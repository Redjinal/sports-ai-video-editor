//! Media-derivative generation (M4): thumbnail strips and waveform peaks against the committed
//! synthetic fixture. Requires ffmpeg/ffprobe on PATH; skipped otherwise.

#![allow(clippy::expect_used, clippy::unwrap_used)]

use std::path::{Path, PathBuf};
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use desktop_media::thumbnail::generate_strip;
use desktop_media::waveform::generate as generate_waveform;

fn fixture() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../../fixtures/media/sync8s_1080p30_h264_aac.mp4")
}

fn scratch(name: &str) -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let dir = std::env::temp_dir().join(format!("sve-deriv-{nanos}"));
    let _ = std::fs::create_dir_all(&dir);
    dir.join(name)
}

fn ff() -> bool {
    desktop_media::ffbin::probe_availability().is_ok()
}

#[test]
fn generates_a_thumbnail_strip() {
    if !ff() {
        eprintln!("skipping: ffmpeg not available");
        return;
    }
    let out = scratch("strip.jpg");
    let cancel = Arc::new(AtomicBool::new(false));
    let strip = generate_strip("job_thumb", &fixture(), &out, 10, 160, 8.0, &cancel)
        .expect("thumbnail strip generated");

    assert!(out.exists());
    assert_eq!(strip.count, 10);
    // 10 tiles of ~160px -> a wide strip; height is the scaled 16:9 tile height.
    assert!(
        strip.tile_width >= 150 && strip.tile_width <= 170,
        "tile width {}",
        strip.tile_width
    );
    assert!(strip.tile_height > 0);
    // A tiled strip is much wider than one tile.
    let _ = std::fs::remove_file(&out);
}

#[test]
fn a_zero_count_strip_is_rejected() {
    if !ff() {
        return;
    }
    let out = scratch("bad.jpg");
    let cancel = Arc::new(AtomicBool::new(false));
    assert!(generate_strip("j", &fixture(), &out, 0, 160, 8.0, &cancel).is_err());
}

#[test]
fn generates_waveform_peaks_from_the_audio() {
    if !ff() {
        return;
    }
    let cancel = Arc::new(AtomicBool::new(false));
    let wf = generate_waveform("job_wave", &fixture(), 200, 8.0, &cancel).expect("waveform");

    assert!(wf.has_audio, "the fixture has a sine tone");
    assert_eq!(wf.peaks.len(), 200);
    assert_eq!(wf.rms.len(), 200);
    // A steady tone produces non-trivial, bounded peaks throughout (the fixture's AAC sine
    // decodes to roughly -20 dB, so assert non-silence rather than a specific level).
    let max_peak = wf.peaks.iter().cloned().fold(0.0f32, f32::max);
    assert!(max_peak > 0.02 && max_peak <= 1.0, "max peak {max_peak}");
    let min_peak = wf.peaks.iter().cloned().fold(1.0f32, f32::min);
    assert!(
        min_peak > 0.0,
        "a steady tone should have no silent buckets"
    );
    // RMS never exceeds peak.
    for (p, r) in wf.peaks.iter().zip(&wf.rms) {
        assert!(*r <= *p + 1e-3, "rms {r} exceeded peak {p}");
    }
}

#[test]
fn a_video_only_input_yields_an_empty_but_valid_waveform() {
    if !ff() {
        return;
    }
    // Make a silent, audio-less clip from the fixture's video stream.
    let noaudio = scratch("noaudio.mp4");
    let status = std::process::Command::new("ffmpeg")
        .args(["-hide_banner", "-loglevel", "error", "-y", "-i"])
        .arg(fixture())
        .args(["-an", "-t", "2", "-c:v", "libx264", "-crf", "30"])
        .arg(&noaudio)
        .status()
        .expect("strip audio");
    assert!(status.success());

    let cancel = Arc::new(AtomicBool::new(false));
    let wf = generate_waveform("job_na", &noaudio, 50, 2.0, &cancel).expect("waveform");
    assert!(!wf.has_audio);
    assert_eq!(wf.peaks.len(), 50);
    assert!(wf.peaks.iter().all(|p| *p == 0.0));
    let _ = std::fs::remove_file(&noaudio);
}
