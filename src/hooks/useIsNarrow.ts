import { useEffect, useState } from "react";

/** Phase B — true when the window is too narrow to show list + detail
 * side-by-side. At this point the layout switches to a stacked "list, then
 * detail overlay" mode (back button + Esc to dismiss).
 *
 * 900px is the Snap series convention — 13" laptops at 1280×800 still get
 * the desktop split-view, while half-screen windows (640~900px) fall back
 * to the iOS-style stack. */
const NARROW_PX = 900;

export function useIsNarrow(): boolean {
  const [narrow, setNarrow] = useState<boolean>(
    typeof window !== "undefined" && window.innerWidth < NARROW_PX,
  );
  useEffect(() => {
    function onResize() {
      setNarrow(window.innerWidth < NARROW_PX);
    }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return narrow;
}
