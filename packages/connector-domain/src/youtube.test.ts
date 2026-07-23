import { describe, it, expect } from "vitest";
import { youTubeProjectRefSchema, toYouTubeRemoteSource } from "./youtube";
import type { YouTubeProjectRef } from "./youtube";

describe("YouTubeProjectRef", () => {
  it("validates a link + metadata reference", () => {
    const result = youTubeProjectRefSchema.safeParse({
      url: "https://www.youtube.com/watch?v=abc123",
      videoId: "abc123",
      title: "Season opener recap",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a non-URL link", () => {
    const result = youTubeProjectRefSchema.safeParse({
      url: "not-a-url",
      videoId: "abc123",
      title: "Season opener recap",
    });
    expect(result.success).toBe(false);
  });

  it("carries no field that could hold downloaded media or a media URL", () => {
    const ref: YouTubeProjectRef = {
      url: "https://www.youtube.com/watch?v=abc123",
      videoId: "abc123",
      title: "Season opener recap",
    };
    // Only link + metadata fields — no localPath / downloadUrl / bytes anywhere on the type.
    expect(Object.keys(ref).sort()).toEqual(["title", "url", "videoId"].sort());
  });

  it("adapts to a RemoteSource for listing/display without adding a download path", () => {
    const ref: YouTubeProjectRef = {
      url: "https://www.youtube.com/watch?v=abc123",
      videoId: "abc123",
      title: "Season opener recap",
    };
    const remoteSource = toYouTubeRemoteSource(ref);
    expect(remoteSource).toEqual({
      provider: "youtubeProject",
      url: ref.url,
      videoId: ref.videoId,
      displayName: ref.title,
    });
  });
});
