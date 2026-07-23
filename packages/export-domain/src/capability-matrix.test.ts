import { describe, it, expect } from "vitest";
import type { ExportSettings } from "./settings";
import { isSupported, resolveFallback, capabilitiesFor } from "./capability-matrix";

function settings(overrides: Partial<ExportSettings> = {}): ExportSettings {
  return {
    container: "mp4",
    videoCodec: "h264",
    audioCodec: "aac",
    resolution: "1080p",
    fps: 30,
    hwAccel: "auto",
    captions: "none",
    ...overrides,
  };
}

describe("capabilitiesFor", () => {
  it("declares Windows up to 4k with h264 + h265", () => {
    const caps = capabilitiesFor("windows");
    expect(caps.resolutions).toEqual(["720p", "1080p", "1440p", "4k"]);
    expect(caps.videoCodecs).toEqual(["h264", "h265"]);
    expect(caps.dexCompatibleProxyWorkflow).toBe(false);
  });

  it("declares DeX limited to 720p/1080p, h264 only, with a proxy workflow", () => {
    const caps = capabilitiesFor("dex");
    expect(caps.resolutions).toEqual(["720p", "1080p"]);
    expect(caps.videoCodecs).toEqual(["h264"]);
    expect(caps.dexCompatibleProxyWorkflow).toBe(true);
  });
});

describe("isSupported", () => {
  it("Windows accepts 4k h264", () => {
    expect(isSupported("windows", settings({ resolution: "4k", videoCodec: "h264" }))).toBe(true);
  });

  it("Windows accepts 4k h265", () => {
    expect(isSupported("windows", settings({ resolution: "4k", videoCodec: "h265" }))).toBe(true);
  });

  it("DeX rejects 4k", () => {
    expect(isSupported("dex", settings({ resolution: "4k" }))).toBe(false);
  });

  it("DeX accepts 1080p h264", () => {
    expect(isSupported("dex", settings({ resolution: "1080p", videoCodec: "h264" }))).toBe(true);
  });

  it("DeX rejects h265 (not promised until certified)", () => {
    expect(isSupported("dex", settings({ resolution: "720p", videoCodec: "h265" }))).toBe(false);
  });
});

describe("resolveFallback", () => {
  it("leaves fully-supported Windows settings unchanged", () => {
    const input = settings({ videoCodec: "h264", resolution: "1080p", hwAccel: "hardware" });
    expect(resolveFallback("windows", input)).toEqual(input);
  });

  it("downgrades hardware -> software on Windows for h265 (hw encode not guaranteed)", () => {
    const input = settings({ videoCodec: "h265", resolution: "1080p", hwAccel: "hardware" });
    const resolved = resolveFallback("windows", input);
    expect(resolved.hwAccel).toBe("software");
    expect(resolved.videoCodec).toBe("h265");
    expect(resolved.resolution).toBe("1080p");
  });

  it("downgrades hardware -> software and 4k -> 1080p on DeX", () => {
    const input = settings({ videoCodec: "h265", resolution: "4k", hwAccel: "hardware" });
    const resolved = resolveFallback("dex", input);
    expect(resolved.videoCodec).toBe("h264"); // unsupported codec -> h264
    expect(resolved.resolution).toBe("1080p"); // nearest supported tier to 4k
    expect(resolved.hwAccel).toBe("software"); // hw not guaranteed at h264/1080p on DeX
  });

  it("keeps hardware on DeX at the one guaranteed combo (h264/720p)", () => {
    const input = settings({ videoCodec: "h264", resolution: "720p", hwAccel: "hardware" });
    const resolved = resolveFallback("dex", input);
    expect(resolved).toEqual(input);
  });

  it("passes 'auto' and 'software' hwAccel through unchanged even when hw isn't guaranteed", () => {
    const auto = settings({ videoCodec: "h265", resolution: "1080p", hwAccel: "auto" });
    expect(resolveFallback("windows", auto).hwAccel).toBe("auto");

    const soft = settings({ videoCodec: "h265", resolution: "1080p", hwAccel: "software" });
    expect(resolveFallback("windows", soft).hwAccel).toBe("software");
  });

  it("snaps an unsupported resolution to the nearest supported tier on DeX", () => {
    expect(resolveFallback("dex", settings({ resolution: "1440p" })).resolution).toBe("1080p");
  });

  it("does not mutate the input settings", () => {
    const input = settings({ videoCodec: "h265", resolution: "4k", hwAccel: "hardware" });
    const snapshot = { ...input };
    resolveFallback("dex", input);
    expect(input).toEqual(snapshot);
  });
});
