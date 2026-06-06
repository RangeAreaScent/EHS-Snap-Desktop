import { Command } from "cmdk";
import { useEffect, useState } from "react";
import { searchChemicals, searchLois, searchRegulations } from "../api";
import { useAppData } from "../state";
import type { ChemicalSummary, LoiSummary, RegulationSummary } from "../types";
import { showToast } from "./Toaster";

/** Phase C (SNAP_DESKTOP_IMPROVEMENT_PLAN.md) — ⌘K command palette.
 *
 * Unifies regulation / LOI / chemical search + tab jumps + filter actions.
 *
 * Noise prevention (mirrors the Snap series convention):
 *   1. Entity result groups render only when query.length >= 2.
 *   2. Each entity group is capped at 5 to keep the list within one screen.
 *   3. Favorites groups render only when the query is empty (idle hint).
 *   4. Tab/action groups are always shown; cmdk's fuzzy filter trims them.
 *   5. Action values pack rich keywords ("filter osha 1910") so any synonym
 *      surfaces the right command.
 */

type Tab = "search" | "favorites" | "collections" | "settings";
type SearchFilter = "all" | "osha" | "msha" | "loi" | "chemicals";

interface Props {
  open: boolean;
  onClose: () => void;
  onJumpToRegulation: (regulationId: string) => void;
  onJumpToLoi: (loiId: string) => void;
  onJumpToChemical: (name: string) => void;
  onJumpToTab: (tab: Tab) => void;
  onSetSearchFilter: (filter: SearchFilter) => void;
}

export function CommandPalette({
  open,
  onClose,
  onJumpToRegulation,
  onJumpToLoi,
  onJumpToChemical,
  onJumpToTab,
  onSetSearchFilter,
}: Props) {
  const [query, setQuery] = useState("");
  const [regs, setRegs] = useState<RegulationSummary[]>([]);
  const [lois, setLois] = useState<LoiSummary[]>([]);
  const [chems, setChems] = useState<ChemicalSummary[]>([]);
  const { favorites, favoriteLois, favoriteChemicals } = useAppData();

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  // Debounced three-way search. Two-character minimum.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setRegs([]);
      setLois([]);
      setChems([]);
      return;
    }
    let active = true;
    const t = setTimeout(() => {
      Promise.allSettled([
        searchRegulations(q, 5, null),
        searchLois(q, 5),
        searchChemicals(q, 5),
      ]).then((res) => {
        if (!active) return;
        if (res[0].status === "fulfilled") setRegs(res[0].value);
        if (res[1].status === "fulfilled") setLois(res[1].value);
        if (res[2].status === "fulfilled") setChems(res[2].value);
      });
    }, 150);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [query]);

  if (!open) return null;

  const trimmed = query.trim();
  const showIdleSuggestions = trimmed.length === 0;
  const showEntities = trimmed.length >= 2;

  function jumpReg(id: string) {
    onJumpToRegulation(id);
    onClose();
  }
  function jumpLoi(id: string) {
    onJumpToLoi(id);
    onClose();
  }
  function jumpChem(name: string) {
    onJumpToChemical(name);
    onClose();
  }
  function jumpTab(tab: Tab) {
    onJumpToTab(tab);
    onClose();
  }
  function setFilter(filter: SearchFilter, label: string) {
    onJumpToTab("search");
    onSetSearchFilter(filter);
    showToast(`Filter: ${label}`);
    onClose();
  }

  return (
    <Command.Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      label="Command palette"
      className="cmdk-root"
    >
      <Command.Input
        placeholder="Search regulations, letters, chemicals — or a command…"
        value={query}
        onValueChange={setQuery}
        className="cmdk-input"
        autoFocus
      />
      <Command.List className="cmdk-list">
        <Command.Empty className="cmdk-empty">No matches</Command.Empty>

        {showEntities && regs.length > 0 && (
          <Command.Group heading="Regulations" className="cmdk-group">
            {regs.map((r) => (
              <Command.Item
                key={`reg-${r.regulationId}`}
                value={`reg ${r.citation} ${r.regulationId} ${r.heading}`}
                onSelect={() => jumpReg(r.regulationId)}
                className="cmdk-item"
              >
                <span className="cmdk-item__code">
                  {r.citation || r.regulationId}
                </span>
                <span className="cmdk-item__desc">{r.heading}</span>
                <span className="cmdk-item__hint">{r.agency}</span>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {showEntities && lois.length > 0 && (
          <Command.Group
            heading="Letters of Interpretation"
            className="cmdk-group"
          >
            {lois.map((l) => (
              <Command.Item
                key={`loi-${l.loiId}`}
                value={`loi letter ${l.title} ${l.relatedSections.join(" ")}`}
                onSelect={() => jumpLoi(l.loiId)}
                className="cmdk-item"
              >
                <span className="cmdk-item__code">LOI</span>
                <span className="cmdk-item__desc">{l.title}</span>
                <span className="cmdk-item__hint">{l.issueDate}</span>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {showEntities && chems.length > 0 && (
          <Command.Group heading="Chemicals" className="cmdk-group">
            {chems.map((c) => (
              <Command.Item
                key={`chem-${c.substanceName}`}
                value={`chem chemical ${c.substanceName}`}
                onSelect={() => jumpChem(c.substanceName)}
                className="cmdk-item"
              >
                <span className="cmdk-item__code">{c.substanceName}</span>
                <span className="cmdk-item__desc">
                  {c.oshaPelTwa ? `PEL TWA ${c.oshaPelTwa}` : "—"}
                  {c.idlh ? ` · IDLH ${c.idlh}` : ""}
                </span>
                {c.isOshaCarcinogen && (
                  <span className="cmdk-item__hint">Carcinogen</span>
                )}
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {showIdleSuggestions && favorites.length > 0 && (
          <Command.Group
            heading="Favorite regulations"
            className="cmdk-group"
          >
            {favorites.slice(0, 3).map((f) => (
              <Command.Item
                key={`fav-${f.regulationId}`}
                value={`favorite ${f.regulationId} ${f.heading}`}
                onSelect={() => jumpReg(f.regulationId)}
                className="cmdk-item"
              >
                <span className="cmdk-item__code">
                  {f.citation || f.regulationId}
                </span>
                <span className="cmdk-item__desc">{f.heading}</span>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {showIdleSuggestions && favoriteLois.length > 0 && (
          <Command.Group heading="Favorite letters" className="cmdk-group">
            {favoriteLois.slice(0, 3).map((f) => (
              <Command.Item
                key={`favloi-${f.loiId}`}
                value={`favorite loi ${f.title}`}
                onSelect={() => jumpLoi(f.loiId)}
                className="cmdk-item"
              >
                <span className="cmdk-item__code">LOI</span>
                <span className="cmdk-item__desc">{f.title}</span>
                <span className="cmdk-item__hint">{f.issueDate}</span>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        {showIdleSuggestions && favoriteChemicals.length > 0 && (
          <Command.Group heading="Favorite chemicals" className="cmdk-group">
            {favoriteChemicals.slice(0, 3).map((f) => (
              <Command.Item
                key={`favchem-${f.substanceName}`}
                value={`favorite chemical ${f.substanceName}`}
                onSelect={() => jumpChem(f.substanceName)}
                className="cmdk-item"
              >
                <span className="cmdk-item__code">{f.substanceName}</span>
                <span className="cmdk-item__desc">
                  {f.oshaPelTwa ? `PEL TWA ${f.oshaPelTwa}` : "—"}
                </span>
              </Command.Item>
            ))}
          </Command.Group>
        )}

        <Command.Group heading="Go to" className="cmdk-group">
          <Command.Item
            value="go to search"
            onSelect={() => jumpTab("search")}
            className="cmdk-item"
          >
            <span className="cmdk-item__icon">⌕</span>
            <span className="cmdk-item__label">Search</span>
            <span className="cmdk-item__hint">⌘1</span>
          </Command.Item>
          <Command.Item
            value="go to favorites favourites starred"
            onSelect={() => jumpTab("favorites")}
            className="cmdk-item"
          >
            <span className="cmdk-item__icon">★</span>
            <span className="cmdk-item__label">Favorites</span>
            <span className="cmdk-item__hint">⌘2</span>
          </Command.Item>
          <Command.Item
            value="go to collections lists folders"
            onSelect={() => jumpTab("collections")}
            className="cmdk-item"
          >
            <span className="cmdk-item__icon">🗂</span>
            <span className="cmdk-item__label">Collections</span>
            <span className="cmdk-item__hint">⌘3</span>
          </Command.Item>
          <Command.Item
            value="go to settings preferences theme"
            onSelect={() => jumpTab("settings")}
            className="cmdk-item"
          >
            <span className="cmdk-item__icon">⚙</span>
            <span className="cmdk-item__label">Settings</span>
            <span className="cmdk-item__hint">⌘,</span>
          </Command.Item>
        </Command.Group>

        <Command.Group heading="Filters" className="cmdk-group">
          <Command.Item
            value="filter all everything"
            onSelect={() => setFilter("all", "All")}
            className="cmdk-item"
          >
            <span className="cmdk-item__icon">∗</span>
            <span className="cmdk-item__label">Filter: All</span>
          </Command.Item>
          <Command.Item
            value="filter osha 29 cfr 1910 general industry"
            onSelect={() => setFilter("osha", "OSHA")}
            className="cmdk-item"
          >
            <span className="cmdk-item__icon">🇺🇸</span>
            <span className="cmdk-item__label">Filter: OSHA (29 CFR)</span>
          </Command.Item>
          <Command.Item
            value="filter msha 30 cfr mining mine safety"
            onSelect={() => setFilter("msha", "MSHA")}
            className="cmdk-item"
          >
            <span className="cmdk-item__icon">⛏</span>
            <span className="cmdk-item__label">Filter: MSHA (30 CFR)</span>
          </Command.Item>
          <Command.Item
            value="filter loi letters interpretation"
            onSelect={() => setFilter("loi", "Letters of Interpretation")}
            className="cmdk-item"
          >
            <span className="cmdk-item__icon">✉</span>
            <span className="cmdk-item__label">Filter: Letters of Interpretation</span>
          </Command.Item>
          <Command.Item
            value="filter chemicals niosh pel idlh substances"
            onSelect={() => setFilter("chemicals", "Chemicals")}
            className="cmdk-item"
          >
            <span className="cmdk-item__icon">⚗</span>
            <span className="cmdk-item__label">Filter: Chemicals (NIOSH/PEL)</span>
          </Command.Item>
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}
