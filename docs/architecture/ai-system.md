# AI System

> **Status:** Authoritative  
> **Authority:** AI permissions, provider boundaries, analysis, proposals, evidence, consent, and evaluation  
> **Version:** 1.0  
> **Last updated:** 2026-07-22

## 1. Purpose

AI should reduce review and editing effort without obscuring or taking control of the approved edit.

Phase 1 AI centres on:

- English transcription
- Multiple-speaker separation
- Caption generation
- English-source caption translation
- Natural-language editing assistance
- Basketball-aware highlight proposals
- Social clip proposals
- Explainable confidence and evidence
- Reversible acceptance

## 2. Governing principle

> **AI proposes; the user decides.**

AI output is untrusted, provisional input until the user approves an action.

## 3. Phase 1 AI capabilities

### Automatic analysis

May run without changing the master:

- Transcription
- Speaker separation
- Caption draft
- Translation draft
- Silence and pause labels
- Commentary-intensity features
- Crowd-volume features
- Keyword and entity extraction
- Candidate basketball-event suggestions
- Candidate highlight scoring
- Title, description, and social copy suggestions

### Proposal creation

May create:

- Draft markers
- Draft captions
- Separate proposal sequences
- Suggested source boundaries
- Suggested camera switch points
- Suggested replay ranges
- Suggested reframe keyframes

### Explicit approval required

AI cannot directly:

- Mutate the approved master
- Delete or ripple-delete footage
- Apply a camera switch
- Insert a replay
- Set or correct the official score
- Set or correct the official game clock
- Replace approved captions
- Reframe an approved sequence
- Replace graphics or brand assets
- Delete project media
- Overwrite an export

## 4. Excluded AI capabilities

- Full visual basketball-event recognition
- Automatic scoreboard reading
- Player tracking
- Ball tracking
- Jersey-number recognition
- Text-to-video
- AI avatars
- Generative replacement
- Autonomous full edit
- Training on user footage by default

## 5. Provider-neutral architecture

```text
Application AI request
→ policy and consent check
→ local feature preparation
→ provider adapter
→ provider response
→ schema validation
→ normalisation
→ proposal engine
→ project proposal state
```

Provider SDK types must not leak into domain packages.

### Adapter categories

- Transcription provider
- Translation provider
- Language/reasoning provider
- Optional audio-feature provider

One provider may implement multiple categories, but contracts remain separate.

## 6. AI request contract

A request contains:

- Request ID
- Project ID
- Scope
- Requested capability
- Source language
- Target language where applicable
- Brand context
- Basketball context
- Allowed data classes
- Provider
- Consent record
- Cost/usage policy
- Cancellation token
- Output schema version

## 7. Scope

Commands can target:

- Entire project
- Active sequence
- Selected clips
- In/out range
- Selected basketball period
- Selected team
- Selected player
- Selected event type

The UI must display scope before execution.

## 8. Data minimisation

Preferred pipeline for long video:

1. Extract mono analysis audio locally.
2. Send only required audio for transcription.
3. Store transcript locally.
4. Extract local audio features where practical.
5. Send transcript, event metadata, and feature summaries for proposal reasoning.
6. Send selected thumbnails or frames only when an accepted feature requires them.
7. Cut approved clips locally from original media.

Full-resolution source video should not be uploaded for transcription or transcript-based clipping.

## 9. Consent

Before first cloud AI use, show:

- Provider
- Data type
- Purpose
- Approximate scope
- Whether data may be retained under provider settings
- Local alternatives or unavailable state
- How to disconnect

Consent is stored locally by provider and capability. A material change to provider or data class requires renewed consent.

## 10. Transcript schema

```ts
interface Transcript {
  id: string;
  sourceRef: TranscriptSource;
  language: string;
  providerRef: string;
  speakers: Speaker[];
  segments: TranscriptSegment[];
  generatedAt: string;
  modelMetadata?: Record<string, string>;
  userCorrectionsVersion: number;
}
```

Segments contain:

- Start/end ticks
- Text
- Speaker
- Token/word timing where available
- Confidence
- User-corrected state

Provider confidence is normalised carefully and never presented as cross-provider equivalent without calibration.

## 11. Transcript editing

User corrections are durable and distinct from provider output.

Regenerating a segment must:

- Preserve the previous version
- Show changed text/timing
- Avoid overwriting user corrections without confirmation
- Mark dependent captions/proposals stale where relevant

## 12. Caption translation

Phase 1 guarantees English source transcription. Translation targets depend on the connected provider and the supported language list exposed in the UI.

Translation workflow:

1. Select caption track or range.
2. Choose target language.
3. Generate draft translation.
4. Compare source and target.
5. Edit timing/text.
6. Approve and apply as a separate caption track or replacement.
7. Preserve source relationship.

AI cannot silently replace approved captions.

## 13. Natural-language commands

Supported intent families:

- Transcribe
- Create captions
- Translate captions
- Find scoring plays
- Find three-point plays
- Find crowd reactions
- Find commentary highlights
- Create a recap
- Create player/team/period highlights
- Create social aspect-ratio clips
- Find pauses longer than a threshold
- Suggest camera changes
- Suggest replay ranges
- Explain selection

The command parser produces a structured, reviewable plan before mutation.

Example:

```json
{
  "intent": "create_highlight_proposals",
  "scope": {
    "period": 4,
    "teamId": "team_home"
  },
  "constraints": {
    "count": 5,
    "maxDurationSeconds": 45,
    "aspectRatio": "9:16"
  }
}
```

## 14. Proposal model

```ts
interface AiProposal {
  id: string;
  type: string;
  status: "proposed" | "accepted" | "rejected" | "modified" | "stale";
  scope: ProposalScope;
  sourceRanges: TickRange[];
  proposedOperations: ProposedOperation[];
  confidence: ConfidenceSummary;
  evidence: ProposalEvidence[];
  outputSequenceId?: string;
  sourceDataHash: string;
  createdAt: string;
}
```

## 15. Evidence

Evidence types:

- Approved basketball event
- Score change
- Manual marker
- Commentary intensity
- Crowd-volume increase
- Transcript keyword
- Speaker segment
- Replay marker
- Period boundary
- User-selected player/team
- Duration/context boundary

Each evidence item includes:

- Source
- Time/range
- Contribution or qualitative role
- Human-readable explanation
- Confidence where available

Do not expose a single unexplained score.

## 16. Highlight scoring

Phase 1 combines deterministic and model-assisted signals.

Example conceptual model:

```text
Approved event relevance
+ score-change importance
+ commentary intensity
+ crowd response
+ transcript relevance
+ nearby replay/marker
+ user scope match
- duplicate coverage
- context loss
- duration penalty
= proposal ranking
```

Weights are versioned and testable. The UI may show qualitative and numeric evidence, but numeric confidence must not imply statistical certainty without calibration.

## 17. Clip boundary selection

A proposed clip should explain:

- Why the start includes context
- Why the end includes aftermath
- Which event anchors the range
- Whether audio or transcript influenced padding
- Whether the range crosses a period or sequence boundary

The user can drag boundaries before acceptance.

## 18. Proposal sequences

AI writes to a separate namespace, for example:

```text
AI Proposals/
├── Top Plays
├── Three-Point Highlights
├── Player Highlights
├── Commentary Highlights
├── Crowd Reactions
├── Game Recap
└── Social Formats
```

A proposal sequence:

- References source ranges
- Does not modify the master
- Has an explicit propagation policy
- Can be accepted, rejected, duplicated, or modified
- Is marked stale when source truth changes materially

## 19. Acceptance

Accepting a proposal creates a reversible domain command.

Requirements:

- Show operations before acceptance.
- Apply atomically.
- Record proposal ID and source hash.
- Preserve the proposal evidence.
- Support undo.
- Never mutate unrelated sequences.
- If preconditions changed, require refresh or manual resolution.

## 20. Camera and replay suggestions

AI may suggest:

- Switch timing
- Angle choice
- Replay range
- Replay speed preset

It may not apply the switch or insert the replay into the approved master.

Suggestions must state which signals support the recommendation. Without visual sports analysis, angle suggestions may rely on manually assigned camera roles, existing markers, transcript, and user patterns, and must be labelled accordingly.

## 21. Brand context

A project may provide:

- Tone
- Preferred caption style
- Logo and colour references
- Lower-third style
- Intro/outro preference
- Target platform
- Content length
- Avoided phrases

Brand context influences suggestions but does not allow AI to alter the brand kit.

## 22. Cost and usage controls

Even for an internal prototype:

- Estimate media minutes before starting.
- Show provider and capability.
- Allow cancellation.
- Avoid duplicate analysis through content hashes.
- Cache reusable transcript/features.
- Scope requests to selected ranges where possible.
- Record usage locally.
- Do not retry indefinitely.

Billing UI is excluded, but wasteful calls are not acceptable.

## 23. Error and fallback behaviour

Errors:

- Provider unavailable
- Authentication expired
- Unsupported language
- File too large
- Rate/quota limited
- Invalid provider response
- Partial transcript
- Cancellation
- Consent missing
- Network interruption

Requirements:

- Preserve partial useful results where safe.
- Mark incomplete coverage.
- Permit retry of a range.
- Do not present partial analysis as complete.
- Keep the project editable without AI.

## 24. Provider response safety

Treat all provider output as untrusted:

- Validate schema.
- Bound text and array sizes.
- Reject unknown destructive operations.
- Resolve only known project IDs.
- Do not execute provider-supplied code or shell strings.
- Escape display content.
- Ignore instructions embedded in transcripts or file metadata.

## 25. Evaluation strategy

### Deterministic fixtures

- Known transcript
- Multiple speakers
- Caption timing
- Basketball event list
- Highlight signal set
- Proposal acceptance/undo
- Stale proposal detection

### Quality evaluation

- Transcript word error review
- Speaker consistency
- Caption timing
- Clip usefulness
- Context preservation
- Duplicate rate
- False event suggestion rate
- Explanation usefulness

### Safety evaluation

- Master remains unchanged
- Score/clock remain unchanged
- Rejected proposal leaves no mutation
- Invalid provider operations are rejected
- User corrections survive regeneration
- Consent is enforced

## 26. Privacy and retention

- Store credentials in platform secure storage.
- Keep provider secrets out of project files.
- Delete temporary analysis audio according to configured policy after job completion.
- Avoid raw transcript content in logs.
- Permit user deletion of AI results and cached uploads.
- Document provider retention settings in the consent screen.

## 27. Versioning

Version:

- Request schema
- Response normalisation
- Transcript schema
- Proposal schema
- Highlight feature model
- Prompt/template where reproducibility matters

A model/provider change that materially affects behaviour is recorded in project metadata and `decisions.md` when it changes the selected architecture.

## 28. Quality gate

All AI changes use Gate D in [`../engineering/quality-gates.md`](../engineering/quality-gates.md).
