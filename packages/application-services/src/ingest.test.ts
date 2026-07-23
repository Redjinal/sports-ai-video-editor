import { describe, it, expect, vi } from "vitest";
import type { InspectMediaResultV1 } from "@sve/media-contracts";
import { ingestMedia, assetFromInspection, assetKindFromInspection } from "./ingest";
import type { MediaInspector } from "./ports";

const TIMESCALE = 27_000_000;

function inspection(over: Partial<InspectMediaResultV1> = {}): InspectMediaResultV1 {
  return {
    requestId: "r",
    assetFingerprint: "abcdef0123456789feed",
    container: "mov,mp4",
    durationTicks: TIMESCALE * 8,
    startTicks: 0,
    fileSizeBytes: 1000,
    videoStreams: [
      {
        index: 0,
        codec: "h264",
        width: 1920,
        height: 1080,
        pixelAspectRatio: { numerator: 1, denominator: 1 },
        avgFrameRate: { numerator: 30, denominator: 1 },
        rFrameRate: { numerator: 30, denominator: 1 },
        isVariableFrameRate: false,
      },
    ],
    audioStreams: [{ index: 1, codec: "aac", sampleRate: 48_000, channels: 2 }],
    otherStreams: [],
    compatibility: "certified",
    warnings: [],
    ...over,
  };
}

describe("asset kind classification", () => {
  it("classifies a normal clip as video", () => {
    expect(assetKindFromInspection(inspection())).toBe("video");
  });
  it("classifies an audio-only file as audio", () => {
    expect(assetKindFromInspection(inspection({ videoStreams: [] }))).toBe("audio");
  });
  it("classifies a zero-duration still as an image", () => {
    expect(assetKindFromInspection(inspection({ durationTicks: 0 }))).toBe("image");
  });
});

describe("ingestMedia", () => {
  it("inspects a path and produces a fingerprint-keyed asset", async () => {
    const inspector: MediaInspector = { inspect: vi.fn().mockResolvedValue(inspection()) };
    const { asset, inspection: got } = await ingestMedia(inspector, "C:/media/game.mp4");

    expect(inspector.inspect).toHaveBeenCalledOnce();
    expect(asset.kind).toBe("video");
    expect(asset.path).toBe("C:/media/game.mp4");
    expect(asset.status).toBe("online");
    expect(asset.durationTicks).toBe(TIMESCALE * 8);
    expect(asset.id).toBe("ast_abcdef0123456789");
    expect(asset.fingerprint).toBe("abcdef0123456789feed");
    expect(got.compatibility).toBe("certified");
  });

  it("maps the inspection fingerprint onto the asset id deterministically", () => {
    const a = assetFromInspection(inspection(), "C:/a.mp4");
    const b = assetFromInspection(inspection(), "C:/b.mp4");
    expect(a.id).toBe(b.id); // same content -> same id, regardless of path
    expect(a.path).not.toBe(b.path);
  });
});
