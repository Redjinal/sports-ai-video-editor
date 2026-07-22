// Media suite: probe the committed synthetic fixture with ffprobe and validate the
// result through the @sve/media-contracts inspect schema. This exercises the certified
// H.264/AAC baseline (DEC-MEDIA-001) and prototypes the shape the Rust adapter must emit.
// Skipped automatically when ffprobe is unavailable so CI without FFmpeg still passes.
import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  parseInspectResult,
  PROTOCOL_VERSION,
  type InspectMediaResultV1,
} from "@sve/media-contracts";
import { TIMESCALE } from "@sve/timeline-domain";

const FIXTURE = resolve(__dirname, "..", "..", "fixtures", "media", "sync8s_1080p30_h264_aac.mp4");

function ffprobeAvailable(): boolean {
  try {
    return spawnSync("ffprobe", ["-version"], { encoding: "utf8" }).status === 0;
  } catch {
    return false;
  }
}

function parseRational(value: string | undefined): { numerator: number; denominator: number } {
  const [n, d] = (value ?? "0/1").split("/").map((x) => Number.parseInt(x, 10));
  return { numerator: n ?? 0, denominator: d && d !== 0 ? d : 1 };
}

/** Minimal ffprobe-json -> InspectMediaResultV1 mapper (the Rust adapter's job in prod). */
function inspectViaFfprobe(path: string): InspectMediaResultV1 {
  const out = spawnSync(
    "ffprobe",
    ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", path],
    { encoding: "utf8" },
  );
  const probe = JSON.parse(out.stdout) as {
    format: { format_name: string; duration: string; size: string };
    streams: Array<Record<string, unknown>>;
  };
  const durationTicks = Math.round(Number.parseFloat(probe.format.duration) * TIMESCALE);
  const fingerprint = createHash("sha256").update(readFileSync(path)).digest("hex");

  const videoStreams = probe.streams
    .filter((s) => s.codec_type === "video")
    .map((s) => {
      const avg = parseRational(s.avg_frame_rate as string);
      const r = parseRational(s.r_frame_rate as string);
      return {
        index: s.index as number,
        codec: s.codec_name as string,
        profile: s.profile as string | undefined,
        width: s.width as number,
        height: s.height as number,
        pixelAspectRatio: parseRational((s.sample_aspect_ratio as string) ?? "1/1"),
        avgFrameRate: avg,
        rFrameRate: r,
        isVariableFrameRate: avg.numerator * r.denominator !== r.numerator * avg.denominator,
      };
    });

  const audioStreams = probe.streams
    .filter((s) => s.codec_type === "audio")
    .map((s) => ({
      index: s.index as number,
      codec: s.codec_name as string,
      sampleRate: Number.parseInt(s.sample_rate as string, 10),
      channels: s.channels as number,
    }));

  // Validate through the real contract schema — the point of this test.
  return parseInspectResult({
    requestId: "test",
    assetFingerprint: fingerprint,
    container: probe.format.format_name,
    durationTicks,
    fileSizeBytes: Number.parseInt(probe.format.size, 10),
    videoStreams,
    audioStreams,
    compatibility: "certified",
  } satisfies Record<string, unknown> & { requestId: string });
}

const suite = ffprobeAvailable() ? describe : describe.skip;

suite("inspect the certified H.264/AAC fixture", () => {
  it("the fixture exists", () => {
    expect(existsSync(FIXTURE)).toBe(true);
  });

  it("produces a schema-valid inspection with the expected streams", () => {
    const r = inspectViaFfprobe(FIXTURE);
    expect(r.container).toContain("mp4");
    // ~8s, within one frame (900,000 ticks) tolerance.
    expect(Math.abs(r.durationTicks - TIMESCALE * 8)).toBeLessThan(900_000);
    expect(r.videoStreams).toHaveLength(1);
    expect(r.videoStreams[0]!.codec).toBe("h264");
    expect(r.videoStreams[0]!.width).toBe(1920);
    expect(r.videoStreams[0]!.height).toBe(1080);
    expect(r.videoStreams[0]!.rFrameRate).toEqual({ numerator: 30, denominator: 1 });
    expect(r.videoStreams[0]!.isVariableFrameRate).toBe(false);
    expect(r.audioStreams[0]!.codec).toBe("aac");
    expect(r.audioStreams[0]!.sampleRate).toBe(48_000);
  });

  it("uses the current protocol version constant", () => {
    expect(PROTOCOL_VERSION).toBe(1);
  });
});
