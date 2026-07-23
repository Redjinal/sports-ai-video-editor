//! Consolidation, cache cleanup, and packaging (project-format.md §20-23).

#![allow(clippy::expect_used, clippy::unwrap_used)]

use std::fs;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};

use desktop_storage::media::{clean_cache, consolidate, package_project, PackageMode};
use desktop_storage::project;
use serde_json::json;

fn unique(tag: &str) -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    std::env::temp_dir().join(format!("sve-mediaops-{tag}-{nanos}"))
}

fn minimal_manifest(name: &str) -> serde_json::Value {
    json!({
        "schemaVersion": 1, "projectId": "prj_1", "name": name,
        "createdAt": "2026-07-22T00:00:00.000Z", "updatedAt": "2026-07-22T00:00:00.000Z",
        "projectType": "general", "platformCreatedOn": "windows",
        "settings": {}, "assets": [], "sequences": [], "basketballContexts": [],
        "brandKits": [], "templates": [], "proposalSets": [],
        "activeMasterSequenceId": null, "compatibility": { "minimumReaderVersion": "0.1.0" }
    })
}

#[test]
fn consolidates_originals_into_the_media_folder() {
    let root = unique("consolidate");
    fs::create_dir_all(&root).unwrap();
    let a = root.join("clipA.mp4");
    let b = root.join("clipB.mp4");
    fs::write(&a, b"aaa").unwrap();
    fs::write(&b, b"bbbb").unwrap();

    let dir = root.join("project");
    project::create(&dir, &minimal_manifest("P")).unwrap();

    let mapping = consolidate(
        &dir,
        &[
            ("ast_a".into(), a.to_string_lossy().to_string()),
            ("ast_b".into(), b.to_string_lossy().to_string()),
        ],
    )
    .expect("consolidate");

    assert_eq!(mapping.len(), 2);
    assert!(mapping[0].new_path.starts_with("media/ast_a__"));
    assert!(dir.join(&mapping[0].new_path).exists());
    // Originals are untouched.
    assert!(a.exists() && b.exists());
    fs::remove_dir_all(&root).ok();
}

#[test]
fn consolidation_rolls_back_when_a_source_is_offline() {
    let root = unique("consolidate-fail");
    fs::create_dir_all(&root).unwrap();
    let good = root.join("good.mp4");
    fs::write(&good, b"ok").unwrap();
    let dir = root.join("project");
    project::create(&dir, &minimal_manifest("P")).unwrap();

    let err = consolidate(
        &dir,
        &[
            ("ast_good".into(), good.to_string_lossy().to_string()),
            (
                "ast_bad".into(),
                root.join("missing.mp4").to_string_lossy().to_string(),
            ),
        ],
    )
    .expect_err("must abort");
    assert_eq!(
        err.code,
        desktop_storage::error::StorageErrorCode::StorageReadFailed
    );

    // The good copy that was already made must have been rolled back.
    let media = dir.join("media");
    let count = fs::read_dir(&media).map(|d| d.count()).unwrap_or(0);
    assert_eq!(count, 0, "no half-consolidated files remain");
    fs::remove_dir_all(&root).ok();
}

#[test]
fn cleans_caches_but_never_originals_or_project() {
    let dir = unique("clean");
    project::create(&dir, &minimal_manifest("P")).unwrap();
    fs::create_dir_all(dir.join("proxies")).unwrap();
    fs::write(dir.join("proxies/p.mp4"), vec![0u8; 5000]).unwrap();
    fs::create_dir_all(dir.join("thumbnails")).unwrap();
    fs::write(dir.join("thumbnails/t.jpg"), vec![0u8; 3000]).unwrap();
    fs::create_dir_all(dir.join("media")).unwrap();
    fs::write(dir.join("media/original.mp4"), b"precious").unwrap();

    let report = clean_cache(&dir).expect("clean");
    assert!(report.bytes_freed >= 8000);
    assert!(report.removed.contains(&"proxies".to_string()));
    assert!(!dir.join("proxies").exists());
    assert!(!dir.join("thumbnails").exists());
    // Originals and the project file survive.
    assert!(dir.join("media/original.mp4").exists());
    assert!(dir.join("project.json").exists());
    fs::remove_dir_all(&dir).ok();
}

#[test]
fn packages_project_data_with_a_checksummed_manifest() {
    let dir = unique("pkg");
    project::create(&dir, &minimal_manifest("Packaged")).unwrap();
    fs::create_dir_all(dir.join("media")).unwrap();
    fs::write(dir.join("media/ast_a__clip.mp4"), b"mediadata").unwrap();

    let dest = unique("pkg-dest");
    let report = package_project(&dir, &dest, PackageMode::WithMedia).expect("package");

    assert!(dest.join("package.json").exists());
    assert!(dest.join("project.json").exists());
    assert!(dest.join("media/ast_a__clip.mp4").exists());
    // Manifest lists project + media with checksums.
    assert!(report
        .files
        .iter()
        .any(|f| f.relative_path == "project.json" && f.sha256.len() == 64));
    assert!(report
        .files
        .iter()
        .any(|f| f.relative_path.starts_with("media/")));
    assert!(report.total_bytes > 0);
    fs::remove_dir_all(&dir).ok();
    fs::remove_dir_all(&dest).ok();
}

#[test]
fn packaging_rejects_a_traversing_destination() {
    let dir = unique("pkg-bad");
    project::create(&dir, &minimal_manifest("P")).unwrap();
    let err = package_project(
        &dir,
        std::path::Path::new("relative/dest"),
        PackageMode::DataOnly,
    )
    .expect_err("must reject");
    assert_eq!(
        err.code,
        desktop_storage::error::StorageErrorCode::StoragePathRejected
    );
    fs::remove_dir_all(&dir).ok();
}
