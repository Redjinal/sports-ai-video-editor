// YouTube project integration (M11 connectors).
//
// INVARIANT (AGENTS.md §8 / product decisions, release blocker): no unofficial YouTube
// downloader. "YouTube project integration" means importing a *link/metadata reference
// only* — this module intentionally defines NO field, method, or helper that carries,
// requests, or resolves downloaded video/audio bytes from YouTube. A `YouTubeProjectRef`
// is nothing more than a link plus fetched title/id, suitable for citation/reference inside
// a project. Any future media acquisition path must go through an explicitly, separately
// approved official mechanism — never through this type.
import { z } from "zod";
import type { YouTubeProjectSource } from "./remote-source";

export const youTubeProjectRefSchema = z.object({
  url: z.string().url(),
  videoId: z.string().min(1),
  title: z.string().min(1),
});

/** Link + fetched metadata only. No media, no download URL, no local path. */
export type YouTubeProjectRef = z.infer<typeof youTubeProjectRefSchema>;

/** Adapt a reference into the generic `RemoteSource` union for listing/display purposes. */
export function toYouTubeRemoteSource(ref: YouTubeProjectRef): YouTubeProjectSource {
  return {
    provider: "youtubeProject",
    url: ref.url,
    videoId: ref.videoId,
    displayName: ref.title,
  };
}
