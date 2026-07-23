// Program viewer (M5): renders the sequence's visual objects at the playhead through the same
// evaluated transforms the render engine will use, and supports direct manipulation — drag to
// move, corner-drag to scale — writing back reversible SetTransform commands on the shared
// session. A drag previews locally and commits exactly one command on release, so one drag is
// one undo step (not one per pixel). No decoded frames are available in the shell, so clips show
// a labelled placeholder; the geometry is real.
import { useEffect, useRef, useState } from "react";
import {
  asTicks,
  defaultTransform,
  evaluateTransform,
  isAnimated,
  upsertKeyframe,
  type AnimatableNumber,
  type Sequence,
  type TimelineObject,
  type Transform,
} from "@sve/timeline-domain";
import { nextMeta, type TimelineApi } from "../timeline/useTimeline";

interface ViewerProps {
  tl: TimelineApi;
}

const VISUAL_KINDS = new Set(["clip", "nested", "text", "graphic"]);
type MoveMode = "move" | "scale";

interface DragState {
  id: string;
  mode: MoveMode;
  startX: number;
  startY: number;
  origX: number;
  origY: number;
  origScale: number;
  curX: number;
  curY: number;
  curScale: number;
}

/** Is this object visible at `ticks` on a picture track? */
function isVisibleAt(seq: Sequence, obj: TimelineObject, ticks: number): boolean {
  if (!VISUAL_KINDS.has(obj.kind) || !obj.enabled) return false;
  const track = seq.tracks.find((t) => t.id === obj.trackId);
  if (track && (track.type === "audio" || track.type === "caption")) return false;
  if (track?.hidden) return false;
  return ticks >= obj.startTicks && ticks < obj.startTicks + obj.durationTicks;
}

function label(obj: TimelineObject): string {
  return obj.name ?? obj.id;
}

export function Viewer({ tl }: ViewerProps) {
  const seq = tl.sequence;
  const t = tl.playheadTicks;
  const frameW = seq.settings.width;
  const frameH = seq.settings.height;

  const stageRef = useRef<HTMLDivElement | null>(null);
  const [stageW, setStageW] = useState(640);
  const [drag, setDrag] = useState<DragState | null>(null);

  // Fit the stage to the panel width when the platform supports it; tests fall back to 640.
  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const box = entries[0]?.contentRect;
      if (!box || box.width <= 0 || box.height <= 0) return;
      // Fit the frame within the available area on whichever axis binds first.
      setStageW(Math.min(box.width, (box.height * frameW) / frameH));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [frameW, frameH]);

  const scale = stageW / frameW; // screen px per frame px
  const stageH = frameH * scale;

  const objects = seq.objects
    .filter((o) => isVisibleAt(seq, o, t))
    .sort((a, b) => {
      const ao = seq.tracks.find((tr) => tr.id === a.trackId)?.order ?? 0;
      const bo = seq.tracks.find((tr) => tr.id === b.trackId)?.order ?? 0;
      return ao - bo; // higher track order renders on top
    });

  // Persist the drag in a ref so the window listeners always see the latest.
  const dragRef = useRef<DragState | null>(null);
  dragRef.current = drag;

  useEffect(() => {
    if (!drag) return;
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dxFrame = (e.clientX - d.startX) / scale;
      const dyFrame = (e.clientY - d.startY) / scale;
      if (d.mode === "move") {
        setDrag({ ...d, curX: d.origX + dxFrame, curY: d.origY + dyFrame });
      } else {
        // Corner drag: scale by the pointer's distance change from centre, clamped positive.
        const delta = (dxFrame + dyFrame) / 2;
        setDrag({ ...d, curScale: Math.max(1, Math.round(d.origScale + delta / 4)) });
      }
    };
    const onUp = () => {
      const d = dragRef.current;
      if (d) commitDrag(d);
      setDrag(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    // Re-subscribe only when a drag starts/ends or the fit scale changes.
  }, [drag?.id, drag?.mode, scale]);

  // Write one channel: a constant unless the channel is already animated, in which case set a
  // keyframe at the playhead (so dragging refines an existing animation rather than flattening it).
  function channelValue(channel: AnimatableNumber, value: number): AnimatableNumber {
    return isAnimated(channel)
      ? upsertKeyframe(channel, { atTicks: asTicks(t), value, interp: "linear" })
      : value;
  }

  function commitDrag(d: DragState) {
    const obj = seq.objects.find((o) => o.id === d.id);
    if (!obj) return;
    const base = obj.transform ?? defaultTransform();
    const next: Transform =
      d.mode === "move"
        ? { ...base, x: channelValue(base.x, d.curX), y: channelValue(base.y, d.curY) }
        : { ...base, scale: channelValue(base.scale, d.curScale) };
    tl.run({
      type: "SetTransform",
      meta: nextMeta(seq.id, d.mode === "move" ? "Move" : "Scale"),
      objectId: obj.id,
      transform: next,
    });
  }

  function startDrag(obj: TimelineObject, mode: MoveMode, e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    tl.select(obj.id);
    const ev = evaluateTransform(obj.transform ?? defaultTransform(), t);
    setDrag({
      id: obj.id,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      origX: ev.x,
      origY: ev.y,
      origScale: ev.scale,
      curX: ev.x,
      curY: ev.y,
      curScale: ev.scale,
    });
  }

  return (
    <div className="viewer">
      <div className="viewer-frame" ref={stageRef}>
        {/* Outer box carries the scaled footprint (a CSS transform doesn't shrink layout); the
            inner stage is the true frame, scaled to fit, with children positioned in frame px. */}
        <div className="viewer-stage-box" style={{ width: stageW, height: stageH }}>
          <div
            className="viewer-stage"
            role="img"
            aria-label="Program viewer"
            style={{ width: frameW, height: frameH, transform: `scale(${scale})` }}
            onPointerDown={() => tl.select(null)}
          >
            {objects.map((obj) => {
              const live = drag?.id === obj.id ? drag : null;
              const ev = evaluateTransform(obj.transform ?? defaultTransform(), t);
              const x = live ? live.curX : ev.x;
              const y = live ? live.curY : ev.y;
              const sc = (live ? live.curScale : ev.scale) / 100;
              const selected = tl.selectedId === obj.id;
              return (
                <div
                  key={obj.id}
                  data-obj-id={obj.id}
                  className={`vo${selected ? " is-selected" : ""}`}
                  style={{
                    left: frameW / 2 + x,
                    top: frameH / 2 + y,
                    opacity: Math.max(0, Math.min(1, ev.opacity / 100)),
                    transform: `translate(-50%, -50%) rotate(${ev.rotation}deg) scale(${sc})`,
                  }}
                  onPointerDown={(e) => startDrag(obj, "move", e)}
                >
                  <ObjectBody obj={obj} />
                  {selected && (
                    <button
                      className="vo-scale"
                      aria-label={`Scale ${label(obj)}`}
                      title="Drag to scale"
                      onPointerDown={(e) => startDrag(obj, "scale", e)}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <div className="viewer-bar">
        <span className="mono">
          {frameW}×{frameH}
        </span>
        <span className="muted">
          {objects.length} {objects.length === 1 ? "layer" : "layers"} at playhead
        </span>
        {drag && (
          <span className="muted">
            {drag.mode === "move"
              ? `x ${Math.round(drag.curX)} · y ${Math.round(drag.curY)}`
              : `scale ${drag.curScale}%`}
          </span>
        )}
      </div>
    </div>
  );
}

function ObjectBody({ obj }: { obj: TimelineObject }) {
  if (obj.kind === "text") {
    return (
      <div
        className="vo-text"
        style={{
          fontFamily: obj.style.fontFamily,
          fontSize: obj.style.fontSizePx,
          color: obj.style.color,
          fontWeight: obj.style.weight,
          textAlign: obj.style.align,
        }}
      >
        {obj.text}
      </div>
    );
  }
  if (obj.kind === "graphic") {
    const g = obj.graphic;
    if (g.type === "lowerThird") {
      return (
        <div className="vo-lower" style={{ borderLeftColor: g.accent }}>
          <strong>{g.title}</strong>
          <span>{g.subtitle}</span>
        </div>
      );
    }
    if (g.type === "shape") {
      return <div className="vo-shape" style={{ background: g.fill }} />;
    }
    return <div className="vo-graphic">{g.type}</div>;
  }
  // clip / nested — no decoded frame in the shell; show a labelled placeholder at true geometry.
  return <div className="vo-clip">{label(obj)}</div>;
}
