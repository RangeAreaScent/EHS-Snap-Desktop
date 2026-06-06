import { useCallback, useEffect, useRef, useState } from "react";
import { ask } from "@tauri-apps/plugin-dialog";
import {
  FONT_FAMILIES,
  FONT_LABELS,
  FONT_SIZE_LABELS,
  FONT_SIZES,
  FREE_THEMES,
  PREMIUM_THEMES,
  THEME_LABELS,
  useSettings,
  type FontFamily,
  type Theme,
} from "../settings";
import { FREE_COLLECTIONS_MAX, FREE_FAVORITES_MAX, useAppData } from "../state";

const FONT_PREVIEW: Record<FontFamily, string> = {
  system: '-apple-system, "Segoe UI", Roboto, sans-serif',
  inter: '"Inter Variable", sans-serif',
  atkinson: '"Atkinson Hyperlegible", sans-serif',
  quattro: '"iA Writer Quattro", sans-serif',
};

/** Detects the hidden unlock rhythm: tap-tap · pause · tap-tap · pause ·
 *  tap-tap (6 clicks). Mirrors the iOS app's SecretTapDetector. */
function useSecretRhythm(onTrigger: () => void) {
  const taps = useRef<number[]>([]);
  return useCallback(() => {
    const now = Date.now();
    const t = taps.current;
    // A long stall means the user gave up — start fresh.
    if (t.length > 0 && now - t[t.length - 1] > 6000) t.length = 0;
    t.push(now);
    if (t.length > 6) t.splice(0, t.length - 6);
    if (t.length === 6) {
      const g = [
        t[1] - t[0],
        t[2] - t[1],
        t[3] - t[2],
        t[4] - t[3],
        t[5] - t[4],
      ];
      const pair = (x: number) => x < 700; // two quick taps
      const gap = (x: number) => x >= 700 && x <= 4500; // deliberate pause
      if (pair(g[0]) && gap(g[1]) && pair(g[2]) && gap(g[3]) && pair(g[4])) {
        taps.current = [];
        onTrigger();
      }
    }
  }, [onTrigger]);
}

/** Small preview colors per theme: [outer background, accent]. */
const SWATCH: Record<Theme, [string, string]> = {
  system: ["#ffffff", "#1c1d21"],
  light: ["#f4f5f7", "#2f6df0"],
  dark: ["#1e2023", "#5a8df5"],
  "sky-blue": ["#c9d3de", "#5c7ba3"],
  "peach-pink": ["#eac3b7", "#c77f66"],
  "deep-charcoal": ["#262424", "#e8b87a"],
  blueberry: ["#3e4e66", "#b8c9e0"],
};

export function SettingsView() {
  const {
    theme,
    setTheme,
    fontFamily,
    setFontFamily,
    fontSize,
    setFontSize,
    unlocked,
    licenseKey,
    activateLicense,
    deactivateLicense,
    togglePremiumOverride,
  } = useSettings();

  const [flash, setFlash] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);

  // Round B — open the How-to-Use modal when the menu fires.
  useEffect(() => {
    function onOpen() {
      setHelpOpen(true);
    }
    window.addEventListener("snap:open-howto", onOpen);
    return () => window.removeEventListener("snap:open-howto", onOpen);
  }, []);

  const secretTap = useSecretRhythm(() => {
    togglePremiumOverride().then(() => {
      setFlash("Premium override toggled");
      setTimeout(() => setFlash((f) => (f ? null : f)), 2500);
    });
  });

  return (
    <div className="settings-pane">
      <div className="settings-scroll">
        <h1 className="settings-title">Settings</h1>

        <section className="settings-section">
          <h2 className="settings-heading">Appearance</h2>
          <p className="settings-sub">Free themes</p>
          <div className="theme-grid">
            {FREE_THEMES.map((t) => (
              <ThemeCard
                key={t}
                theme={t}
                selected={theme === t}
                locked={false}
                onClick={() => setTheme(t)}
              />
            ))}
          </div>
          <p className="settings-sub">
            Premium themes {unlocked ? "" : "🔒"}
          </p>
          <div className="theme-grid">
            {PREMIUM_THEMES.map((t) => (
              <ThemeCard
                key={t}
                theme={t}
                selected={theme === t}
                locked={!unlocked}
                onClick={() => unlocked && setTheme(t)}
              />
            ))}
          </div>
          {!unlocked && (
            <p className="settings-hint">
              Unlock all premium themes below.
            </p>
          )}

          <p className="settings-sub">Font</p>
          <div className="theme-grid">
            {FONT_FAMILIES.map((f) => (
              <button
                key={f}
                className={`theme-card${
                  fontFamily === f ? " theme-card--selected" : ""
                }`}
                onClick={() => setFontFamily(f)}
              >
                <span
                  className="font-preview"
                  style={{ fontFamily: FONT_PREVIEW[f] }}
                >
                  Aa
                </span>
                <span className="theme-card__label">{FONT_LABELS[f]}</span>
                {fontFamily === f && (
                  <span className="theme-card__check">✓</span>
                )}
              </button>
            ))}
          </div>

          <p className="settings-sub">Text size</p>
          <div className="segmented">
            {FONT_SIZES.map((s) => (
              <button
                key={s}
                className={`segmented__opt${
                  fontSize === s ? " segmented__opt--on" : ""
                }`}
                onClick={() => setFontSize(s)}
              >
                {FONT_SIZE_LABELS[s]}
              </button>
            ))}
          </div>
        </section>

        <PremiumSection
          unlocked={unlocked}
          licenseKey={licenseKey}
          activateLicense={activateLicense}
          deactivateLicense={deactivateLicense}
          togglePremiumOverride={togglePremiumOverride}
        />

        <section className="settings-section">
          <h2 className="settings-heading">Help</h2>
          <button
            className="nav-row"
            onClick={() => setHelpOpen(true)}
          >
            <span className="nav-row__label">How to Use</span>
            <span className="nav-row__chevron">›</span>
          </button>
        </section>

        <section className="settings-section">
          <h2 className="settings-heading">Data</h2>
          <InfoRow label="29 CFR Part 1910 (OSHA)" value="204 sections" />
          <InfoRow label="30 CFR (MSHA)" value="1,972 sections" />
          <InfoRow label="OSHA Letters of Interpretation" value="4,223 letters" />
          <InfoRow label="NIOSH Pocket Guide chemicals" value="677 substances" />
          <InfoRow label="Source" value="eCFR.gov · OSHA.gov · CDC NIOSH (public domain)" />
        </section>

        <section className="settings-section">
          <h2 className="settings-heading">About</h2>
          <div className="info-row">
            <span className="info-row__label">EHS Snap</span>
            <span className="info-row__value" onClick={secretTap}>
              Version 1.0.0
            </span>
          </div>
          {flash && <p className="settings-hint">{flash}</p>}
          <p className="settings-disclaimer">
            EHS Snap is a reference tool. Always verify regulations against
            the official eCFR, OSHA, MSHA, or NIOSH sources before relying on
            them for compliance work. Not affiliated with or endorsed by OSHA,
            MSHA, NIOSH, or the U.S. Department of Labor; those marks belong
            to their respective owners. No data leaves your computer except
            license activation.
          </p>
        </section>
      </div>

      {helpOpen && <HowToUseModal onClose={() => setHelpOpen(false)} />}
    </div>
  );
}

function ThemeCard({
  theme,
  selected,
  locked,
  onClick,
}: {
  theme: Theme;
  selected: boolean;
  locked: boolean;
  onClick: () => void;
}) {
  const [bg, accent] = SWATCH[theme];
  return (
    <button
      className={`theme-card${selected ? " theme-card--selected" : ""}${
        locked ? " theme-card--locked" : ""
      }`}
      onClick={onClick}
    >
      <span className="theme-swatch" style={{ background: bg }}>
        <span className="theme-swatch__dot" style={{ background: accent }} />
        {locked && <span className="theme-swatch__lock">🔒</span>}
      </span>
      <span className="theme-card__label">{THEME_LABELS[theme]}</span>
      {selected && <span className="theme-card__check">✓</span>}
    </button>
  );
}

function PremiumSection({
  unlocked,
  licenseKey,
  activateLicense,
  deactivateLicense,
  togglePremiumOverride,
}: {
  unlocked: boolean;
  licenseKey: string | null;
  activateLicense: (key: string) => Promise<void>;
  deactivateLicense: () => Promise<void>;
  togglePremiumOverride: () => Promise<void>;
}) {
  const { favorites, collections } = useAppData();
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isDev = import.meta.env.DEV;

  async function activate() {
    setBusy(true);
    setError(null);
    try {
      await activateLicense(key);
      setKey("");
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  async function deactivate() {
    const ok = await ask("Deactivate premium on this computer?", {
      title: "Deactivate premium",
      kind: "warning",
    });
    if (!ok) return;
    setBusy(true);
    setError(null);
    try {
      await deactivateLicense();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="settings-section">
      <h2 className="settings-heading">Premium</h2>
      {unlocked ? (
        <div className="premium-box premium-box--on">
          <p className="premium-box__title">✓ Premium unlocked</p>
          <p className="premium-box__text">
            Thank you for supporting EHS Snap.
          </p>
          {licenseKey && (
            <p className="premium-box__key">Key: {maskKey(licenseKey)}</p>
          )}
          <button className="btn" onClick={deactivate} disabled={busy}>
            Deactivate on this computer
          </button>
        </div>
      ) : (
        <div className="premium-box">
          <p className="premium-box__text">
            EHS Snap is free to use. A one-time premium license unlocks all
            four premium themes plus unlimited favorites and collections.
          </p>
          <p className="premium-box__text">
            Free plan: {favorites.length} / {FREE_FAVORITES_MAX} favorites
            {" · "}
            {collections.length} / {FREE_COLLECTIONS_MAX} collections. Notes
            and export are always unlimited.
          </p>
          <p className="premium-box__text">
            Enter your license key (one key works on up to 2 computers):
          </p>
          <div className="license-row">
            <input
              className="text-input"
              placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              spellCheck={false}
              disabled={busy}
            />
            <button
              className="btn btn--primary"
              onClick={activate}
              disabled={busy || !key.trim()}
            >
              {busy ? "Activating…" : "Activate"}
            </button>
          </div>
          {error && <p className="license-error">{error}</p>}
        </div>
      )}
      {isDev && (
        <button
          className="btn dev-btn"
          onClick={() => togglePremiumOverride()}
        >
          Dev: toggle premium override
        </button>
      )}
    </section>
  );
}

function maskKey(key: string): string {
  if (key.length <= 8) return key;
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="info-row">
      <span className="info-row__label">{label}</span>
      <span className="info-row__value">{value}</span>
    </div>
  );
}

// ─── Round B — How to Use modal ────────────────────────────────────────────

function InfoModal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    function fn(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="info-modal" onClick={(e) => e.stopPropagation()}>
        <div className="info-modal__header">
          <h3 className="info-modal__title">{title}</h3>
          <button className="modal__close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="info-modal__body">{children}</div>
      </div>
    </div>
  );
}

function ModalSection({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <div className="info-modal__section">
      <h4 className="info-modal__section-heading">{heading}</h4>
      {children}
    </div>
  );
}

function HowToUseModal({ onClose }: { onClose: () => void }) {
  const isMac =
    typeof navigator !== "undefined" &&
    /Mac/i.test(navigator.platform || navigator.userAgent);
  const mod = isMac ? "⌘" : "Ctrl";

  return (
    <InfoModal title="How to Use" onClose={onClose}>
      <ModalSection heading="Search">
        <p>
          Type a citation, a topic, or a chemical name. Common EHS abbreviations
          are expanded automatically before the full-text search runs.
        </p>
        <table className="howto-table">
          <tbody>
            <tr>
              <td>By citation</td>
              <td>
                <code>1910.147</code>, <code>1910.1200</code>,{" "}
                <code>30 CFR 75</code>
              </td>
            </tr>
            <tr>
              <td>By topic</td>
              <td>
                <code>lockout</code>, <code>confined space</code>,{" "}
                <code>fall protection</code>, <code>respirator</code>
              </td>
            </tr>
            <tr>
              <td>By abbreviation</td>
              <td>
                <code>LOTO</code>, <code>HAZWOPER</code>, <code>HazCom</code>,{" "}
                <code>SDS</code>, <code>PSM</code>, <code>PPE</code>,{" "}
                <code>SCBA</code>, <code>PIT</code>
              </td>
            </tr>
            <tr>
              <td>By chemical</td>
              <td>
                <code>benzene</code>, <code>CO</code>, <code>H2S</code>,{" "}
                <code>silica</code>, <code>lead</code>
              </td>
            </tr>
          </tbody>
        </table>
        <p className="howto-note">
          Use the chips below the search bar to narrow to OSHA, MSHA, Letters of
          Interpretation, or Chemicals.
        </p>
      </ModalSection>

      <ModalSection heading="Favorites & Collections">
        <p>
          Click the ☆ on any regulation, letter, or chemical to save it to{" "}
          <strong>Favorites</strong>. Group related items into named{" "}
          <strong>Collections</strong> — site audits, program topics, training
          decks, or recurring inspections.
        </p>
        <p className="howto-note">
          Free plan: up to {15} regulation favorites and {10} collections.
          Premium removes both limits. LOI and chemical favorites are unlimited
          on every plan.
        </p>
        <p>
          On the open detail of any item, use the <strong>＋</strong> button to
          add it to a collection. Collections can contain a mix of regulations,
          letters, and chemicals.
        </p>
      </ModalSection>

      <ModalSection heading="Detail panes">
        <p>
          Each detail view cross-links the other two entity kinds. From a
          regulation, related Letters of Interpretation appear beneath the body;
          from a letter or chemical, related CFR sections are tappable chips
          that jump straight to the regulation.
        </p>
        <p className="howto-note">
          External links (osha.gov, NIOSH Pocket Guide, PubChem) open in your
          system browser — they're never embedded.
        </p>
      </ModalSection>

      <ModalSection heading="Export">
        <table className="howto-table">
          <tbody>
            <tr>
              <td>Collection (PDF)</td>
              <td>Open a collection → ⋯ menu → Export as PDF</td>
            </tr>
            <tr>
              <td>Collection (CSV)</td>
              <td>Open a collection → ⋯ menu → Export as CSV</td>
            </tr>
            <tr>
              <td>Copy citation</td>
              <td>
                Select a regulation → <kbd>{mod}C</kbd>
              </td>
            </tr>
          </tbody>
        </table>
      </ModalSection>

      <ModalSection heading="Keyboard Shortcuts">
        <table className="howto-table howto-table--kbd">
          <tbody>
            <tr>
              <td>
                <kbd>↑</kbd> <kbd>↓</kbd>
              </td>
              <td>Move through results</td>
            </tr>
            <tr>
              <td>
                <kbd>Enter</kbd>
              </td>
              <td>Open the selected item</td>
            </tr>
            <tr>
              <td>
                <kbd>Esc</kbd>
              </td>
              <td>Back to the search box (or close overlay)</td>
            </tr>
            <tr>
              <td>
                <kbd>{mod}K</kbd>
              </td>
              <td>Command palette — search anything, jump anywhere</td>
            </tr>
            <tr>
              <td>
                <kbd>{mod}F</kbd>
              </td>
              <td>Focus search</td>
            </tr>
            <tr>
              <td>
                <kbd>{mod}C</kbd>
              </td>
              <td>Copy the selected item's citation / name</td>
            </tr>
            <tr>
              <td>
                <kbd>{mod}D</kbd>
              </td>
              <td>Add / remove favorite</td>
            </tr>
            <tr>
              <td>
                <kbd>{mod}1</kbd>–<kbd>{mod}3</kbd>
              </td>
              <td>Search · Favorites · Collections</td>
            </tr>
            <tr>
              <td>
                <kbd>{mod}{","}</kbd>
              </td>
              <td>Settings</td>
            </tr>
            <tr>
              <td>
                <kbd>{mod}E</kbd>
              </td>
              <td>Export the open collection as PDF</td>
            </tr>
            <tr>
              <td>
                <kbd>{mod}N</kbd>
              </td>
              <td>New search (from the native menu)</td>
            </tr>
            <tr>
              <td>
                <kbd>{mod}⌥0</kbd>–<kbd>{mod}⌥4</kbd>
              </td>
              <td>Filter: All · OSHA · MSHA · LOI · Chemicals</td>
            </tr>
          </tbody>
        </table>
      </ModalSection>

      <ModalSection heading="Tips">
        <ul>
          <li>
            Citations with dots (<code>1910.147</code>) and without (
            <code>1910147</code>) both work — punctuation is normalised.
          </li>
          <li>
            EHS abbreviations are replaced with their full phrase before search,
            so <code>LOTO</code> finds 1910.147 even though the regulation never
            uses the acronym.
          </li>
          <li>
            <code>forklift</code> automatically maps to "powered industrial
            truck" (1910.178).
          </li>
          <li>
            Drag the divider between the list and the detail pane to resize.
            The position is remembered between sessions.
          </li>
          <li>
            Narrow your window below 900px and the detail pane slides over the
            list with a back button — useful for split-screen work.
          </li>
        </ul>
      </ModalSection>
    </InfoModal>
  );
}
