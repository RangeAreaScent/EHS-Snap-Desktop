/** Phase B — empty state for the detail pane.
 *
 * Shown when nothing is selected. Doubles as a keyboard-shortcut cheatsheet
 * so the user discovers Phase A's ↑↓Enter/⌘1~4/⌘C/⌘D pattern naturally.
 * Phase C adds ⌘K once the palette is wired up. */
const isMac =
  typeof navigator !== "undefined" && /Mac|iPad|iPhone/.test(navigator.platform);
const MOD = isMac ? "⌘" : "Ctrl";

export function EmptyDetail() {
  return (
    <div className="detail-pane detail-pane--empty">
      <div className="detail-empty">
        <p className="detail-empty__title">Nothing selected</p>
        <p className="detail-empty__sub">
          Pick a regulation, letter, or chemical to see its details.
        </p>
        <ul className="detail-empty__keys">
          <li>
            <kbd>↑↓</kbd>Move through results
          </li>
          <li>
            <kbd>Enter</kbd>Open in detail
          </li>
          <li>
            <kbd>{MOD}F</kbd>Focus search
          </li>
          <li>
            <kbd>{MOD}K</kbd>Command palette
          </li>
          <li>
            <kbd>{MOD}1</kbd>Search · <kbd>{MOD}2</kbd>Favorites ·{" "}
            <kbd>{MOD}3</kbd>Collections
          </li>
          <li>
            <kbd>{MOD}C</kbd>Copy citation
          </li>
          <li>
            <kbd>{MOD}D</kbd>Toggle favorite
          </li>
          <li>
            <kbd>{MOD}E</kbd>Export collection
          </li>
        </ul>
      </div>
    </div>
  );
}
