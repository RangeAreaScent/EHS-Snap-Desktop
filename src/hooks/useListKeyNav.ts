import { useEffect } from "react";

/** Phase A (SNAP_DESKTOP_IMPROVEMENT_PLAN.md) — list keyboard navigation.
 *
 * Wires ↑↓ to a result list so the user can drive the app without a mouse.
 * Selection lives in the parent (selectedKey + each item's `onSelect`) so the
 * detail pane re-renders for free.
 *
 * EHS variant: this hook is **kind-agnostic**. Tariff Snap uses a single
 * `code` field, but EHS Snap has three entity kinds (regulation / LOI /
 * chemical) keyed by `regulationId` / `loiId` / `substanceName`. The caller
 * unifies them into a `NavItem[]` array, prefixing each key by kind (e.g.
 * `"reg:1910.147"`, `"loi:1234"`, `"chem:Benzene"`) so they never collide.
 *
 * Behaviour:
 *  - When a text input/textarea is focused, ↓ jumps to the first row and
 *    blurs the input so subsequent arrows keep navigating.
 *  - On the list, ↑↓ moves selection. Wrapping is intentionally off so
 *    top/bottom acts as a natural stop.
 *  - When `selectedKey` changes, the matching row (`[data-nav-key=…]`) is
 *    scrolled into view.
 *  - `Enter` is a no-op here — clicking already calls onSelect.
 *
 * Phase C interaction: if the ⌘K command palette is open, the hook yields
 * keyboard handling to cmdk (detected via the `[cmdk-root]` portal).
 */
export interface NavItem {
  key: string;
  onSelect: () => void;
}

export function useListKeyNav(items: NavItem[], selectedKey: string | null) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (items.length === 0) return;

      // Yield to cmdk when the ⌘K palette is open.
      if (document.querySelector("[cmdk-root]")) return;

      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const inEditable = tag === "input" || tag === "textarea";

      if (e.key === "ArrowDown") {
        if (inEditable) {
          e.preventDefault();
          target?.blur();
          items[0].onSelect();
          return;
        }
        e.preventDefault();
        const idx = items.findIndex((i) => i.key === selectedKey);
        const next = idx < 0 ? 0 : Math.min(idx + 1, items.length - 1);
        items[next].onSelect();
      } else if (e.key === "ArrowUp") {
        if (inEditable) return;
        e.preventDefault();
        const idx = items.findIndex((i) => i.key === selectedKey);
        const next = idx <= 0 ? 0 : idx - 1;
        items[next].onSelect();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items, selectedKey]);

  // Scroll the selected row into view whenever it changes.
  useEffect(() => {
    if (!selectedKey) return;
    const safeKey = selectedKey.replace(/"/g, '\\"');
    const el = document.querySelector(`[data-nav-key="${safeKey}"]`);
    if (el) (el as HTMLElement).scrollIntoView({ block: "nearest" });
  }, [selectedKey]);
}
