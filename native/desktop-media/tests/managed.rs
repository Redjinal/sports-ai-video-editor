//! Managed conversion against the committed fixture. Requires ffmpeg/ffprobe on PATH.

#![allow(clippy::expect_used, clippy::unwrap_used)]

use std::path::{Path, PathBuf};
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use desktop_media::inspect::inspect;
use desktop_media::managed::convert;

fn fixture() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../../fixtures/media/sync8s_1080p30_h264_aac.mp4")
}

fn scratch(name: &str) -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let dir = std::env::temp_dir().join(format!("sve-managed-{nanos}"));
    let _ = std::fs::create_dir_all(&dir);
    dir.join(name)
}

fn ff() -> bool {
    desktop_media::ffbin::probe_availability().is_ok()
}

#[test]
fn produces_a_validated_certified_derivative() {
    if !ff() {
        eprintln!("skipping: ffmpeg not available");
        return;
    }
    let out = scratch("managed.mp4");
    let cancel = Arc::new(AtomicBool::new(false));
    let result = convert("job_managed", &fixture(), &out, &cancel).expect("managed conversion");

    assert!(out.exists());
    assert!(!scratch("managed.mp4")
        .with_file_name(".managed.managed.part.mp4")
        .exists());
    assert_eq!(result.managed_video_codec.as_deref(), Some("h264"));
    assert!(result.duration_ticks > 0);

    // The derivative really is a certified H.264/AAC file, preserving resolution.
    let info = inspect("check", &out).expect("inspect managed");
    assert_eq!(info.video_streams[0].codec, "h264");
    assert_eq!(
        (info.video_streams[0].width, info.video_streams[0].height),
        (1920, 1080)
    );
    assert_eq!(info.audio_streams[0].codec, "aac");
    let _ = std::fs::remove_file(&out);
}

#[test]
fn a_missing_source_is_rejected() {
    if !ff() {
        return;
    }
    let cancel = Arc::new(AtomicBool::new(false));
    assert!(convert("j", Path::new("nope.mp4"), &scratch("x.mp4"), &cancel).is_err());
}
