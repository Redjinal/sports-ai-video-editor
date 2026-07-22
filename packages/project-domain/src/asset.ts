// Project asset registry (project-format.md §6).
import { z } from "zod";

export const assetStatusSchema = z.enum(["online", "offline", "proxy_only", "invalid"]);
export type AssetStatus = z.infer<typeof assetStatusSchema>;

export const projectAssetSchema = z.object({
  id: z.string().min(1),
  /** Stable content fingerprint used for identity across relink/proxy. */
  fingerprint: z.string().min(1),
  kind: z.enum(["video", "audio", "image"]),
  /** Absolute or project-relative path to the original source. */
  path: z.string().min(1),
  status: assetStatusSchema,
  durationTicks: z.number().int().nonnegative(),
  /** Optional generated proxy path (disposable derived data). */
  proxyPath: z.string().optional(),
});
export type ProjectAsset = z.infer<typeof projectAssetSchema>;
