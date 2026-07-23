// Multicam switcher (M7). When a multicam object is selected this drives its angles through the
// shared session: a live cut (click a tile or press 1–4) records a switch at the playhead, the
// on-air angle is derived from the switch program, and the switch list / audio angle / angle lock
// are editable. Every change is one reversible SetMulticam command (one undo step), so switching
// never bakes anything in.
import { useMemo } from "react";
import {
  asTicks,
  ticksToSeconds,
  multicamProgram,
  activeAngleAt,
  angleForKey,
  switchAngle,
  removeSwitch,
  setAudioAngle,
  toggleAngleLock,
  type MulticamObject,
  type MulticamProgram,
} from "@sve/timeline-domain";
import { nextMeta, type TimelineApi } from "../timeline/useTimeline";

function fmtTc(ticks: number): string {
  const s = ticksToSeconds(asTicks(Math.max(0, Math.round(ticks))));
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function MulticamPanel({ tl, obj }: { tl: TimelineApi; obj: MulticamObject }) {
  // Playhead relative to the object; the switch program is stored object-relative.
  const rel = Math.max(0, tl.playheadTicks - obj.startTicks);
  const onAir = useMemo(() => activeAngleAt(obj, rel), [obj, rel]);

  const dispatch = (program: MulticamProgram) =>
    tl.run({
      type: "SetMulticam",
      meta: nextMeta(tl.sequence.id, "Multicam"),
      objectId: obj.id,
      angles: program.angles,
      switches: program.switches,
      audioAngleId: program.audioAngleId,
      lockedAngleIds: program.lockedAngleIds,
    });

  const cut = (angleId: string) => {
    const program = multicamProgram(obj);
    const next = switchAngle(program, asTicks(rel), angleId);
    // switchAngle returns the SAME program reference on a no-op (locked/unknown angle) — skip it.
    if (next !== program) dispatch(next);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const n = Number(e.key);
    if (n >= 1 && n <= 4) {
      const angleId = angleForKey(obj, n as 1 | 2 | 3 | 4);
      if (angleId) {
        e.preventDefault();
        cut(angleId);
      }
    }
  };

  const switches = [...obj.switches].sort((a, b) => a.atTicks - b.atTicks);
  const angleLabel = (id: string) => obj.angles.find((a) => a.id === id)?.label ?? id;

  return (
    <div className="mc" aria-label="Multicam" tabIndex={0} onKeyDown={onKeyDown}>
      <h3>Multicam — {obj.angles.length} angles</h3>
      <p className="micro">Click an angle or press 1–4 to cut at the playhead.</p>
      <div className="mc-grid">
        {obj.angles.map((a, i) => {
          const live = a.id === onAir;
          const locked = obj.lockedAngleIds.includes(a.id);
          return (
            <div key={a.id} className={`mc-tile${live ? " is-live" : ""}`}>
              <button
                className="mc-tile-cut"
                aria-label={`Cut to ${a.label}`}
                aria-pressed={live}
                disabled={locked}
                onClick={() => cut(a.id)}
              >
                <span className="mc-key">{i + 1}</span>
                <span className="mc-label">{a.label}</span>
                {live && <span className="badge good">ON AIR</span>}
              </button>
              <button
                className={`mc-lock${locked ? " is-on" : ""}`}
                title={locked ? "Unlock angle" : "Lock angle"}
                aria-label={`${locked ? "Unlock" : "Lock"} ${a.label}`}
                aria-pressed={locked}
                onClick={() => dispatch(toggleAngleLock(multicamProgram(obj), a.id))}
              >
                {locked ? "🔒" : "🔓"}
              </button>
            </div>
          );
        })}
      </div>

      <div className="field">
        <label className="micro" htmlFor={`mc-audio-${obj.id}`}>
          Audio angle
        </label>
        <select
          id={`mc-audio-${obj.id}`}
          value={obj.audioAngleId}
          onChange={(e) => dispatch(setAudioAngle(multicamProgram(obj), e.target.value))}
        >
          {obj.angles.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
      </div>

      <h3>Switches</h3>
      {switches.length === 0 && <p className="micro">No cuts yet.</p>}
      <ul className="mc-switches">
        {switches.map((s, i) => (
          <li key={`${s.atTicks}-${s.angleId}`}>
            <span className="mono">{fmtTc(s.atTicks)}</span>
            <span>{angleLabel(s.angleId)}</span>
            <button
              aria-label={`Remove cut at ${fmtTc(s.atTicks)}`}
              onClick={() => dispatch(removeSwitch(multicamProgram(obj), i))}
            >
              ✕
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
