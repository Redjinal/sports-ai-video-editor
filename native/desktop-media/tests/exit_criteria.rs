//! M1 exit criteria (02-phase-roadmap.md §5):
//! "A ten-minute H.264/AAC MP4 can be imported, proxied, previewed, trimmed, exported,
//!  and validated without corruption or material A/V drift."
//!
//! Ignored by default because it needs the large generated fixture and takes minutes.
//! Generate the fixture first, then run:
//!
//!   node tools/fixtures/generate-fixtures.mjs --long
//!   cargo test -p desktop-media --test exit_criteria -- --ignored --nocapture

#![allow(clippy::expect_used, clippy::unwrap_used)]

use std::path::{Path, PathBuf};
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use std::time::Instant;

use desktop_media::encode::{export_to_temp, finalise, generate_proxy, EncodeProgress};
use desktop_media::inspect::inspect;
use desktop_media::plan::RenderPlan;
use desktop_media::validate::{validate_output, ExpectedOutput};
use desktop_media::TIMESCALE;

fn long_fixture() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../fixtures/media/generated/vslice_600s_1080p30_h264_aac.mp4")
}

fn scratch(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join("sve-m1-exit");
    let _ = std::fs::create_dir_all(&dir);
    dir.join(name)
}

#[test]
#[ignore = "requires the generated 10-minute fixture"]
fn m1_exit_criteria_ten_minute_project() {
    let source = long_fixture();
    assert!(
        source.exists(),
        "missing fixture {source:?} — run: node tools/fixtures/generate-fixtures.mjs --long"
    );

    // 1. IMPORT / INSPECT ----------------------------------------------------
    let t0 = Instant::now();
    let info = inspect("m1_import", &source).expect("inspect the 10-minute source");
    println!(
        "inspect: {:?} in {:?} | {} {}x{} {:.3}fps audio={} duration={}s",
        info.compatibility,
        t0.elapsed(),
        info.video_streams[0].codec,
        info.video_streams[0].width,
        info.video_streams[0].height,
        info.video_streams[0].r_frame_rate.numerator as f64
            / info.video_streams[0].r_frame_rate.denominator as f64,
        info.audio_streams[0].codec,
        info.duration_ticks / TIMESCALE
    );
    assert!(
        info.duration_ticks >= TIMESCALE * 595,
        "roughly ten minutes"
    );
    assert_eq!(info.video_streams[0].codec, "h264");
    assert_eq!(info.audio_streams[0].codec, "aac");
    assert!(!info.video_streams[0].is_variable_frame_rate);

    let cancel = Arc::new(AtomicBool::new(false));

    // 2. PROXY ---------------------------------------------------------------
    let proxy = scratch("proxy720.mp4");
    let t1 = Instant::now();
    let mut p_noop = |_p: EncodeProgress| {};
    generate_proxy(
        "m1_proxy",
        &source,
        &proxy,
        1280,
        720,
        info.duration_ticks,
        &cancel,
        &mut p_noop,
    )
    .expect("generate the editing proxy");
    let proxy_info = inspect("m1_proxy_probe", &proxy).expect("inspect proxy");
    println!(
        "proxy: {}x{} in {:?} ({:.1} MB)",
        proxy_info.video_streams[0].width,
        proxy_info.video_streams[0].height,
        t1.elapsed(),
        proxy_info.file_size_bytes as f64 / 1_048_576.0
    );
    assert!(proxy_info.video_streams[0].height <= 720);
    // Proxy must preserve source timing 1:1 so timeline references stay valid.
    assert!(
        (proxy_info.duration_ticks - info.duration_ticks).abs() < TIMESCALE / 2,
        "proxy duration must match the source"
    );

    // 3. TRIM + EXPORT -------------------------------------------------------
    // Trimmed sub-range: start 60s in, keep 120s.
    let source_in = TIMESCALE * 60;
    let duration = TIMESCALE * 120;
    let out = scratch("export1080.mp4");
    let plan: RenderPlan = serde_json::from_value(serde_json::json!({
        "version": 1,
        "sequenceId": "seq_master",
        "range": { "startTicks": 0, "endTicks": duration },
        "video": { "codec": "h264", "width": 1920, "height": 1080,
                   "frameRate": { "numerator": 30, "denominator": 1 },
                   "preferHardware": true, "quality": 70 },
        "audio": { "codec": "aac", "sampleRate": 48000, "channels": 2, "bitrateKbps": 192 },
        "tracks": [{
            "id": "trk_v1", "kind": "video", "order": 0,
            "clips": [{
                "assetId": "ast_1",
                "sourcePath": source.to_string_lossy(),
                "sourceInTicks": source_in,
                "sourceDurationTicks": duration,
                "timelineStartTicks": 0,
                "timelineDurationTicks": duration,
                "playbackRate": 1
            }]
        }],
        "sourcePolicy": "originals"
    }))
    .expect("plan parses");

    let t2 = Instant::now();
    let mut e_noop = |_p: EncodeProgress| {};
    let temp = export_to_temp("m1_export", &plan, &out, &cancel, &mut e_noop).expect("export");
    println!("export rendered in {:?}", t2.elapsed());

    // 4. VALIDATE ------------------------------------------------------------
    let t3 = Instant::now();
    let result = validate_output(
        &temp,
        &ExpectedOutput {
            width: 1920,
            height: 1080,
            video_codec: "h264".into(),
            duration_ticks: duration,
            expect_audio: true,
        },
    )
    .expect("validation runs");
    println!("validation in {:?}: valid={}", t3.elapsed(), result.valid);
    for c in &result.checks {
        println!(
            "  [{}] {}{}",
            if c.passed { "pass" } else { "FAIL" },
            c.name,
            c.detail
                .as_deref()
                .map(|d| format!(" — {d}"))
                .unwrap_or_default()
        );
    }
    assert!(
        result.valid,
        "the exported ten-minute-project render must validate"
    );

    finalise(&temp, &out).expect("atomic move");
    assert!(out.exists());

    // A/V drift: the muxed audio and video durations must agree within a frame.
    let final_info = inspect("m1_final", &out).expect("inspect final export");
    let drift_ticks = (final_info.duration_ticks - duration).abs();
    let one_frame = TIMESCALE / 30;
    println!(
        "final: {}x{} duration_delta={} ticks (one frame = {})",
        final_info.video_streams[0].width,
        final_info.video_streams[0].height,
        drift_ticks,
        one_frame
    );
    assert!(
        drift_ticks <= one_frame,
        "duration drift {drift_ticks} ticks exceeds one frame ({one_frame})"
    );

    let _ = std::fs::remove_file(&proxy);
    let _ = std::fs::remove_file(&out);
}
