// Exercises the provider-neutral Connector contract via a fake in-memory implementation.
// The fake lives only in this test — no concrete adapter belongs in this package.
import { describe, it, expect } from "vitest";
import { createDownloadJob } from "./download-job";
import { notFound } from "./errors";
import type {
  Connector,
  ConnectorDownloadRequestResult,
  ConnectorListResult,
  ConnectorMetadataResult,
} from "./connector";
import type { RemoteSource } from "./remote-source";

function fakeConnector(): Connector {
  const knownFile: RemoteSource = {
    provider: "url",
    url: "https://example.com/game.mp4",
    displayName: "game.mp4",
  };

  return {
    provider: "url",
    async list(): Promise<ConnectorListResult> {
      return { ok: true, entries: [{ source: knownFile, isContainer: false }] };
    },
    async fetchMetadata(source: RemoteSource): Promise<ConnectorMetadataResult> {
      if (source.provider === "url" && source.url === knownFile.url) {
        return { ok: true, source: knownFile };
      }
      return { ok: false, error: notFound("No such item.") };
    },
    async requestDownload(
      source: RemoteSource,
      targetLocalPath: string,
    ): Promise<ConnectorDownloadRequestResult> {
      return { ok: true, job: createDownloadJob("job_1", source, targetLocalPath) };
    },
  };
}

describe("Connector interface", () => {
  it("lists entries", async () => {
    const connector = fakeConnector();
    const result = await connector.list();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.entries).toHaveLength(1);
    }
  });

  it("fetches metadata for a known source", async () => {
    const connector = fakeConnector();
    const result = await connector.fetchMetadata({
      provider: "url",
      url: "https://example.com/game.mp4",
      displayName: "game.mp4",
    });
    expect(result.ok).toBe(true);
  });

  it("returns a structured error for an unknown source, never throwing", async () => {
    const connector = fakeConnector();
    const result = await connector.fetchMetadata({
      provider: "url",
      url: "https://example.com/missing.mp4",
      displayName: "missing.mp4",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CONNECTOR_NOT_FOUND");
    }
  });

  it("requestDownload returns a DownloadJob descriptor, not bytes", async () => {
    const connector = fakeConnector();
    const result = await connector.requestDownload(
      { provider: "url", url: "https://example.com/game.mp4", displayName: "game.mp4" },
      "C:/media/game.mp4",
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.job.state).toBe("pending");
      expect(result.job.targetLocalPath).toBe("C:/media/game.mp4");
    }
  });
});
