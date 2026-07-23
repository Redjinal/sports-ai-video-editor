/** @vitest-environment happy-dom */
// The media bin must drive the real ingest use case and asset-registry operations against the
// manifest. IPC (Tauri) is mocked; the domain logic under it is exercised for real.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import {
  createEmptyManifest,
  addAsset,
  type ProjectManifest,
  type ProjectAsset,
} from "@sve/project-domain";

const mocks = vi.hoisted(() => ({
  inspectMedia: vi.fn(),
  generateProxy: vi.fn(),
  cleanCache: vi.fn(),
  consolidate: vi.fn(),
  packageProject: vi.fn(),
}));

vi.mock("../ipc", () => ({
  inspectMedia: mocks.inspectMedia,
  generateProxy: mocks.generateProxy,
}));
vi.mock("../project/media-ipc", () => ({
  cleanCache: mocks.cleanCache,
  consolidate: mocks.consolidate,
  packageProject: mocks.packageProject,
}));

import { MediaBin } from "./MediaBin";

const TIMESCALE = 27_000_000;

function inspection(fp: string) {
  return {
    requestId: "r",
    assetFingerprint: fp,
    container: "mov,mp4",
    durationTicks: TIMESCALE * 8,
    startTicks: 0,
    fileSizeBytes: 1000,
    videoStreams: [
      {
        index: 0,
        codec: "h264",
        width: 1920,
        height: 1080,
        pixelAspectRatio: { numerator: 1, denominator: 1 },
        avgFrameRate: { numerator: 30, denominator: 1 },
        rFrameRate: { numerator: 30, denominator: 1 },
        isVariableFrameRate: false,
      },
    ],
    audioStreams: [{ index: 1, codec: "aac", sampleRate: 48_000, channels: 2 }],
    otherStreams: [],
    compatibility: "certified",
    warnings: [],
  };
}

function asset(id: string, fp: string, path: string): ProjectAsset {
  return { id, fingerprint: fp, kind: "video", path, status: "online", durationTicks: 1000 };
}

function baseManifest(): ProjectManifest {
  return createEmptyManifest({ projectId: "prj_1", name: "P", now: "2026-07-22T00:00:00.000Z" });
}

function setup(manifest: ProjectManifest) {
  let current = manifest;
  const onError = vi.fn();
  const onManifestChange = vi.fn((m: ProjectManifest) => {
    current = m;
    rerender(
      <MediaBin
        manifest={current}
        dir="C:\\p"
        onManifestChange={onManifestChange}
        onError={onError}
      />,
    );
  });
  const { rerender } = render(
    <MediaBin
      manifest={current}
      dir="C:\\p"
      onManifestChange={onManifestChange}
      onError={onError}
    />,
  );
  return { onError, onManifestChange, latest: () => current };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.inspectMedia.mockResolvedValue(inspection("feedbeef00112233"));
});
afterEach(cleanup);

describe("MediaBin", () => {
  it("imports a file: inspects it and adds a fingerprint-keyed asset", async () => {
    const { onManifestChange, latest } = setup(baseManifest());
    fireEvent.change(screen.getByLabelText("Media file path"), {
      target: { value: "C:\\media\\game.mp4" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Import" }));
    await waitFor(() => expect(onManifestChange).toHaveBeenCalled());
    expect(mocks.inspectMedia).toHaveBeenCalledWith("C:\\media\\game.mp4");
    expect(latest().assets).toHaveLength(1);
    expect(latest().assets[0]!.id).toBe("ast_feedbeef00112233");
  });

  it("shows an unused badge and lets an unused asset be removed", async () => {
    const m = addAsset(baseManifest(), asset("ast_x", "fp-x", "C:\\media\\unused.mp4"));
    const { latest } = setup(m);
    // The asset is referenced by no clip, so it is unused.
    expect(screen.getByText("unused")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(latest().assets).toHaveLength(0);
  });

  it("attaches a generated proxy path to the asset", async () => {
    const m = addAsset(baseManifest(), asset("ast_x", "fp-x", "C:\\media\\clip.mp4"));
    mocks.generateProxy.mockResolvedValue("C:\\media\\clip.mp4.proxy720.mp4");
    const { latest } = setup(m);
    fireEvent.click(screen.getByRole("button", { name: "Proxy" }));
    await waitFor(() => expect(mocks.generateProxy).toHaveBeenCalled());
    await waitFor(() =>
      expect(latest().assets[0]!.proxyPath).toBe("C:\\media\\clip.mp4.proxy720.mp4"),
    );
  });

  it("filters the asset list", () => {
    let m = addAsset(baseManifest(), asset("ast_a", "fp-a", "C:\\m\\alpha.mp4"));
    m = addAsset(m, asset("ast_b", "fp-b", "C:\\m\\bravo.mp4"));
    setup(m);
    expect(screen.getByText("alpha.mp4")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Filter media"), { target: { value: "brav" } });
    expect(screen.queryByText("alpha.mp4")).toBeNull();
    expect(screen.getByText("bravo.mp4")).toBeTruthy();
  });

  it("reports a cache-clean summary", async () => {
    mocks.cleanCache.mockResolvedValue({ removed: ["proxies"], bytesFreed: 2_097_152 });
    const { onError } = setup(baseManifest());
    fireEvent.click(screen.getByRole("button", { name: "Clean cache" }));
    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith(expect.stringMatching(/Freed 2\.0 MB/)),
    );
  });
});
