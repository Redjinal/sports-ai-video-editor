//! FFprobe-backed media inspection (media-engine.md §5).
//!
//! Field names serialise to camelCase so the payload validates against the
//! `@sve/media-contracts` zod schema unchanged. `Option::None` is skipped rather than
//! emitted as `null`, because the TS schema treats those fields as optional-undefined.

use std::io::{Read, Seek, SeekFrom};
use std::path::Path;
use std::process::Command;

use serde::Serialize;
use serde_json::Value;
use sha2::{Digest, Sha256};

use crate::error::{MediaError, MediaErrorCode, Result};
use crate::ffbin::ffprobe_path;
use crate::TIMESCALE;

#[derive(Debug, Clone, Serialize)]
pub struct Rational {
    pub numerator: i64,
    pub denominator: i64,
}

#[derive(Debug, Clone, Copy, Serialize)]
pub enum CompatibilityTier {
    #[serde(rename = "certified")]
    Certified,
    #[serde(rename = "conditional")]
    Conditional,
    #[serde(rename = "best_effort")]
    BestEffort,
    #[serde(rename = "unsupported")]
    Unsupported,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MediaWarning {
    pub code: String,
    pub message: String,
    pub severity: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoStreamInfo {
    pub index: u32,
    pub codec: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub profile: Option<String>,
    pub width: u32,
    pub height: u32,
    pub pixel_aspect_ratio: Rational,
    pub avg_frame_rate: Rational,
    pub r_frame_rate: Rational,
    pub is_variable_frame_rate: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color_primaries: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color_transfer: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color_space: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub rotation_degrees: Option<f64>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioStreamInfo {
    pub index: u32,
    pub codec: String,
    pub sample_rate: u32,
    pub channels: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub channel_layout: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub language: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OtherStreamInfo {
    pub index: u32,
    pub kind: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub codec: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InspectResult {
    pub request_id: String,
    pub asset_fingerprint: String,
    pub container: String,
    pub duration_ticks: i64,
    pub start_ticks: i64,
    pub file_size_bytes: u64,
    pub video_streams: Vec<VideoStreamInfo>,
    pub audio_streams: Vec<AudioStreamInfo>,
    pub other_streams: Vec<OtherStreamInfo>,
    pub compatibility: CompatibilityTier,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timecode: Option<String>,
    pub warnings: Vec<MediaWarning>,
}

fn parse_rational(value: Option<&str>, fallback: (i64, i64)) -> Rational {
    let raw = value.unwrap_or("");
    let mut parts = raw.split('/');
    let n = parts.next().and_then(|x| x.parse::<i64>().ok());
    let d = parts.next().and_then(|x| x.parse::<i64>().ok());
    match (n, d) {
        (Some(n), Some(d)) if d != 0 => Rational {
            numerator: n,
            denominator: d,
        },
        _ => Rational {
            numerator: fallback.0,
            denominator: fallback.1,
        },
    }
}

fn seconds_to_ticks(seconds: f64) -> i64 {
    (seconds * TIMESCALE as f64).round() as i64
}

/// Stable-enough asset fingerprint: file size plus the head and tail of the file.
/// Avoids hashing gigabytes of long-form footage on every import.
fn fingerprint(path: &Path, size: u64) -> Result<String> {
    const CHUNK: u64 = 1024 * 1024;
    let mut file = std::fs::File::open(path).map_err(|e| {
        MediaError::new(
            MediaErrorCode::MediaUnreadable,
            "Could not open the media file",
        )
        .with_cause(e.to_string())
    })?;
    let mut hasher = Sha256::new();
    hasher.update(size.to_le_bytes());

    let mut head = vec![0u8; CHUNK.min(size) as usize];
    file.read_exact(&mut head).map_err(|e| {
        MediaError::new(
            MediaErrorCode::MediaUnreadable,
            "Could not read the media file",
        )
        .with_cause(e.to_string())
    })?;
    hasher.update(&head);

    if size > CHUNK * 2 {
        let mut tail = vec![0u8; CHUNK as usize];
        file.seek(SeekFrom::End(-(CHUNK as i64))).map_err(|e| {
            MediaError::new(
                MediaErrorCode::MediaUnreadable,
                "Could not seek the media file",
            )
            .with_cause(e.to_string())
        })?;
        file.read_exact(&mut tail).map_err(|e| {
            MediaError::new(
                MediaErrorCode::MediaUnreadable,
                "Could not read the media file",
            )
            .with_cause(e.to_string())
        })?;
        hasher.update(&tail);
    }

    Ok(format!("{:x}", hasher.finalize()))
}

fn classify(
    container: &str,
    video: &[VideoStreamInfo],
    audio: &[AudioStreamInfo],
) -> CompatibilityTier {
    let is_mp4_family = container.contains("mp4") || container.contains("mov");
    let has_h264 = video.iter().any(|v| v.codec == "h264");
    let has_hevc = video.iter().any(|v| v.codec == "hevc");
    let aac_ok = audio.is_empty() || audio.iter().any(|a| a.codec == "aac");

    if video.is_empty() && audio.is_empty() {
        return CompatibilityTier::Unsupported;
    }
    // DEC-MEDIA-001: H.264/AAC MP4 is the certified baseline.
    if is_mp4_family && has_h264 && aac_ok {
        CompatibilityTier::Certified
    } else if is_mp4_family && has_hevc {
        // DEC-MEDIA-002: H.265 depends on device/codec capability.
        CompatibilityTier::Conditional
    } else {
        CompatibilityTier::BestEffort
    }
}

/// Inspect a media file. `path` must already be validated by the caller.
pub fn inspect(request_id: &str, path: &Path) -> Result<InspectResult> {
    if !path.exists() {
        return Err(MediaError::new(
            MediaErrorCode::MediaUnreadable,
            "The media file could not be found.",
        ));
    }

    let output = Command::new(ffprobe_path())
        .args([
            "-v",
            "error",
            "-print_format",
            "json",
            "-show_format",
            "-show_streams",
        ])
        .arg(path)
        .output()
        .map_err(|e| {
            MediaError::new(
                MediaErrorCode::MediaInspectFailed,
                "Could not run media inspection.",
            )
            .with_cause(e.to_string())
        })?;

    if !output.status.success() {
        return Err(MediaError::new(
            MediaErrorCode::MediaUnreadable,
            "The file could not be read as media.",
        )
        .with_cause(
            String::from_utf8_lossy(&output.stderr)
                .chars()
                .take(400)
                .collect::<String>(),
        ));
    }

    let probe: Value = serde_json::from_slice(&output.stdout).map_err(|e| {
        MediaError::new(
            MediaErrorCode::MediaInspectFailed,
            "Media inspection returned unreadable data.",
        )
        .with_cause(e.to_string())
    })?;

    let format = probe.get("format").cloned().unwrap_or(Value::Null);
    let container = format
        .get("format_name")
        .and_then(Value::as_str)
        .unwrap_or("unknown")
        .to_string();
    let duration_secs = format
        .get("duration")
        .and_then(Value::as_str)
        .and_then(|s| s.parse::<f64>().ok())
        .unwrap_or(0.0);
    let start_secs = format
        .get("start_time")
        .and_then(Value::as_str)
        .and_then(|s| s.parse::<f64>().ok())
        .unwrap_or(0.0);
    let file_size_bytes = format
        .get("size")
        .and_then(Value::as_str)
        .and_then(|s| s.parse::<u64>().ok())
        .unwrap_or(0);

    let empty: Vec<Value> = Vec::new();
    let streams = probe
        .get("streams")
        .and_then(Value::as_array)
        .unwrap_or(&empty);

    let mut video_streams = Vec::new();
    let mut audio_streams = Vec::new();
    let mut other_streams = Vec::new();
    let mut warnings = Vec::new();

    for s in streams {
        let index = s.get("index").and_then(Value::as_u64).unwrap_or(0) as u32;
        let codec_type = s.get("codec_type").and_then(Value::as_str).unwrap_or("");
        let codec = s
            .get("codec_name")
            .and_then(Value::as_str)
            .unwrap_or("unknown")
            .to_string();

        match codec_type {
            "video" => {
                let avg = parse_rational(s.get("avg_frame_rate").and_then(Value::as_str), (0, 1));
                let r = parse_rational(s.get("r_frame_rate").and_then(Value::as_str), (0, 1));
                // VFR detection: differing average and base rates (media-engine.md §5).
                let is_vfr = avg.numerator * r.denominator != r.numerator * avg.denominator;
                if is_vfr {
                    warnings.push(MediaWarning {
                        code: "VARIABLE_FRAME_RATE".into(),
                        message:
                            "Source appears variable-frame-rate; nominal fps is not source truth."
                                .into(),
                        severity: "warning".into(),
                    });
                }
                video_streams.push(VideoStreamInfo {
                    index,
                    codec,
                    profile: s.get("profile").and_then(Value::as_str).map(String::from),
                    width: s.get("width").and_then(Value::as_u64).unwrap_or(0) as u32,
                    height: s.get("height").and_then(Value::as_u64).unwrap_or(0) as u32,
                    pixel_aspect_ratio: parse_rational(
                        s.get("sample_aspect_ratio").and_then(Value::as_str),
                        (1, 1),
                    ),
                    avg_frame_rate: avg,
                    r_frame_rate: r,
                    is_variable_frame_rate: is_vfr,
                    color_primaries: s
                        .get("color_primaries")
                        .and_then(Value::as_str)
                        .map(String::from),
                    color_transfer: s
                        .get("color_transfer")
                        .and_then(Value::as_str)
                        .map(String::from),
                    color_space: s
                        .get("color_space")
                        .and_then(Value::as_str)
                        .map(String::from),
                    rotation_degrees: None,
                });
            }
            "audio" => audio_streams.push(AudioStreamInfo {
                index,
                codec,
                sample_rate: s
                    .get("sample_rate")
                    .and_then(Value::as_str)
                    .and_then(|x| x.parse::<u32>().ok())
                    .unwrap_or(0),
                channels: s.get("channels").and_then(Value::as_u64).unwrap_or(0) as u32,
                channel_layout: s
                    .get("channel_layout")
                    .and_then(Value::as_str)
                    .map(String::from),
                language: None,
            }),
            other => other_streams.push(OtherStreamInfo {
                index,
                kind: if other == "subtitle" {
                    "subtitle".into()
                } else {
                    "data".into()
                },
                codec: Some(codec),
            }),
        }
    }

    let compatibility = classify(&container, &video_streams, &audio_streams);
    let fingerprint = fingerprint(path, file_size_bytes)?;

    Ok(InspectResult {
        request_id: request_id.to_string(),
        asset_fingerprint: fingerprint,
        container,
        duration_ticks: seconds_to_ticks(duration_secs),
        start_ticks: seconds_to_ticks(start_secs),
        file_size_bytes,
        video_streams,
        audio_streams,
        other_streams,
        compatibility,
        timecode: None,
        warnings,
    })
}
