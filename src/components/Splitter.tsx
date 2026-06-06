import { useCallback, useEffect, useState } from "react";

/** Phase B (SNAP_DESKTOP_IMPROVEMENT_PLAN.md) — list/detail splitter.
 *
 * Owns the list-pane width. Renders a draggable handle that sits on the
 * border between list-pane and detail-pane. Width is persisted to
 * `localStorage` so the user's chosen layout survives reloads.
 *
 * EHS-specific: the rail is 84px wide (vs 92px on Tariff UK). Otherwise
 * the component is identical and reusable across the Snap desktop series.
 */

const STORAGE_KEY = "snap.listWidth";
const DEFAULT_WIDTH = 380;
const MIN_WIDTH = 320;
const MAX_WIDTH = 720;
const RAIL_WIDTH = 84; // matches .rail in styles.css

function loadInitial(): number {
  if (typeof localStorage === "undefined") return DEFAULT_WIDTH;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return DEFAULT_WIDTH;
  const n = Number(raw);
  if (!Number.isFinite(n)) return DEFAULT_WIDTH;
  return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, n));
}

/** Read-only hook so other components (e.g. responsive fallback) can
 * inspect the current width without owning it. */
export function useListWidth(): number {
  const [w, setW] = useState(loadInitial);
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY && e.newValue) {
        const n = Number(e.newValue);
        if (Number.isFinite(n)) setW(n);
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  return w;
}

export function Splitter() {
  const [width, setWidth] = useState<number>(loadInitial);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    document.documentElement.style.setProperty("--list-width", `${width}px`);
  }, [width]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);

  useEffect(() => {
    if (!dragging) return;
    function onMove(e: MouseEvent) {
      const next = Math.max(
        MIN_WIDTH,
        Math.min(MAX_WIDTH, e.pageX - RAIL_WIDTH),
      );
      setWidth(next);
    }
    function onUp() {
      setDragging(false);
      try {
        localStorage.setItem(STORAGE_KEY, String(width));
      } catch {
        /* ignore quota errors */
      }
    }
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
    };
  }, [dragging, width]);

  return (
    <div
      className={`splitter${dragging ? " splitter--dragging" : ""}`}
      onMouseDown={onMouseDown}
      title="Drag to resize"
    />
  );
}
