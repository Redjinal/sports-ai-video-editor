import { describe, it, expect } from "vitest";
import { localise, isLocalized } from "./localised-asset";
import type { RemoteSource } from "./remote-source";

describe("localise", () => {
  it("produces a self-contained asset from a remote source", () => {
    const source: RemoteSource = {
      provider: "googleDrive",
      fileId: "1AbCdEf",
      displayName: "game-footage.mp4",
    };
    const asset = localise(source, "C:/media/game-footage.mp4", "2026-07-22T12:00:00.000Z");

    expect(asset.localPath).toBe("C:/media/game-footage.mp4");
    expect(asset.provenance).toEqual({
      provider: "googleDrive",
      sourceDisplayName: "game-footage.mp4",
      localisedAtIso: "2026-07-22T12:00:00.000Z",
    });
  });

  it("carries no data required to reach back to the remote provider", () => {
    const source: RemoteSource = {
      provider: "dropbox",
      path: "/footage/game1.mp4",
      displayName: "game1.mp4",
    };
    const asset = localise(source, "C:/media/game1.mp4", "2026-07-22T12:00:00.000Z");

    // Only localPath + display-only provenance — no fileId/path/url/itemId that would be
    // needed to re-fetch from the provider.
    const keys = Object.keys(asset);
    expect(keys.sort()).toEqual(["localPath", "provenance"]);
    const provenanceKeys = Object.keys(asset.provenance).sort();
    expect(provenanceKeys).toEqual(["localisedAtIso", "provider", "sourceDisplayName"]);
  });

  it("is pure: the same inputs always produce an equal result", () => {
    const source: RemoteSource = { provider: "oneDrive", itemId: "AAB123", displayName: "x.mov" };
    const a = localise(source, "C:/media/x.mov", "2026-07-22T00:00:00.000Z");
    const b = localise(source, "C:/media/x.mov", "2026-07-22T00:00:00.000Z");
    expect(a).toEqual(b);
  });

  it("isLocalized is true once a local path is present", () => {
    const source: RemoteSource = {
      provider: "url",
      url: "https://example.com/a.mp4",
      displayName: "a.mp4",
    };
    const asset = localise(source, "C:/media/a.mp4", "2026-07-22T00:00:00.000Z");
    expect(isLocalized(asset)).toBe(true);
  });

  it("isLocalized is false for an empty local path", () => {
    expect(
      isLocalized({
        localPath: "",
        provenance: {
          provider: "url",
          sourceDisplayName: "a.mp4",
          localisedAtIso: "2026-07-22T00:00:00.000Z",
        },
      }),
    ).toBe(false);
  });
});
