//! M2 exit criteria (02-phase-roadmap.md §6), driven as one continuous sequence against
//! the shipping storage path:
//!
//! "A project can be created, saved, closed, reopened, recovered, duplicated, and relinked
//!  without losing timeline state."
//!
//! Each step asserts the timeline object is still exactly what the previous step left.

#![allow(clippy::expect_used, clippy::unwrap_used)]

use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use desktop_storage::index::ProjectIndex;
use desktop_storage::media_links::{all_resolved, detect, relink, LinkStatus};
use desktop_storage::project;
use serde_json::{json, Value};

fn unique(tag: &str) -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    std::env::temp_dir().join(format!("sve-m2-exit-{tag}-{nanos}"))
}

fn manifest(name: &str, duration: i64, media_path: &str) -> Value {
    json!({
        "schemaVersion": 1,
        "projectId": "prj_exit",
        "name": name,
        "createdAt": "2026-07-22T00:00:00.000Z",
        "updatedAt": "2026-07-22T00:00:00.000Z",
        "projectType": "general",
        "platformCreatedOn": "windows",
        "settings": {},
        "assets": [{
            "id": "ast_1", "fingerprint": "fp", "kind": "video",
            "path": media_path, "status": "online", "durationTicks": duration
        }],
        "sequences": [{
            "id": "seq_master", "name": "Master",
            "settings": {
                "width": 1920, "height": 1080,
                "pixelAspectRatio": { "numerator": 1, "denominator": 1 },
                "frameRate": { "numerator": 30, "denominator": 1 },
                "audioSampleRate": 48000, "background": "#000000",
                "timeDisplayMode": "timecode"
            },
            "tracks": [{
                "id": "trk_v1", "name": "V1", "type": "video", "order": 0, "height": 64,
                "color": "#334155", "locked": false, "hidden": false, "muted": false,
                "solo": false, "editTargeted": true
            }],
            "objects": [{
                "kind": "clip", "id": "clp_1", "trackId": "trk_v1",
                "startTicks": 0, "durationTicks": duration, "enabled": true,
                "assetId": "ast_1", "sourceInTicks": 0,
                "sourceDurationTicks": duration, "playbackRate": 1
            }],
            "markers": [], "parentSequenceIds": []
        }],
        "basketballContexts": [], "brandKits": [], "templates": [], "proposalSets": [],
        "activeMasterSequenceId": "seq_master",
        "compatibility": { "minimumReaderVersion": "0.1.0" }
    })
}

fn timeline_state(m: &Value) -> (i64, i64, String) {
    let obj = &m["sequences"][0]["objects"][0];
    (
        obj["durationTicks"].as_i64().expect("duration"),
        obj["startTicks"].as_i64().expect("start"),
        obj["id"].as_str().expect("id").to_string(),
    )
}

#[test]
fn m2_exit_criteria_full_project_lifecycle() {
    let root = unique("root");
    fs::create_dir_all(&root).expect("root");
    let media = root.join("game.mp4");
    fs::write(&media, b"pretend media").expect("media");

    let dir = root.join("project");
    let edited_duration = 40_500_000; // 1.5s at 27,000,000 ticks/s

    // 1. CREATE -------------------------------------------------------------
    let initial = manifest("Home vs Away", 54_000_000, &media.to_string_lossy());
    project::create(&dir, &initial).expect("create");
    let expected = timeline_state(&initial);
    println!("created: {expected:?}");

    // 2. SAVE an edit --------------------------------------------------------
    let edited = manifest("Home vs Away", edited_duration, &media.to_string_lossy());
    project::save(&dir, &edited).expect("save");

    // 3. CLOSE + REOPEN ------------------------------------------------------
    // Closing is just dropping in-memory state; reopening must read back the same edit.
    let reopened = project::open(&dir).expect("reopen");
    assert_eq!(
        timeline_state(&reopened),
        timeline_state(&edited),
        "reopen must preserve timeline state"
    );
    assert_eq!(timeline_state(&reopened).0, edited_duration);

    // 4. RECOVER -------------------------------------------------------------
    // The save above rotated the pre-edit version into a recovery snapshot.
    let snaps = project::list_recovery_snapshots(&dir).expect("snapshots");
    assert!(!snaps.is_empty(), "a save must leave a recovery snapshot");
    let recovered_dir = unique("recovered");
    project::recover_as_copy(&dir, &snaps[0].file_name, &recovered_dir).expect("recover");
    let recovered = project::open(&recovered_dir).expect("recovered opens");
    assert_eq!(
        timeline_state(&recovered).0,
        54_000_000,
        "recovery restores the pre-edit timeline"
    );
    assert_eq!(
        timeline_state(&project::open(&dir).expect("original")).0,
        edited_duration,
        "recovery must not disturb the live project"
    );

    // 5. DUPLICATE -----------------------------------------------------------
    let copy_dir = unique("copy");
    project::duplicate(&dir, &copy_dir).expect("duplicate");
    let copy = project::open(&copy_dir).expect("copy opens");
    assert_eq!(
        timeline_state(&copy),
        timeline_state(&reopened),
        "duplicate must preserve timeline state"
    );

    // 6. RELINK --------------------------------------------------------------
    // Move the media so the project goes offline, then relink it.
    let moved = root.join("game-moved.mp4");
    fs::rename(&media, &moved).expect("move media");

    let offline_manifest = project::open(&dir).expect("open");
    let links = detect(&offline_manifest);
    assert_eq!(
        links[0].status,
        LinkStatus::Offline,
        "media must read offline"
    );
    assert!(!all_resolved(&links));

    let relinked = relink(&offline_manifest, "ast_1", &moved.to_string_lossy()).expect("relink");
    project::save(&dir, &relinked).expect("save after relink");

    let after = project::open(&dir).expect("reopen after relink");
    let links = detect(&after);
    assert_eq!(
        links[0].status,
        LinkStatus::Online,
        "media must be back online"
    );
    assert!(all_resolved(&links));
    assert_eq!(
        timeline_state(&after).0,
        edited_duration,
        "relinking must not disturb timeline state"
    );

    // 7. INDEX ---------------------------------------------------------------
    // The recent list is derived; losing it must not affect any of the above.
    let idx = ProjectIndex::in_memory().expect("index");
    idx.upsert(
        "prj_exit",
        "Home vs Away",
        &dir.to_string_lossy(),
        "general",
        "2026-07-22T00:00:00.000Z",
        1,
    )
    .expect("upsert");
    assert_eq!(idx.recent(10).expect("recent").len(), 1);
    idx.clear().expect("clear");
    assert!(
        project::open(&dir).is_ok(),
        "the project must survive total index loss"
    );

    println!(
        "M2 exit criteria: create -> save -> close -> reopen -> recover -> duplicate -> relink OK"
    );

    fs::remove_dir_all(&root).ok();
    fs::remove_dir_all(&recovered_dir).ok();
    fs::remove_dir_all(&copy_dir).ok();
}
