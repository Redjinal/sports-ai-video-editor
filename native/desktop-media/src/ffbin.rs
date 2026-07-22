//! Locating the FFmpeg/FFprobe binaries.
//!
//! M1 uses a discovered binary (PATH, or an explicit override). Bundling a pinned
//! FFmpeg with the installer is an M1-spike output tracked as follow-up work, so the
//! lookup is centralised here and nowhere else in the crate.

use std::path::PathBuf;
use std::process::Command;

use crate::error::{MediaError, MediaErrorCode, Result};

const FFMPEG_ENV: &str = "SVE_FFMPEG_PATH";
const FFPROBE_ENV: &str = "SVE_FFPROBE_PATH";

fn resolve(env_key: &str, default_name: &str) -> PathBuf {
    match std::env::var(env_key) {
        Ok(value) if !value.trim().is_empty() => PathBuf::from(value),
        _ => PathBuf::from(default_name),
    }
}

pub fn ffmpeg_path() -> PathBuf {
    resolve(FFMPEG_ENV, "ffmpeg")
}

pub fn ffprobe_path() -> PathBuf {
    resolve(FFPROBE_ENV, "ffprobe")
}

/// Verify both binaries are runnable, so the UI can report capability before a job starts.
pub fn probe_availability() -> Result<()> {
    for (path, name) in [(ffmpeg_path(), "ffmpeg"), (ffprobe_path(), "ffprobe")] {
        let status = Command::new(&path).arg("-version").output();
        match status {
            Ok(out) if out.status.success() => {}
            Ok(out) => {
                return Err(MediaError::new(
                    MediaErrorCode::MediaUnreadable,
                    format!("{name} is present but did not run successfully"),
                )
                .with_cause(format!("exit status {:?}", out.status.code())))
            }
            Err(err) => {
                return Err(MediaError::new(
                    MediaErrorCode::MediaUnreadable,
                    format!(
                        "{name} was not found. Install FFmpeg or set {FFMPEG_ENV}/{FFPROBE_ENV}."
                    ),
                )
                .with_cause(err.to_string()))
            }
        }
    }
    Ok(())
}
