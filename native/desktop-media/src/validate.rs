//! Output validation (media-engine.md §18).
//!
//! An export is successful ONLY when every required check passes. A missing or truncated
//! stream is a failure, and a produced file is never itself treated as proof of success.

use std::path::Path;
use std::process::Command;

use serde::Serialize;

use crate::error::Result;
use crate::ffbin::ffmpeg_path;
use crate::inspect::inspect;
use crate::TIMESCALE;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidationCheck {
    pub name: String,
    pub passed: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<String>,
    pub required: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MeasuredOutput {
    pub duration_ticks: i64,
    pub width: u32,
    pub height: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub video_codec: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub audio_codec: Option<String>,
    pub file_size_bytes: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OutputValidationResult {
    pub valid: bool,
    pub checks: Vec<ValidationCheck>,
    pub measured: MeasuredOutput,
}

pub struct ExpectedOutput {
    pub width: u32,
    pub height: u32,
    pub video_codec: String,
    pub duration_ticks: i64,
    pub expect_audio: bool,
}

fn check(name: &str, passed: bool, required: bool, detail: Option<String>) -> ValidationCheck {
    ValidationCheck {
        name: name.to_string(),
        passed,
        detail,
        required,
    }
}

/// ffprobe reports H.265 as `hevc`; normalise so plan codecs compare cleanly.
fn normalise_codec(codec: &str) -> &str {
    match codec {
        "h265" => "hevc",
        other => other,
    }
}

/// Decode a single frame at `at_seconds` to prove the stream is really readable there.
fn sample_decodes(path: &Path, duration_seconds: f64) -> bool {
    if duration_seconds <= 0.0 {
        return false;
    }
    // First, middle, and near-final sample points (media-engine.md §18).
    let points = [
        0.0_f64,
        duration_seconds / 2.0,
        (duration_seconds - 0.5).max(0.0),
    ];
    for at in points {
        let out = Command::new(ffmpeg_path())
            .args(["-v", "error", "-ss"])
            .arg(format!("{at:.3}"))
            .arg("-i")
            .arg(path)
            .args(["-frames:v", "1", "-f", "null", "-"])
            .output();
        match out {
            Ok(o) if o.status.success() => {}
            _ => return false,
        }
    }
    true
}

/// Decode the whole stream and treat ANY decoder diagnostic as failure.
///
/// This is the check that actually catches truncation. Container metadata cannot be
/// trusted: with `+faststart` the `moov` atom sits at the head of the file, so a
/// truncated render still reports its full declared duration and can still satisfy a
/// single-frame seek. Only a complete decode proves the media is really there.
fn full_decode_ok(path: &Path) -> (bool, Option<String>) {
    let out = Command::new(ffmpeg_path())
        .args(["-v", "error", "-xerror", "-i"])
        .arg(path)
        .args(["-f", "null", "-"])
        .output();
    match out {
        Ok(o) => {
            let stderr = String::from_utf8_lossy(&o.stderr);
            let complaint = stderr.trim();
            if o.status.success() && complaint.is_empty() {
                (true, None)
            } else {
                let detail: String = complaint.lines().take(3).collect::<Vec<_>>().join(" | ");
                (
                    false,
                    Some(if detail.is_empty() {
                        "decoder exited with a failure status".to_string()
                    } else {
                        detail
                    }),
                )
            }
        }
        Err(e) => (false, Some(e.to_string())),
    }
}

/// Validate a rendered file against what the render plan promised.
pub fn validate_output(path: &Path, expected: &ExpectedOutput) -> Result<OutputValidationResult> {
    let mut checks = Vec::new();

    let exists = path.exists();
    checks.push(check("output_exists", exists, true, None));
    if !exists {
        return Ok(OutputValidationResult {
            valid: false,
            checks,
            measured: MeasuredOutput {
                duration_ticks: 0,
                width: 0,
                height: 0,
                video_codec: None,
                audio_codec: None,
                file_size_bytes: 0,
            },
        });
    }

    // If the container will not open/parse, everything downstream is moot.
    let probed = inspect("validate", path);
    let info = match probed {
        Ok(info) => {
            checks.push(check("container_opens", true, true, None));
            info
        }
        Err(e) => {
            checks.push(check(
                "container_opens",
                false,
                true,
                Some(e.safe_message.clone()),
            ));
            return Ok(OutputValidationResult {
                valid: false,
                checks,
                measured: MeasuredOutput {
                    duration_ticks: 0,
                    width: 0,
                    height: 0,
                    video_codec: None,
                    audio_codec: None,
                    file_size_bytes: 0,
                },
            });
        }
    };

    let video = info.video_streams.first();
    let audio = info.audio_streams.first();

    checks.push(check("video_stream_present", video.is_some(), true, None));
    checks.push(check(
        "audio_stream_present",
        !expected.expect_audio || audio.is_some(),
        expected.expect_audio,
        None,
    ));

    let expected_codec = normalise_codec(&expected.video_codec);
    let codec_ok = video.map(|v| v.codec == expected_codec).unwrap_or(false);
    checks.push(check(
        "codec_matches",
        codec_ok,
        true,
        video.map(|v| format!("expected {}, got {}", expected_codec, v.codec)),
    ));

    let res_ok = video
        .map(|v| v.width == expected.width && v.height == expected.height)
        .unwrap_or(false);
    checks.push(check(
        "resolution_matches",
        res_ok,
        true,
        video.map(|v| {
            format!(
                "expected {}x{}, got {}x{}",
                expected.width, expected.height, v.width, v.height
            )
        }),
    ));

    let fps_ok = video
        .map(|v| v.r_frame_rate.numerator > 0 && v.r_frame_rate.denominator > 0)
        .unwrap_or(false);
    checks.push(check("frame_rate_valid", fps_ok, true, None));

    // Duration tolerance: a quarter second absorbs encoder/container rounding without
    // hiding a truncated render.
    let tolerance = TIMESCALE / 4;
    let delta = (info.duration_ticks - expected.duration_ticks).abs();
    checks.push(check(
        "duration_within_tolerance",
        delta <= tolerance,
        true,
        Some(format!(
            "expected {} ticks, got {} ticks (delta {})",
            expected.duration_ticks, info.duration_ticks, delta
        )),
    ));

    checks.push(check(
        "not_truncated",
        info.duration_ticks > 0 && info.duration_ticks + tolerance >= expected.duration_ticks,
        true,
        None,
    ));

    checks.push(check(
        "file_size_plausible",
        info.file_size_bytes > 1024,
        true,
        Some(format!("{} bytes", info.file_size_bytes)),
    ));

    let duration_seconds = info.duration_ticks as f64 / TIMESCALE as f64;
    checks.push(check(
        "sample_decode_first_middle_last",
        sample_decodes(path, duration_seconds),
        true,
        None,
    ));

    // Authoritative content check: decode every frame and reject on any decoder error.
    let (decoded, decode_detail) = full_decode_ok(path);
    checks.push(check("full_decode_clean", decoded, true, decode_detail));

    let valid = checks.iter().all(|c| !c.required || c.passed);

    Ok(OutputValidationResult {
        valid,
        checks,
        measured: MeasuredOutput {
            duration_ticks: info.duration_ticks,
            width: video.map(|v| v.width).unwrap_or(0),
            height: video.map(|v| v.height).unwrap_or(0),
            video_codec: video.map(|v| v.codec.clone()),
            audio_codec: audio.map(|a| a.codec.clone()),
            file_size_bytes: info.file_size_bytes,
        },
    })
}
