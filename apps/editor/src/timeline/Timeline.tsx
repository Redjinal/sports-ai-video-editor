// Production timeline view, wired to the @sve/timeline-domain kernel.
// Every edit builds a domain command and runs it through the command history; the view holds
// no authoritative timeline state and does no editing arithmetic beyond pixel<->tick mapping.
import { useCallback, useMemo, useState } from "react";
import {
  TIMESCALE,
  asTicks,
  ticksToSeconds,
  type Sequence,
  type SourceClip,
  type Track,
  type TrackFlag,
} from "@sve/timeline-domain";
import { useTimeline, nextMeta } from "./useTimeline";
import { tickToPx, pxToTick, pxToTickDelta, snapToFrame } from "./geometry";

interface TimelineProps {
  sequence: Sequence;
  onChange: (sequence: Sequence) => void;
  onError?: (message: string) => void;
}

const EDGE_PX = 7; // width of a trim handle at each clip edge
const TRACK_H: Record<string, number> = {
  video: 52,
  audio: 40,
  text: 34,
  caption: 30,
  graphic: 40,
  multicam: 52,
  marker: 30,
};

function fmtTc(ticks: number): string {
  const s = ticksToSeconds(asTicks(Math.max(0, Math.round(ticks))));
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const f = Math.floor((s % 1) * 30);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(m)}:${p(sec)}:${p(f)}`;
}

function trackEnd(seq: Sequence, trackId: string): number {
  return seq.objects
    .filter((o) => o.trackId === trackId)
    .reduce((max, o) => Math.max(max, o.startTicks + o.durationTicks), 0);
}

interface DragState {
  id: string;
  mode: "move" | "trim-start" | "trim-end";
  originClientX: number;
  origStart: number;
  origTrackId: string;
  dxPx: number;
  overTrackId: string;
}

export function Timeline({ sequence, onChange, onError }: TimelineProps) {
  const tl = useTimeline(sequence, onError ? { onChange, onError } : { onChange });
  const seq = tl.sequence;
  const [pps, setPps] = useState(12); // pixels per second (zoom)
  const [drag, setDrag] = useState<DragState | null>(null);

  const rate = seq.settings.frameRate;
  const HEADER_W = 132;

  // Timeline content width: a little past the last object, min 60s.
  const contentTicks = useMemo(() => {
    const end = seq.objects.reduce((m, o) => Math.max(m, o.startTicks + o.durationTicks), 0);
    return Math.max(end + TIMESCALE * 6, TIMESCALE * 60);
  }, [seq.objects]);
  const contentPx = tickToPx(contentTicks, pps);

  const clips = seq.objects as SourceClip[];
  const selected = clips.find((c) => c.id === tl.selectedId) ?? null;

  // ---- Command helpers (each builds a real domain command) ----
  const splitAtPlayhead = useCallback(() => {
    if (!selected) return;
    const end = selected.startTicks + selected.durationTicks;
    if (tl.playheadTicks <= selected.startTicks || tl.playheadTicks >= end) {
      onError?.("Move the playhead inside the selected clip to split it.");
      return;
    }
    tl.run({
      type: "SplitObject",
      meta: nextMeta(seq.id, "Split"),
      objectId: selected.id,
      atTicks: asTicks(Math.round(tl.playheadTicks)),
      newObjectId: `clp_${crypto.randomUUID().slice(0, 8)}`,
    });
  }, [selected, tl, seq.id, onError]);

  const deleteSelected = useCallback(
    (ripple: boolean) => {
      if (!tl.selectedId) return;
      if (ripple) tl.rippleDelete(tl.selectedId);
      else {
        tl.run({ type: "RemoveObject", meta: nextMeta(seq.id, "Delete"), objectId: tl.selectedId });
        tl.select(null);
      }
    },
    [tl, seq.id],
  );

  const addClip = useCallback(() => {
    const target = seq.tracks.find((t) => t.type === "video" && !t.locked) ?? seq.tracks[0];
    if (!target) return;
    const start = asTicks(trackEnd(seq, target.id)); // append, collision-free
    const dur = asTicks(TIMESCALE * 3);
    const clip: SourceClip = {
      kind: "clip",
      id: `clp_${crypto.randomUUID().slice(0, 8)}`,
      trackId: target.id,
      startTicks: start,
      durationTicks: dur,
      enabled: true,
      assetId: "ast_demo",
      sourceInTicks: asTicks(0),
      sourceDurationTicks: dur,
      playbackRate: 1,
    };
    if (tl.run({ type: "AddObject", meta: nextMeta(seq.id, "Add clip"), object: clip })) {
      tl.select(clip.id);
    }
  }, [seq, tl]);

  const addMarker = useCallback(() => {
    tl.run({
      type: "AddMarker",
      meta: nextMeta(seq.id, "Add marker"),
      marker: {
        id: `mk_${crypto.randomUUID().slice(0, 6)}`,
        atTicks: asTicks(Math.round(tl.playheadTicks)),
        label: "Marker",
      },
    });
  }, [tl, seq.id]);

  const toggleFlag = useCallback(
    (track: Track, flag: TrackFlag) => {
      tl.run({
        type: "SetTrackFlag",
        meta: nextMeta(seq.id, `Toggle ${flag}`),
        trackId: track.id,
        flag,
        value: !track[flag],
      });
    },
    [tl, seq.id],
  );

  // ---- Pointer drag (move / trim) ----
  const beginDrag = useCallback(
    (e: React.PointerEvent, clip: SourceClip, mode: DragState["mode"]) => {
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      tl.select(clip.id);
      setDrag({
        id: clip.id,
        mode,
        originClientX: e.clientX,
        origStart: clip.startTicks,
        origTrackId: clip.trackId,
        dxPx: 0,
        overTrackId: clip.trackId,
      });
    },
    [tl],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!drag) return;
      let overTrackId = drag.overTrackId;
      if (drag.mode === "move") {
        const el = document.elementFromPoint(e.clientX, e.clientY);
        const lane = el?.closest?.("[data-track-id]") as HTMLElement | null;
        if (lane?.dataset.trackId) overTrackId = lane.dataset.trackId;
      }
      setDrag({ ...drag, dxPx: e.clientX - drag.originClientX, overTrackId });
    },
    [drag],
  );

  const endDrag = useCallback(() => {
    if (!drag) return;
    const clip = clips.find((c) => c.id === drag.id);
    const d = drag;
    setDrag(null);
    if (!clip) return;
    const deltaTicks = pxToTickDelta(d.dxPx, pps);
    if (d.mode === "move") {
      const newStart = snapToFrame(Math.max(0, d.origStart + deltaTicks), rate);
      if (newStart === clip.startTicks && d.overTrackId === clip.trackId) return;
      tl.run({
        type: "MoveObject",
        meta: nextMeta(seq.id, "Move"),
        objectId: clip.id,
        toTrackId: d.overTrackId,
        toStartTicks: newStart,
      });
    } else {
      const edge = d.mode === "trim-start" ? "start" : "end";
      if (Math.abs(deltaTicks) < TIMESCALE / 60) return; // ignore sub-2-frame nudges
      tl.run({
        type: "TrimObject",
        meta: nextMeta(seq.id, "Trim"),
        objectId: clip.id,
        edge,
        deltaTicks,
      });
    }
  }, [drag, clips, pps, rate, tl, seq.id]);

  // ---- Keyboard ----
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) tl.redo();
        else tl.undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        tl.redo();
        return;
      }
      switch (e.key) {
        case "s":
        case "S":
          e.preventDefault();
          splitAtPlayhead();
          break;
        case "Delete":
        case "Backspace":
          e.preventDefault();
          deleteSelected(e.shiftKey);
          break;
        case "ArrowRight":
          e.preventDefault();
          tl.setPlayhead(tl.playheadTicks + (e.shiftKey ? TIMESCALE : TIMESCALE / 30));
          break;
        case "ArrowLeft":
          e.preventDefault();
          tl.setPlayhead(tl.playheadTicks - (e.shiftKey ? TIMESCALE : TIMESCALE / 30));
          break;
        default:
          break;
      }
    },
    [tl, splitAtPlayhead, deleteSelected],
  );

  const onRulerPointerDown = useCallback(
    (e: React.PointerEvent) => {
      const rect = e.currentTarget.getBoundingClientRect();
      tl.setPlayhead(pxToTick(e.clientX - rect.left, pps));
    },
    [tl, pps],
  );

  // ---- Ruler ticks ----
  const rulerTicks = useMemo(() => {
    const out: { x: number; label?: string; major: boolean }[] = [];
    const totalSec = Math.ceil(ticksToSeconds(asTicks(contentTicks)));
    const step = pps < 8 ? 10 : pps < 16 ? 5 : 1;
    for (let s = 0; s <= totalSec; s += step) {
      const major = s % (step * 6) === 0;
      out.push(
        major
          ? { x: s * pps, major, label: fmtTc(s * TIMESCALE).slice(0, 5) }
          : { x: s * pps, major },
      );
    }
    return out;
  }, [contentTicks, pps]);

  const playheadX = tickToPx(tl.playheadTicks, pps);

  return (
    <div className="tl" tabIndex={0} onKeyDown={onKeyDown} aria-label="Timeline">
      <div className="tl-toolbar">
        <div className="tl-group">
          <button onClick={tl.undo} disabled={!tl.canUndo} title="Undo (Ctrl+Z)">
            ↶ Undo
          </button>
          <button onClick={tl.redo} disabled={!tl.canRedo} title="Redo (Ctrl+Shift+Z)">
            ↷ Redo
          </button>
        </div>
        <div className="tl-sep" />
        <div className="tl-group">
          <button onClick={addClip} title="Append a clip">
            ＋ Clip
          </button>
          <button onClick={splitAtPlayhead} disabled={!selected} title="Split at playhead (S)">
            Split
          </button>
          <button onClick={() => deleteSelected(false)} disabled={!selected} title="Delete (Del)">
            Delete
          </button>
          <button
            onClick={() => deleteSelected(true)}
            disabled={!selected}
            title="Ripple delete (Shift+Del)"
          >
            Ripple ⌫
          </button>
          <button onClick={addMarker} title="Add marker at playhead">
            Marker
          </button>
        </div>
        <div className="tl-spacer" />
        <span className="tl-tc mono">{fmtTc(tl.playheadTicks)}</span>
        <div className="tl-sep" />
        <div className="tl-group">
          <button onClick={() => setPps((p) => Math.max(4, p - 3))} aria-label="Zoom out">
            −
          </button>
          <button onClick={() => setPps((p) => Math.min(40, p + 3))} aria-label="Zoom in">
            ＋
          </button>
        </div>
      </div>

      <div className="tl-scroll">
        <div className="tl-inner" style={{ width: HEADER_W + contentPx }}>
          {/* Ruler */}
          <div
            className="tl-ruler"
            style={{ marginLeft: HEADER_W, width: contentPx }}
            onPointerDown={onRulerPointerDown}
            role="slider"
            aria-label="Playhead"
            aria-valuenow={Math.round(ticksToSeconds(asTicks(Math.round(tl.playheadTicks))))}
            aria-valuemin={0}
          >
            {rulerTicks.map((t, i) => (
              <div key={i} className={`tl-tick${t.major ? " major" : ""}`} style={{ left: t.x }}>
                {t.label && <span className="mono">{t.label}</span>}
              </div>
            ))}
          </div>

          {/* Marker lane */}
          <div className="tl-row" style={{ height: TRACK_H.marker }}>
            <div className="tl-head" style={{ width: HEADER_W }}>
              <span className="tl-tname micro">Markers</span>
            </div>
            <div className="tl-lane" style={{ width: contentPx }}>
              {seq.markers.map((m) => (
                <button
                  key={m.id}
                  className="tl-marker"
                  style={{ left: tickToPx(m.atTicks, pps) }}
                  title={`${m.label} @ ${fmtTc(m.atTicks)}`}
                  onClick={() => tl.setPlayhead(m.atTicks)}
                >
                  <span className="tl-marker-flag" />
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tracks */}
          {seq.tracks.map((track) => (
            <div className="tl-row" key={track.id} style={{ height: TRACK_H[track.type] ?? 44 }}>
              <div className="tl-head" style={{ width: HEADER_W }}>
                <span className="tl-tname">{track.name}</span>
                <div className="tl-flags">
                  <button
                    className={`tl-flag${track.locked ? " on lock" : ""}`}
                    aria-pressed={track.locked}
                    onClick={() => toggleFlag(track, "locked")}
                    title="Lock"
                  >
                    L
                  </button>
                  {track.type === "audio" && (
                    <button
                      className={`tl-flag${track.muted ? " on mute" : ""}`}
                      aria-pressed={track.muted}
                      onClick={() => toggleFlag(track, "muted")}
                      title="Mute"
                    >
                      M
                    </button>
                  )}
                  <button
                    className={`tl-flag${track.hidden ? " on" : ""}`}
                    aria-pressed={track.hidden}
                    onClick={() => toggleFlag(track, "hidden")}
                    title="Hide"
                  >
                    H
                  </button>
                </div>
              </div>
              <div
                className={`tl-lane${track.locked ? " locked" : ""}`}
                style={{ width: contentPx }}
                data-track-id={track.id}
                onPointerMove={onPointerMove}
                onPointerUp={endDrag}
              >
                {clips
                  .filter((c) => c.trackId === track.id)
                  .map((c) => {
                    const isDrag = drag?.id === c.id;
                    let left = tickToPx(c.startTicks, pps);
                    let width = tickToPx(c.durationTicks, pps);
                    if (isDrag && drag) {
                      if (drag.mode === "move") left += drag.dxPx;
                      else if (drag.mode === "trim-start") {
                        left += drag.dxPx;
                        width -= drag.dxPx;
                      } else width += drag.dxPx;
                    }
                    return (
                      <div
                        key={c.id}
                        className={`tl-clip ${track.type}${tl.selectedId === c.id ? " sel" : ""}${isDrag ? " dragging" : ""}`}
                        style={{ left, width: Math.max(6, width) }}
                        onPointerDown={(e) => {
                          const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          const off = e.clientX - rect.left;
                          const mode =
                            off < EDGE_PX
                              ? "trim-start"
                              : off > rect.width - EDGE_PX
                                ? "trim-end"
                                : "move";
                          beginDrag(e, c, mode);
                        }}
                        onClick={() => tl.select(c.id)}
                        data-clip-id={c.id}
                      >
                        <span className="tl-clip-name">{c.name ?? c.assetId}</span>
                        <span className="tl-handle l" />
                        <span className="tl-handle r" />
                      </div>
                    );
                  })}
              </div>
            </div>
          ))}

          {/* Playhead */}
          <div
            className="tl-playhead"
            style={{ transform: `translateX(${HEADER_W + playheadX}px)` }}
          />
        </div>
      </div>

      <div className="tl-status">
        <span className="mono">
          {seq.objects.length} objects · {seq.tracks.length} tracks · {seq.markers.length} markers
        </span>
        <span className="tl-hint">
          Click a clip to select · drag body to move, edges to trim · <b>S</b> split · <b>Del</b>{" "}
          delete · <b>Ctrl+Z</b> undo
        </span>
      </div>
    </div>
  );
}
