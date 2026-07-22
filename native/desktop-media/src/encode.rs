//! FFmpeg encode jobs: proxy generation and sequence export.
//!
//! Rules enforced here (engineering-standards.md §2, §8, §9, §10):
//! - arguments are passed as an array, never a constructed shell string
//! - long work reports structured progress and supports cancellation by flag
//! - output is written to a unique temp path and only moved into place after success

use std::io::{BufRead, BufReader, Read};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

/// How often the cancellation watcher checks the flag. Small enough that a user-visible
/// cancel feels immediate, large enough to stay off the CPU during long renders.
const CANCEL_POLL_INTERVAL: Duration = Duration::from_millis(20);

use crate::error::{MediaError, MediaErrorCode, Result};
use crate::ffbin::ffmpeg_path;
use crate::plan::RenderPlan;
use crate::TIMESCALE;

/// Progress emitted while an encode runs.
#[derive(Debug, Clone)]
pub struct EncodeProgress {
    pub job_id: String,
    pub stage: &'static str,
    pub out_time_ticks: i64,
    pub total_ticks: i64,
}

impl EncodeProgress {
    /// Monotonic 0..1 fraction for the current stage; 0 when the total is unknown.
    pub fn fraction(&self) -> f64 {
        if self.total_ticks <= 0 {
            0.0
        } else {
            (self.out_time_ticks as f64 / self.total_ticks as f64).clamp(0.0, 1.0)
        }
    }
}

fn ticks_to_seconds(ticks: i64) -> f64 {
    ticks as f64 / TIMESCALE as f64
}

/// Run one ffmpeg invocation, streaming structured progress and honouring cancellation.
fn run_ffmpeg(
    job_id: &str,
    stage: &'static str,
    args: &[String],
    total_ticks: i64,
    cancel: &Arc<AtomicBool>,
    on_progress: &mut dyn FnMut(EncodeProgress),
    failure_code: MediaErrorCode,
) -> Result<()> {
    let mut child = Command::new(ffmpeg_path())
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| {
            MediaError::new(failure_code, "Could not start the media encoder.")
                .with_cause(e.to_string())
                .with_job(job_id)
        })?;

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    // Collect stderr on its own thread so a full pipe buffer can never deadlock the encode.
    let stderr_handle = stderr.map(|err| {
        std::thread::spawn(move || {
            let mut buf = String::new();
            let _ = BufReader::new(err).read_to_string(&mut buf);
            buf
        })
    });

    // Cancellation is watched independently of progress output. Polling the flag inside the
    // stdout loop would only observe a cancel when FFmpeg happens to emit a line, so a
    // stalled or silent encode could never be cancelled at all.
    let child = Arc::new(Mutex::new(child));
    let finished = Arc::new(AtomicBool::new(false));
    let watcher = {
        let child = Arc::clone(&child);
        let cancel = Arc::clone(cancel);
        let finished = Arc::clone(&finished);
        std::thread::spawn(move || {
            while !finished.load(Ordering::Relaxed) {
                if cancel.load(Ordering::Relaxed) {
                    if let Ok(mut c) = child.lock() {
                        let _ = c.kill();
                    }
                    return;
                }
                std::thread::sleep(CANCEL_POLL_INTERVAL);
            }
        })
    };

    // -progress writes key=value lines to stdout; parse them instead of scraping the log.
    if let Some(stdout) = stdout {
        let reader = BufReader::new(stdout);
        for line in reader.lines() {
            let Ok(line) = line else { break };
            if let Some(value) = line.strip_prefix("out_time_us=") {
                if let Ok(us) = value.trim().parse::<i64>() {
                    let out_time_ticks =
                        (us as f64 / 1_000_000.0 * TIMESCALE as f64).round() as i64;
                    on_progress(EncodeProgress {
                        job_id: job_id.to_string(),
                        stage,
                        out_time_ticks,
                        total_ticks,
                    });
                }
            }
        }
    }

    let status = {
        let mut guard = child.lock().map_err(|_| {
            MediaError::new(failure_code, "The media encoder state was lost.").with_job(job_id)
        })?;
        guard.wait().map_err(|e| {
            MediaError::new(failure_code, "The media encoder did not finish cleanly.")
                .with_cause(e.to_string())
                .with_job(job_id)
        })?
    };
    finished.store(true, Ordering::Relaxed);
    let _ = watcher.join();
    let stderr_text = stderr_handle
        .and_then(|h| h.join().ok())
        .unwrap_or_default();

    if cancel.load(Ordering::Relaxed) {
        return Err(
            MediaError::new(MediaErrorCode::ExportCancelled, "Export cancelled.").with_job(job_id),
        );
    }

    if !status.success() {
        let tail: String = stderr_text
            .lines()
            .rev()
            .take(6)
            .collect::<Vec<_>>()
            .join(" | ");
        return Err(
            MediaError::new(failure_code, "The media encoder reported a failure.")
                .with_cause(tail)
                .with_job(job_id),
        );
    }
    Ok(())
}

/// Remove a partial temp file, ignoring errors (cleanup must never mask the real error).
fn cleanup(path: &Path) {
    let _ = std::fs::remove_file(path);
}

/// Temp render path. The final extension is preserved (`.export.part.mp4`) because FFmpeg
/// infers the muxer from it; a bare `.part` suffix makes the output format unresolvable.
fn temp_path(final_path: &Path) -> PathBuf {
    let mut p = final_path.to_path_buf();
    let stem = p
        .file_stem()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "output".to_string());
    let name = match p.extension().map(|e| e.to_string_lossy().to_string()) {
        Some(ext) if !ext.is_empty() => format!(".{stem}.part.{ext}"),
        _ => format!(".{stem}.part"),
    };
    p.set_file_name(name);
    p
}

/// Generate an editing proxy that fits inside `max_w` x `max_h`, preserving aspect ratio.
#[allow(clippy::too_many_arguments)]
pub fn generate_proxy(
    job_id: &str,
    source: &Path,
    output: &Path,
    max_w: u32,
    max_h: u32,
    total_ticks: i64,
    cancel: &Arc<AtomicBool>,
    on_progress: &mut dyn FnMut(EncodeProgress),
) -> Result<()> {
    if !source.exists() {
        return Err(MediaError::new(
            MediaErrorCode::MediaProxyFailed,
            "The source file is not available.",
        ));
    }
    if let Some(parent) = output.parent() {
        std::fs::create_dir_all(parent).map_err(|e| {
            MediaError::new(
                MediaErrorCode::MediaProxyFailed,
                "Could not create the proxy folder.",
            )
            .with_cause(e.to_string())
        })?;
    }
    let tmp = temp_path(output);
    cleanup(&tmp);

    let args: Vec<String> = vec![
        "-hide_banner".into(),
        "-nostats".into(),
        "-y".into(),
        "-i".into(),
        source.to_string_lossy().to_string(),
        "-vf".into(),
        format!("scale={max_w}:{max_h}:force_original_aspect_ratio=decrease"),
        "-c:v".into(),
        "libx264".into(),
        "-preset".into(),
        "veryfast".into(),
        "-crf".into(),
        "23".into(),
        "-pix_fmt".into(),
        "yuv420p".into(),
        // Short GOP keeps scrubbing responsive, which is the point of a proxy.
        "-g".into(),
        "30".into(),
        "-c:a".into(),
        "aac".into(),
        "-b:a".into(),
        "160k".into(),
        "-movflags".into(),
        "+faststart".into(),
        "-progress".into(),
        "pipe:1".into(),
        tmp.to_string_lossy().to_string(),
    ];

    match run_ffmpeg(
        job_id,
        "proxy",
        &args,
        total_ticks,
        cancel,
        on_progress,
        MediaErrorCode::MediaProxyFailed,
    ) {
        Ok(()) => {}
        Err(e) => {
            cleanup(&tmp);
            return Err(e);
        }
    }

    std::fs::rename(&tmp, output).map_err(|e| {
        cleanup(&tmp);
        MediaError::new(
            MediaErrorCode::MediaProxyFailed,
            "Could not finalise the proxy file.",
        )
        .with_cause(e.to_string())
    })?;
    Ok(())
}

/// The single clip an M1 export renders, resolved from the plan.
#[derive(Debug)]
pub struct ResolvedExport {
    pub source_path: PathBuf,
    pub source_in_seconds: f64,
    pub duration_seconds: f64,
    pub total_ticks: i64,
}

/// M1 scope: exactly one clip on one video track. Anything richer is rejected explicitly
/// rather than silently rendering something different from the timeline.
pub fn resolve_single_clip(plan: &RenderPlan) -> Result<ResolvedExport> {
    if plan.version != 1 {
        return Err(MediaError::new(
            MediaErrorCode::ExportInvalidPlan,
            "Unsupported render plan version.",
        ));
    }
    let clips: Vec<_> = plan
        .tracks
        .iter()
        .filter(|t| t.kind == "video")
        .flat_map(|t| t.clips.iter())
        .collect();

    let clip = match clips.as_slice() {
        [only] => *only,
        [] => {
            return Err(MediaError::new(
                MediaErrorCode::ExportInvalidPlan,
                "The sequence has no video clip to export.",
            ))
        }
        _ => {
            return Err(MediaError::new(
                MediaErrorCode::ExportInvalidPlan,
                "This build exports a single-clip sequence only (M1 vertical slice).",
            ))
        }
    };

    let source = PathBuf::from(&clip.source_path);
    if !source.exists() {
        return Err(MediaError::new(
            MediaErrorCode::ExportSourceOffline,
            "The source media for this clip is offline.",
        ));
    }
    if clip.timeline_duration_ticks <= 0 {
        return Err(MediaError::new(
            MediaErrorCode::ExportInvalidPlan,
            "The clip has no duration.",
        ));
    }

    Ok(ResolvedExport {
        source_path: source,
        source_in_seconds: ticks_to_seconds(clip.source_in_ticks),
        duration_seconds: ticks_to_seconds(clip.timeline_duration_ticks),
        total_ticks: clip.timeline_duration_ticks,
    })
}

/// Render + encode the plan to a temp file. The caller validates before the atomic move.
pub fn export_to_temp(
    job_id: &str,
    plan: &RenderPlan,
    final_output: &Path,
    cancel: &Arc<AtomicBool>,
    on_progress: &mut dyn FnMut(EncodeProgress),
) -> Result<PathBuf> {
    let resolved = resolve_single_clip(plan)?;
    if let Some(parent) = final_output.parent() {
        std::fs::create_dir_all(parent).map_err(|e| {
            MediaError::new(
                MediaErrorCode::ExportEncoderFailed,
                "Could not create the output folder.",
            )
            .with_cause(e.to_string())
        })?;
    }
    let tmp = temp_path(final_output);
    cleanup(&tmp);

    let vcodec = match plan.video.codec.as_str() {
        "h264" => "libx264",
        "h265" => "libx265",
        other => {
            return Err(MediaError::new(
                MediaErrorCode::ExportInvalidPlan,
                format!("Unsupported video codec '{other}'."),
            ))
        }
    };
    // Map the neutral 0..100 quality onto CRF (lower CRF = higher quality).
    let crf = (51.0 - (plan.video.quality as f64 / 100.0) * 33.0).round() as i64;
    let fps = if plan.video.frame_rate.denominator != 0 {
        format!(
            "{}/{}",
            plan.video.frame_rate.numerator, plan.video.frame_rate.denominator
        )
    } else {
        "30/1".to_string()
    };

    let args: Vec<String> = vec![
        "-hide_banner".into(),
        "-nostats".into(),
        "-y".into(),
        // Accurate trim: -ss before -i seeks fast, and -t bounds the copied span.
        "-ss".into(),
        format!("{:.6}", resolved.source_in_seconds),
        "-t".into(),
        format!("{:.6}", resolved.duration_seconds),
        "-i".into(),
        resolved.source_path.to_string_lossy().to_string(),
        "-vf".into(),
        format!(
            "scale={}:{}:force_original_aspect_ratio=decrease,pad={}:{}:(ow-iw)/2:(oh-ih)/2",
            plan.video.width, plan.video.height, plan.video.width, plan.video.height
        ),
        "-r".into(),
        fps,
        "-c:v".into(),
        vcodec.into(),
        "-crf".into(),
        crf.to_string(),
        "-pix_fmt".into(),
        "yuv420p".into(),
        "-c:a".into(),
        "aac".into(),
        "-b:a".into(),
        format!(
            "{}k",
            if plan.audio.bitrate_kbps == 0 {
                192
            } else {
                plan.audio.bitrate_kbps
            }
        ),
        "-ar".into(),
        plan.audio.sample_rate.to_string(),
        "-ac".into(),
        plan.audio.channels.to_string(),
        "-movflags".into(),
        "+faststart".into(),
        "-progress".into(),
        "pipe:1".into(),
        tmp.to_string_lossy().to_string(),
    ];

    match run_ffmpeg(
        job_id,
        "encoding",
        &args,
        resolved.total_ticks,
        cancel,
        on_progress,
        MediaErrorCode::ExportEncoderFailed,
    ) {
        Ok(()) => Ok(tmp),
        Err(e) => {
            cleanup(&tmp);
            Err(e)
        }
    }
}

/// Move a validated temp render into its final destination.
pub fn finalise(temp: &Path, final_output: &Path) -> Result<()> {
    std::fs::rename(temp, final_output).map_err(|e| {
        cleanup(temp);
        MediaError::new(
            MediaErrorCode::ExportEncoderFailed,
            "Could not finalise the export file.",
        )
        .with_cause(e.to_string())
    })
}

/// Discard a rejected render so a failed export never leaves a usable-looking file.
pub fn discard(temp: &Path) {
    cleanup(temp);
}
