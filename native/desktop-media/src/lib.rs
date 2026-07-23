//! Windows desktop media adapter for the Sports-Aware AI Video Editor.
//!
//! This crate owns every FFmpeg/FFprobe detail (structure.md §6). It exposes
//! platform-neutral shapes that match `@sve/media-contracts`, so the timeline and
//! project domains never learn that FFmpeg exists.

pub mod encode;
pub mod error;
pub mod ffbin;
pub mod inspect;
pub mod managed;
pub mod plan;
pub mod thumbnail;
pub mod validate;
pub mod waveform;

/// Canonical timeline timescale: integer ticks per second (DEC-EDIT-009).
/// Must stay identical to `TIMESCALE` in `@sve/timeline-domain`.
pub const TIMESCALE: i64 = 27_000_000;

#[cfg(test)]
#[allow(clippy::expect_used)]
mod tests {
    use super::*;

    #[test]
    fn timescale_matches_the_domain_constant() {
        assert_eq!(TIMESCALE, 27_000_000);
    }

    #[test]
    fn rejects_a_plan_with_no_video_clip() {
        let json = serde_json::json!({
            "version": 1,
            "sequenceId": "seq_1",
            "range": { "startTicks": 0, "endTicks": 27_000_000i64 },
            "video": { "codec": "h264", "width": 1920, "height": 1080,
                       "frameRate": { "numerator": 30, "denominator": 1 },
                       "preferHardware": true, "quality": 70 },
            "audio": { "codec": "aac", "sampleRate": 48000, "channels": 2, "bitrateKbps": 192 },
            "tracks": [],
            "sourcePolicy": "originals"
        });
        let plan: plan::RenderPlan = serde_json::from_value(json).expect("plan parses");
        let err = encode::resolve_single_clip(&plan).expect_err("must reject an empty plan");
        assert_eq!(err.code, error::MediaErrorCode::ExportInvalidPlan);
    }

    #[test]
    fn rejects_multi_clip_plans_in_the_m1_slice() {
        let clip = serde_json::json!({
            "assetId": "ast_1", "sourcePath": "missing.mp4",
            "sourceInTicks": 0, "sourceDurationTicks": 27_000_000i64,
            "timelineStartTicks": 0, "timelineDurationTicks": 27_000_000i64,
            "playbackRate": 1
        });
        let json = serde_json::json!({
            "version": 1,
            "sequenceId": "seq_1",
            "range": { "startTicks": 0, "endTicks": 54_000_000i64 },
            "video": { "codec": "h264", "width": 1920, "height": 1080,
                       "frameRate": { "numerator": 30, "denominator": 1 },
                       "preferHardware": true, "quality": 70 },
            "audio": { "codec": "aac", "sampleRate": 48000, "channels": 2, "bitrateKbps": 192 },
            "tracks": [ { "id": "t1", "kind": "video", "order": 0, "clips": [clip.clone(), clip] } ],
            "sourcePolicy": "originals"
        });
        let plan: plan::RenderPlan = serde_json::from_value(json).expect("plan parses");
        let err = encode::resolve_single_clip(&plan).expect_err("must reject multi-clip");
        assert_eq!(err.code, error::MediaErrorCode::ExportInvalidPlan);
    }
}
