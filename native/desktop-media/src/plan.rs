//! Render plan mirroring `@sve/media-contracts` `RenderPlan` (media-engine.md §13).
//! Deserialised from the UI/application layer; treated as untrusted input.

use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
pub struct Rational {
    pub numerator: i64,
    pub denominator: i64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoOutputSettings {
    pub codec: String,
    pub width: u32,
    pub height: u32,
    pub frame_rate: Rational,
    #[serde(default)]
    pub prefer_hardware: bool,
    #[serde(default)]
    pub quality: u32,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioOutputSettings {
    pub codec: String,
    pub sample_rate: u32,
    pub channels: u32,
    #[serde(default)]
    pub bitrate_kbps: u32,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderClip {
    pub asset_id: String,
    pub source_path: String,
    pub source_in_ticks: i64,
    pub source_duration_ticks: i64,
    pub timeline_start_ticks: i64,
    pub timeline_duration_ticks: i64,
    #[serde(default = "one")]
    pub playback_rate: f64,
}

fn one() -> f64 {
    1.0
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderTrack {
    pub id: String,
    pub kind: String,
    pub order: i32,
    pub clips: Vec<RenderClip>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderRange {
    pub start_ticks: i64,
    pub end_ticks: i64,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RenderPlan {
    pub version: u32,
    pub sequence_id: String,
    pub range: RenderRange,
    pub video: VideoOutputSettings,
    pub audio: AudioOutputSettings,
    pub tracks: Vec<RenderTrack>,
    #[serde(default)]
    pub source_policy: Option<String>,
}
