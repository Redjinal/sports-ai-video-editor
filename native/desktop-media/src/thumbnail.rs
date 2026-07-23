//! Thumbnail strip generation (media-engine.md §10).
//!
//! A strip is a single image with `count` evenly-spaced frames tiled left-to-right. Generating
//! one image (rather than N files) keeps the cache small and the UI's filmstrip a single decode.
//! Disposable derived data; carries a version in the cache key so it can be invalidated.

use std::path::Path;
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use serde::Serialize;

use crate::error::{MediaError, MediaErrorCode, Result};
use crate::ffbin::ffmpeg_path;

/// Bump when the strip layout/encoding changes so old caches are recomputed.
pub const THUMBNAIL_CACHE_VERSION: u32 = 1;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ThumbnailStrip {
    pub path: String,
    pub count: u32,
    pub tile_width: u32,
    pub tile_height: u32,
    pub cache_version: u32,
}

/// Generate a `count`-frame strip at `tile_width` px per frame (height keeps aspect).
pub fn generate_strip(
    job_id: &str,
    source: &Path,
    output: &Path,
    count: u32,
    tile_width: u32,
    duration_seconds: f64,
    cancel: &Arc<AtomicBool>,
) -> Result<ThumbnailStrip> {
    if count == 0 {
        return Err(MediaError::new(
            MediaErrorCode::MediaProxyFailed,
            "A thumbnail strip needs at least one frame.",
        ));
    }
    if !source.exists() {
        return Err(MediaError::new(
            MediaErrorCode::MediaUnreadable,
            "The source file is not available.",
        ));
    }
    if let Some(parent) = output.parent() {
        std::fs::create_dir_all(parent).map_err(|e| {
            MediaError::new(
                MediaErrorCode::MediaProxyFailed,
                "Could not create the cache folder.",
            )
            .with_cause(e.to_string())
        })?;
    }
    if cancel.load(Ordering::Relaxed) {
        return Err(
            MediaError::new(MediaErrorCode::ExportCancelled, "Cancelled.").with_job(job_id),
        );
    }

    // fps = count/duration selects `count` frames spread across the whole file; `tile=countx1`
    // packs them into one horizontal strip.
    let fps = if duration_seconds > 0.0 {
        count as f64 / duration_seconds
    } else {
        1.0
    };
    let vf = format!(
        "fps={fps:.6},scale={tile_width}:-2:flags=fast_bilinear,tile={count}x1",
        fps = fps.max(0.000_001),
    );

    let args: Vec<String> = vec![
        "-hide_banner".into(),
        "-loglevel".into(),
        "error".into(),
        "-nostats".into(),
        "-y".into(),
        "-i".into(),
        source.to_string_lossy().to_string(),
        "-vf".into(),
        vf,
        "-frames:v".into(),
        "1".into(),
        output.to_string_lossy().to_string(),
    ];

    let out = Command::new(ffmpeg_path())
        .args(&args)
        .output()
        .map_err(|e| {
            MediaError::new(
                MediaErrorCode::MediaProxyFailed,
                "Could not start thumbnail generation.",
            )
            .with_cause(e.to_string())
            .with_job(job_id)
        })?;

    if cancel.load(Ordering::Relaxed) {
        let _ = std::fs::remove_file(output);
        return Err(
            MediaError::new(MediaErrorCode::ExportCancelled, "Cancelled.").with_job(job_id),
        );
    }
    if !out.status.success() || !output.exists() {
        let tail: String = String::from_utf8_lossy(&out.stderr)
            .lines()
            .rev()
            .take(4)
            .collect::<Vec<_>>()
            .join(" | ");
        return Err(MediaError::new(
            MediaErrorCode::MediaProxyFailed,
            "Thumbnail generation failed.",
        )
        .with_cause(tail)
        .with_job(job_id));
    }

    // Measure the produced strip so the UI can slice it into frames.
    let (w, h) = probe_dimensions(output).unwrap_or((tile_width.saturating_mul(count), 0));
    Ok(ThumbnailStrip {
        path: output.to_string_lossy().to_string(),
        count,
        tile_width: w.checked_div(count).unwrap_or(w),
        tile_height: h,
        cache_version: THUMBNAIL_CACHE_VERSION,
    })
}

fn probe_dimensions(path: &Path) -> Option<(u32, u32)> {
    let out = Command::new(crate::ffbin::ffprobe_path())
        .args([
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height",
            "-of",
            "csv=p=0",
        ])
        .arg(path)
        .output()
        .ok()?;
    let text = String::from_utf8_lossy(&out.stdout);
    let mut parts = text.trim().split(',');
    let w = parts.next()?.trim().parse::<u32>().ok()?;
    let h = parts.next()?.trim().parse::<u32>().ok()?;
    Some((w, h))
}
