# Media fixtures

All fixtures here are **synthetic**, generated from FFmpeg's built-in `testsrc2` and `sine`
sources. They contain no copyrighted, private, or personal material
(testing-strategy.md §3).

## Regenerate

```
node tools/fixtures/generate-fixtures.mjs          # short fixture only
node tools/fixtures/generate-fixtures.mjs --long   # also the 10-minute F3 fixture
```

Requires `ffmpeg` and `ffprobe` on PATH.

## Inventory

| File | Tier | Spec | Committed |
|---|---|---|---|
| `sync8s_1080p30_h264_aac.mp4` | F1/F2 | 8 s, 1920×1080, 30 fps CFR, H.264 High / yuv420p, AAC 48 kHz stereo | yes |
| `generated/vslice_600s_1080p30_h264_aac.mp4` | F3 | 10 min, same spec | no — regenerate locally |

The 10-minute fixture is the one M1's exit criteria call for. It is git-ignored because of
its size and is reproducible byte-for-byte from the generator on the same FFmpeg build.

`checksums.json` records SHA-256 for whatever the last generator run produced.

## Why this spec

H.264/AAC in MP4 is the **certified** import and export baseline (DEC-MEDIA-001,
DEC-MEDIA-006). Constant frame rate and a plain `yuv420p` pixel format keep the fixture
unambiguous, so any duration, frame-rate, or A/V-sync deviation observed in a test is a
real defect rather than a property of the source.
