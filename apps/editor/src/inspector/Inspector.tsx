// Property inspector (M5, Gate A). Edits the selected object's transform (with keyframes),
// text, and graphic properties, dispatching reversible domain commands through the shared
// timeline session. When nothing is selected it shows the recovery snapshots.
import { useMemo } from "react";
import {
  defaultTransform,
  evaluateAnimatable,
  upsertKeyframe,
  isAnimated,
  asTicks,
  ticksToSeconds,
  type Transform,
  type TransformChannel,
  type TimelineObject,
  type TextObject,
  type GraphicObject,
} from "@sve/timeline-domain";
import { nextMeta, type TimelineApi } from "../timeline/useTimeline";
import type { RecoverySnapshot } from "../project/ipc";

interface InspectorProps {
  tl: TimelineApi;
  snapshots: RecoverySnapshot[];
  onRecover: (snapshot: RecoverySnapshot) => void;
}

const CHANNELS: { key: TransformChannel; label: string; step: number }[] = [
  { key: "x", label: "X", step: 1 },
  { key: "y", label: "Y", step: 1 },
  { key: "scale", label: "Scale %", step: 1 },
  { key: "rotation", label: "Rotation°", step: 1 },
  { key: "opacity", label: "Opacity", step: 1 },
];

function fmtTc(ticks: number): string {
  const s = ticksToSeconds(asTicks(Math.max(0, Math.round(ticks))));
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
}

export function Inspector({ tl, snapshots, onRecover }: InspectorProps) {
  const selected = useMemo<TimelineObject | undefined>(
    () => tl.sequence.objects.find((o) => o.id === tl.selectedId),
    [tl.sequence.objects, tl.selectedId],
  );

  if (!selected) {
    return (
      <div className="stack">
        <p className="muted">Select an object to edit its properties.</p>
        <h3>Recovery</h3>
        <p className="muted">
          Snapshots are automatic. Recovering always opens a copy — your project is never
          overwritten.
        </p>
        {snapshots.length === 0 && <p className="muted">No snapshots yet.</p>}
        <ul className="link-list">
          {snapshots.slice(0, 8).map((s) => (
            <li key={s.fileName}>
              <span className="muted">{new Date(Number(s.stamp)).toLocaleString()}</span>
              <button onClick={() => onRecover(s)}>Recover a copy</button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  const transform = selected.transform ?? defaultTransform();
  const playhead = tl.playheadTicks;

  const setTransform = (next: Transform) =>
    tl.run({
      type: "SetTransform",
      meta: nextMeta(tl.sequence.id, "Transform"),
      objectId: selected.id,
      transform: next,
    });

  const editChannel = (channel: TransformChannel, value: number) => {
    const base = selected.transform ?? defaultTransform();
    const ch = base[channel];
    // If the channel is animated, editing sets a keyframe at the playhead; otherwise a constant.
    const nextCh = isAnimated(ch)
      ? upsertKeyframe(ch, { atTicks: asTicks(playhead), value, interp: "linear" })
      : value;
    setTransform({ ...base, [channel]: nextCh });
  };

  const addKeyframe = (channel: TransformChannel) => {
    const base = selected.transform ?? defaultTransform();
    const current = evaluateAnimatable(base[channel], playhead);
    setTransform({
      ...base,
      [channel]: upsertKeyframe(base[channel], {
        atTicks: asTicks(playhead),
        value: current,
        interp: "linear",
      }),
    });
  };

  const currentValue = (channel: TransformChannel) =>
    Math.round(evaluateAnimatable(transform[channel], playhead) * 100) / 100;

  return (
    <div className="stack" aria-label="Inspector">
      <div className="field">
        <label className="micro">{selected.kind}</label>
        <div className="val">{selected.name ?? selected.id}</div>
      </div>
      <div className="grid2">
        <div className="field">
          <label className="micro">Start</label>
          <div className="val mono">{fmtTc(selected.startTicks)}</div>
        </div>
        <div className="field">
          <label className="micro">Duration</label>
          <div className="val mono">{fmtTc(selected.durationTicks)}</div>
        </div>
      </div>

      <h3>Transform</h3>
      {CHANNELS.map(({ key, label, step }) => (
        <div className="field" key={key}>
          <label className="micro">
            {label} {isAnimated(transform[key]) && <span className="badge good">animated</span>}
          </label>
          <div className="row">
            <input
              type="number"
              aria-label={label}
              step={step}
              value={currentValue(key)}
              onChange={(e) => editChannel(key, Number(e.target.value))}
            />
            <button
              className="kf-btn"
              title={`Add ${label} keyframe at playhead`}
              aria-label={`Keyframe ${label}`}
              onClick={() => addKeyframe(key)}
            >
              ◆
            </button>
          </div>
        </div>
      ))}

      {selected.kind === "text" && <TextEditor tl={tl} obj={selected} />}
      {selected.kind === "graphic" && <GraphicEditor tl={tl} obj={selected} />}

      <p className="hint">
        Every property is a reversible command with keyframes stored as instructions — nothing is
        baked into the source. Undo with Ctrl+Z.
      </p>
    </div>
  );
}

function TextEditor({ tl, obj }: { tl: TimelineApi; obj: TextObject }) {
  const set = (text: string, style: TextObject["style"]) =>
    tl.run({
      type: "SetText",
      meta: nextMeta(tl.sequence.id, "Text"),
      objectId: obj.id,
      text,
      style,
    });
  return (
    <>
      <h3>Text</h3>
      <div className="field">
        <label className="micro">Content</label>
        <input
          aria-label="Text content"
          value={obj.text}
          onChange={(e) => set(e.target.value, obj.style)}
        />
      </div>
      <div className="grid2">
        <div className="field">
          <label className="micro">Size</label>
          <input
            type="number"
            aria-label="Font size"
            value={obj.style.fontSizePx}
            onChange={(e) => set(obj.text, { ...obj.style, fontSizePx: Number(e.target.value) })}
          />
        </div>
        <div className="field">
          <label className="micro">Colour</label>
          <input
            aria-label="Text colour"
            value={obj.style.color}
            onChange={(e) => set(obj.text, { ...obj.style, color: e.target.value })}
          />
        </div>
      </div>
    </>
  );
}

function GraphicEditor({ tl, obj }: { tl: TimelineApi; obj: GraphicObject }) {
  const set = (graphic: GraphicObject["graphic"]) =>
    tl.run({
      type: "SetGraphic",
      meta: nextMeta(tl.sequence.id, "Graphic"),
      objectId: obj.id,
      graphic,
    });
  const g = obj.graphic;
  return (
    <>
      <h3>Graphic — {g.type}</h3>
      {g.type === "lowerThird" && (
        <>
          <div className="field">
            <label className="micro">Title</label>
            <input
              aria-label="Lower-third title"
              value={g.title}
              onChange={(e) => set({ ...g, title: e.target.value })}
            />
          </div>
          <div className="field">
            <label className="micro">Subtitle</label>
            <input
              aria-label="Lower-third subtitle"
              value={g.subtitle}
              onChange={(e) => set({ ...g, subtitle: e.target.value })}
            />
          </div>
          <div className="field">
            <label className="micro">Accent</label>
            <input
              aria-label="Accent colour"
              value={g.accent}
              onChange={(e) => set({ ...g, accent: e.target.value })}
            />
          </div>
        </>
      )}
      {g.type === "shape" && (
        <div className="field">
          <label className="micro">Fill</label>
          <input
            aria-label="Shape fill"
            value={g.fill}
            onChange={(e) => set({ ...g, fill: e.target.value })}
          />
        </div>
      )}
    </>
  );
}
