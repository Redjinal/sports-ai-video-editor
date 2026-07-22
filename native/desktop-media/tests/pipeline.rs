//! End-to-end media pipeline against the committed synthetic fixture:
//! inspect -> proxy -> trimmed export -> output validation, plus the negative cases that
//! make validation meaningful (a truncated render must FAIL, cancellation must clean up).
//!
//! Requires ffmpeg/ffprobe on PATH; skipped automatically when unavailable.

// Tests assert on happy paths directly; panicking on a broken invariant is the point.
#![allow(clippy::expect_used, clippy::unwrap_used)]

use std::path::{Path, PathBuf};
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use desktop_media::encode::{discard, export_to_temp, finalise, generate_proxy, EncodeProgress};
use desktop_media::error::MediaErrorCode;
use desktop_media::inspect::inspect;
use desktop_media::plan::RenderPlan;
use desktop_media::validate::{validate_output, ExpectedOutput};
use desktop_media::TIMESCALE;

fn fixture() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../../fixtures/media/sync8s_1080p30_h264_aac.mp4")
}

fn ffmpeg_available() -> bool {
    desktop_media::ffbin::probe_availability().is_ok()
}

fn scratch(name: &str) -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let dir = std::env::temp_dir().join(format!("sve-media-{nanos}"));
    let _ = std::fs::create_dir_all(&dir);
    dir.join(name)
}

fn noop_progress() -> impl FnMut(EncodeProgress) {
    |_p: EncodeProgress| {}
}

fn plan_json(source: &Path, duration_ticks: i64, width: u32, height: u32) -> RenderPlan {
    let json = serde_json::json!({
        "version": 1,
        "sequenceId": "seq_master",
        "range": { "startTicks": 0, "endTicks": duration_ticks },
        "video": {
            "codec": "h264", "width": width, "height": height,
            "frameRate": { "numerator": 30, "denominator": 1 },
            "preferHardware": true, "quality": 70
        },
        "audio": { "codec": "aac", "sampleRate": 48000, "channels": 2, "bitrateKbps": 192 },
        "tracks": [{
            "id": "trk_v1", "kind": "video", "order": 0,
            "clips": [{
                "assetId": "ast_1",
                "sourcePath": source.to_string_lossy(),
                // Trimmed: start 1s into the source, keep `duration_ticks`.
                "sourceInTicks": TIMESCALE,
                "sourceDurationTicks": duration_ticks,
                "timelineStartTicks": 0,
                "timelineDurationTicks": duration_ticks,
                "playbackRate": 1
            }]
        }],
        "sourcePolicy": "originals"
    });
    serde_json::from_value(json).expect("render plan deserialises")
}

#[test]
fn inspects_the_certified_fixture() {
    if !ffmpeg_available() {
        eprintln!("skipping: ffmpeg/ffprobe not available");
        return;
    }
    let info = inspect("req_1", &fixture()).expect("inspect succeeds");
    assert!(
        info.container.contains("mp4"),
        "container was {}",
        info.container
    );
    assert_eq!(info.video_streams.len(), 1);
    let v = &info.video_streams[0];
    assert_eq!(v.codec, "h264");
    assert_eq!((v.width, v.height), (1920, 1080));
    assert!(!v.is_variable_frame_rate, "fixture is CFR");
    assert_eq!(info.audio_streams[0].codec, "aac");
    assert_eq!(info.audio_streams[0].sample_rate, 48_000);
    // ~8s within one frame at 30fps.
    assert!((info.duration_ticks - TIMESCALE * 8).abs() < 900_000);
    assert!(!info.asset_fingerprint.is_empty());
}

#[test]
fn generates_a_720p_proxy() {
    if !ffmpeg_available() {
        eprintln!("skipping: ffmpeg/ffprobe not available");
        return;
    }
    let out = scratch("proxy.mp4");
    let cancel = Arc::new(AtomicBool::new(false));
    let mut progress = noop_progress();
    generate_proxy(
        "job_proxy",
        &fixture(),
        &out,
        1280,
        720,
        TIMESCALE * 8,
        &cancel,
        &mut progress,
    )
    .expect("proxy generation succeeds");

    assert!(out.exists());
    let info = inspect("req_proxy", &out).expect("proxy inspects");
    let v = &info.video_streams[0];
    assert!(v.height <= 720, "proxy height was {}", v.height);
    assert_eq!(v.codec, "h264");
    // Proxy must preserve the source duration so timeline mapping stays 1:1.
    assert!((info.duration_ticks - TIMESCALE * 8).abs() < TIMESCALE / 2);
    let _ = std::fs::remove_file(&out);
}

#[test]
fn exports_a_trimmed_clip_and_validation_passes() {
    if !ffmpeg_available() {
        eprintln!("skipping: ffmpeg/ffprobe not available");
        return;
    }
    let duration = TIMESCALE * 3;
    let final_out = scratch("export.mp4");
    let plan = plan_json(&fixture(), duration, 1280, 720);
    let cancel = Arc::new(AtomicBool::new(false));
    let mut progress = noop_progress();

    let temp = export_to_temp("job_export", &plan, &final_out, &cancel, &mut progress)
        .expect("export renders to temp");
    assert!(temp.exists(), "temp render exists before validation");
    assert!(
        !final_out.exists(),
        "final file must not appear before validation"
    );

    let expected = ExpectedOutput {
        width: 1280,
        height: 720,
        video_codec: "h264".into(),
        duration_ticks: duration,
        expect_audio: true,
    };
    let result = validate_output(&temp, &expected).expect("validation runs");
    assert!(
        result.valid,
        "validation should pass, failing checks: {:?}",
        result
            .checks
            .iter()
            .filter(|c| c.required && !c.passed)
            .collect::<Vec<_>>()
    );
    assert_eq!((result.measured.width, result.measured.height), (1280, 720));
    assert_eq!(result.measured.video_codec.as_deref(), Some("h264"));
    assert_eq!(result.measured.audio_codec.as_deref(), Some("aac"));

    finalise(&temp, &final_out).expect("atomic move succeeds");
    assert!(final_out.exists() && !temp.exists());
    let _ = std::fs::remove_file(&final_out);
}

#[test]
fn a_truncated_render_fails_validation() {
    if !ffmpeg_available() {
        eprintln!("skipping: ffmpeg/ffprobe not available");
        return;
    }
    let duration = TIMESCALE * 3;
    let final_out = scratch("truncated.mp4");
    let plan = plan_json(&fixture(), duration, 1280, 720);
    let cancel = Arc::new(AtomicBool::new(false));
    let mut progress = noop_progress();
    let temp = export_to_temp("job_trunc", &plan, &final_out, &cancel, &mut progress)
        .expect("export renders");

    // Corrupt the render: keep only the first 40% of the bytes.
    let bytes = std::fs::read(&temp).expect("read render");
    std::fs::write(&temp, &bytes[..bytes.len() * 2 / 5]).expect("truncate render");

    let expected = ExpectedOutput {
        width: 1280,
        height: 720,
        video_codec: "h264".into(),
        duration_ticks: duration,
        expect_audio: true,
    };
    let result = validate_output(&temp, &expected).expect("validation runs");
    assert!(
        !result.valid,
        "a truncated render must be reported invalid; checks: {:?}",
        result.checks
    );

    // A rejected render is discarded, never promoted to the final destination.
    discard(&temp);
    assert!(!temp.exists());
    assert!(!final_out.exists());
}

#[test]
fn cancellation_stops_the_export_and_leaves_no_partial_file() {
    if !ffmpeg_available() {
        eprintln!("skipping: ffmpeg/ffprobe not available");
        return;
    }
    let final_out = scratch("cancelled.mp4");
    // Full-length 1080p render gives the cancel flag time to be observed.
    let plan = plan_json(&fixture(), TIMESCALE * 7, 1920, 1080);
    let cancel = Arc::new(AtomicBool::new(true)); // already cancelled
    let mut progress = noop_progress();

    let err = export_to_temp("job_cancel", &plan, &final_out, &cancel, &mut progress)
        .expect_err("cancelled export must return an error");
    assert_eq!(err.code, MediaErrorCode::ExportCancelled);
    assert!(err.data_safe, "cancellation must not endanger user data");
    assert!(!final_out.exists(), "no final file after cancellation");
}
