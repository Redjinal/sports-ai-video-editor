// ISSUE-002 comparative benchmark: the "simpler alternative" to the Rust native layer.
//
// This orchestrates FFmpeg/FFprobe directly from Node — i.e. what the desktop app would do
// if there were NO Rust crate and the JS side spawned the media tools itself. It mirrors
// native/desktop-media/tests/benchmark.rs operation for operation so the two are comparable:
// same binaries, same encoder arguments, same payload, same measurements.
//
// Run: node tools/benchmark/node-orchestration.mjs
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { openSync, readSync, closeSync, statSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const FIXTURE = join(root, "fixtures", "media", "sync8s_1080p30_h264_aac.mp4");
const TIMESCALE = 27_000_000;

function ffAvailable() {
  try {
    return spawnSync("ffprobe", ["-version"], { encoding: "utf8" }).status === 0;
  } catch {
    return false;
  }
}

/** Same head+tail+size fingerprint the Rust adapter computes, so the work matches. */
function fingerprint(path) {
  const CHUNK = 1024 * 1024;
  const size = statSync(path).size;
  const hash = createHash("sha256");
  const sizeBuf = Buffer.alloc(8);
  sizeBuf.writeBigUInt64LE(BigInt(size));
  hash.update(sizeBuf);
  const fd = openSync(path, "r");
  try {
    const head = Buffer.alloc(Math.min(CHUNK, size));
    readSync(fd, head, 0, head.length, 0);
    hash.update(head);
    if (size > CHUNK * 2) {
      const tail = Buffer.alloc(CHUNK);
      readSync(fd, tail, 0, CHUNK, size - CHUNK);
      hash.update(tail);
    }
  } finally {
    closeSync(fd);
  }
  return hash.digest("hex");
}

/** Equivalent of desktop_media::inspect: spawn ffprobe, parse, normalise, fingerprint. */
function inspect(path) {
  const out = spawnSync(
    "ffprobe",
    ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", path],
    { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  );
  if (out.status !== 0) {
    throw new Error("ffprobe failed");
  }
  const probe = JSON.parse(out.stdout);
  const rational = (v, fb) => {
    const [n, d] = String(v ?? "").split("/");
    const num = Number.parseInt(n, 10);
    const den = Number.parseInt(d, 10);
    return Number.isFinite(num) && Number.isFinite(den) && den !== 0
      ? { numerator: num, denominator: den }
      : fb;
  };
  const videoStreams = probe.streams
    .filter((s) => s.codec_type === "video")
    .map((s) => {
      const avg = rational(s.avg_frame_rate, { numerator: 0, denominator: 1 });
      const r = rational(s.r_frame_rate, { numerator: 0, denominator: 1 });
      return {
        index: s.index,
        codec: s.codec_name,
        profile: s.profile,
        width: s.width,
        height: s.height,
        pixelAspectRatio: rational(s.sample_aspect_ratio, { numerator: 1, denominator: 1 }),
        avgFrameRate: avg,
        rFrameRate: r,
        isVariableFrameRate: avg.numerator * r.denominator !== r.numerator * avg.denominator,
        colorPrimaries: s.color_primaries,
        colorTransfer: s.color_transfer,
        colorSpace: s.color_space,
      };
    });
  const audioStreams = probe.streams
    .filter((s) => s.codec_type === "audio")
    .map((s) => ({
      index: s.index,
      codec: s.codec_name,
      sampleRate: Number.parseInt(s.sample_rate, 10),
      channels: s.channels,
      channelLayout: s.channel_layout,
    }));
  return {
    requestId: "bench",
    assetFingerprint: fingerprint(path),
    container: probe.format.format_name,
    durationTicks: Math.round(Number.parseFloat(probe.format.duration) * TIMESCALE),
    startTicks: 0,
    fileSizeBytes: Number.parseInt(probe.format.size, 10),
    videoStreams,
    audioStreams,
    otherStreams: [],
    compatibility: "certified",
    warnings: [],
  };
}

/** Same encoder arguments the Rust exporter builds for the benchmark plan. */
function exportArgs(source, out, durationSeconds) {
  return [
    "-hide_banner",
    "-nostats",
    "-y",
    "-ss",
    "0.000000",
    "-t",
    durationSeconds.toFixed(6),
    "-i",
    source,
    "-vf",
    "scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2",
    "-r",
    "30/1",
    "-c:v",
    "libx264",
    "-crf",
    "28",
    "-pix_fmt",
    "yuv420p",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-ar",
    "48000",
    "-ac",
    "2",
    "-movflags",
    "+faststart",
    "-progress",
    "pipe:1",
    out,
  ];
}

function main() {
  if (!ffAvailable()) {
    console.warn("SKIPPED: ffmpeg/ffprobe unavailable");
    return;
  }
  console.warn("=== Node orchestration benchmark (ISSUE-002 comparison) ===");
  console.warn(`node: ${process.version} platform: ${process.platform} arch: ${process.arch}`);

  // --- 1. Metadata throughput --------------------------------------------
  const n = 20;
  let t = performance.now();
  for (let i = 0; i < n; i++) inspect(FIXTURE);
  let elapsed = performance.now() - t;
  console.warn(
    `metadata throughput: ${n} inspects in ${elapsed.toFixed(1)}ms => ` +
      `${(elapsed / n).toFixed(2)}ms/inspect (${(1000 / (elapsed / n)).toFixed(1)}/s)`,
  );

  // --- 2. Cancellation latency -------------------------------------------
  const tmp = join(tmpdir(), "sve-bench-node-cancel.mp4");
  rmSync(tmp, { force: true });
  const child = spawn("ffmpeg", exportArgs(FIXTURE, tmp, 8), { stdio: ["ignore", "pipe", "pipe"] });
  const started = performance.now();
  let markedAt = 0;
  const cancelTimer = setTimeout(() => {
    markedAt = performance.now();
    child.kill("SIGKILL"); // Windows: terminates the process
  }, 400);

  child.on("exit", () => {
    clearTimeout(cancelTimer);
    const ended = performance.now();
    // Cleanup is the orchestrator's job in both implementations.
    rmSync(tmp, { force: true });
    console.warn(
      `cancellation latency: ${(ended - markedAt).toFixed(1)}ms ` +
        `(total run ${(ended - started).toFixed(1)}ms), partial file removed=${!existsSync(tmp)}`,
    );

    // --- 3. IPC payload overhead -----------------------------------------
    const info = inspect(FIXTURE);
    const iterations = 1000;
    t = performance.now();
    let bytes = 0;
    for (let i = 0; i < iterations; i++) {
      const json = JSON.stringify(info);
      bytes = json.length;
      JSON.parse(json);
    }
    elapsed = performance.now() - t;
    console.warn(
      `ipc payload: ${bytes} bytes; ${iterations} serialise+parse round trips in ` +
        `${elapsed.toFixed(1)}ms => ${((elapsed / iterations) * 1000).toFixed(1)}µs each`,
    );

    // --- 4. Crash isolation ----------------------------------------------
    let isolated = false;
    try {
      inspect("definitely-not-a-media-file.mp4");
    } catch {
      isolated = true;
    }
    console.warn(`crash isolation: missing input handled=${isolated} (host process alive)`);
    console.warn("=== end benchmark ===");
  });
}

main();
