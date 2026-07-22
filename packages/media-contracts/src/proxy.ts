// Proxy generation contract (media-engine.md §8). Proxies are disposable derived data;
// they share the original's asset id and preserve explicit source-time mapping.
import { z } from "zod";
import { PROTOCOL_VERSION } from "./inspect";

export const proxyProfileIdSchema = z.enum(["windows-standard-1080", "lightweight-720", "dex-720"]);
export type ProxyProfileId = z.infer<typeof proxyProfileIdSchema>;

export interface ProxyProfile {
  id: ProxyProfileId;
  maxWidth: number;
  maxHeight: number;
  videoCodec: "h264";
  audioCodec: "aac";
  /** Editing-friendly, seek-optimised encode; not for final delivery. */
  label: string;
}

export const PROXY_PROFILES: Readonly<Record<ProxyProfileId, ProxyProfile>> = {
  "windows-standard-1080": {
    id: "windows-standard-1080",
    maxWidth: 1920,
    maxHeight: 1080,
    videoCodec: "h264",
    audioCodec: "aac",
    label: "Windows standard 1080p",
  },
  "lightweight-720": {
    id: "lightweight-720",
    maxWidth: 1280,
    maxHeight: 720,
    videoCodec: "h264",
    audioCodec: "aac",
    label: "Lightweight 720p",
  },
  "dex-720": {
    id: "dex-720",
    maxWidth: 1280,
    maxHeight: 720,
    videoCodec: "h264",
    audioCodec: "aac",
    label: "DeX-compatible 720p",
  },
};

export const generateProxyRequestSchema = z.object({
  protocolVersion: z.literal(PROTOCOL_VERSION),
  requestId: z.string().min(1),
  /** Shared asset id — proxy and original are the same asset (media-engine.md §8 invariants). */
  assetId: z.string().min(1),
  sourcePath: z.string().min(1),
  profileId: proxyProfileIdSchema,
  outputPath: z.string().min(1),
});
export type GenerateProxyRequestV1 = z.infer<typeof generateProxyRequestSchema>;

export const proxyResultSchema = z.object({
  requestId: z.string().min(1),
  assetId: z.string().min(1),
  proxyPath: z.string().min(1),
  profileId: proxyProfileIdSchema,
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  durationTicks: z.number().int().nonnegative(),
  /**
   * Source-time mapping. For a straight transcode this is 1:1, but it is stated
   * explicitly so timeline references never silently shift (media-engine.md §8).
   */
  sourceTimeScale: z.object({ numerator: z.number().int(), denominator: z.number().int() }),
});
export type ProxyResultV1 = z.infer<typeof proxyResultSchema>;
