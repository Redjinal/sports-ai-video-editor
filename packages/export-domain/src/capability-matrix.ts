// Per-platform export capability matrix (media-engine.md §2 & §4, roadmap.md M12).
// Windows: H.264 + H.265, up to 4K, hardware decode/encode with a software fallback.
// DeX: 720p/1080p only, H.264 only (H.265 on DeX is "not promised until certified" —
// media-engine.md §4), a supported hardware encode path with a compatibility fallback, and a
// DeX-compatible proxy workflow for heavy/unsupported originals (media-engine.md §8).
import type { ExportSettings, Resolution, VideoCodec, HwAccel } from "./settings";
import { RESOLUTIONS_BY_SIZE } from "./settings";

export const PLATFORMS = ["windows", "dex"] as const;
export type Platform = (typeof PLATFORMS)[number];

export interface PlatformCapabilities {
  platform: Platform;
  /** Video codecs this platform can produce for export. */
  videoCodecs: readonly VideoCodec[];
  /** Resolutions this platform can produce for export. */
  resolutions: readonly Resolution[];
  /**
   * For each supported codec, the resolutions where a hardware encode path is guaranteed rather
   * than merely attempted with a software/compatibility fallback (media-engine.md §4: Windows
   * H.265 hardware is "subject to encoder path"; DeX 1080p relies on the "compatibility
   * fallback" roadmap deliverable). Combos outside this map still export, just via software.
   */
  hardwareEncodeGuaranteed: Readonly<Partial<Record<VideoCodec, readonly Resolution[]>>>;
  /** DeX-compatible proxy workflow for heavy/unsupported originals (media-engine.md §8). */
  dexCompatibleProxyWorkflow: boolean;
}

export const CAPABILITY_MATRIX: Readonly<Record<Platform, PlatformCapabilities>> = {
  windows: {
    platform: "windows",
    videoCodecs: ["h264", "h265"],
    resolutions: ["720p", "1080p", "1440p", "4k"],
    hardwareEncodeGuaranteed: {
      h264: ["720p", "1080p", "1440p", "4k"],
      h265: [],
    },
    dexCompatibleProxyWorkflow: false,
  },
  dex: {
    platform: "dex",
    videoCodecs: ["h264"],
    resolutions: ["720p", "1080p"],
    hardwareEncodeGuaranteed: {
      h264: ["720p"],
    },
    dexCompatibleProxyWorkflow: true,
  },
};

export function capabilitiesFor(platform: Platform): PlatformCapabilities {
  return CAPABILITY_MATRIX[platform];
}

function hardwareEncodeGuaranteed(
  caps: PlatformCapabilities,
  videoCodec: VideoCodec,
  resolution: Resolution,
): boolean {
  return (caps.hardwareEncodeGuaranteed[videoCodec] ?? []).includes(resolution);
}

/**
 * True when the platform can produce this codec at this resolution at all. `hwAccel` is never a
 * support blocker on its own — every supported combo has a software path (`resolveFallback`
 * downgrades hardware requests that aren't guaranteed).
 */
export function isSupported(platform: Platform, settings: ExportSettings): boolean {
  const caps = capabilitiesFor(platform);
  return (
    caps.videoCodecs.includes(settings.videoCodec) && caps.resolutions.includes(settings.resolution)
  );
}

/** Find the platform's supported resolution closest to `requested`; ties favor the smaller tier. */
function nearestSupportedResolution(caps: PlatformCapabilities, requested: Resolution): Resolution {
  if (caps.resolutions.includes(requested)) return requested;

  const requestedIndex = RESOLUTIONS_BY_SIZE.indexOf(requested);
  let best: Resolution | undefined;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const candidate of caps.resolutions) {
    const distance = Math.abs(RESOLUTIONS_BY_SIZE.indexOf(candidate) - requestedIndex);
    const closerTie =
      best !== undefined &&
      distance === bestDistance &&
      RESOLUTIONS_BY_SIZE.indexOf(candidate) < RESOLUTIONS_BY_SIZE.indexOf(best);
    if (best === undefined || distance < bestDistance || closerTie) {
      best = candidate;
      bestDistance = distance;
    }
  }

  if (best === undefined) {
    throw new Error(`Platform ${caps.platform} declares no supported resolutions`);
  }
  return best;
}

/**
 * Resolve settings a platform cannot honor exactly into the nearest settings it can:
 * - an unsupported video codec falls back to h264;
 * - an unsupported resolution snaps to the nearest supported tier;
 * - `hwAccel: "hardware"` downgrades to `"software"` when hardware encode isn't guaranteed for
 *   the (possibly just-downgraded) codec/resolution; `"auto"` and `"software"` pass through.
 * Pure and deterministic: same inputs always produce the same fallback settings.
 */
export function resolveFallback(platform: Platform, settings: ExportSettings): ExportSettings {
  const caps = capabilitiesFor(platform);

  const videoCodec: VideoCodec = caps.videoCodecs.includes(settings.videoCodec)
    ? settings.videoCodec
    : "h264";
  const resolution = nearestSupportedResolution(caps, settings.resolution);
  const hwAccel: HwAccel =
    settings.hwAccel === "hardware" && !hardwareEncodeGuaranteed(caps, videoCodec, resolution)
      ? "software"
      : settings.hwAccel;

  return { ...settings, videoCodec, resolution, hwAccel };
}
