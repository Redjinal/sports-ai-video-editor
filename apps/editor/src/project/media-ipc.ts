// IPC bindings for M4 media derivatives and storage media operations.
import { invoke } from "@tauri-apps/api/core";

export interface ThumbnailStrip {
  path: string;
  count: number;
  tileWidth: number;
  tileHeight: number;
  cacheVersion: number;
}

export interface Waveform {
  version: number;
  hasAudio: boolean;
  sampleRate: number;
  buckets: number;
  peaks: number[];
  rms: number[];
}

export interface ManagedConversion {
  managedPath: string;
  sourceContainer: string;
  sourceVideoCodec?: string;
  managedVideoCodec?: string;
  changedProperties: string[];
  durationTicks: number;
}

export interface ConsolidatedAsset {
  assetId: string;
  newPath: string;
}

export interface CacheCleanReport {
  removed: string[];
  bytesFreed: number;
}

export interface PackageEntry {
  relativePath: string;
  sizeBytes: number;
  sha256: string;
}

export interface PackageReport {
  destination: string;
  files: PackageEntry[];
  totalBytes: number;
}

export function generateThumbnails(args: {
  jobId: string;
  sourcePath: string;
  outputPath: string;
  count: number;
  tileWidth: number;
  durationTicks: number;
}): Promise<ThumbnailStrip> {
  return invoke<ThumbnailStrip>("generate_thumbnails", { args });
}

export function generateWaveform(args: {
  jobId: string;
  sourcePath: string;
  buckets: number;
  durationTicks: number;
}): Promise<Waveform> {
  return invoke<Waveform>("generate_waveform", { args });
}

export function convertManaged(args: {
  jobId: string;
  sourcePath: string;
  outputPath: string;
}): Promise<ManagedConversion> {
  return invoke<ManagedConversion>("convert_managed", { args });
}

export function consolidate(
  dir: string,
  items: { assetId: string; sourcePath: string }[],
): Promise<ConsolidatedAsset[]> {
  return invoke<ConsolidatedAsset[]>("project_consolidate", { dir, items });
}

export function cleanCache(dir: string): Promise<CacheCleanReport> {
  return invoke<CacheCleanReport>("project_clean_cache", { dir });
}

export function packageProject(
  dir: string,
  dest: string,
  withMedia: boolean,
): Promise<PackageReport> {
  return invoke<PackageReport>("project_package", { dir, dest, withMedia });
}
