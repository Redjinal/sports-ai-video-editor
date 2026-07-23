//! Waveform peak generation (media-engine.md §11).
//!
//! Decoded audio is streamed from FFmpeg as low-rate mono PCM and reduced to fixed-size peak +
//! loudness buckets on the fly, so a two-hour file never loads all its samples into memory.
//! Display peaks and RMS loudness are exposed separately. Disposable derived data.

use std::io::Read;
use std::path::Path;
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use serde::Serialize;

use crate::error::{MediaError, MediaErrorCode, Result};
use crate::ffbin::{ffmpeg_path, ffprobe_path};

pub const WAVEFORM_CACHE_VERSION: u32 = 1;
const DECODE_RATE: u32 = 8000; // mono Hz — plenty for a scrubbing waveform, cheap to stream

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Waveform {
    pub version: u32,
    pub has_audio: bool,
    pub sample_rate: u32,
    pub buckets: u32,
    /// Peak amplitude per bucket, 0.0..1.0 (for the drawn waveform).
    pub peaks: Vec<f32>,
    /// RMS loudness per bucket, 0.0..1.0 (exposed separately from display peaks).
    pub rms: Vec<f32>,
}

fn has_audio_stream(path: &Path) -> bool {
    Command::new(ffprobe_path())
        .args([
            "-v",
            "error",
            "-select_streams",
            "a",
            "-show_entries",
            "stream=index",
            "-of",
            "csv=p=0",
        ])
        .arg(path)
        .output()
        .map(|o| !o.stdout.is_empty())
        .unwrap_or(false)
}

/// Generate `buckets` peak/RMS values across the file's audio.
pub fn generate(
    job_id: &str,
    source: &Path,
    buckets: u32,
    duration_seconds: f64,
    cancel: &Arc<AtomicBool>,
) -> Result<Waveform> {
    if buckets == 0 {
        return Err(MediaError::new(
            MediaErrorCode::MediaUnreadable,
            "A waveform needs at least one bucket.",
        ));
    }
    if !source.exists() {
        return Err(MediaError::new(
            MediaErrorCode::MediaUnreadable,
            "The source file is not available.",
        ));
    }
    if !has_audio_stream(source) {
        return Ok(Waveform {
            version: WAVEFORM_CACHE_VERSION,
            has_audio: false,
            sample_rate: DECODE_RATE,
            buckets,
            peaks: vec![0.0; buckets as usize],
            rms: vec![0.0; buckets as usize],
        });
    }

    let total_samples = ((duration_seconds.max(0.0)) * DECODE_RATE as f64).round() as u64;
    let per_bucket = (total_samples / buckets as u64).max(1);

    let mut child = Command::new(ffmpeg_path())
        .args(["-hide_banner", "-loglevel", "error", "-nostats", "-i"])
        .arg(source)
        .args([
            "-ac",
            "1",
            "-ar",
            &DECODE_RATE.to_string(),
            "-map",
            "a:0",
            "-f",
            "s16le",
            "-",
        ])
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| {
            MediaError::new(
                MediaErrorCode::MediaUnreadable,
                "Could not start audio decoding.",
            )
            .with_cause(e.to_string())
            .with_job(job_id)
        })?;

    let mut peaks = vec![0.0f32; buckets as usize];
    let mut sumsq = vec![0.0f64; buckets as usize];
    let mut counts = vec![0u64; buckets as usize];

    if let Some(mut stdout) = child.stdout.take() {
        let mut buf = [0u8; 1 << 16];
        let mut carry: Option<u8> = None; // odd byte spanning a chunk boundary
        let mut sample_index: u64 = 0;
        loop {
            if cancel.load(Ordering::Relaxed) {
                let _ = child.kill();
                let _ = child.wait();
                return Err(
                    MediaError::new(MediaErrorCode::ExportCancelled, "Cancelled.").with_job(job_id),
                );
            }
            let n = stdout.read(&mut buf).map_err(|e| {
                MediaError::new(
                    MediaErrorCode::MediaUnreadable,
                    "Audio decoding was interrupted.",
                )
                .with_cause(e.to_string())
                .with_job(job_id)
            })?;
            if n == 0 {
                break;
            }
            let mut i = 0;
            // Reassemble a sample split across the previous chunk.
            if let Some(lo) = carry.take() {
                if n >= 1 {
                    let s = i16::from_le_bytes([lo, buf[0]]);
                    accumulate(
                        s,
                        sample_index,
                        per_bucket,
                        buckets,
                        &mut peaks,
                        &mut sumsq,
                        &mut counts,
                    );
                    sample_index += 1;
                    i = 1;
                }
            }
            while i + 1 < n {
                let s = i16::from_le_bytes([buf[i], buf[i + 1]]);
                accumulate(
                    s,
                    sample_index,
                    per_bucket,
                    buckets,
                    &mut peaks,
                    &mut sumsq,
                    &mut counts,
                );
                sample_index += 1;
                i += 2;
            }
            if i < n {
                carry = Some(buf[i]);
            }
        }
    }

    let status = child.wait().map_err(|e| {
        MediaError::new(
            MediaErrorCode::MediaUnreadable,
            "Audio decoding did not finish.",
        )
        .with_cause(e.to_string())
        .with_job(job_id)
    })?;
    if !status.success() {
        return Err(MediaError::new(
            MediaErrorCode::MediaUnreadable,
            "The audio could not be decoded for a waveform.",
        )
        .with_job(job_id));
    }

    let rms: Vec<f32> = sumsq
        .iter()
        .zip(&counts)
        .map(|(s, c)| {
            if *c > 0 {
                (s / *c as f64).sqrt() as f32
            } else {
                0.0
            }
        })
        .collect();

    Ok(Waveform {
        version: WAVEFORM_CACHE_VERSION,
        has_audio: true,
        sample_rate: DECODE_RATE,
        buckets,
        peaks,
        rms,
    })
}

#[allow(clippy::too_many_arguments)]
fn accumulate(
    sample: i16,
    sample_index: u64,
    per_bucket: u64,
    buckets: u32,
    peaks: &mut [f32],
    sumsq: &mut [f64],
    counts: &mut [u64],
) {
    let b = ((sample_index / per_bucket) as usize).min(buckets as usize - 1);
    let amp = (sample as f32).abs() / 32768.0;
    if amp > peaks[b] {
        peaks[b] = amp;
    }
    sumsq[b] += (amp as f64) * (amp as f64);
    counts[b] += 1;
}
