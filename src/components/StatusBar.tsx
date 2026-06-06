/** Phase D — bottom status bar.
 *
 * Shows dataset metadata + a hint that ⌘K opens the command palette.
 * All colors come from CSS variables so the bar follows the active theme
 * without per-theme branches. */
export function StatusBar() {
  return (
    <div className="status-bar">
      <div className="status-bar__left">
        <span className="status-bar__dot" />
        <span className="status-bar__text">
          2,176 regulations · 4,223 LOIs · 677 chemicals · EHS Snap v1.0
        </span>
      </div>
      <div className="status-bar__right">
        <span className="status-bar__hint">
          <span>Press</span>
          <span className="status-bar__kbd">⌘K</span>
          <span>for commands</span>
        </span>
      </div>
    </div>
  );
}
