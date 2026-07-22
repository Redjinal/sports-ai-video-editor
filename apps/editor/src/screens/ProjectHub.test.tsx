/** @vitest-environment happy-dom */
// Gate A interface checks for the Project Hub. The IPC boundary is mocked here because it
// is separately and more thoroughly tested in native/desktop-storage against real files;
// what matters at this layer is that destructive actions are guarded and that a project
// whose folder has vanished cannot be opened.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mocks = vi.hoisted(() => ({
  recentProjects: vi.fn(),
  defaultProjectsDir: vi.fn(),
  deleteProject: vi.fn(),
  openProject: vi.fn(),
  duplicateProject: vi.fn(),
  createProject: vi.fn(),
}));

vi.mock("../project/ipc", () => ({
  recentProjects: mocks.recentProjects,
  defaultProjectsDir: mocks.defaultProjectsDir,
  deleteProject: mocks.deleteProject,
  openProject: mocks.openProject,
  duplicateProject: mocks.duplicateProject,
  createProject: mocks.createProject,
  describeError: (e: unknown) => String(e),
}));

import { ProjectHub } from "./ProjectHub";

const present = {
  projectId: "prj_1",
  name: "Home vs Away",
  path: "C:\\projects\\home-vs-away",
  projectType: "general",
  updatedAt: "2026-07-22T00:00:00.000Z",
  lastOpenedAt: 2,
  exists: true,
};
const missing = { ...present, projectId: "prj_2", name: "Old Game", exists: false };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.defaultProjectsDir.mockResolvedValue("C:\\projects");
  mocks.recentProjects.mockResolvedValue([present, missing]);
  mocks.deleteProject.mockResolvedValue(undefined);
  mocks.openProject.mockResolvedValue({ name: "Home vs Away" });
});
afterEach(cleanup);

describe("Project Hub", () => {
  it("lists recent projects", async () => {
    render(<ProjectHub onOpened={vi.fn()} />);
    expect(await screen.findByText("Home vs Away")).toBeTruthy();
    expect(screen.getByText("Old Game")).toBeTruthy();
  });

  it("flags a project whose folder is gone and refuses to open it", async () => {
    render(<ProjectHub onOpened={vi.fn()} />);
    await screen.findByText("Old Game");
    expect(screen.getByText("Folder missing")).toBeTruthy();

    // The row for the missing project must have its actions disabled.
    const missingRow = screen.getByText("Old Game").closest("li");
    expect(missingRow).toBeTruthy();
    const openButton = Array.from(missingRow!.querySelectorAll("button")).find(
      (b) => b.textContent === "Open",
    );
    expect(openButton?.hasAttribute("disabled")).toBe(true);
  });

  it("never deletes on a single click — it asks first and names the folder", async () => {
    const user = userEvent.setup();
    render(<ProjectHub onOpened={vi.fn()} />);
    await screen.findByText("Home vs Away");

    const row = screen.getByText("Home vs Away").closest("li")!;
    const deleteButton = Array.from(row.querySelectorAll("button")).find(
      (b) => b.textContent === "Delete",
    )!;
    await user.click(deleteButton);

    // Nothing destructive has happened yet.
    expect(mocks.deleteProject).not.toHaveBeenCalled();

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog.textContent).toContain("C:\\projects\\home-vs-away");
    expect(dialog.textContent).toMatch(/cannot be undone/i);
  });

  it("cancelling the confirmation deletes nothing", async () => {
    const user = userEvent.setup();
    render(<ProjectHub onOpened={vi.fn()} />);
    await screen.findByText("Home vs Away");
    const row = screen.getByText("Home vs Away").closest("li")!;
    await user.click(
      Array.from(row.querySelectorAll("button")).find((b) => b.textContent === "Delete")!,
    );
    await user.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(mocks.deleteProject).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("confirming deletes exactly that project", async () => {
    const user = userEvent.setup();
    render(<ProjectHub onOpened={vi.fn()} />);
    await screen.findByText("Home vs Away");
    const row = screen.getByText("Home vs Away").closest("li")!;
    await user.click(
      Array.from(row.querySelectorAll("button")).find((b) => b.textContent === "Delete")!,
    );
    await user.click(await screen.findByRole("button", { name: "Delete permanently" }));
    await waitFor(() => expect(mocks.deleteProject).toHaveBeenCalledTimes(1));
    expect(mocks.deleteProject).toHaveBeenCalledWith(present.path, present.projectId);
  });

  it("opening a project hands the manifest to the caller", async () => {
    const user = userEvent.setup();
    const onOpened = vi.fn();
    render(<ProjectHub onOpened={onOpened} />);
    await screen.findByText("Home vs Away");
    const row = screen.getByText("Home vs Away").closest("li")!;
    await user.click(
      Array.from(row.querySelectorAll("button")).find((b) => b.textContent === "Open")!,
    );
    await waitFor(() => expect(onOpened).toHaveBeenCalledTimes(1));
    expect(onOpened.mock.calls[0]![0]).toBe(present.path);
  });

  it("surfaces a storage failure instead of failing silently", async () => {
    const user = userEvent.setup();
    mocks.openProject.mockRejectedValue(new Error("PROJECT_NOT_FOUND"));
    render(<ProjectHub onOpened={vi.fn()} />);
    await screen.findByText("Home vs Away");
    const row = screen.getByText("Home vs Away").closest("li")!;
    await user.click(
      Array.from(row.querySelectorAll("button")).find((b) => b.textContent === "Open")!,
    );
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("PROJECT_NOT_FOUND");
  });

  it("labels the name and type controls", async () => {
    render(<ProjectHub onOpened={vi.fn()} />);
    await screen.findByText("Home vs Away");
    expect(screen.getByLabelText(/name/i)).toBeTruthy();
    expect(screen.getByLabelText(/type/i)).toBeTruthy();
  });
});
