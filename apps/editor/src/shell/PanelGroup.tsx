// Resizable / collapsible panel layout for the editor shell (roadmap M2, design-system).
//
// Hand-rolled rather than pulled from a library so the separators are genuinely accessible:
// each is a focusable `role="separator"` with aria-valuenow and arrow-key resizing. A
// feature that only works by dragging with a precise mouse is not done
// (engineering-standards.md §16).
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

export interface PanelSpec {
  id: string;
  title: string;
  /** Initial size as a percentage of the group. */
  defaultSize: number;
  minSize: number;
  collapsible?: boolean;
  content: ReactNode;
}

interface PanelGroupProps {
  direction: "horizontal" | "vertical";
  panels: PanelSpec[];
  /** Persisted sizes keyed by panel id, restored on mount. */
  sizes: Record<string, number>;
  collapsed: Record<string, boolean>;
  onSizesChange(sizes: Record<string, number>): void;
  onCollapsedChange(collapsed: Record<string, boolean>): void;
}

const KEYBOARD_STEP = 2; // percent per arrow press

export function PanelGroup({
  direction,
  panels,
  sizes,
  collapsed,
  onSizesChange,
  onCollapsedChange,
}: PanelGroupProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<number | null>(null);
  const horizontal = direction === "horizontal";

  const effectiveSize = (panel: PanelSpec): number =>
    collapsed[panel.id] ? 0 : (sizes[panel.id] ?? panel.defaultSize);

  /** Move `delta` percent from the panel after the separator to the one before it. */
  const resize = useCallback(
    (index: number, deltaPercent: number) => {
      const before = panels[index];
      const after = panels[index + 1];
      if (!before || !after) return;
      if (collapsed[before.id] || collapsed[after.id]) return;

      const beforeSize = sizes[before.id] ?? before.defaultSize;
      const afterSize = sizes[after.id] ?? after.defaultSize;
      const nextBefore = beforeSize + deltaPercent;
      const nextAfter = afterSize - deltaPercent;
      // Neither neighbour may be pushed below its minimum.
      if (nextBefore < before.minSize || nextAfter < after.minSize) return;

      onSizesChange({ ...sizes, [before.id]: nextBefore, [after.id]: nextAfter });
    },
    [panels, sizes, collapsed, onSizesChange],
  );

  useEffect(() => {
    if (dragging === null) return;
    const container = containerRef.current;
    if (!container) return;

    const onMove = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const total = horizontal ? rect.width : rect.height;
      if (total <= 0) return;
      const deltaPx = horizontal ? event.movementX : event.movementY;
      resize(dragging, (deltaPx / total) * 100);
    };
    const stop = () => setDragging(null);

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", stop);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", stop);
    };
  }, [dragging, horizontal, resize]);

  const toggleCollapse = (id: string) => {
    onCollapsedChange({ ...collapsed, [id]: !collapsed[id] });
  };

  return (
    <div
      ref={containerRef}
      className={`panel-group ${horizontal ? "is-horizontal" : "is-vertical"}`}
    >
      {panels.map((panel, index) => {
        const size = effectiveSize(panel);
        const isCollapsed = Boolean(collapsed[panel.id]);
        return (
          <div key={panel.id} className="panel-slot" style={{ flexGrow: size, flexBasis: 0 }}>
            <section
              className={`panel ${isCollapsed ? "is-collapsed" : ""}`}
              aria-labelledby={`${panel.id}-title`}
            >
              <header className="panel-head">
                <h2 id={`${panel.id}-title`}>{panel.title}</h2>
                {panel.collapsible !== false && (
                  <button
                    type="button"
                    className="panel-toggle"
                    onClick={() => toggleCollapse(panel.id)}
                    aria-expanded={!isCollapsed}
                    aria-controls={`${panel.id}-body`}
                  >
                    {isCollapsed ? "Expand" : "Collapse"}
                  </button>
                )}
              </header>
              {!isCollapsed && (
                <div className="panel-body" id={`${panel.id}-body`}>
                  {panel.content}
                </div>
              )}
            </section>

            {index < panels.length - 1 && (
              <div
                role="separator"
                tabIndex={0}
                aria-orientation={horizontal ? "vertical" : "horizontal"}
                aria-label={`Resize ${panel.title}`}
                aria-valuenow={Math.round(size)}
                aria-valuemin={panel.minSize}
                aria-valuemax={100}
                className="panel-separator"
                onPointerDown={(e) => {
                  e.preventDefault();
                  setDragging(index);
                }}
                onKeyDown={(e) => {
                  const grow = horizontal ? "ArrowRight" : "ArrowDown";
                  const shrink = horizontal ? "ArrowLeft" : "ArrowUp";
                  if (e.key === grow) {
                    e.preventDefault();
                    resize(index, KEYBOARD_STEP);
                  } else if (e.key === shrink) {
                    e.preventDefault();
                    resize(index, -KEYBOARD_STEP);
                  }
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
