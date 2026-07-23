/** @vitest-environment happy-dom */
// Shell composition + save-state behaviour. IPC is mocked; the storage layer behind it is
// tested for real in native/desktop-storage.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ProjectManifest } from "@sve/project-domain";

const mocks = vi.hoisted(() => ({
  saveProject: vi.fn(),
  detectLinks: vi.fn(),
  recoverySnapshots: vi.fn(),
  relinkAsset: vi.fn(),
  recoverAsCopy: vi.fn(),
}));

vi.mock("../project/ipc", () => ({
  saveProject: mocks.saveProject,
  detectLinks: mocks.detectLinks,
  recoverySnapshots: mocks.recoverySnapshots,
  relinkAsset: mocks.relinkAsset,
  recoverAsCopy: mocks.recoverAsCopy,
  describeError: (e: unknown) => String(e),
}));

// The workspace panel owns the timeline (which builds domain commands); stub it out so this
// test stays focused on the shell composition and save/close behaviour.
vi.mock("../timeline/Timeline", () => ({ Timeline: () => <div>timeline</div> }));
// The media bin talks to Tauri; stub it so this test stays on shell composition.
vi.mock("../media/MediaBin", () => ({ MediaBin: () => <div>media bin</div> }));

import { EditorShell } from "./EditorShell";

// Defined once as a JS string so the value passed in and the value asserted are identical.
// (A JSX attribute literal does not process backslash escapes, which is easy to get wrong.)
const PROJECT_DIR = "C:\\projects\\home";

const manifest = {
  schemaVersion: 1,
  projectId: "prj_1",
  name: "Home vs Away",
  projectType: "general",
} as unknown as ProjectManifest;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.saveProject.mockResolvedValue(undefined);
  mocks.detectLinks.mockResolvedValue([
    { assetId: "ast_1", path: "C:\\media\\gone.mp4", status: "offline" },
  ]);
  mocks.recoverySnapshots.mockResolvedValue([
    { fileName: "recovery-1.json", stamp: "1700000000000", sizeBytes: 120 },
  ]);
});
afterEach(cleanup);

describe("Editor shell", () => {
  it("renders the project, workspace, and recovery panels", async () => {
    render(<EditorShell dir={PROJECT_DIR} manifest={manifest} onClose={vi.fn()} />);
    expect(await screen.findByRole("region", { name: "Media" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Timeline" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Recovery" })).toBeTruthy();
  });

  it("starts in a saved state and shows the project name", async () => {
    render(<EditorShell dir={PROJECT_DIR} manifest={manifest} onClose={vi.fn()} />);
    expect(await screen.findByText("All changes saved")).toBeTruthy();
    // Shown in both the title bar and the Project panel.
    expect(screen.getAllByText("Home vs Away").length).toBeGreaterThan(0);
  });

  it("surfaces missing media as a count in the title bar", async () => {
    // The relink entry point itself lives in the media bin (tested there); the shell owns the
    // aggregate missing-media count.
    render(<EditorShell dir={PROJECT_DIR} manifest={manifest} onClose={vi.fn()} />);
    expect(await screen.findByText("1 missing file")).toBeTruthy();
  });

  it("saves on demand", async () => {
    const user = userEvent.setup();
    render(<EditorShell dir={PROJECT_DIR} manifest={manifest} onClose={vi.fn()} />);
    await screen.findByText("All changes saved");
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mocks.saveProject).toHaveBeenCalled());
    expect(mocks.saveProject.mock.calls[0]![0]).toBe(PROJECT_DIR);
  });

  it("flushes pending work before closing the project", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<EditorShell dir={PROJECT_DIR} manifest={manifest} onClose={onClose} />);
    await screen.findByText("All changes saved");
    await user.click(screen.getByRole("button", { name: "Close project" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("reports a save failure rather than claiming success", async () => {
    const user = userEvent.setup();
    mocks.saveProject.mockRejectedValue(new Error("STORAGE_WRITE_FAILED"));
    render(<EditorShell dir={PROJECT_DIR} manifest={manifest} onClose={vi.fn()} />);
    await screen.findByText("All changes saved");
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText("Save failed")).toBeTruthy();
    expect((await screen.findByRole("alert")).textContent).toContain("STORAGE_WRITE_FAILED");
  });

  it("makes recovery explicitly non-destructive in the copy it offers", async () => {
    render(<EditorShell dir={PROJECT_DIR} manifest={manifest} onClose={vi.fn()} />);
    const recovery = await screen.findByRole("region", { name: "Recovery" });
    expect(recovery.textContent).toMatch(/opens a copy/i);
    expect(screen.getByRole("button", { name: "Recover a copy" })).toBeTruthy();
  });
});
