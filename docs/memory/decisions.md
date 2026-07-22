# Accepted Decisions

> **Status:** Living authoritative log  
> **Authority:** Accepted product, architecture, scope, and workflow decisions  
> **Last updated:** 2026-07-22

## 1. Recording rules

- Add accepted decisions; do not delete history.
- Mark changed decisions as superseded and link the replacement.
- Record date, status, decision, and rationale.
- Minor implementation choices do not require entries unless they alter an authoritative contract.

## 2. Product decisions

| ID | Date | Status | Decision | Rationale |
|---|---|---|---|---|
| DEC-PROD-001 | 2026-07-22 | Accepted | Product category is a sports-aware general editor. | Keeps broad creator utility while giving basketball a clear advantage. |
| DEC-PROD-002 | 2026-07-22 | Accepted | Initial user is one solo general creator focused on sports and broadcast scenarios. | Phase 1 optimises a concrete user rather than a team/workspace abstraction. |
| DEC-PROD-003 | 2026-07-22 | Accepted | Phase 1 is an internal working prototype. | Prioritises technical and workflow proof over commercial infrastructure. |
| DEC-PROD-004 | 2026-07-22 | Accepted | No account is required and projects belong to one local user. | Supports local-first use and avoids premature identity/backend work. |
| DEC-PROD-005 | 2026-07-22 | Accepted | Primary outputs are a YouTube-ready long-form master and several social-ready clips. | One completed project should serve both long and short distribution. |
| DEC-PROD-006 | 2026-07-22 | Accepted | Typical source duration is 60–120 minutes. | Long-form reliability and proxy workflows are core requirements. |
| DEC-PROD-007 | 2026-07-22 | Accepted | Editing combines timeline, transcript, and AI assistant. | Different tasks benefit from different control surfaces. |
| DEC-PROD-008 | 2026-07-22 | Accepted | No built-in camera, screen, microphone, or voiceover recording in Phase 1. | All source assets are imported; recording would expand platform scope. |
| DEC-PROD-009 | 2026-07-22 | Accepted | Interface is dark, timeline-first, desktop-only, resizable/collapsible, and follows familiar CapCut shortcuts. | Optimises long editing sessions and an accessible learning curve. |
| DEC-PROD-010 | 2026-07-22 | Accepted | Visual identity should be distinct rather than a VEED clone. | Familiar layout can coexist with a broadcast-control-room identity. |

## 3. Editing decisions

| ID | Date | Status | Decision | Rationale |
|---|---|---|---|---|
| DEC-EDIT-001 | 2026-07-22 | Accepted | Support multiple simultaneous video and audio tracks plus text/photo/graphic overlays. | Required for broadcast, podcast, and marketing use. |
| DEC-EDIT-002 | 2026-07-22 | Accepted | Video and source audio begin linked and may be detached/relinked. | Matches expected editing behaviour. |
| DEC-EDIT-003 | 2026-07-22 | Accepted | Core visual/audio properties support keyframes in Phase 1. | Required for social reframing and broadcast graphics. |
| DEC-EDIT-004 | 2026-07-22 | Accepted | Effects and edits are non-destructive project instructions. | Protects originals and supports undo/reuse. |
| DEC-EDIT-005 | 2026-07-22 | Accepted | Nested sequences are Phase 1. | Needed for reusable scenes, multicam, and replays. |
| DEC-EDIT-006 | 2026-07-22 | Accepted | Markers, comments/notes, and chapters are Phase 1 timeline concepts. | Long game navigation requires structured markers. |
| DEC-EDIT-007 | 2026-07-22 | Accepted | Transitions are separate timeline objects. | Makes duration and manipulation explicit. |
| DEC-EDIT-008 | 2026-07-22 | Accepted | Fixed speeds 0.25×, 0.5×, 1×, and 2× are Phase 1; speed ramps are excluded. | Provides basic replay utility without advanced time remapping. |
| DEC-EDIT-009 | 2026-07-22 | Accepted | Canonical timeline time is integer ticks at 27,000,000 ticks/second. | Exactly represents common production frame rates. |

## 4. Basketball decisions

| ID | Date | Status | Decision | Rationale |
|---|---|---|---|---|
| DEC-BSK-001 | 2026-07-22 | Accepted | Basketball is the first sport-specific domain. | It is the initial workflow to optimise and validate. |
| DEC-BSK-002 | 2026-07-22 | Accepted | Support up to four simultaneous cameras. | Balances useful coverage with Phase 1 complexity. |
| DEC-BSK-003 | 2026-07-22 | Accepted | Logging an approved made basket updates the score automatically. | Event truth should drive scorebug and highlights. |
| DEC-BSK-004 | 2026-07-22 | Accepted | The user synchronises the game clock per period and may add correction anchors. | Handles edited/missing footage without unreliable continuous inference. |
| DEC-BSK-005 | 2026-07-22 | Accepted | Optional roster includes name, number, position, and image. | Enables player graphics and player-scoped clips without requiring full stats. |
| DEC-BSK-006 | 2026-07-22 | Accepted | Phase 1 statistics are basic points, team fouls, and major events. | Full box-score management is outside core editing proof. |
| DEC-BSK-007 | 2026-07-22 | Accepted | Replay is created from a selected range as a nested replay object. | Keeps replays non-destructive and retrimmable. |
| DEC-BSK-008 | 2026-07-22 | Accepted | Multicam supports live keyboard switching and later refinement. | Enables efficient first pass and precise correction. |
| DEC-BSK-009 | 2026-07-22 | Accepted | No visual sports analysis in Phase 1. | Initial highlights rely on events, audio, transcript, and markers. |
| DEC-BSK-010 | 2026-07-22 | Accepted | Rosters/game data support manual entry plus CSV/JSON import. | Practical local data entry without league integrations. |
| DEC-BSK-011 | 2026-07-22 | Accepted | Scorebug includes editable score, clock, period, teams, possession, fouls, timeouts, bonus, optional shot clock, and sponsor data. | Establishes a useful basic broadcast package. |

## 5. Platform and architecture decisions

| ID | Date | Status | Decision | Rationale |
|---|---|---|---|---|
| DEC-ARCH-001 | 2026-07-22 | Accepted | Use a monorepo. | Shared domains and two platform shells need coordinated evolution. |
| DEC-ARCH-002 | 2026-07-22 | Accepted | Shared UI uses React and TypeScript. | Supports a common desktop/DeX interface and strong domain contracts. |
| DEC-ARCH-003 | 2026-07-22 | Accepted, conditional | Use Tauri with Rust for the Windows native layer, subject to M1 benchmark validation. | Rust is selected for safe native orchestration, not because it determines encode quality. |
| DEC-ARCH-004 | 2026-07-22 | Accepted | Use Kotlin and an Android-native media adapter for DeX. | Android lifecycle and codec access should remain native. |
| DEC-ARCH-005 | 2026-07-22 | Accepted | Desktop media processing uses native FFmpeg/FFprobe. | Provides broad inspection and quality-controlled local rendering. |
| DEC-ARCH-006 | 2026-07-22 | Accepted | DeX uses Android-native media capabilities and compatible proxies rather than assuming desktop FFmpeg parity. | Platform capability differs and must be explicit. |
| DEC-ARCH-007 | 2026-07-22 | Accepted | Timeline, basketball, project, AI, media, and connector domains remain platform-neutral. | Prevents native/provider lock-in. |
| DEC-ARCH-008 | 2026-07-22 | Accepted | Portable project truth uses versioned JSON; SQLite is a rebuildable local index. | Balances portability, inspectability, and long-project performance. |

## 6. Platform support decisions

| ID | Date | Status | Decision | Rationale |
|---|---|---|---|---|
| DEC-PLAT-001 | 2026-07-22 | Accepted | Initial desktop target is Windows only. | Narrows certification and native integration. |
| DEC-PLAT-002 | 2026-07-22 | Accepted | DeX supports full editing with 720p/1080p export; Windows handles 1440p/4K. | Keeps DeX useful while acknowledging device constraints. |
| DEC-PLAT-003 | 2026-07-22 | Accepted | Minimum logical viewport is 1280×800. | Represents the smallest supported DeX desktop-class layout. |
| DEC-PLAT-004 | 2026-07-22 | Accepted | Hardware acceleration is used when available with high-quality software fallback. | Preserves quality and compatibility. |

## 7. Media decisions

| ID | Date | Status | Decision | Rationale |
|---|---|---|---|---|
| DEC-MEDIA-001 | 2026-07-22 | Accepted | Certified import includes H.264/AAC MP4, MP3/AAC/WAV, PNG/JPEG/WebP, SRT/VTT. | Defines a testable compatibility baseline. |
| DEC-MEDIA-002 | 2026-07-22 | Accepted | H.265/HEVC MP4/MOV is conditionally certified. | Support depends on device/codec capability. |
| DEC-MEDIA-003 | 2026-07-22 | Accepted | Windows attempts broader FFmpeg-readable formats as best-effort, not certified. | Broad access without an impossible guarantee. |
| DEC-MEDIA-004 | 2026-07-22 | Accepted | Proxy generation is required and offers 720p and 1080p profiles. | Two-hour four-camera work requires responsive derivatives. |
| DEC-MEDIA-005 | 2026-07-22 | Accepted | Final exports are local. | Aligns with local-first ownership and avoids render backend scope. |
| DEC-MEDIA-006 | 2026-07-22 | Accepted | Windows exports H.264/AAC and H.265/AAC MP4 at 720p–4K. | Covers compatibility and efficient high-quality delivery. |
| DEC-MEDIA-007 | 2026-07-22 | Accepted | Quality is prioritised over export speed. | Hardware paths cannot silently reduce requested output. |
| DEC-MEDIA-008 | 2026-07-22 | Accepted | Export success requires output validation. | Process completion alone is not reliable proof. |
| DEC-MEDIA-009 | 2026-07-22 | Accepted | Originals are linked by default; users can consolidate/package. | Avoids automatic duplication of large footage. |
| DEC-MEDIA-010 | 2026-07-22 | Accepted | Phase 1 exports have no forced watermark or product branding. | The internal prototype should produce clean usable output. |

## 8. AI decisions

| ID | Date | Status | Decision | Rationale |
|---|---|---|---|---|
| DEC-AI-001 | 2026-07-22 | Accepted | AI execution is hybrid: cloud analysis with local editing and export. | Uses strong cloud analysis while keeping media/render local. |
| DEC-AI-002 | 2026-07-22 | Accepted | Essential Phase 1 AI includes transcription and automatic short-clip proposals. | These provide the clearest initial productivity gain. |
| DEC-AI-003 | 2026-07-22 | Accepted | Support natural-language commands scoped to project or selection. | Makes AI useful without replacing the timeline. |
| DEC-AI-004 | 2026-07-22 | Accepted | AI provides confidence and explanation. | Users need evidence to review proposals. |
| DEC-AI-005 | 2026-07-22 | Accepted | English transcription, multiple speakers, and caption translation are Phase 1. | Covers the initial content language and useful localisation. |
| DEC-AI-006 | 2026-07-22 | Accepted | AI uses project brand instructions. | Suggestions should align with reusable creator style. |
| DEC-AI-007 | 2026-07-22 | Accepted | AI automatically creates separate proposal sequences. | Preserves the approved master while reducing manual setup. |
| DEC-AI-008 | 2026-07-22 | Accepted | Full-resolution video is not sent when audio/transcript/metadata is sufficient. | Minimises privacy, cost, and transfer. |

## 9. Asset, brand, and connector decisions

| ID | Date | Status | Decision | Rationale |
|---|---|---|---|---|
| DEC-ASSET-001 | 2026-07-22 | Accepted | No stock media library in Phase 1. | User imports assets and stock scope is deferred. |
| DEC-ASSET-002 | 2026-07-22 | Accepted | Custom fonts, brand kits, reusable templates, caption styles, lower thirds, scorebugs, intros/outros, and sponsor graphics are Phase 1. | Branding is central to creator and broadcast workflows. |
| DEC-ASSET-003 | 2026-07-22 | Accepted | Include waveform visualisers, progress bars, shapes, and image overlays. | Supports podcast, sports, and marketing layouts. |
| DEC-CON-001 | 2026-07-22 | Accepted | Phase 1 connectors are Google Drive, Dropbox, OneDrive, direct URL, and YouTube project integration. | Covers requested import sources through one contract. |
| DEC-CON-002 | 2026-07-22 | Accepted | Remote media is downloaded locally before editing. | Prevents fragile timeline dependency on remote URLs. |
| DEC-CON-003 | 2026-07-22 | Accepted | YouTube integration does not include unofficial source downloading. | Keeps the integration within authorised workflows. |

## 10. Agent and quality decisions

| ID | Date | Status | Decision | Rationale |
|---|---|---|---|---|
| DEC-GOV-001 | 2026-07-22 | Accepted | Agents use balanced autonomy. | They may implement and test accepted scope but publication remains human-controlled. |
| DEC-GOV-002 | 2026-07-22 | Accepted | Agents may create task branches automatically. | Keeps work isolated without requiring approval for routine setup. |
| DEC-GOV-003 | 2026-07-22 | Accepted | Commit, push, PR, merge, release, deploy, destructive data actions, and history rewrite require direct instruction. | Preserves human control over publication and destructive actions. |
| DEC-GOV-004 | 2026-07-22 | Accepted | Every feature begins with a written implementation plan and existing-pattern inspection. | Reduces drift and duplicated architecture. |
| DEC-GOV-005 | 2026-07-22 | Accepted | Scope expansion requires a reasoned discussion and explicit acceptance. | Useful expansion remains possible without silent scope creep. |
| DEC-GOV-006 | 2026-07-22 | Accepted | Update `active-state.md` after tasks and `decisions.md` only after accepted decisions. | Keeps memory useful rather than noisy. |
| DEC-QUAL-001 | 2026-07-22 | Accepted | Use risk-based quality gates. | Matches validation cost to interface, domain, media, AI, connector, and release risk. |
