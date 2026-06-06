import { useEffect, useMemo, useRef, useState } from "react";
import {
  searchChemicals,
  searchLois,
  searchRegulations,
} from "../api";
import { useAppData } from "../state";
import {
  selectedItemKey,
  type ChemicalSummary,
  type LoiSummary,
  type RegulationSummary,
  type SearchFilter,
  type SelectedItem,
} from "../types";
import { useListKeyNav, type NavItem } from "../hooks/useListKeyNav";
import { ChemicalRow } from "./ChemicalRow";
import { LoiRow } from "./LoiRow";
import { RegulationRow } from "./RegulationRow";

interface Props {
  selectedItem: SelectedItem;
  onSelectItem: (item: SelectedItem) => void;
  /** Phase C — optional external filter control so the ⌘K palette can
   * push the user into a filtered view. */
  externalFilter?: SearchFilter | null;
  onFilterApplied?: () => void;
}

const FILTER_LABELS: Record<SearchFilter, string> = {
  all: "All",
  osha: "OSHA",
  msha: "MSHA",
  loi: "LOI",
  chemicals: "Chemicals",
};

const FILTER_ORDER: SearchFilter[] = ["all", "osha", "msha", "loi", "chemicals"];

/** Round D — applies only to the regulations group (LOIs are sorted by
 * issue date, chemicals by name, both inherent to their data shape). */
type SortKey = "relevance" | "citation";

export function SearchView({
  selectedItem,
  onSelectItem,
  externalFilter,
  onFilterApplied,
}: Props) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<SearchFilter>("all");
  const [sortBy, setSortBy] = useState<SortKey>("relevance");

  // Apply externally-pushed filter (e.g. from ⌘K palette).
  useEffect(() => {
    if (externalFilter && externalFilter !== filter) {
      setFilter(externalFilter);
      onFilterApplied?.();
    }
    // We intentionally listen only to the prop changing — not filter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalFilter]);
  const [regs, setRegs] = useState<RegulationSummary[]>([]);
  const [lois, setLois] = useState<LoiSummary[]>([]);
  const [chems, setChems] = useState<ChemicalSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isFavorite, toggleFavorite, isFavoriteLoi, toggleFavoriteLoi, isFavoriteChemical } = useAppData();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const runId = useRef(0);
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setRegs([]);
      setLois([]);
      setChems([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const id = ++runId.current;

    const tasks: Promise<unknown>[] = [];

    if (filter === "all" || filter === "osha" || filter === "msha") {
      const agency =
        filter === "osha" ? "OSHA" : filter === "msha" ? "MSHA" : null;
      tasks.push(
        searchRegulations(trimmed, 50, agency).then((res) => {
          if (id === runId.current) setRegs(res);
        }),
      );
    } else {
      setRegs([]);
    }

    if (filter === "all" || filter === "loi") {
      tasks.push(
        searchLois(trimmed, filter === "loi" ? 50 : 15).then((res) => {
          if (id === runId.current) setLois(res);
        }),
      );
    } else {
      setLois([]);
    }

    if (filter === "all" || filter === "chemicals") {
      tasks.push(
        searchChemicals(trimmed, filter === "chemicals" ? 50 : 12).then(
          (res) => {
            if (id === runId.current) setChems(res);
          },
        ),
      );
    } else {
      setChems([]);
    }

    const timer = setTimeout(() => {
      Promise.allSettled(tasks)
        .then(() => {
          if (id === runId.current) setError(null);
        })
        .catch((e) => {
          if (id === runId.current) setError(String(e));
        })
        .finally(() => {
          if (id === runId.current) setLoading(false);
        });
    }, 200);
    return () => clearTimeout(timer);
  }, [query, filter]);

  const trimmed = query.trim();
  const hasAnyResult = regs.length + lois.length + chems.length > 0;

  // Round D — sort regulations by citation when requested.
  // Citation strings like "29 CFR § 1910.147" sort lexically incorrectly
  // (e.g. .19 < .9), so we key on sectionNumber, splitting the part-section
  // tail into numeric components.
  const sortedRegs = useMemo(() => {
    if (sortBy === "relevance" || regs.length < 2) return regs;
    function parts(s: string): number[] {
      return s.split(/[^0-9]+/).filter(Boolean).map((n) => parseInt(n, 10));
    }
    return [...regs].sort((a, b) => {
      const pa = parts(a.sectionNumber || a.regulationId);
      const pb = parts(b.sectionNumber || b.regulationId);
      const len = Math.max(pa.length, pb.length);
      for (let i = 0; i < len; i++) {
        const ai = pa[i] ?? 0;
        const bi = pb[i] ?? 0;
        if (ai !== bi) return ai - bi;
      }
      return 0;
    });
  }, [regs, sortBy]);

  // Phase A: unify the three result lists into one keyboard-navigable
  // ordering, in the same order they're rendered below.
  const navItems = useMemo<NavItem[]>(() => {
    const out: NavItem[] = [];
    for (const r of sortedRegs) {
      out.push({
        key: `reg:${r.regulationId}`,
        onSelect: () =>
          onSelectItem({ kind: "regulation", id: r.regulationId }),
      });
    }
    for (const l of lois) {
      out.push({
        key: `loi:${l.loiId}`,
        onSelect: () => onSelectItem({ kind: "loi", id: l.loiId }),
      });
    }
    for (const c of chems) {
      out.push({
        key: `chem:${c.substanceName}`,
        onSelect: () =>
          onSelectItem({ kind: "chemical", name: c.substanceName }),
      });
    }
    return out;
  }, [sortedRegs, lois, chems, onSelectItem]);

  useListKeyNav(navItems, selectedItemKey(selectedItem));

  return (
    <div className="list-pane">
      <div className="search-bar">
        <span className="search-bar__icon">⌕</span>
        <input
          ref={inputRef}
          className="search-bar__input"
          placeholder="Search 29 CFR · 30 CFR · LOI · chemicals…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          spellCheck={false}
          autoComplete="off"
        />
        {query && (
          <button
            className="search-bar__clear"
            onClick={() => setQuery("")}
            title="Clear"
          >
            ✕
          </button>
        )}
      </div>

      <div className="filter-row">
        {FILTER_ORDER.map((f) => (
          <button
            key={f}
            className={`filter-chip${filter === f ? " filter-chip--active" : ""}`}
            onClick={() => setFilter(f)}
          >
            {FILTER_LABELS[f]}
          </button>
        ))}
      </div>

      {sortedRegs.length > 1 && (
        <div className="sort-bar">
          <span className="sort-bar__label">
            {sortedRegs.length} regulation{sortedRegs.length === 1 ? "" : "s"}
            {lois.length + chems.length > 0
              ? ` · ${lois.length + chems.length} more`
              : ""}
          </span>
          <div className="sort-bar__opts">
            <button
              className={`sort-bar__opt${
                sortBy === "relevance" ? " sort-bar__opt--on" : ""
              }`}
              onClick={() => setSortBy("relevance")}
              title="FTS5 rank — best match first"
            >
              Relevance
            </button>
            <button
              className={`sort-bar__opt${
                sortBy === "citation" ? " sort-bar__opt--on" : ""
              }`}
              onClick={() => setSortBy("citation")}
              title="Numeric citation order (1910.1 → 1910.999 → 30 CFR)"
            >
              Citation
            </button>
          </div>
        </div>
      )}

      <div className="list-scroll">
        {error && <div className="state-msg state-msg--error">{error}</div>}
        {!error && !trimmed && (
          <div className="state-msg">
            <p className="state-msg__title">Search EHS regulations</p>
            <p>
              Type a citation (e.g. "1910.147"), a topic ("LOTO", "confined
              space", "HazCom"), or a chemical name ("benzene", "CO").
            </p>
            <p>Use the chips above to narrow to OSHA, MSHA, LOI, or chemicals only.</p>
          </div>
        )}
        {!error && trimmed && !loading && !hasAnyResult && (
          <div className="state-msg">
            <p className="state-msg__title">No results</p>
            <p>Nothing matches "{trimmed}" in the current filter.</p>
          </div>
        )}

        {sortedRegs.length > 0 && (
          <>
            {filter === "all" && (
              <SectionHeading title="Regulations" count={sortedRegs.length} />
            )}
            {sortedRegs.map((item) => (
              <RegulationRow
                key={item.regulationId}
                item={item}
                selected={
                  selectedItem?.kind === "regulation" &&
                  selectedItem.id === item.regulationId
                }
                favorite={isFavorite(item.regulationId)}
                onSelect={() =>
                  onSelectItem({ kind: "regulation", id: item.regulationId })
                }
                onToggleFavorite={() => toggleFavorite(item)}
              />
            ))}
          </>
        )}

        {lois.length > 0 && (
          <>
            {filter === "all" && (
              <SectionHeading title="Letters of Interpretation" count={lois.length} />
            )}
            {lois.map((item) => (
              <LoiRow
                key={item.loiId}
                item={item}
                selected={
                  selectedItem?.kind === "loi" &&
                  selectedItem.id === item.loiId
                }
                favorite={isFavoriteLoi(item.loiId)}
                onSelect={() => onSelectItem({ kind: "loi", id: item.loiId })}
                onToggleFavorite={() => toggleFavoriteLoi(item)}
              />
            ))}
          </>
        )}

        {chems.length > 0 && (
          <>
            {filter === "all" && <SectionHeading title="Chemicals" count={chems.length} />}
            {chems.map((item) => (
              <ChemicalRow
                key={item.substanceName}
                item={item}
                selected={
                  selectedItem?.kind === "chemical" &&
                  selectedItem.name === item.substanceName
                }
                favorite={isFavoriteChemical(item.substanceName)}
                onSelect={() =>
                  onSelectItem({ kind: "chemical", name: item.substanceName })
                }
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function SectionHeading({ title, count }: { title: string; count: number }) {
  return (
    <div className="section-heading">
      {title}
      <span className="section-heading__count">{count}</span>
    </div>
  );
}
