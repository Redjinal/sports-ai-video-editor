// Typed wrappers over the Tauri command boundary.
// Every payload crossing this boundary is validated against the media-contracts schemas,
// because native/provider output is untrusted input (engineering-standards.md §2).
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  parseInspectResult,
  PROTOCOL_VERSION,
  type InspectMediaResultV1,
  type OutputValidationResult,
  type RenderPlan,
} from "@sve/media-contracts";

export interface JobProgressEvent {
  jobId: string;
  stage: string;
  fraction: number;
}

export async function inspectMedia(path: string): Promise<InspectMediaResultV1> {
  const raw = await invoke<unknown>("inspect_media", {
    request: { protocolVersion: PROTOCOL_VERSION, requestId: crypto.randomUUID(), path },
  });
  return parseInspectResult(raw);
}

export async function generateProxy(args: {
  jobId: string;
  sourcePath: string;
  outputPath: string;
  maxWidth: number;
  maxHeight: number;
  totalTicks: number;
}): Promise<string> {
  return invoke<string>("generate_proxy", { args });
}

export async function exportSequence(args: {
  jobId: string;
  plan: RenderPlan;
  outputPath: string;
}): Promise<OutputValidationResult> {
  return invoke<OutputValidationResult>("export_sequence", { args });
}

export async function cancelJob(jobId: string): Promise<void> {
  await invoke("cancel_job", { jobId });
}

export async function ffmpegAvailable(): Promise<boolean> {
  return invoke<boolean>("ffmpeg_available");
}

export function onJobProgress(handler: (e: JobProgressEvent) => void): Promise<() => void> {
  return listen<JobProgressEvent>("job://progress", (event) => handler(event.payload)).then(
    (unlisten) => unlisten,
  );
}
