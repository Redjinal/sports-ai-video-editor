//! Managed conversion (media-engine.md §9).
//!
//! Distinct from a proxy: a managed conversion is a durable, certified derivative used when the
//! original is unsupported or unstable. It preserves resolution and frame rate where possible,
//! re-encodes to the certified H.264/AAC baseline, and reports any property that changed so the
//! user knows what final export will use. The source reference is never altered here.

use std::path::Path;
use std::process::Command;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use serde::Serialize;

use crate::error::{MediaError, MediaErrorCode, Result};
use crate::ffbin::ffmpeg_path;
use crate::inspect::{inspect, InspectResult};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ManagedConversion {
    pub managed_path: String,
    pub source_container: String,
    pub source_video_codec: Option<String>,
    pub managed_video_codec: Option<String>,
    /// Human-readable list of properties that changed vs the original (§9).
    pub changed_properties: Vec<String>,
    pub duration_ticks: i64,
}

fn temp_path(final_path: &Path) -> std::path::PathBuf {
    let mut p = final_path.to_path_buf();
    let stem = p
        .file_stem()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "managed".into());
    let ext = p
        .extension()
        .map(|e| e.to_string_lossy().to_string())
        .unwrap_or_else(|| "mp4".into());
    p.set_file_name(format!(".{stem}.managed.part.{ext}"));
    p
}

/// Convert `source` to a certified H.264/AAC MP4 at `output`, preserving resolution and frame
/// rate. Returns what changed. The output is validated (a produced file is not proof of success).
pub fn convert(
    job_id: &str,
    source: &Path,
    output: &Path,
    cancel: &Arc<AtomicBool>,
) -> Result<ManagedConversion> {
    if !source.exists() {
        return Err(MediaError::new(
            MediaErrorCode::MediaUnreadable,
            "The source file is not available.",
        ));
    }
    let src = inspect("managed_src", source)?;
    if let Some(parent) = output.parent() {
        std::fs::create_dir_all(parent).map_err(|e| {
            MediaError::new(
                MediaErrorCode::MediaProxyFailed,
                "Could not create the managed folder.",
            )
            .with_cause(e.to_string())
        })?;
    }
    let tmp = temp_path(output);
    let _ = std::fs::remove_file(&tmp);

    // Preserve resolution + frame rate; re-encode to the certified baseline (yuv420p keeps it
    // broadly decodable). Audio to AAC 48k stereo.
    let args: Vec<String> = vec![
        "-hide_banner".into(),
        "-loglevel".into(),
        "error".into(),
        "-nostats".into(),
        "-y".into(),
        "-i".into(),
        source.to_string_lossy().to_string(),
        "-c:v".into(),
        "libx264".into(),
        "-profile:v".into(),
        "high".into(),
        "-pix_fmt".into(),
        "yuv420p".into(),
        "-preset".into(),
        "medium".into(),
        "-crf".into(),
        "18".into(),
        "-c:a".into(),
        "aac".into(),
        "-b:a".into(),
        "192k".into(),
        "-ar".into(),
        "48000".into(),
        "-movflags".into(),
        "+faststart".into(),
        tmp.to_string_lossy().to_string(),
    ];

    let out = Command::new(ffmpeg_path())
        .args(&args)
        .output()
        .map_err(|e| {
            MediaError::new(
                MediaErrorCode::MediaProxyFailed,
                "Could not start managed conversion.",
            )
            .with_cause(e.to_string())
            .with_job(job_id)
        })?;
    if cancel.load(Ordering::Relaxed) {
        let _ = std::fs::remove_file(&tmp);
        return Err(
            MediaError::new(MediaErrorCode::ExportCancelled, "Cancelled.").with_job(job_id),
        );
    }
    if !out.status.success() || !tmp.exists() {
        let _ = std::fs::remove_file(&tmp);
        let tail: String = String::from_utf8_lossy(&out.stderr)
            .lines()
            .rev()
            .take(4)
            .collect::<Vec<_>>()
            .join(" | ");
        return Err(MediaError::new(
            MediaErrorCode::MediaProxyFailed,
            "Managed conversion failed.",
        )
        .with_cause(tail)
        .with_job(job_id));
    }

    // Validate the derivative before publishing it.
    let managed = inspect("managed_out", &tmp)?;
    let ok = managed
        .video_streams
        .first()
        .map(|v| v.codec == "h264")
        .unwrap_or(false)
        && managed.duration_ticks > 0;
    if !ok {
        let _ = std::fs::remove_file(&tmp);
        return Err(MediaError::new(
            MediaErrorCode::MediaProxyFailed,
            "The managed conversion did not produce a valid certified file.",
        )
        .with_job(job_id));
    }

    std::fs::rename(&tmp, output).map_err(|e| {
        let _ = std::fs::remove_file(&tmp);
        MediaError::new(
            MediaErrorCode::MediaProxyFailed,
            "Could not finalise the managed file.",
        )
        .with_cause(e.to_string())
    })?;

    Ok(ManagedConversion {
        managed_path: output.to_string_lossy().to_string(),
        source_container: src.container.clone(),
        source_video_codec: src.video_streams.first().map(|v| v.codec.clone()),
        managed_video_codec: managed.video_streams.first().map(|v| v.codec.clone()),
        changed_properties: diff_properties(&src, &managed),
        duration_ticks: managed.duration_ticks,
    })
}

/// Compare source vs managed and describe every meaningful change (§9).
fn diff_properties(src: &InspectResult, managed: &InspectResult) -> Vec<String> {
    let mut changed = Vec::new();
    let sv = src.video_streams.first();
    let mv = managed.video_streams.first();
    if let (Some(s), Some(m)) = (sv, mv) {
        if s.codec != m.codec {
            changed.push(format!("video codec {} → {}", s.codec, m.codec));
        }
        if (s.width, s.height) != (m.width, m.height) {
            changed.push(format!(
                "resolution {}x{} → {}x{}",
                s.width, s.height, m.width, m.height
            ));
        }
        let sr = s.r_frame_rate.numerator * m.r_frame_rate.denominator;
        let mr = m.r_frame_rate.numerator * s.r_frame_rate.denominator;
        if sr != mr {
            changed.push("frame rate changed".to_string());
        }
    }
    let sa = src.audio_streams.first();
    let ma = managed.audio_streams.first();
    if let (Some(s), Some(m)) = (sa, ma) {
        if s.codec != m.codec {
            changed.push(format!("audio codec {} → {}", s.codec, m.codec));
        }
    }
    if src.container != managed.container {
        changed.push("container re-muxed to MP4".to_string());
    }
    changed
}
