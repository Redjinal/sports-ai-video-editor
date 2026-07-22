// M1 vertical-slice editor shell: import -> inspect -> proxy -> preview -> place/trim
// -> export -> validate. Timeline math goes through @sve/timeline-domain commands, never
// ad-hoc arithmetic, so the UI cannot invent its own notion of time.
import { useCallback, useEffect, useMemo, useState } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import {
  TIMESCALE,
  asTicks,
  ticksToSeconds,
  applyCommand,
  type Sequence,
  type SourceClip,
  type AddObjectCommand,
  type TrimObjectCommand,
} from "@sve/timeline-domain";
import type {
  InspectMediaResultV1,
  OutputValidationResult,
  RenderPlan,
} from "@sve/media-contracts";
import {
  inspectMedia,
  generateProxy,
  exportSequence,
  cancelJob,
  ffmpegAvailable,
  onJobProgress,
} from "../ipc";

const emptySequence = (): Sequence => ({
  id: "seq_master",
  name: "Master",
  settings: {
    width: 1920,
    height: 1080,
    pixelAspectRatio: { numerator: 1, denominator: 1 },
    frameRate: { numerator: 30, denominator: 1 },
    audioSampleRate: 48_000,
    background: "#000000",
    timeDisplayMode: "timecode",
  },
  tracks: [
    {
      id: "trk_v1",
      name: "V1",
      type: "video",
      order: 0,
      height: 64,
      color: "#2b6cb0",
      locked: false,
      hidden: false,
      muted: false,
      solo: false,
      editTargeted: true,
    },
  ],
  objects: [],
  markers: [],
  parentSequenceIds: [],
});

const meta = (id: string) => ({
  id,
  version: 1 as const,
  sequenceId: "seq_master",
  timestamp: new Date().toISOString(),
});

function fmt(ticks: number): string {
  const s = ticksToSeconds(asTicks(Math.max(0, Math.round(ticks))));
  const m = Math.floor(s / 60);
  const rest = (s % 60).toFixed(2).padStart(5, "0");
  return `${String(m).padStart(2, "0")}:${rest}`;
}

export function SliceWorkspace() {
  const [sourcePath, setSourcePath] = useState("");
  const [info, setInfo] = useState<InspectMediaResultV1 | null>(null);
  const [proxyPath, setProxyPath] = useState<string | null>(null);
  const [sequence, setSequence] = useState<Sequence>(emptySequence);
  const [validation, setValidation] = useState<OutputValidationResult | null>(null);
  const [progress, setProgress] = useState<{ stage: string; fraction: number } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [haveFfmpeg, setHaveFfmpeg] = useState<boolean | null>(null);
  const [exportHeight, setExportHeight] = useState(720);

  useEffect(() => {
    ffmpegAvailable()
      .then(setHaveFfmpeg)
      .catch(() => setHaveFfmpeg(false));
    const off = onJobProgress((e) => setProgress({ stage: e.stage, fraction: e.fraction }));
    return () => {
      void off.then((fn) => fn());
    };
  }, []);

  const clip = sequence.objects[0] as SourceClip | undefined;

  const run = useCallback(async (label: string, fn: () => Promise<void>) => {
    setBusy(label);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
      setProgress(null);
    }
  }, []);

  const doInspect = () =>
    run("Inspecting", async () => {
      const result = await inspectMedia(sourcePath);
      setInfo(result);
      setProxyPath(null);
      setValidation(null);
      setSequence(emptySequence());
    });

  const doProxy = () =>
    run("Generating proxy", async () => {
      if (!info) return;
      const out = `${sourcePath}.proxy720.mp4`;
      const path = await generateProxy({
        jobId: crypto.randomUUID(),
        sourcePath,
        outputPath: out,
        maxWidth: 1280,
        maxHeight: 720,
        totalTicks: info.durationTicks,
      });
      setProxyPath(path);
    });

  const doPlace = () => {
    if (!info) return;
    const object: SourceClip = {
      kind: "clip",
      id: "clp_1",
      trackId: "trk_v1",
      startTicks: asTicks(0),
      durationTicks: asTicks(info.durationTicks),
      enabled: true,
      assetId: info.assetFingerprint.slice(0, 12),
      sourceInTicks: asTicks(0),
      sourceDurationTicks: asTicks(info.durationTicks),
      playbackRate: 1,
    };
    const cmd: AddObjectCommand = { type: "AddObject", meta: meta("cmd_place"), object };
    try {
      setSequence(applyCommand(emptySequence(), cmd).sequence);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const doTrim = (edge: "start" | "end", deltaTicks: number) => {
    if (!clip || !info) return;
    const cmd: TrimObjectCommand = {
      type: "TrimObject",
      meta: meta(`cmd_trim_${edge}`),
      objectId: clip.id,
      edge,
      deltaTicks,
    };
    try {
      const bounds = new Map([[clip.assetId, asTicks(info.durationTicks)]]);
      setSequence(applyCommand(sequence, cmd, { assetBounds: bounds }).sequence);
      setError(null);
    } catch (e) {
      // Domain rejections (zero duration, source bounds) surface as real errors.
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const plan: RenderPlan | null = useMemo(() => {
    if (!clip) return null;
    const width = Math.round((exportHeight * 16) / 9 / 2) * 2;
    return {
      version: 1,
      sequenceId: sequence.id,
      range: { startTicks: 0, endTicks: clip.durationTicks },
      video: {
        codec: "h264",
        width,
        height: exportHeight,
        frameRate: sequence.settings.frameRate,
        preferHardware: true,
        quality: 70,
      },
      audio: { codec: "aac", sampleRate: 48_000, channels: 2, bitrateKbps: 192 },
      tracks: [
        {
          id: "trk_v1",
          kind: "video",
          order: 0,
          clips: [
            {
              assetId: clip.assetId,
              sourcePath,
              sourceInTicks: clip.sourceInTicks,
              sourceDurationTicks: clip.sourceDurationTicks,
              timelineStartTicks: clip.startTicks,
              timelineDurationTicks: clip.durationTicks,
              playbackRate: clip.playbackRate,
            },
          ],
        },
      ],
      overlays: [],
      captions: { entries: [] },
      sourcePolicy: "originals",
    };
  }, [clip, exportHeight, sequence, sourcePath]);

  const doExport = () =>
    run("Exporting", async () => {
      if (!plan) return;
      const out = `${sourcePath}.export${exportHeight}.mp4`;
      const result = await exportSequence({ jobId: crypto.randomUUID(), plan, outputPath: out });
      setValidation(result);
    });

  return (
    <main>
      <header>
        <h1>Sports AI Video Editor</h1>
        <span className="tag">M1 vertical slice</span>
        {haveFfmpeg === false && <span className="bad">FFmpeg not found</span>}
      </header>

      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}

      <section>
        <h2>1 · Import</h2>
        <div className="row">
          <input
            aria-label="Media file path"
            placeholder="Full path to an .mp4 file"
            value={sourcePath}
            onChange={(e) => setSourcePath(e.target.value)}
          />
          <button onClick={doInspect} disabled={!sourcePath || busy !== null}>
            Inspect
          </button>
        </div>
        {info && (
          <dl className="facts">
            <div>
              <dt>Container</dt>
              <dd>{info.container}</dd>
            </div>
            <div>
              <dt>Duration</dt>
              <dd>{fmt(info.durationTicks)}</dd>
            </div>
            <div>
              <dt>Video</dt>
              <dd>
                {info.videoStreams[0]
                  ? `${info.videoStreams[0].codec} ${info.videoStreams[0].width}×${info.videoStreams[0].height} @ ${(
                      info.videoStreams[0].rFrameRate.numerator /
                      info.videoStreams[0].rFrameRate.denominator
                    ).toFixed(3)} fps`
                  : "none"}
              </dd>
            </div>
            <div>
              <dt>Audio</dt>
              <dd>
                {info.audioStreams[0]
                  ? `${info.audioStreams[0].codec} ${info.audioStreams[0].sampleRate} Hz ${info.audioStreams[0].channels}ch`
                  : "none"}
              </dd>
            </div>
            <div>
              <dt>Compatibility</dt>
              <dd className={info.compatibility === "certified" ? "good" : "warn"}>
                {info.compatibility}
              </dd>
            </div>
          </dl>
        )}
      </section>

      <section>
        <h2>2 · Proxy &amp; preview</h2>
        <div className="row">
          <button onClick={doProxy} disabled={!info || busy !== null}>
            Generate 720p proxy
          </button>
          <span className="muted">{proxyPath ? "proxy" : "original"}</span>
        </div>
        {proxyPath && <video controls src={convertFileSrc(proxyPath)} width={640} />}
      </section>

      <section>
        <h2>3 · Timeline</h2>
        <div className="row">
          <button onClick={doPlace} disabled={!info}>
            Place clip
          </button>
          <button onClick={() => doTrim("start", TIMESCALE)} disabled={!clip}>
            Trim head +1s
          </button>
          <button onClick={() => doTrim("end", -TIMESCALE)} disabled={!clip}>
            Trim tail −1s
          </button>
        </div>
        <div className="track" aria-label="Video track V1">
          {clip && info && (
            <div
              className="clip"
              style={{
                marginLeft: `${(clip.startTicks / info.durationTicks) * 100}%`,
                width: `${(clip.durationTicks / info.durationTicks) * 100}%`,
              }}
            >
              {fmt(clip.durationTicks)}
            </div>
          )}
        </div>
        {clip && (
          <p className="muted">
            start {fmt(clip.startTicks)} · duration {fmt(clip.durationTicks)} · source in{" "}
            {fmt(clip.sourceInTicks)} · {clip.durationTicks} ticks
          </p>
        )}
      </section>

      <section>
        <h2>4 · Export</h2>
        <div className="row">
          <label>
            Resolution{" "}
            <select value={exportHeight} onChange={(e) => setExportHeight(Number(e.target.value))}>
              <option value={720}>1280×720</option>
              <option value={1080}>1920×1080</option>
            </select>
          </label>
          <button onClick={doExport} disabled={!plan || busy !== null}>
            Export H.264/AAC
          </button>
          {busy === "Exporting" && (
            <button onClick={() => void cancelJob("current")}>Cancel</button>
          )}
        </div>

        {busy && (
          <p className="muted">
            {busy}
            {progress ? ` — ${progress.stage} ${(progress.fraction * 100).toFixed(0)}%` : "…"}
          </p>
        )}

        {validation && (
          <div className={validation.valid ? "verdict good" : "verdict bad"}>
            <strong>{validation.valid ? "Export validated" : "Export FAILED validation"}</strong>
            <ul>
              {validation.checks.map((c) => (
                <li key={c.name} className={c.passed ? "good" : "bad"}>
                  {c.passed ? "✓" : "✗"} {c.name}
                  {c.detail ? ` — ${c.detail}` : ""}
                </li>
              ))}
            </ul>
            <p className="muted">
              {validation.measured.width}×{validation.measured.height} ·{" "}
              {validation.measured.videoCodec} / {validation.measured.audioCodec} ·{" "}
              {fmt(validation.measured.durationTicks)} ·{" "}
              {(validation.measured.fileSizeBytes / 1_048_576).toFixed(1)} MB
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
