// Remote source references (M11 connectors). Every variant carries only a minimal
// reference (id/path/url + display name, optional size/mime) — never credentials, never
// a cached copy of the media itself. Provider-neutral: this file defines shapes only,
// no provider SDK is imported anywhere in this package.
import { z } from "zod";

const optionalMetadataShape = {
  sizeBytes: z.number().int().nonnegative().optional(),
  mimeType: z.string().min(1).optional(),
} as const;

export const googleDriveSourceSchema = z.object({
  provider: z.literal("googleDrive"),
  /** Provider-assigned file id — opaque reference, not a path. */
  fileId: z.string().min(1),
  displayName: z.string().min(1),
  ...optionalMetadataShape,
});
export type GoogleDriveSource = z.infer<typeof googleDriveSourceSchema>;

export const dropboxSourceSchema = z.object({
  provider: z.literal("dropbox"),
  path: z.string().min(1),
  displayName: z.string().min(1),
  ...optionalMetadataShape,
});
export type DropboxSource = z.infer<typeof dropboxSourceSchema>;

export const oneDriveSourceSchema = z.object({
  provider: z.literal("oneDrive"),
  itemId: z.string().min(1),
  displayName: z.string().min(1),
  ...optionalMetadataShape,
});
export type OneDriveSource = z.infer<typeof oneDriveSourceSchema>;

export const urlSourceSchema = z.object({
  provider: z.literal("url"),
  url: z.string().url(),
  displayName: z.string().min(1),
  ...optionalMetadataShape,
});
export type UrlSource = z.infer<typeof urlSourceSchema>;

/**
 * A YouTube project reference. This is a *link/metadata reference only* — there is
 * intentionally no field carrying downloaded media or a download URL. See
 * `youtube.ts` for the fuller metadata model and the invariant it documents
 * (AGENTS.md §8: no unofficial YouTube downloader).
 */
export const youtubeProjectSourceSchema = z.object({
  provider: z.literal("youtubeProject"),
  url: z.string().url(),
  videoId: z.string().min(1),
  displayName: z.string().min(1),
  ...optionalMetadataShape,
});
export type YouTubeProjectSource = z.infer<typeof youtubeProjectSourceSchema>;

export const remoteSourceSchema = z.discriminatedUnion("provider", [
  googleDriveSourceSchema,
  dropboxSourceSchema,
  oneDriveSourceSchema,
  urlSourceSchema,
  youtubeProjectSourceSchema,
]);

/** A reference to media that lives outside the local filesystem, pending localisation. */
export type RemoteSource = z.infer<typeof remoteSourceSchema>;

export type RemoteSourceProvider = RemoteSource["provider"];
