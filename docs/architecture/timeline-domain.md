# Timeline Domain

> **Status:** Authoritative  
> **Authority:** Timeline entities, time model, editing semantics, invariants, and undo behaviour  
> **Version:** 1.0  
> **Last updated:** 2026-07-22

## 1. Domain goals

The timeline domain must:

- Represent long-form, multi-track projects deterministically
- Remain platform-neutral
- Support frame-accurate editing at common frame rates
- Support nested sequences, multicam, replays, captions, and basketball events
- Produce reversible commands
- Survive save/reopen without semantic change
- Generate a stable platform-neutral render plan
- Avoid coupling to React, FFmpeg, Media3, SQLite, or provider SDKs

## 2. Canonical time model

Authoritative time is an integer count of timeline ticks.

```text
TIMESCALE = 27,000,000 ticks per second
```

This timescale exactly represents common rates including:

- 23.976 (`24000/1001`)
- 24
- 25
- 29.97 (`30000/1001`)
- 30
- 50
- 59.94 (`60000/1001`)
- 60

### Rules

- Never persist authoritative time as floating-point seconds.
- Every start, duration, trim, marker, keyframe, and anchor uses integer ticks.
- A duration is non-negative.
- An end is represented as an exclusive boundary: `[start, end)`.
- UI seconds are derived.
- Frame conversion uses rational frame rates.
- Source timestamps and timeline ticks require explicit mapping.

TypeScript may use safe integer `number` values while values remain within validated project limits. If project limits later exceed safe integer precision, a schema decision is required before changing representation.

## 3. Rational frame rate

```ts
interface RationalRate {
  numerator: number;
  denominator: number;
}
```

Examples:

```ts
const fps23976 = { numerator: 24000, denominator: 1001 };
const fps5994 = { numerator: 60000, denominator: 1001 };
```

The domain must not round `29.97` or `59.94` to an integer.

## 4. Core identifiers

All persistent entities use immutable opaque IDs:

- Project ID
- Asset ID
- Sequence ID
- Track ID
- Timeline object ID
- Link group ID
- Marker/event ID
- Keyframe ID
- Proposal ID

Display names are mutable and never serve as identity.

## 5. Sequence

```ts
interface Sequence {
  id: string;
  name: string;
  settings: SequenceSettings;
  tracks: Track[];
  markers: Marker[];
  basketballContextId?: string;
  parentSequenceIds: string[];
}
```

`SequenceSettings` contains:

- Width
- Height
- Pixel aspect ratio
- Rational frame rate
- Audio sample rate
- Background
- Time-display mode

Sequence duration is derived from content unless an explicit work area extends it.

## 6. Track types

- Video
- Audio
- Text
- Caption
- Graphic
- Multicam
- Marker/event lane

Track properties:

- ID
- Name
- Type
- Order
- Height
- Colour
- Locked
- Hidden where visual
- Muted where audio
- Solo where audio
- Edit-targeted
- Ripple group, if explicitly configured

Higher visual tracks composite above lower tracks.

## 7. Timeline object base

```ts
interface TimelineObjectBase {
  id: string;
  trackId: string;
  startTicks: number;
  durationTicks: number;
  enabled: boolean;
  name?: string;
  linkGroupId?: string;
  metadata?: Record<string, unknown>;
}
```

Object-specific fields are discriminated by type.

## 8. Object types

- Video clip
- Audio clip
- Image clip
- Text object
- Caption segment
- Graphic object
- Transition object
- Nested sequence
- Multicam instance
- Replay object
- Marker
- Basketball event reference
- Game-clock anchor reference

Basketball event and clock data are owned by the basketball domain; timeline objects reference their IDs and time.

## 9. Source clip mapping

A source clip contains:

- Asset ID
- Source stream selection
- Source in ticks
- Source duration ticks
- Timeline start/duration
- Playback rate
- Transform/effect references
- Proxy policy
- Audio mapping
- Link group

Mapping must account for:

- Variable-frame-rate source timestamps
- Rotation metadata
- Source gaps
- Fixed speed changes
- Managed derivative mapping

## 10. Selection

Selection is workspace state, not persisted authoritative timeline state.

Supported selection:

- Single object
- Multi-object
- Marquee/range
- Track
- All after playhead
- All before playhead
- Linked group
- Objects intersecting in/out range

Linked video/audio selects together by default. A modifier selects only the target component.

Commands receive explicit object IDs and must not depend on implicit current selection after dispatch.

## 11. Edit targeting

Multi-track operations use explicit target tracks.

Rules:

- Locked tracks are never mutated.
- Hidden tracks can be edited unless locked.
- Untargeted tracks are not affected by ripple operations.
- The UI previews affected tracks before a destructive multi-track operation.
- Invalid target combinations return structured errors.

## 12. Move

A move command specifies:

- Object IDs
- Original state precondition
- Destination track IDs
- Delta ticks or absolute start
- Collision mode
- Snap result
- Link behaviour

Dragging must show collision outcome. It cannot silently overwrite.

## 13. Insert and overwrite

### Insert

- Places content at a target time.
- Shifts targeted unlocked content to make space.
- Does not shift untargeted or locked tracks.
- Requires explicit target tracks.

### Overwrite

- Replaces the intersecting range on targeted unlocked tracks.
- Must be an explicit mode, modifier, or drop zone.
- Preserves source objects outside the overwritten range through splits where required.
- Is fully undoable.

## 14. Split

Split can target:

- Selected objects
- Targeted tracks at playhead
- All unlocked tracks when explicitly requested

Rules:

- Split point must lie strictly inside the object.
- Linked video/audio split together unless overridden.
- Keyframes and effects are partitioned without changing evaluated values.
- Source mapping remains continuous.
- Zero-duration objects are prohibited.

## 15. Trim

### Standard trim

Changes an object edge without moving later objects.

### Ripple trim

Changes an edge and shifts later objects on targeted unlocked tracks.

Rules:

- Respect source bounds.
- Respect minimum object duration.
- Preserve link alignment by default.
- Preview multi-track ripple effects.
- Transitions dependent on changed edges are recalculated or flagged.
- Nested sequence instances cannot exceed source sequence bounds unless freeze/hold behaviour is explicitly supported later.

## 16. Delete

### Standard delete

Removes selected objects and leaves gaps.

### Ripple delete

Removes selected objects or a selected range and closes the gap on targeted unlocked tracks.

Rules:

- Show affected tracks.
- Split partially intersecting objects where appropriate.
- Never shift locked tracks.
- Update dependent transition objects.
- Preserve basketball events unless the user explicitly deletes them; events in removed source ranges may become unbound and require review.
- Fully reversible.

## 17. Snapping

Targets:

- Playhead
- Clip edges
- Sequence start/end
- In/out points
- Markers
- Basketball events
- Clock anchors
- Transition edges
- Keyframes
- Caption boundaries

Snapping returns:

- Target type
- Target ID
- Original time
- Snapped time
- Distance

Snapping may be globally enabled, temporarily disabled, or filtered by category.

## 18. Track locking

Locked tracks cannot be:

- Moved
- Trimmed
- Split
- Deleted
- Ripple-shifted
- Reordered by edit commands

Locked objects remain selectable for inspection and playback.

## 19. Linking

Video and audio from one asset begin in a link group.

Actions:

- Unlink
- Relink
- Detach audio
- Replace audio
- Select only one component

Linked components preserve relative timing during move, trim, split, and delete unless the command explicitly overrides linking.

Link groups cannot create circular ownership and do not imply shared effects.

## 20. Transforms

Supported visual properties:

- Position X/Y
- Scale X/Y
- Rotation
- Crop edges
- Opacity
- Anchor X/Y
- Horizontal flip
- Vertical flip
- Fit/fill mode

Transforms are evaluated in sequence coordinates after orientation correction.

## 21. Keyframes

Supported Phase 1 keyframes:

- Position
- Scale
- Rotation
- Crop
- Opacity
- Audio volume
- Explicitly keyframe-enabled text properties

Interpolation:

- Linear
- Ease in
- Ease out
- Ease in/out
- Hold

Rules:

- Keyframe time is relative to object start unless a property explicitly uses sequence time.
- Moving an object moves relative keyframes.
- Trimming preserves keyframes in the retained range.
- Keyframes outside a retained trim are not evaluated and may be restored by extending the trim where source data permits.
- Duplicate times for one property are prohibited.
- An advanced graph editor is excluded.

## 22. Transitions

Transitions are separate timeline objects.

Phase 1:

- Cut
- Cross dissolve
- Fade to colour
- Dip to black
- Audio crossfade
- Replay bumper

A transition may reference:

- Outgoing object
- Incoming object
- Duration
- Alignment
- Parameters

Deleting a transition does not delete clips. Invalid neighbours place the transition in a recoverable error state or remove it through an explicit command.

## 23. Nested sequences

A nested sequence instance references a source sequence.

Rules:

- Source edits update all instances.
- Duplicate-as-independent-copy creates a new source sequence.
- A sequence cannot contain itself.
- Circular nesting is prohibited through graph validation.
- Instance duration follows source unless trimmed.
- Audio and video exposure are explicit.
- Parent render planning recursively resolves nesting with cycle and depth checks.

## 24. Multicam

A multicam source contains:

- Up to four angles
- Source segment mappings
- Sync offsets or mapping
- Reference angle
- Audio policy
- Gap metadata
- Lock state

A multicam edit instance contains angle regions:

```ts
interface AngleRegion {
  startTicks: number;
  endTicks: number;
  angleId: string;
}
```

Rules:

- Regions cover the instance without overlap.
- Gaps can explicitly represent no valid angle.
- Live switching inserts a boundary at playhead.
- Switching to the already-active angle is a no-op.
- Angle boundaries are trim-editable.
- Source angle replacement preserves boundaries where valid.
- Resync that invalidates a region must flag it.

## 25. Replay object

A replay is a specialised nested sequence reference.

```ts
interface ReplayObject {
  id: string;
  sourceSequenceId: string;
  sourceRange: TickRange;
  playbackRate: 0.25 | 0.5 | 1 | 2;
  bumperTemplateId?: string;
  audioMode: "source" | "mute" | "commentary" | "custom";
}
```

Rules:

- Source remains untouched.
- Insertion requires user confirmation.
- Source range is retrimmable.
- Playback-rate change recalculates timeline duration deterministically.
- Audio mode is explicit.
- AI may suggest but not insert.

## 26. Markers

Marker types:

- Sequence marker
- Clip marker
- General note
- Basketball event reference
- Clock anchor reference
- AI suggestion
- Chapter

Marker fields:

- Time or range
- Label
- Category
- Colour
- Notes
- Source
- Approval state where applicable

## 27. Basketball integration

Timeline references approved or suggested basketball entities through IDs.

Rules:

- Approved scoring events may drive scorebug state.
- Suggested events remain provisional.
- Deleting a clip does not silently delete an event.
- An event whose source footage is removed becomes unbound and visible for review.
- Score and clock evaluation is performed by the basketball domain at a timeline time.

## 28. Transcript integration

Transcript tokens map to source or sequence time ranges.

Actions:

- Select timeline range
- Create marker
- Create clip
- Create captions
- Mute range
- Manual remove
- Include range in AI scope

Manual transcript removal dispatches an ordinary reversible timeline command. AI-suggested removal creates a proposal.

## 29. Captions

Caption segment fields:

- Text
- Start/duration
- Speaker
- Style reference
- Position override
- Translation/source relationship
- Approval state

Rules:

- Segments on one standard caption track do not overlap.
- A multi-speaker track mode may permit explicit simultaneous regions.
- Timing can be edited in panel, inspector, or timeline.
- Caption import normalises to ticks.
- Export converts using the target format’s timing precision.

## 30. Social sequences

Supported aspect ratios:

- 16:9
- 9:16
- 1:1
- 4:5

A social sequence may reference:

- Approved master ranges
- Original source
- Proposal source ranges

Propagation policy:

- Snapshot: later master changes do not propagate
- Linked: source-range content changes propagate where resolvable

The user chooses policy when creating or accepting a sequence.

## 31. Collision rules

Visual/audio object overlap is allowed when tracks permit it.

Invalid examples:

- Caption overlap on standard single-lane caption track
- Two transition objects occupying the same edge without supported stacking
- Object on incompatible track type
- Multicam angle region overlap
- Negative time
- Zero-duration media object
- Circular nesting

Collision errors must be deterministic and testable.

## 32. Command model

Every mutation is a command with:

- Command ID
- Type
- Version
- Project/sequence target
- Preconditions
- Payload
- Inverse or reversible state
- Timestamp
- Optional user-visible label

Examples:

- AddObject
- MoveObjects
- SplitObjects
- TrimObject
- DeleteRange
- SetKeyframe
- AcceptProposal
- UpdateBasketballEvent
- CorrectScore
- SetMulticamAngle
- InsertReplay

## 33. Undo and redo

Requirements:

- Deterministic
- Covers AI acceptance
- Restores linked state
- Restores score/statistics through event reversal
- Restores transitions and dependent objects
- Survives panel changes
- Does not depend on current selection
- Supports grouped atomic operations
- Failed command does not enter history

Persistent recovery may use the operation journal, but user-visible undo depth is a separate policy.

## 34. Transactions

Multi-object operations use an atomic domain transaction.

Either:

- All changes validate and apply, or
- None apply

Examples:

- Ripple delete across tracks
- Accept AI proposal
- Insert replay plus bumper
- Import multicam group
- Correct score event and dependent data

## 35. Invariants

At all valid checkpoints:

- IDs are unique.
- Times are safe integers.
- Starts and durations are non-negative.
- Media objects have positive duration.
- Track/object types are compatible.
- Source ranges are valid.
- Nested sequence graph is acyclic.
- Multicam regions do not overlap.
- Approved event references resolve.
- Link groups reference existing objects.
- Transition neighbours resolve or the transition is explicitly invalid and non-renderable.
- Renderable sequence has no unresolved blocking asset.

## 36. Serialization

- Every domain object has a schema version.
- Unknown future fields are preserved where safe.
- Invalid data is not silently coerced.
- Migrations are explicit and tested.
- Derived values such as sequence duration and score are not duplicated as unrelated authoritative fields.
- Ordering is deterministic to support meaningful diffs.

## 37. Render-plan generation

Render-plan generation:

1. Validate sequence.
2. Resolve work range.
3. Resolve nested sequences recursively.
4. Resolve multicam angle regions.
5. Resolve asset source policy.
6. Evaluate transforms/keyframes.
7. Evaluate transitions.
8. Evaluate audio mix.
9. Evaluate captions/graphics.
10. Evaluate basketball-bound graphics.
11. Produce immutable plan.
12. Hash the plan for job traceability.

## 38. Testing requirements

Required unit coverage:

- Tick/frame conversion
- Rational rates
- Move/split/trim/delete
- Ripple across target/locked tracks
- Link behaviour
- Snapping
- Keyframe partition
- Transition validity
- Nested cycle detection
- Multicam region edits
- Replay duration
- Caption overlap
- Event binding
- Undo/redo
- Serialization and migration
- Render-plan determinism

Property-based testing is encouraged for timeline math and operation inversion.

## 39. Deferred tools

Outside Phase 1:

- Slip edit
- Slide edit
- Roll edit
- Rate-stretch tool
- Speed ramps
- Advanced trim monitor
- Advanced keyframe graph
- Optical flow
- Motion tracking
