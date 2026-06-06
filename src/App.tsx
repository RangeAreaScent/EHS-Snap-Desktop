import { useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import "./styles.css";
import {
  getChemicalDetail,
  getLoiDetail,
  getRegulationDetail,
} from "./api";
import { ChemicalDetailView } from "./components/ChemicalDetailView";
import { CollectionsView } from "./components/CollectionsView";
import { CommandPalette } from "./components/CommandPalette";
import { EmptyDetail } from "./components/EmptyDetail";
import { FavoritesView } from "./components/FavoritesView";
import { LoiDetailView } from "./components/LoiDetailView";
import { OnboardingView } from "./components/OnboardingView";
import { PremiumPromptModal } from "./components/PremiumPromptModal";
import { RegulationDetailView } from "./components/RegulationDetailView";
import { SearchView } from "./components/SearchView";
import { SettingsView } from "./components/SettingsView";
import { Splitter } from "./components/Splitter";
import { StatusBar } from "./components/StatusBar";
import { Toaster, showToast } from "./components/Toaster";
import { useIsNarrow } from "./hooks/useIsNarrow";
import { AppDataProvider, useAppData } from "./state";
import { SettingsProvider, useSettings } from "./settings";
import type { SearchFilter, SelectedItem } from "./types";

type Tab = "search" | "favorites" | "collections" | "settings";

function App() {
  return (
    <SettingsProvider>
      <AppDataProvider>
        <AppShell />
      </AppDataProvider>
    </SettingsProvider>
  );
}

function AppShell() {
  const [tab, setTab] = useState<Tab>("search");
  // Single source of truth for the right-pane detail view.
  const [selectedItem, setSelectedItem] = useState<SelectedItem>(null);
  const isNarrow = useIsNarrow();
  // Phase B: in narrow mode, list pane is full-width by default; selecting
  // an item slides the detail pane over the top (overlay with back button).
  const [narrowDetailOpen, setNarrowDetailOpen] = useState(false);
  // Phase C: command-palette open state + pending external filter push.
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [pendingSearchFilter, setPendingSearchFilter] =
    useState<SearchFilter | null>(null);
  const {
    premiumPrompt,
    clearPremiumPrompt,
    isFavorite,
    toggleFavorite,
    isFavoriteLoi,
    toggleFavoriteLoi,
    isFavoriteChemical,
    toggleFavoriteChemical,
  } = useAppData();
  const { hasSeenOnboarding, dismissOnboarding } = useSettings();

  // Phase A — Global keyboard shortcuts.
  // - ⌘F / ⌘1~4 / ⌘,    : tab navigation (always active)
  // - ⌘C                : copy selected item identifier
  // - ⌘D                : toggle favorite for selected item
  // - ⌘E                : CollectionsView listens itself for the export hotkey
  useEffect(() => {
    async function onKey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return;
      const k = e.key.toLowerCase();

      // Phase C — ⌘K toggles command palette (always-on).
      if (k === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
        return;
      }

      // Tab switching — these work even when inputs are focused.
      if (k === "f") { e.preventDefault(); setTab("search"); return; }
      if (k === "1") { e.preventDefault(); setTab("search"); return; }
      if (k === "2") { e.preventDefault(); setTab("favorites"); return; }
      if (k === "3") { e.preventDefault(); setTab("collections"); return; }
      if (k === "4" || k === ",") {
        e.preventDefault();
        setTab("settings");
        return;
      }

      // For ⌘C / ⌘D — defer to native input copy when text is focused.
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const inEditable = tag === "input" || tag === "textarea";
      if (inEditable) return;

      if (k === "c" && selectedItem) {
        e.preventDefault();
        const text =
          selectedItem.kind === "regulation"
            ? selectedItem.id.replace(/^29-cfr-|^30-cfr-/, "")
            : selectedItem.kind === "loi"
              ? selectedItem.id
              : selectedItem.name;
        try {
          await navigator.clipboard.writeText(text);
          showToast(`Copied ${text}`);
        } catch {
          showToast("Copy failed");
        }
        return;
      }

      if (k === "d" && selectedItem) {
        e.preventDefault();
        if (selectedItem.kind === "regulation") {
          const already = isFavorite(selectedItem.id);
          if (already) {
            // toggleFavorite needs a RegulationSummary — fetch once.
            const detail = await getRegulationDetail(selectedItem.id);
            if (detail) {
              toggleFavorite({
                regulationId: detail.regulationId,
                citation: detail.citation,
                sectionNumber: detail.sectionNumber,
                heading: detail.heading,
                agency: detail.agency,
                industry: detail.industry,
                subpartLabel: detail.subpartLabel,
              });
              showToast("Removed from Favorites");
            }
          } else {
            const detail = await getRegulationDetail(selectedItem.id);
            if (detail) {
              toggleFavorite({
                regulationId: detail.regulationId,
                citation: detail.citation,
                sectionNumber: detail.sectionNumber,
                heading: detail.heading,
                agency: detail.agency,
                industry: detail.industry,
                subpartLabel: detail.subpartLabel,
              });
              showToast("Added to Favorites");
            }
          }
        } else if (selectedItem.kind === "loi") {
          const already = isFavoriteLoi(selectedItem.id);
          const detail = await getLoiDetail(selectedItem.id);
          if (detail) {
            toggleFavoriteLoi({
              loiId: detail.loiId,
              title: detail.title,
              issueDate: detail.issueDate,
              relatedSections: detail.relatedSections,
            });
            showToast(already ? "Removed from Favorites" : "Added to Favorites");
          }
        } else {
          // chemical
          const already = isFavoriteChemical(selectedItem.name);
          const detail = await getChemicalDetail(selectedItem.name);
          if (detail) {
            toggleFavoriteChemical({
              substanceName: detail.substanceName,
              oshaPelTwa: detail.oshaPelTwa,
              idlh: detail.idlh,
              isOshaCarcinogen: detail.isOshaCarcinogen,
            });
            showToast(already ? "Removed from Favorites" : "Added to Favorites");
          }
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    selectedItem,
    isFavorite,
    toggleFavorite,
    isFavoriteLoi,
    toggleFavoriteLoi,
    isFavoriteChemical,
    toggleFavoriteChemical,
  ]);

  // Phase B — Esc: in narrow mode, close the detail overlay first.
  // Then on Search tab, fall back to re-focusing the search input.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      // Phase C: cmdk owns its own Esc handling while open.
      if (paletteOpen) return;
      if (document.querySelector("[cmdk-root]")) return;
      if (isNarrow && narrowDetailOpen) {
        setNarrowDetailOpen(false);
        return;
      }
      if (tab === "search") {
        const input = document.querySelector(
          ".search-bar__input",
        ) as HTMLInputElement | null;
        if (input && document.activeElement !== input) {
          input.focus();
          input.select?.();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isNarrow, narrowDetailOpen, tab, paletteOpen]);

  // Reset overlay when the tab changes — otherwise a stale detail would
  // linger on top of a different list.
  useEffect(() => {
    setNarrowDetailOpen(false);
  }, [tab]);

  // Phase D — native menu → action wiring. Each menu item emits
  // `menu:<id>`; we forward to the same handlers the keyboard uses.
  useEffect(() => {
    const unlistens: Array<Promise<() => void>> = [];
    function on(id: string, fn: () => void) {
      unlistens.push(listen(`menu:${id}`, fn));
    }

    // File
    on("file.new_search", () => {
      setTab("search");
      setTimeout(() => {
        const input = document.querySelector(
          ".search-bar__input",
        ) as HTMLInputElement | null;
        input?.focus();
        input?.select?.();
      }, 0);
    });
    on("file.command_palette", () => setPaletteOpen(true));
    on("file.export_collection", () => {
      setTab("collections");
      // CollectionsView listens for ⌘E itself — dispatch a synthetic key.
      const ev = new KeyboardEvent("keydown", {
        key: "e",
        metaKey: true,
        ctrlKey: true,
        bubbles: true,
      });
      setTimeout(() => window.dispatchEvent(ev), 0);
    });

    // Edit
    on("edit.copy_citation", () => {
      const ev = new KeyboardEvent("keydown", {
        key: "c",
        metaKey: true,
        ctrlKey: true,
        bubbles: true,
      });
      window.dispatchEvent(ev);
    });
    on("edit.find", () => setTab("search"));

    // View — tabs
    on("view.tab_search", () => setTab("search"));
    on("view.tab_favorites", () => setTab("favorites"));
    on("view.tab_collections", () => setTab("collections"));
    on("view.tab_settings", () => setTab("settings"));

    // View — search filters
    on("view.filter_all", () => {
      setTab("search");
      setPendingSearchFilter("all");
      showToast("Filter: All");
    });
    on("view.filter_osha", () => {
      setTab("search");
      setPendingSearchFilter("osha");
      showToast("Filter: OSHA");
    });
    on("view.filter_msha", () => {
      setTab("search");
      setPendingSearchFilter("msha");
      showToast("Filter: MSHA");
    });
    on("view.filter_loi", () => {
      setTab("search");
      setPendingSearchFilter("loi");
      showToast("Filter: Letters of Interpretation");
    });
    on("view.filter_chemicals", () => {
      setTab("search");
      setPendingSearchFilter("chemicals");
      showToast("Filter: Chemicals");
    });

    on("view.reset_splitter", () => {
      try {
        localStorage.removeItem("snap.listWidth");
      } catch {
        /* ignore */
      }
      document.documentElement.style.setProperty("--list-width", "380px");
      showToast("Splitter width reset");
    });

    // Help (UI-routed items only — URLs are opened by Rust).
    // SettingsView listens for the `snap:open-howto` event itself.
    on("help.how_to_use", () => {
      setTab("settings");
      setTimeout(
        () => window.dispatchEvent(new CustomEvent("snap:open-howto")),
        0,
      );
    });
    on("help.dataset_details", () => setTab("settings"));

    return () => {
      unlistens.forEach((p) => p.then((fn) => fn()).catch(() => {}));
    };
  }, []);

  // Wrap setSelectedItem so list-pane → detail-pane transitions open the
  // overlay in narrow mode. `null` (e.g. clear-recents) also closes the overlay.
  function handleSelect(item: SelectedItem) {
    setSelectedItem(item);
    if (item == null) {
      setNarrowDetailOpen(false);
    } else if (isNarrow) {
      setNarrowDetailOpen(true);
    }
  }

  const showSplit = tab !== "settings";
  const contentClass = [
    "content",
    isNarrow ? "content--narrow" : "",
    isNarrow && narrowDetailOpen ? "content--detail-overlay" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="app">
      <div className="app__main">
        <nav className="rail">
        <div className="rail__brand">EHS</div>
        <RailTab
          label="Search"
          icon="⌕"
          active={tab === "search"}
          onClick={() => setTab("search")}
          kbd="⌘1"
        />
        <RailTab
          label="Favorites"
          icon="★"
          active={tab === "favorites"}
          onClick={() => setTab("favorites")}
          kbd="⌘2"
        />
        <RailTab
          label="Collections"
          icon="🗂"
          active={tab === "collections"}
          onClick={() => setTab("collections")}
          kbd="⌘3"
        />
        <div className="rail__spacer" />
        <RailTab
          label="Settings"
          icon="⚙"
          active={tab === "settings"}
          onClick={() => setTab("settings")}
          kbd="⌘4"
        />
      </nav>

      <main className={contentClass}>
        {/* Left pane — list / browser */}
        {tab === "search" && (
          <SearchView
            selectedItem={selectedItem}
            onSelectItem={handleSelect}
            externalFilter={pendingSearchFilter}
            onFilterApplied={() => setPendingSearchFilter(null)}
          />
        )}
        {tab === "favorites" && (
          <FavoritesView
            selectedItem={selectedItem}
            onSelectItem={handleSelect}
          />
        )}
        {tab === "collections" && (
          <CollectionsView
            selectedItem={selectedItem}
            onSelectItem={handleSelect}
          />
        )}

        {/* Phase B — Splitter only when both panes are visible. */}
        {showSplit && !isNarrow && <Splitter />}

        {/* Right pane — detail */}
        {tab === "settings" ? (
          <SettingsView />
        ) : (
          <DetailPane
            item={selectedItem}
            onSelectItem={handleSelect}
            onClose={
              isNarrow && narrowDetailOpen
                ? () => setNarrowDetailOpen(false)
                : undefined
            }
          />
        )}
      </main>
      </div>

      <StatusBar />

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onJumpToRegulation={(id) => {
          setTab("search");
          handleSelect({ kind: "regulation", id });
        }}
        onJumpToLoi={(id) => {
          setTab("search");
          handleSelect({ kind: "loi", id });
        }}
        onJumpToChemical={(name) => {
          setTab("search");
          handleSelect({ kind: "chemical", name });
        }}
        onJumpToTab={(t) => setTab(t)}
        onSetSearchFilter={(f) => setPendingSearchFilter(f)}
      />

      {premiumPrompt && (
        <PremiumPromptModal
          message={premiumPrompt}
          onClose={clearPremiumPrompt}
          onGoSettings={() => {
            clearPremiumPrompt();
            setTab("settings");
          }}
        />
      )}

      {!hasSeenOnboarding && (
        <OnboardingView onDismiss={dismissOnboarding} />
      )}

      <Toaster />
    </div>
  );
}

/**
 * Renders the appropriate detail view based on the selected item kind.
 * `onSelectItem` is forwarded so LOI→Regulation cross-links work.
 *
 * In narrow mode, `onClose` is set — we render a floating back button
 * absolutely positioned over the top of the detail view so each
 * `*DetailView` component (which owns its own .detail-pane root) doesn't
 * need to be modified.
 */
function DetailPane({
  item,
  onSelectItem,
  onClose,
}: {
  item: SelectedItem;
  onSelectItem: (item: SelectedItem) => void;
  onClose?: () => void;
}) {
  const inner = !item ? (
    <EmptyDetail />
  ) : item.kind === "regulation" ? (
    <RegulationDetailView
      regulationId={item.id}
      onNavigateToLoi={(loiId) => onSelectItem({ kind: "loi", id: loiId })}
    />
  ) : item.kind === "loi" ? (
    <LoiDetailView
      loiId={item.id}
      onNavigateToRegulation={(id) =>
        onSelectItem({ kind: "regulation", id })
      }
    />
  ) : (
    <ChemicalDetailView
      substanceName={item.name}
      onNavigateToRegulation={(id) =>
        onSelectItem({ kind: "regulation", id })
      }
    />
  );

  if (!onClose) return inner;
  return (
    <div className="detail-overlay-wrap">
      <button
        className="detail-back"
        onClick={onClose}
        title="Back to list (Esc)"
      >
        ‹ Back
      </button>
      {inner}
    </div>
  );
}

function RailTab({
  label,
  icon,
  active,
  onClick,
  kbd,
}: {
  label: string;
  icon: string;
  active: boolean;
  onClick: () => void;
  kbd?: string;
}) {
  return (
    <button
      className={`rail__tab${active ? " rail__tab--active" : ""}`}
      onClick={onClick}
      title={kbd ? `${label} (${kbd})` : label}
    >
      <span className="rail__icon">{icon}</span>
      <span className="rail__label">{label}</span>
    </button>
  );
}

export default App;
