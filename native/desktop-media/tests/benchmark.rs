//! M1 architecture spike (02-phase-roadmap.md §5, ISSUE-002, DEC-ARCH-003).
//!
//! Measures what the roadmap asks of the Rust orchestration layer: process management,
//! metadata throughput, cancellation latency, IPC payload overhead, and crash isolation.
//! Numbers are indicative only — reference hardware is not yet named (ISSUE-004), so the
//! environment must be recorded alongside any result.
//!
//! Run: cargo test -p desktop-media --test benchmark -- --ignored --nocapture

#![allow(clippy::expect_used, clippy::unwrap_used)]

use std::path::{Path, PathBuf};
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use std::time::{Duration, Instant};

use desktop_media::encode::{export_to_temp, EncodeProgress};
use desktop_media::error::MediaErrorCode;
use desktop_media::inspect::inspect;
use desktop_media::plan::RenderPlan;
use desktop_media::TIMESCALE;

fn fixture() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../../fixtures/media/sync8s_1080p30_h264_aac.mp4")
}

fn available() -> bool {
    desktop_media::ffbin::probe_availability().is_ok()
}

fn plan_for(source: &Path, duration: i64) -> RenderPlan {
    serde_json::from_value(serde_json::json!({
        "version": 1,
        "sequenceId": "seq_bench",
        "range": { "startTicks": 0, "endTicks": duration },
        "video": { "codec": "h264", "width": 1920, "height": 1080,
                   "frameRate": { "numerator": 30, "denominator": 1 },
                   "preferHardware": true, "quality": 70 },
        "audio": { "codec": "aac", "sampleRate": 48000, "channels": 2, "bitrateKbps": 192 },
        "tracks": [{
            "id": "t", "kind": "video", "order": 0,
            "clips": [{
                "assetId": "a", "sourcePath": source.to_string_lossy(),
                "sourceInTicks": 0, "sourceDurationTicks": duration,
                "timelineStartTicks": 0, "timelineDurationTicks": duration,
                "playbackRate": 1
            }]
        }],
        "sourcePolicy": "originals"
    }))
    .expect("plan parses")
}

#[test]
#[ignore = "benchmark; run explicitly"]
fn rust_orchestration_benchmark() {
    if !available() {
        println!("SKIPPED: ffmpeg/ffprobe unavailable");
        return;
    }
    println!("=== M1 Rust orchestration benchmark ===");
    println!(
        "os: {} arch: {}",
        std::env::consts::OS,
        std::env::consts::ARCH
    );
    println!(
        "cpus: {}",
        std::thread::available_parallelism()
            .map(|n| n.get())
            .unwrap_or(0)
    );

    // --- 1. Metadata throughput (process spawn + parse per inspect) ---------
    let n = 20;
    let t = Instant::now();
    for _ in 0..n {
        let _ = inspect("bench", &fixture()).expect("inspect");
    }
    let per = t.elapsed() / n;
    println!(
        "metadata throughput: {n} inspects in {:?} => {:?}/inspect ({:.1}/s)",
        t.elapsed(),
        per,
        1.0 / per.as_secs_f64()
    );

    // --- 2. Cancellation latency -------------------------------------------
    // Start a long render, cancel it after a short delay, measure time to unwind.
    let cancel = Arc::new(AtomicBool::new(false));
    let flag = Arc::clone(&cancel);
    let handle = std::thread::spawn(move || {
        std::thread::sleep(Duration::from_millis(400));
        let marked = Instant::now();
        flag.store(true, std::sync::atomic::Ordering::Relaxed);
        marked
    });

    let out = std::env::temp_dir().join("sve-bench-cancel.mp4");
    let plan = plan_for(&fixture(), TIMESCALE * 8);
    let mut noop = |_p: EncodeProgress| {};
    let started = Instant::now();
    let result = export_to_temp("bench_cancel", &plan, &out, &cancel, &mut noop);
    let ended = Instant::now();
    let marked_at = handle.join().expect("cancel thread");

    match result {
        Err(e) if e.code == MediaErrorCode::ExportCancelled => {
            println!(
                "cancellation latency: {:?} (total run {:?})",
                ended.duration_since(marked_at),
                ended.duration_since(started)
            );
        }
        Err(e) => println!("cancellation: unexpected error {:?}", e.code),
        Ok(_) => println!("cancellation: render finished before the flag was observed"),
    }
    assert!(!out.exists(), "cancelled render must leave no final file");

    // --- 3. IPC payload overhead -------------------------------------------
    // The UI boundary is JSON; measure serialise+parse of a realistic inspect payload.
    let info = inspect("bench", &fixture()).expect("inspect");
    let iterations = 1000;
    let t = Instant::now();
    let mut bytes = 0usize;
    for _ in 0..iterations {
        let json = serde_json::to_string(&info).expect("serialise");
        bytes = json.len();
        let _: serde_json::Value = serde_json::from_str(&json).expect("parse");
    }
    println!(
        "ipc payload: {bytes} bytes; {iterations} serialise+parse round trips in {:?} => {:?} each",
        t.elapsed(),
        t.elapsed() / iterations
    );

    // --- 4. Crash isolation -------------------------------------------------
    // A failing child process must surface as a structured error, never take down the host.
    let bad = Path::new("definitely-not-a-media-file.mp4");
    let err = inspect("bench_bad", bad).expect_err("missing file must error");
    println!(
        "crash isolation: missing input -> {:?} (host process alive, data_safe={})",
        err.code, err.data_safe
    );
    assert!(err.data_safe);

    println!("=== end benchmark ===");
}
