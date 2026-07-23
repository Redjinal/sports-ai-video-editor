//! M4 exit criteria (02-phase-roadmap.md §8):
//! "A 120-minute 2K asset can be inspected, ingested, proxied, reopened, and relinked without
//!  losing the original reference."
//!
//! Proven here at 2K (2560×1440) on a short clip so the pipeline mechanics run without a
//! two-hour encode; the full 120-minute run is a release-tier (F5) fixture (ISSUE-009). The
//! steps are resolution- and duration-independent. #[ignore] because it needs ffmpeg and does a
//! real 2K encode.
//!
//! Run: cargo test -p desktop-media --test m4_exit_criteria -- --ignored --nocapture

#![allow(clippy::expect_used, clippy::unwrap_used)]

use std::path::PathBuf;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use desktop_media::encode::generate_proxy;
use desktop_media::inspect::inspect;
use desktop_storage::media_links::{detect, relink, LinkStatus};
use desktop_storage::project;
use serde_json::{json, Value};

const TIMESCALE: i64 = 27_000_000;

fn scratch(tag: &str) -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let dir = std::env::temp_dir().join(format!("sve-m4-exit-{tag}-{nanos}"));
    std::fs::create_dir_all(&dir).unwrap();
    dir
}

/// Encode a 2K (2560×1440) H.264/AAC clip of `seconds` to `out`.
fn make_2k(out: &std::path::Path, seconds: u32) {
    let status = std::process::Command::new("ffmpeg")
        .args([
            "-hide_banner",
            "-loglevel",
            "error",
            "-y",
            "-f",
            "lavfi",
            "-i",
            &format!("testsrc2=size=2560x1440:rate=30:duration={seconds}"),
            "-f",
            "lavfi",
            "-i",
            &format!("sine=frequency=440:sample_rate=48000:duration={seconds}"),
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-pix_fmt",
            "yuv420p",
            "-crf",
            "26",
            "-c:a",
            "aac",
            "-b:a",
            "160k",
            "-movflags",
            "+faststart",
        ])
        .arg(out)
        .status()
        .expect("ffmpeg 2k encode");
    assert!(status.success(), "2K fixture encode failed");
}

fn manifest_with_asset(asset_id: &str, path: &str, duration_ticks: i64) -> Value {
    json!({
        "schemaVersion": 1, "projectId": "prj_m4", "name": "2K project",
        "createdAt": "2026-07-22T00:00:00.000Z", "updatedAt": "2026-07-22T00:00:00.000Z",
        "projectType": "general", "platformCreatedOn": "windows",
        "settings": {},
        "assets": [{
            "id": asset_id, "fingerprint": "fp2k", "kind": "video",
            "path": path, "status": "online", "durationTicks": duration_ticks
        }],
        "sequences": [], "basketballContexts": [], "brandKits": [], "templates": [],
        "proposalSets": [], "activeMasterSequenceId": null,
        "compatibility": { "minimumReaderVersion": "0.1.0" }
    })
}

#[test]
#[ignore = "2K encode; run explicitly"]
fn m4_exit_criteria_2k_asset_lifecycle() {
    if desktop_media::ffbin::probe_availability().is_err() {
        eprintln!("skipping: ffmpeg unavailable");
        return;
    }
    let root = scratch("root");
    let original = root.join("game_2k.mp4");
    make_2k(&original, 20);

    // 1. INSPECT — a real 2K certified asset.
    let info = inspect("m4", &original).expect("inspect 2k");
    assert_eq!(
        (info.video_streams[0].width, info.video_streams[0].height),
        (2560, 1440)
    );
    assert_eq!(info.video_streams[0].codec, "h264");
    assert!(matches!(
        info.compatibility,
        desktop_media::inspect::CompatibilityTier::Certified
    ));
    let duration = info.duration_ticks;
    assert!(duration >= TIMESCALE * 19);

    // 2. INGEST — record the asset in a saved project.
    let dir = root.join("project");
    let asset_id = format!("ast_{}", &info.asset_fingerprint[..12]);
    project::create(
        &dir,
        &manifest_with_asset(&asset_id, &original.to_string_lossy(), duration),
    )
    .expect("create project");

    // 3. PROXY — a 720p editing proxy of the 2K original.
    let proxy = dir.join("proxies").join("game_2k.proxy720.mp4");
    let cancel = Arc::new(AtomicBool::new(false));
    let mut noop = |_p: desktop_media::encode::EncodeProgress| {};
    generate_proxy(
        "m4_proxy", &original, &proxy, 1280, 720, duration, &cancel, &mut noop,
    )
    .expect("generate 720p proxy");
    let proxy_info = inspect("m4_proxy", &proxy).expect("inspect proxy");
    assert!(proxy_info.video_streams[0].height <= 720);
    // The 2K original is untouched by proxying.
    let still_2k = inspect("m4_recheck", &original).expect("re-inspect original");
    assert_eq!(
        (
            still_2k.video_streams[0].width,
            still_2k.video_streams[0].height
        ),
        (2560, 1440)
    );

    // 4. REOPEN — the asset survives save/reopen with its original reference intact.
    let reopened = project::open(&dir).expect("reopen");
    let asset = &reopened["assets"][0];
    assert_eq!(asset["path"].as_str().unwrap(), original.to_string_lossy());
    assert_eq!(detect(&reopened)[0].status, LinkStatus::Online);

    // 5. RELINK — move the original, confirm it reads offline, relink to the new location, and
    //    verify the original reference is preserved (pointed at the moved file, never deleted).
    let moved = root.join("archive").join("game_2k.mp4");
    std::fs::create_dir_all(moved.parent().unwrap()).unwrap();
    std::fs::rename(&original, &moved).expect("move original");

    let offline = project::open(&dir).expect("open");
    assert_eq!(detect(&offline)[0].status, LinkStatus::Offline);

    let relinked = relink(&offline, &asset_id, &moved.to_string_lossy()).expect("relink");
    project::save(&dir, &relinked).expect("save after relink");

    let after = project::open(&dir).expect("reopen after relink");
    assert_eq!(detect(&after)[0].status, LinkStatus::Online);
    assert_eq!(
        after["assets"][0]["path"].as_str().unwrap(),
        moved.to_string_lossy()
    );
    // The moved original still exists — the reference was preserved, not lost.
    assert!(moved.exists());

    println!("M4 exit criteria: 2K inspect -> ingest -> proxy -> reopen -> relink OK");
    std::fs::remove_dir_all(&root).ok();
}
