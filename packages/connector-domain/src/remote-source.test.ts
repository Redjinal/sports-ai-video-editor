import { describe, it, expect } from "vitest";
import {
  googleDriveSourceSchema,
  dropboxSourceSchema,
  oneDriveSourceSchema,
  urlSourceSchema,
  youtubeProjectSourceSchema,
  remoteSourceSchema,
} from "./remote-source";

describe("RemoteSource schemas", () => {
  it("validates a googleDrive source", () => {
    const result = googleDriveSourceSchema.safeParse({
      provider: "googleDrive",
      fileId: "1AbCdEf",
      displayName: "game-footage.mp4",
      sizeBytes: 1024,
      mimeType: "video/mp4",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a googleDrive source missing fileId", () => {
    const result = googleDriveSourceSchema.safeParse({
      provider: "googleDrive",
      displayName: "game-footage.mp4",
    });
    expect(result.success).toBe(false);
  });

  it("validates a dropbox source", () => {
    const result = dropboxSourceSchema.safeParse({
      provider: "dropbox",
      path: "/footage/game1.mp4",
      displayName: "game1.mp4",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a dropbox source with an empty path", () => {
    const result = dropboxSourceSchema.safeParse({
      provider: "dropbox",
      path: "",
      displayName: "game1.mp4",
    });
    expect(result.success).toBe(false);
  });

  it("validates a oneDrive source", () => {
    const result = oneDriveSourceSchema.safeParse({
      provider: "oneDrive",
      itemId: "AAB123",
      displayName: "practice.mov",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a oneDrive source missing itemId", () => {
    const result = oneDriveSourceSchema.safeParse({
      provider: "oneDrive",
      displayName: "practice.mov",
    });
    expect(result.success).toBe(false);
  });

  it("validates a url source with an http(s) URL", () => {
    const result = urlSourceSchema.safeParse({
      provider: "url",
      url: "https://example.com/game.mp4",
      displayName: "game.mp4",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a url source with a non-URL string", () => {
    const result = urlSourceSchema.safeParse({
      provider: "url",
      url: "not-a-url",
      displayName: "game.mp4",
    });
    expect(result.success).toBe(false);
  });

  it("validates a youtubeProject source", () => {
    const result = youtubeProjectSourceSchema.safeParse({
      provider: "youtubeProject",
      url: "https://www.youtube.com/watch?v=abc123",
      videoId: "abc123",
      displayName: "Game recap",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a youtubeProject source missing videoId", () => {
    const result = youtubeProjectSourceSchema.safeParse({
      provider: "youtubeProject",
      url: "https://www.youtube.com/watch?v=abc123",
      displayName: "Game recap",
    });
    expect(result.success).toBe(false);
  });

  it("discriminates the union on provider", () => {
    const drive = remoteSourceSchema.safeParse({
      provider: "googleDrive",
      fileId: "1AbCdEf",
      displayName: "footage.mp4",
    });
    expect(drive.success).toBe(true);

    const unknownProvider = remoteSourceSchema.safeParse({
      provider: "megaUpload",
      displayName: "footage.mp4",
    });
    expect(unknownProvider.success).toBe(false);
  });
});
