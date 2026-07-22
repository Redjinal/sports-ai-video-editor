/** @vitest-environment happy-dom */
// Gate A interface checks for the editor shell layout (engineering-standards.md §16):
// keyboard-operable resizing, semantic names, and collapse state exposed to assistive tech.
// A separator that only works by dragging with a precise mouse is not done.
import { describe, it, expect, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach } from "vitest";
import { PanelGroup, type PanelSpec } from "./PanelGroup";

afterEach(cleanup);

function panels(): PanelSpec[] {
  return [
    { id: "left", title: "Project", defaultSize: 30, minSize: 10, content: <p>left body</p> },
    { id: "right", title: "Inspector", defaultSize: 70, minSize: 10, content: <p>right body</p> },
  ];
}

function setup(overrides?: {
  sizes?: Record<string, number>;
  collapsed?: Record<string, boolean>;
}) {
  const onSizesChange = vi.fn();
  const onCollapsedChange = vi.fn();
  render(
    <PanelGroup
      direction="horizontal"
      panels={panels()}
      sizes={overrides?.sizes ?? { left: 30, right: 70 }}
      collapsed={overrides?.collapsed ?? {}}
      onSizesChange={onSizesChange}
      onCollapsedChange={onCollapsedChange}
    />,
  );
  return { onSizesChange, onCollapsedChange };
}

describe("PanelGroup accessibility", () => {
  it("exposes each panel by its accessible name", () => {
    setup();
    expect(screen.getByRole("region", { name: "Project" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "Inspector" })).toBeTruthy();
  });

  it("gives the separator a name, orientation, and current value", () => {
    setup();
    const sep = screen.getByRole("separator", { name: /resize project/i });
    expect(sep.getAttribute("aria-orientation")).toBe("vertical");
    expect(sep.getAttribute("aria-valuenow")).toBe("30");
    expect(sep.getAttribute("aria-valuemin")).toBe("10");
  });

  it("is reachable by keyboard", async () => {
    const user = userEvent.setup();
    setup();
    const sep = screen.getByRole("separator", { name: /resize project/i });
    await user.tab(); // first focusable is the left panel's collapse button
    await user.tab();
    expect(document.activeElement).toBe(sep);
  });

  it("resizes with arrow keys, not just pointer drag", async () => {
    const user = userEvent.setup();
    const { onSizesChange } = setup();
    const sep = screen.getByRole("separator", { name: /resize project/i });
    sep.focus();

    await user.keyboard("{ArrowRight}");
    expect(onSizesChange).toHaveBeenCalledWith({ left: 32, right: 68 });

    onSizesChange.mockClear();
    await user.keyboard("{ArrowLeft}");
    expect(onSizesChange).toHaveBeenCalledWith({ left: 28, right: 72 });
  });

  it("refuses a resize that would push a neighbour below its minimum", async () => {
    const user = userEvent.setup();
    // left is already at its 10% floor; shrinking further must be ignored.
    const { onSizesChange } = setup({ sizes: { left: 10, right: 90 } });
    const sep = screen.getByRole("separator", { name: /resize project/i });
    sep.focus();
    await user.keyboard("{ArrowLeft}");
    expect(onSizesChange).not.toHaveBeenCalled();
  });

  it("collapses and expands via a real button with aria-expanded", async () => {
    const user = userEvent.setup();
    const { onCollapsedChange } = setup();
    const toggle = screen.getAllByRole("button", { name: "Collapse" })[0]!;
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    await user.click(toggle);
    expect(onCollapsedChange).toHaveBeenCalledWith({ left: true });
  });

  it("hides a collapsed panel's body but keeps it expandable", () => {
    setup({ collapsed: { left: true } });
    expect(screen.queryByText("left body")).toBeNull();
    const toggle = screen.getByRole("button", { name: "Expand" });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    // The other panel is unaffected.
    expect(screen.getByText("right body")).toBeTruthy();
  });

  it("does not render a separator after the last panel", () => {
    setup();
    expect(screen.getAllByRole("separator")).toHaveLength(1);
  });
});
