# Media Engine

> **Status:** Authoritative  
> **Authority:** Media compatibility, ingest, proxy, preview, render, export, and validation  
> **Version:** 1.0  
> **Last updated:** 2026-07-22

## 1. Responsibilities

The media engine owns platform-specific execution for:

- Media inspection
- Decode capability checks
- Managed conversion
- Proxy generation
- Thumbnail extraction
- Waveform generation
- Preview support
- Audio extraction
- Render-plan execution
- Encoding and muxing
- Export validation
- Cancellation and cleanup

It does not own timeline semantics, project decisions, AI proposal logic, or basketball state.

## 2. Platform engines

### Windows

- Native FFprobe for inspection
- Native FFmpeg for proxy, thumbnail, waveform, audio extraction, render, and export
- Rust adapter for safe process orchestration and structured progress
- Hardware decode/encode when available and selected
- High-quality software fallback

### Samsung DeX

- Kotlin native adapter
- Media3/MediaCodec for supported preview/composition/export
- 720p and 1080p export
- Device capability detection
- DeX-compatible proxies for unsupported or heavy originals

The platform-neutral media contract must not expose FFmpeg filters or Media3 classes.

## 3. Compatibility tiers

### Tier 1 — Certified import

Formal Phase 1 guarantees:

| Media | Certified combinations |
|---|---|
| Video | MP4 container, H.264/AVC video, AAC audio |
| Audio | MP3, AAC/M4A, WAV PCM |
| Images | PNG, JPEG, WebP |
| Captions | SRT, VTT |
| Fonts | Common desktop font files supported by the platform, subject to validation and licensing |

Certification covers:

- Inspection
- Preview
- Proxy creation
- Timeline placement
- Save/reopen
- Original relink
- Export

### Tier 2 — Conditional import

- MP4 or MOV with H.265/HEVC and AAC
- Hardware/OS codec availability may affect direct preview
- Managed proxy/conversion should be offered
- Support status must be reported before timeline use

### Tier 3 — Best-effort Windows import

The Windows engine may attempt formats FFmpeg can inspect and decode, including examples such as MOV, MKV, AVI, WebM, MPEG-TS, ProRes, DNxHD/DNxHR, FLAC, OGG, and Opus.

Best-effort means:

- No complete certification promise
- Clear compatibility warning
- Managed conversion recommended
- Specific failure reason
- No silent import followed by later export failure

### DeX import policy

DeX checks device capabilities.

- Supported media may be linked or copied.
- Heavy or unsupported media should use a compatible proxy or managed derivative.
- Files that cannot be decoded or converted safely are rejected with an actionable error.
- A desktop-packaged project may include DeX-compatible proxies.

## 4. Export matrix

### Windows

| Container | Video | Audio | Resolutions |
|---|---|---|---|
| MP4 | H.264/AVC | AAC | 720p, 1080p, 1440p, 4K |
| MP4 | H.265/HEVC | AAC | 720p, 1080p, 1440p, 4K, subject to encoder path |

### DeX

| Container | Video | Audio | Resolutions |
|---|---|---|---|
| MP4 | Device-supported H.264 path | AAC | 720p, 1080p |
| MP4 | H.265 when explicitly supported and certified | AAC | Not promised until certified |

The UI must show only certified paths for the current device.

## 5. Media inspection

Inspection returns normalised metadata:

- Container
- Duration in timeline ticks
- Start time
- File size
- Video streams
- Audio streams
- Subtitle/data streams
- Codec profile and level where available
- Width, height, pixel aspect ratio
- Frame-rate fields
- Colour metadata
- Rotation/display matrix
- Sample rate, channels, and layout
- Timecode metadata
- Decode capability
- Compatibility tier
- Warnings
- Stable asset fingerprint inputs

### Variable frame rate

Variable-frame-rate files must be identified.

Policy:

- Preserve source timing in asset metadata.
- Recommend proxy normalisation for editing.
- Use explicit timestamp mapping.
- Never assume frame number multiplied by nominal frame duration is source truth.

## 6. Asset fingerprinting

An asset fingerprint should combine:

- File size
- Normalised media metadata
- Selected byte-range hashes
- Optional full checksum for packaging or relink verification

The fast fingerprint supports import and relinking. A full checksum may be created asynchronously.

Fingerprint collision must not cause silent relinking. Ambiguous matches require user review.

## 7. Ingest pipeline

```text
Select source
→ validate path/permission
→ inspect
→ classify compatibility
→ estimate storage
→ choose link/copy/convert/proxy policy
→ register asset
→ schedule thumbnails/waveforms/proxies
→ expose ready state
```

An asset can become visible before all derivatives are complete, but the UI must show readiness.

### Import modes

- Link original
- Copy original into project
- Convert to managed mezzanine/compatible asset
- Link original and create proxy
- Copy original and create proxy

## 8. Proxy policy

Proxy generation is a required Phase 1 capability.

### Default profiles

#### DeX compatible

```text
Resolution: 1280 × 720 maximum
Video: H.264
Frame rate: match source, capped at 60 fps
Audio: AAC
Purpose: DeX and limited hardware
```

#### Windows lightweight

```text
Resolution: 1280 × 720 maximum
Video: H.264 editing-friendly profile
Frame rate: match source
Audio: AAC
Purpose: four-camera or limited hardware
```

#### Windows standard

```text
Resolution: 1920 × 1080 maximum
Video: H.264 editing-friendly profile
Frame rate: match source
Audio: AAC
Purpose: standard desktop editing
```

### User choices

- Automatic
- 720p lightweight
- 1080p standard
- Original only
- Custom advanced profile

### Proxy invariants

- Proxy and original share one asset ID.
- Source-time mapping is explicit.
- Proxy creation never changes timeline references.
- Final export uses originals by default.
- Export-from-proxy requires an explicit warning and choice.
- Regenerating a proxy preserves edits.
- Proxy files are disposable derived data.

## 9. Managed conversion

Managed conversion is distinct from a proxy.

A managed conversion:

- Becomes a durable project asset derivative
- Is used when the original is unsupported or unstable
- Preserves source reference and conversion metadata
- May be packaged
- Must document any changed frame rate, colour, audio, or timing properties

The user must know whether final export uses original or managed derivative.

## 10. Thumbnails

Thumbnail generation:

- Uses a tile or strip strategy
- Is resolution-aware
- Avoids generating every visible thumbnail at once
- Supports cancellation
- Stores a versioned cache key
- Regenerates after relevant proxy or colour-orientation changes
- Never blocks project save

## 11. Waveforms

Waveforms are derived from decoded audio and stored as multi-resolution peak data.

Requirements:

- Support long audio without loading all samples into UI memory.
- Provide progressively refined waveform tiles.
- Preserve source-to-timeline mapping.
- Regenerate when selected audio stream changes.
- Be disposable.
- Expose silence and loudness features separately from display peaks.

## 12. Preview

### Goals

- Responsive scrubbing
- Stable A/V sync
- Multiple track composition
- Multicam view
- Proxy/original switching
- Clear preview-quality state

### Allowed preview simplifications

- Reduced resolution
- Proxy media
- Cached frames
- Reduced effect precision
- Disabled unsupported effect with visible indicator

### Not allowed

- Incorrect clip timing
- Hidden missing frames
- Silent angle substitution
- Different basketball score/clock state
- Different caption timing
- Export quality changes caused by preview setting

## 13. Render plan

The application produces a platform-neutral render plan.

Example structure:

```ts
interface RenderPlan {
  version: 1;
  sequenceId: string;
  range: { startTicks: number; endTicks: number };
  video: VideoOutputSettings;
  audio: AudioOutputSettings;
  tracks: RenderTrack[];
  overlays: RenderOverlay[];
  captions: RenderCaptionPlan;
  sourcePolicy: "originals" | "allow-managed" | "allow-proxies";
}
```

The desktop and DeX adapters translate this plan.

The render plan must include resolved:

- Source ranges
- Track ordering
- Transforms and keyframes
- Speed
- Audio mix
- Transitions
- Nested sequences
- Multicam angle choices
- Replays
- Graphics
- Captions
- Basketball-bound graphics

## 14. Export presets

Built-in presets:

- YouTube 720p
- YouTube 1080p
- YouTube 1440p
- YouTube 4K
- Social vertical 9:16
- Social square 1:1
- Social portrait 4:5
- Social landscape 16:9
- Audio-only
- Custom

Presets define defaults but remain reviewable. They do not hide codec, frame rate, quality, or destination. Phase 1 exports do not add a forced watermark or product brand.

## 15. Quality-first encoding

Principles:

- Prefer quality-targeted encoding over unnecessarily low fixed bitrates.
- Make hardware/software path visible.
- Keep a software maximum-quality path on Windows.
- Permit a short test-range export.
- Do not automatically lower resolution to make an export succeed.
- Report hardware encoder limitations.
- Preserve source frame rate unless the user selects a conversion.

## 16. Hardware acceleration

At startup or on demand, the adapter reports:

- Decode capabilities
- Encode capabilities
- Supported codecs
- Maximum tested resolution
- Relevant pixel formats
- Known limitations

Fallback sequence:

1. Requested certified hardware path.
2. Alternative certified hardware path, if selected policy permits.
3. High-quality software path.
4. Fail with actionable reason.

The engine must not silently switch from H.265 to H.264 or from 4K to 1080p.

## 17. Export lifecycle

```text
Validate project/range
→ resolve source availability
→ estimate output storage
→ create immutable render plan
→ create temporary destination
→ render and encode
→ flush and close
→ inspect output
→ validate output
→ atomically move to final destination
→ register completed job
```

## 18. Export validation

A job is successful only when:

- Output exists
- Container opens
- Expected video stream exists
- Expected audio stream exists when requested
- Codec matches
- Resolution matches
- Frame rate is valid
- Duration is within tolerance
- Output is not truncated
- File size is plausible
- First, middle, and near-final sample decode checks pass
- Captions/sidecars exist when requested

A warning state may be used for non-blocking metadata differences. A missing or truncated stream is failure.

## 19. A/V synchronisation

Tests must verify:

- Start alignment
- Midpoint drift
- End drift
- Multicam switch alignment
- Speed-adjusted replay
- Nested sequence boundaries
- Caption timing
- Audio fades and crossfades

Tolerance must be defined per certification fixture and should generally remain below one frame for video-aligned events unless source limitations are documented.

## 20. Cancellation and cleanup

Cancellation must:

- Signal the native job
- Stop child processes/codecs
- Close file handles
- Delete or quarantine partial temporary output
- Preserve the previous valid export
- Mark job cancelled, not failed
- Allow retry

Application exit may cancel active exports because background export is excluded. The user must be warned before exit.

## 21. Storage checks

Before proxy, conversion, packaging, or export:

- Estimate required space
- Check destination availability
- Reserve a safety margin
- Recheck before final move
- Report cache and proxy contribution
- Avoid filling the system drive silently

## 22. Cache management

Derived caches include:

- Inspection cache
- Thumbnail tiles
- Waveform tiles
- Preview frames
- Temporary render segments
- AI feature extracts

Cache rules:

- Versioned keys
- Size accounting
- Manual clear
- Automatic cleanup policy
- Never delete originals or managed durable assets
- Do not clear files used by active jobs
- Recover from missing cache by regenerating

## 23. Relinking

Relink candidates can match by:

1. Exact path
2. Stable platform file identity where available
3. Full checksum
4. Fast fingerprint
5. File name + size + metadata

Ambiguous matches require confirmation. The user may use a proxy temporarily while the original is offline.

## 24. Error handling

Examples:

- `MEDIA_UNREADABLE`
- `MEDIA_UNSUPPORTED_CODEC`
- `MEDIA_PERMISSION_DENIED`
- `MEDIA_PROXY_FAILED`
- `MEDIA_PROXY_MAPPING_INVALID`
- `MEDIA_DISK_SPACE`
- `MEDIA_HARDWARE_UNAVAILABLE`
- `EXPORT_INVALID_PLAN`
- `EXPORT_SOURCE_OFFLINE`
- `EXPORT_ENCODER_FAILED`
- `EXPORT_VALIDATION_FAILED`
- `EXPORT_CANCELLED`

Every error states data safety and recovery.

## 25. Security

- Never build shell commands through unescaped user strings.
- Pass structured argument arrays.
- Validate local paths.
- Treat media as untrusted.
- Bound metadata parsing and preview extraction.
- Use unique temporary directories.
- Avoid following untrusted symbolic links during packaging.
- Clean sensitive temporary audio extracts according to policy.

See [`../operations/security-operations.md`](../operations/security-operations.md).

## 26. Test matrix

The media engine requires:

- Certified short fixtures
- Variable-frame-rate fixture
- Multiple audio stream fixture
- Rotation metadata fixture
- HEVC conditional fixture
- Best-effort fixture
- Corrupt/truncated file
- 10-minute vertical slice
- 3–10-minute integration project
- 30-minute multicam milestone fixture
- 120-minute 2K release fixture
- H.264 and H.265 export verification
- 720p/1080p/1440p/4K Windows verification
- 720p/1080p DeX verification
- Hardware and software path tests
- Cancellation and disk-full simulations

The normative test strategy is in [`../engineering/testing-strategy.md`](../engineering/testing-strategy.md).
