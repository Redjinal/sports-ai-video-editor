// Media ingest use case (roadmap M4). Inspect a file, then turn the inspection into a durable
// project asset. Provider/native output is untrusted and is validated by the inspector port
// before it reaches here.
import { PROTOCOL_VERSION, type InspectMediaResultV1 } from "@sve/media-contracts";
import type { ProjectAsset } from "@sve/project-domain";
import type { MediaInspector } from "./ports";

/** Derive the asset kind from which streams the file actually has. */
export function assetKindFromInspection(info: InspectMediaResultV1): ProjectAsset["kind"] {
  if (info.videoStreams.length > 0) {
    // A single still frame reads as a 0-duration video; classify it as an image.
    return info.durationTicks <= 0 ? "image" : "video";
  }
  if (info.audioStreams.length > 0) return "audio";
  return "image";
}

/** Build a ProjectAsset from an inspection result. The fingerprint is the identity key. */
export function assetFromInspection(info: InspectMediaResultV1, path: string): ProjectAsset {
  return {
    id: `ast_${info.assetFingerprint.slice(0, 16)}`,
    fingerprint: info.assetFingerprint,
    kind: assetKindFromInspection(info),
    path,
    status: "online",
    durationTicks: info.durationTicks,
  };
}

export interface IngestResult {
  asset: ProjectAsset;
  inspection: InspectMediaResultV1;
}

/**
 * Ingest a single media file: inspect it, then produce the asset the caller adds to the
 * manifest (via `addAsset`) and persists. Returns the inspection too, so the UI can show
 * compatibility and stream details without inspecting twice.
 */
export async function ingestMedia(inspector: MediaInspector, path: string): Promise<IngestResult> {
  const inspection = await inspector.inspect({
    protocolVersion: PROTOCOL_VERSION,
    requestId: `ingest_${Date.now().toString(36)}`,
    path,
  });
  return { asset: assetFromInspection(inspection, path), inspection };
}
