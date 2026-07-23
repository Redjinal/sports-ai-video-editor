import { describe, it, expect } from "vitest";
import { createEmptyManifest, type ProjectManifest } from "./manifest";
import type { ProjectAsset } from "./asset";
import {
  addAsset,
  referencedAssetIds,
  findUnusedAssets,
  setAssetStatus,
  setAssetProxy,
} from "./asset-registry";

function asset(id: string, fp: string): ProjectAsset {
  return {
    id,
    fingerprint: fp,
    kind: "video",
    path: `C:/m/${id}.mp4`,
    status: "online",
    durationTicks: 1000,
  };
}

function base(): ProjectManifest {
  return createEmptyManifest({ projectId: "prj_1", name: "P", now: "2026-07-22T00:00:00.000Z" });
}

/** A manifest with one sequence whose single clip references `assetId`. */
function withClip(m: ProjectManifest, assetId: string): ProjectManifest {
  return {
    ...m,
    sequences: [
      {
        id: "seq_master",
        name: "Master",
        settings: {
          width: 1920,
          height: 1080,
          pixelAspectRatio: { numerator: 1, denominator: 1 },
          frameRate: { numerator: 30, denominator: 1 },
          audioSampleRate: 48_000,
          background: "#000000",
          timeDisplayMode: "timecode",
        },
        tracks: [],
        objects: [
          {
            kind: "clip",
            id: "clp_1",
            trackId: "V1",
            startTicks: 0,
            durationTicks: 1000,
            enabled: true,
            assetId,
            sourceInTicks: 0,
            sourceDurationTicks: 1000,
            playbackRate: 1,
          },
        ],
        markers: [],
        parentSequenceIds: [],
      },
    ],
  };
}

describe("asset registry", () => {
  it("adds an asset and de-duplicates by fingerprint", () => {
    let m = base();
    m = addAsset(m, asset("ast_a", "fp-1"));
    expect(m.assets).toHaveLength(1);
    // Same content, different id — must not create a second entry.
    m = addAsset(m, asset("ast_b", "fp-1"));
    expect(m.assets).toHaveLength(1);
    m = addAsset(m, asset("ast_c", "fp-2"));
    expect(m.assets).toHaveLength(2);
  });

  it("reports which assets are referenced by clips", () => {
    let m = addAsset(base(), asset("ast_a", "fp-1"));
    m = addAsset(m, asset("ast_b", "fp-2"));
    m = withClip(m, "ast_a");
    expect([...referencedAssetIds(m)]).toEqual(["ast_a"]);
  });

  it("finds unused assets for review", () => {
    let m = addAsset(base(), asset("ast_a", "fp-1"));
    m = addAsset(m, asset("ast_b", "fp-2"));
    m = withClip(m, "ast_a"); // only ast_a is used
    const unused = findUnusedAssets(m);
    expect(unused.map((a) => a.id)).toEqual(["ast_b"]);
  });

  it("updates status and proxy path immutably", () => {
    const m = addAsset(base(), asset("ast_a", "fp-1"));
    const offline = setAssetStatus(m, "ast_a", "offline");
    expect(offline.assets[0]!.status).toBe("offline");
    expect(m.assets[0]!.status).toBe("online"); // original untouched

    const proxied = setAssetProxy(offline, "ast_a", "C:/m/ast_a.proxy.mp4");
    expect(proxied.assets[0]!.proxyPath).toBe("C:/m/ast_a.proxy.mp4");
  });
});
