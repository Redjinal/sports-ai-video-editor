//! M2 exit criteria (02-phase-roadmap.md §6):
//! "A project can be created, saved, closed, reopened, recovered, duplicated, and relinked
//!  without losing timeline state."
//!
//! Gate B evidence: save/reopen fidelity, atomic-failure safety, recovery, relinking.

#![allow(clippy::expect_used, clippy::unwrap_used)]

use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use desktop_storage::error::StorageErrorCode;
use desktop_storage::index::ProjectIndex;
use desktop_storage::media_links::{all_resolved, detect, relink, LinkStatus};
use desktop_storage::project;
use serde_json::{json, Value};

fn scratch(tag: &str) -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    let dir = std::env::temp_dir().join(format!("sve-m2-{tag}-{nanos}"));
    fs::create_dir_all(&dir).expect("scratch dir");
    dir
}

/// A manifest carrying real timeline state, so "without losing timeline state" is testable.
fn manifest(name: &str, clip_duration_ticks: i64) -> Value {
    json!({
        "schemaVersion": 1,
        "projectId": "prj_m2",
        "name": name,
        "createdAt": "2026-07-22T00:00:00.000Z",
        "updatedAt": "2026-07-22T00:00:00.000Z",
        "projectType": "general",
        "platformCreatedOn": "windows",
        "settings": {},
        "assets": [],
        "sequences": [{
            "id": "seq_master",
            "name": "Master",
            "settings": {
                "width": 1920, "height": 1080,
                "pixelAspectRatio": { "numerator": 1, "denominator": 1 },
                "frameRate": { "numerator": 30, "denominator": 1 },
                "audioSampleRate": 48000,
                "background": "#000000",
                "timeDisplayMode": "timecode"
            },
            "tracks": [{
                "id": "trk_v1", "name": "V1", "type": "video", "order": 0, "height": 64,
                "color": "#334155", "locked": false, "hidden": false, "muted": false,
                "solo": false, "editTargeted": true
            }],
            "objects": [{
                "kind": "clip", "id": "clp_1", "trackId": "trk_v1",
                "startTicks": 0, "durationTicks": clip_duration_ticks, "enabled": true,
                "assetId": "ast_1", "sourceInTicks": 0,
                "sourceDurationTicks": clip_duration_ticks, "playbackRate": 1
            }],
            "markers": [],
            "parentSequenceIds": []
        }],
        "basketballContexts": [], "brandKits": [], "templates": [], "proposalSets": [],
        "activeMasterSequenceId": "seq_master",
        "compatibility": { "minimumReaderVersion": "0.1.0" }
    })
}

fn clip_duration(m: &Value) -> i64 {
    m["sequences"][0]["objects"][0]["durationTicks"]
        .as_i64()
        .expect("clip duration")
}

#[test]
fn creates_the_documented_folder_layout() {
    let dir = scratch("create");
    project::create(&dir, &manifest("New", 54_000_000)).expect("create");
    assert!(dir.join("project.json").exists());
    assert!(dir.join("operations").is_dir());
    assert!(dir.join("autosaves").is_dir());
    assert!(dir.join("operations/journal.ndjson").exists());
    fs::remove_dir_all(&dir).ok();
}

#[test]
fn refuses_to_create_over_an_existing_project() {
    let dir = scratch("dup-create");
    project::create(&dir, &manifest("A", 1)).expect("create");
    let err = project::create(&dir, &manifest("B", 1)).expect_err("must refuse");
    assert_eq!(err.code, StorageErrorCode::ProjectAlreadyExists);
    fs::remove_dir_all(&dir).ok();
}

#[test]
fn save_and_reopen_preserves_timeline_state() {
    let dir = scratch("roundtrip");
    let original = manifest("Home vs Away", 54_000_000);
    project::create(&dir, &original).expect("create");
    let reopened = project::open(&dir).expect("open");
    assert_eq!(reopened, original, "reopen must not change the project");
    assert_eq!(clip_duration(&reopened), 54_000_000);

    // Edit the timeline, save, reopen.
    let edited = manifest("Home vs Away", 40_500_000);
    project::save(&dir, &edited).expect("save");
    let again = project::open(&dir).expect("reopen");
    assert_eq!(clip_duration(&again), 40_500_000);
    fs::remove_dir_all(&dir).ok();
}

#[test]
fn a_rejected_save_leaves_the_previous_project_intact() {
    let dir = scratch("atomic");
    project::create(&dir, &manifest("good", 54_000_000)).expect("create");

    // Structurally invalid: no projectId. Must be refused before the atomic replace.
    let broken = json!({ "schemaVersion": 1, "projectId": "" });
    let err = project::save(&dir, &broken).expect_err("must reject");
    assert_eq!(err.code, StorageErrorCode::ProjectInvalid);
    assert!(err.data_safe);

    let still_there = project::open(&dir).expect("previous project still opens");
    assert_eq!(still_there["name"], "good");
    assert_eq!(clip_duration(&still_there), 54_000_000);
    fs::remove_dir_all(&dir).ok();
}

#[test]
fn refuses_a_project_from_a_newer_schema() {
    let dir = scratch("newer");
    let mut future = manifest("future", 1);
    future["schemaVersion"] = json!(99);
    project::create(&dir, &future).expect("create");
    let err = project::open(&dir).expect_err("must refuse");
    assert_eq!(err.code, StorageErrorCode::ProjectSchemaTooNew);
    fs::remove_dir_all(&dir).ok();
}

#[test]
fn saves_rotate_recovery_snapshots_and_recover_as_a_copy() {
    let dir = scratch("recover");
    project::create(&dir, &manifest("v1", 54_000_000)).expect("create");
    project::save(&dir, &manifest("v2", 40_500_000)).expect("save v2");
    project::save(&dir, &manifest("v3", 27_000_000)).expect("save v3");

    let snaps = project::list_recovery_snapshots(&dir).expect("snapshots");
    assert!(!snaps.is_empty(), "a save must rotate a recovery snapshot");

    // Recovery restores into a NEW folder; the original is never overwritten.
    let dest = scratch("recover-dest");
    fs::remove_dir_all(&dest).ok();
    let oldest = snaps.last().expect("a snapshot").file_name.clone();
    project::recover_as_copy(&dir, &oldest, &dest).expect("recover");

    let recovered = project::open(&dest).expect("recovered project opens");
    assert!(recovered["sequences"][0]["objects"][0]["durationTicks"].is_i64());
    let current = project::open(&dir).expect("original still opens");
    assert_eq!(
        current["name"], "v3",
        "recovery must not touch the original"
    );

    fs::remove_dir_all(&dir).ok();
    fs::remove_dir_all(&dest).ok();
}

#[test]
fn rejects_a_recovery_snapshot_name_that_escapes_the_folder() {
    let dir = scratch("escape");
    project::create(&dir, &manifest("v1", 1)).expect("create");
    let dest = scratch("escape-dest");
    fs::remove_dir_all(&dest).ok();
    let err = project::recover_as_copy(&dir, "../../evil.json", &dest).expect_err("must reject");
    assert_eq!(err.code, StorageErrorCode::StoragePathRejected);
    fs::remove_dir_all(&dir).ok();
}

#[test]
fn duplicate_copies_timeline_state_without_touching_the_source() {
    let dir = scratch("dup-src");
    let dest = scratch("dup-dest");
    fs::remove_dir_all(&dest).ok();
    project::create(&dir, &manifest("original", 54_000_000)).expect("create");

    project::duplicate(&dir, &dest).expect("duplicate");
    let copy = project::open(&dest).expect("copy opens");
    assert_eq!(clip_duration(&copy), 54_000_000);
    assert!(project::open(&dir).is_ok(), "source survives duplication");

    fs::remove_dir_all(&dir).ok();
    fs::remove_dir_all(&dest).ok();
}

#[test]
fn delete_refuses_a_folder_that_is_not_a_project() {
    let dir = scratch("not-a-project");
    let canary = dir.join("important-user-file.txt");
    fs::write(&canary, "do not delete me").expect("write canary");

    let err = project::delete(&dir).expect_err("must refuse");
    assert_eq!(err.code, StorageErrorCode::ProjectNotFound);
    assert!(
        canary.exists(),
        "a non-project folder must never be removed"
    );
    fs::remove_dir_all(&dir).ok();
}

#[test]
fn delete_removes_a_real_project() {
    let dir = scratch("delete");
    project::create(&dir, &manifest("bye", 1)).expect("create");
    project::delete(&dir).expect("delete");
    assert!(!dir.exists());
}

#[test]
fn detects_offline_media_and_relinks_it() {
    let dir = scratch("relink");
    let media = dir.join("clip.mp4");
    fs::write(&media, b"not really media, but it exists").expect("write media");

    let mut m = manifest("linked", 54_000_000);
    m["assets"] = json!([{
        "id": "ast_1", "fingerprint": "abc", "kind": "video",
        "path": dir.join("missing.mp4").to_string_lossy(), "status": "online",
        "durationTicks": 54_000_000
    }]);

    let links = detect(&m);
    assert_eq!(links.len(), 1);
    assert_eq!(links[0].status, LinkStatus::Offline);
    assert!(!all_resolved(&links));

    let relinked = relink(&m, "ast_1", &media.to_string_lossy()).expect("relink");
    let links = detect(&relinked);
    assert_eq!(links[0].status, LinkStatus::Online);
    assert!(all_resolved(&links));

    // Timeline state must survive relinking untouched.
    assert_eq!(clip_duration(&relinked), 54_000_000);
    fs::remove_dir_all(&dir).ok();
}

#[test]
fn relink_rejects_a_missing_replacement_and_an_unknown_asset() {
    let dir = scratch("relink-bad");
    let media = dir.join("real.mp4");
    fs::write(&media, b"x").expect("write");
    let mut m = manifest("linked", 1);
    m["assets"] = json!([{ "id": "ast_1", "fingerprint": "a", "kind": "video",
                           "path": "gone.mp4", "status": "offline", "durationTicks": 1 }]);

    assert!(relink(&m, "ast_1", "definitely-not-here.mp4").is_err());
    assert!(relink(&m, "ast_missing", &media.to_string_lossy()).is_err());
    fs::remove_dir_all(&dir).ok();
}

#[test]
fn proxy_only_is_distinguished_from_offline() {
    let dir = scratch("proxyonly");
    let proxy = dir.join("clip.proxy.mp4");
    fs::write(&proxy, b"proxy").expect("write proxy");
    let mut m = manifest("p", 1);
    m["assets"] = json!([{
        "id": "ast_1", "fingerprint": "a", "kind": "video",
        "path": dir.join("original-gone.mp4").to_string_lossy(),
        "proxyPath": proxy.to_string_lossy(),
        "status": "online", "durationTicks": 1
    }]);
    let links = detect(&m);
    assert_eq!(links[0].status, LinkStatus::ProxyOnly);
    // Editing can continue, so this counts as resolved.
    assert!(all_resolved(&links));
    fs::remove_dir_all(&dir).ok();
}

#[test]
fn the_index_tracks_recent_projects_and_is_rebuildable() {
    let dir = scratch("index");
    project::create(&dir, &manifest("Indexed", 1)).expect("create");

    let idx = ProjectIndex::in_memory().expect("index");
    idx.upsert(
        "prj_m2",
        "Indexed",
        &dir.to_string_lossy(),
        "general",
        "2026-07-22T00:00:00.000Z",
        1_000,
    )
    .expect("upsert");

    let recent = idx.recent(10).expect("recent");
    assert_eq!(recent.len(), 1);
    assert_eq!(recent[0].name, "Indexed");
    assert!(recent[0].exists, "the project folder is present");

    // Upsert is idempotent per project id.
    idx.upsert(
        "prj_m2",
        "Renamed",
        &dir.to_string_lossy(),
        "general",
        "2026-07-22T00:00:01.000Z",
        2_000,
    )
    .expect("upsert again");
    let recent = idx.recent(10).expect("recent");
    assert_eq!(recent.len(), 1, "no duplicate rows for the same project");
    assert_eq!(recent[0].name, "Renamed");

    // Clearing the index loses nothing authoritative: the project still opens from disk.
    idx.clear().expect("clear");
    assert!(idx.recent(10).expect("recent").is_empty());
    assert!(project::open(&dir).is_ok(), "project survives index loss");

    fs::remove_dir_all(&dir).ok();
}

#[test]
fn the_index_flags_a_project_whose_folder_disappeared() {
    let dir = scratch("index-gone");
    project::create(&dir, &manifest("Gone", 1)).expect("create");
    let idx = ProjectIndex::in_memory().expect("index");
    idx.upsert("prj_m2", "Gone", &dir.to_string_lossy(), "general", "", 1)
        .expect("upsert");
    fs::remove_dir_all(&dir).ok();

    let recent = idx.recent(10).expect("recent");
    assert!(!recent[0].exists, "a moved/deleted project must be flagged");
}

#[test]
fn rejects_relative_and_traversing_project_paths() {
    let err = project::open(std::path::Path::new("relative/path")).expect_err("must reject");
    assert_eq!(err.code, StorageErrorCode::StoragePathRejected);
}
