import { useEffect, useMemo, useState } from "react";
import { ask } from "@tauri-apps/plugin-dialog";
import {
  toChemicalCollectionItem,
  toCollectionItem,
  toLoiCollectionItem,
  useAppData,
} from "../state";
import {
  selectedItemKey,
  type ChemicalSummary,
  type Collection,
  type FavoriteChemical,
  type FavoriteLoi,
  type FavoriteRegulation,
  type LoiSummary,
  type RegulationSummary,
  type SelectedItem,
} from "../types";
import { useListKeyNav, type NavItem } from "../hooks/useListKeyNav";
import { LoiRow } from "./LoiRow";
import { RegulationRow } from "./RegulationRow";
import { showToast } from "./Toaster";

interface Props {
  selectedItem: SelectedItem;
  onSelectItem: (item: SelectedItem) => void;
}

/** Multi-select picked keys use the same `kind:id` prefix as data-nav-key
 * so the same string identifies a row across navigation + bulk actions. */
type PickedKey = string;

function favRegKey(f: FavoriteRegulation): PickedKey {
  return `reg:${f.regulationId}`;
}
function favLoiKey(f: FavoriteLoi): PickedKey {
  return `loi:${f.loiId}`;
}
function favChemKey(f: FavoriteChemical): PickedKey {
  return `chem:${f.substanceName}`;
}

export function FavoritesView({ selectedItem, onSelectItem }: Props) {
  const selectedRegulationId =
    selectedItem?.kind === "regulation" ? selectedItem.id : null;
  const {
    favorites,
    isFavorite,
    toggleFavorite,
    removeFavorite,
    favoriteLois,
    isFavoriteLoi,
    toggleFavoriteLoi,
    removeFavoriteLoi,
    favoriteChemicals,
    removeFavoriteChemical,
  } = useAppData();

  const totalCount =
    favorites.length + favoriteLois.length + favoriteChemicals.length;

  // Round C — multi-select state.
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<PickedKey>>(new Set());
  const [addingToCollection, setAddingToCollection] = useState(false);

  // Drop selection mode if the list shrinks to nothing.
  useEffect(() => {
    if (totalCount === 0 && selecting) {
      setSelecting(false);
      setPicked(new Set());
    }
  }, [totalCount, selecting]);

  // Keep ↑↓ navigation behaviour only when NOT in multi-select.
  const navItems = useMemo<NavItem[]>(() => {
    if (selecting) return [];
    const out: NavItem[] = [];
    for (const f of favorites) {
      out.push({
        key: favRegKey(f),
        onSelect: () =>
          onSelectItem({ kind: "regulation", id: f.regulationId }),
      });
    }
    for (const f of favoriteLois) {
      out.push({
        key: favLoiKey(f),
        onSelect: () => onSelectItem({ kind: "loi", id: f.loiId }),
      });
    }
    for (const f of favoriteChemicals) {
      out.push({
        key: favChemKey(f),
        onSelect: () =>
          onSelectItem({ kind: "chemical", name: f.substanceName }),
      });
    }
    return out;
  }, [selecting, favorites, favoriteLois, favoriteChemicals, onSelectItem]);

  useListKeyNav(navItems, selectedItemKey(selectedItem));

  function togglePick(key: PickedKey) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function cancelSelect() {
    setSelecting(false);
    setPicked(new Set());
  }

  async function bulkRemove() {
    if (picked.size === 0) return;
    const n = picked.size;
    const ok = await ask(
      `Remove ${n} favorite${n === 1 ? "" : "s"}? This cannot be undone.`,
      { title: "Remove favorites", kind: "warning" },
    );
    if (!ok) return;
    // Remove from each store by inspecting the prefix.
    let clearedSelected = false;
    picked.forEach((key) => {
      if (key.startsWith("reg:")) {
        const id = key.slice(4);
        removeFavorite(id);
        if (selectedItem?.kind === "regulation" && selectedItem.id === id) {
          clearedSelected = true;
        }
      } else if (key.startsWith("loi:")) {
        const id = key.slice(4);
        removeFavoriteLoi(id);
        if (selectedItem?.kind === "loi" && selectedItem.id === id) {
          clearedSelected = true;
        }
      } else if (key.startsWith("chem:")) {
        const name = key.slice(5);
        removeFavoriteChemical(name);
        if (selectedItem?.kind === "chemical" && selectedItem.name === name) {
          clearedSelected = true;
        }
      }
    });
    if (clearedSelected) onSelectItem(null);
    cancelSelect();
    showToast(`Removed ${n} favorite${n === 1 ? "" : "s"}`);
  }

  return (
    <div className="list-pane">
      <div className="pane-header">
        <h2 className="pane-header__title">Favorites</h2>
        <span className="pane-header__count">{totalCount}</span>
        {totalCount > 0 && !selecting && (
          <button
            className="pane-header__action pane-header__action--text"
            onClick={() => setSelecting(true)}
            title="Select multiple to remove or move"
          >
            Select
          </button>
        )}
      </div>

      {selecting && (
        <div className="multi-bar">
          <span className="multi-bar__count">{picked.size} selected</span>
          <div className="multi-bar__actions">
            <button
              className="icon-btn"
              onClick={() => setAddingToCollection(true)}
              disabled={picked.size === 0}
              title="Add to a collection"
            >
              📁
            </button>
            <button
              className="icon-btn icon-btn--danger"
              onClick={bulkRemove}
              disabled={picked.size === 0}
              title="Remove from favorites"
            >
              🗑
            </button>
            <button
              className="icon-btn"
              onClick={cancelSelect}
              title="Cancel"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {addingToCollection && picked.size > 0 && (
        <BulkAddToCollection
          picked={picked}
          favorites={favorites}
          favoriteLois={favoriteLois}
          favoriteChemicals={favoriteChemicals}
          onClose={() => setAddingToCollection(false)}
          onAdded={() => {
            setAddingToCollection(false);
            cancelSelect();
          }}
        />
      )}

      <div className="list-scroll">
        {totalCount === 0 && (
          <div className="state-msg">
            <p className="state-msg__title">No favorites yet</p>
            <p>
              Tap the ☆ on any regulation, letter, or chemical to save it here.
            </p>
          </div>
        )}

        {/* ---- Regulations ---- */}
        {favorites.length > 0 && (
          <>
            {(favoriteLois.length > 0 || favoriteChemicals.length > 0) && (
              <div className="section-heading">
                Regulations
                <span className="section-heading__count">
                  {favorites.length}
                </span>
              </div>
            )}
            {favorites.map((fav) => {
              const item: RegulationSummary = {
                regulationId: fav.regulationId,
                citation: fav.citation,
                sectionNumber: "",
                heading: fav.heading,
                agency: fav.agency,
                industry: "General Industry",
                subpartLabel: fav.subpartLabel,
              };
              if (selecting) {
                const key = favRegKey(fav);
                const isPicked = picked.has(key);
                return (
                  <PickableRow
                    key={key}
                    navKey={key}
                    picked={isPicked}
                    onToggle={() => togglePick(key)}
                  >
                    <div className="code-row__top">
                      <span className="code-row__code">
                        {item.citation || item.regulationId}
                      </span>
                      <span
                        className={`badge ${
                          item.agency === "OSHA" ? "badge--osha" : "badge--msha"
                        }`}
                      >
                        {item.agency}
                      </span>
                    </div>
                    <div className="code-row__desc">{item.heading}</div>
                    {item.subpartLabel && (
                      <div className="code-row__chapter">
                        {item.subpartLabel}
                      </div>
                    )}
                  </PickableRow>
                );
              }
              return (
                <RegulationRow
                  key={fav.regulationId}
                  item={item}
                  selected={fav.regulationId === selectedRegulationId}
                  favorite={isFavorite(fav.regulationId)}
                  onSelect={() =>
                    onSelectItem({ kind: "regulation", id: fav.regulationId })
                  }
                  onToggleFavorite={() => {
                    toggleFavorite(item);
                    removeFavorite(fav.regulationId);
                  }}
                />
              );
            })}
          </>
        )}

        {/* ---- Letters of Interpretation ---- */}
        {favoriteLois.length > 0 && (
          <>
            <div className="section-heading">
              Letters of Interpretation
              <span className="section-heading__count">
                {favoriteLois.length}
              </span>
            </div>
            {favoriteLois.map((fav) => {
              const item: LoiSummary = {
                loiId: fav.loiId,
                title: fav.title,
                issueDate: fav.issueDate,
                relatedSections: [],
              };
              if (selecting) {
                const key = favLoiKey(fav);
                const isPicked = picked.has(key);
                return (
                  <PickableRow
                    key={key}
                    navKey={key}
                    picked={isPicked}
                    onToggle={() => togglePick(key)}
                  >
                    <div className="code-row__top">
                      <span className="badge badge--loi">LOI</span>
                      <span className="code-row__chapter">
                        {fav.issueDate}
                      </span>
                    </div>
                    <div className="code-row__desc">{fav.title}</div>
                  </PickableRow>
                );
              }
              return (
                <LoiRow
                  key={fav.loiId}
                  item={item}
                  selected={
                    selectedItem?.kind === "loi" &&
                    selectedItem.id === fav.loiId
                  }
                  favorite={isFavoriteLoi(fav.loiId)}
                  onSelect={() =>
                    onSelectItem({ kind: "loi", id: fav.loiId })
                  }
                  onToggleFavorite={() => {
                    toggleFavoriteLoi(item);
                    removeFavoriteLoi(fav.loiId);
                  }}
                />
              );
            })}
          </>
        )}

        {/* ---- Chemicals ---- */}
        {favoriteChemicals.length > 0 && (
          <>
            <div className="section-heading">
              Chemicals
              <span className="section-heading__count">
                {favoriteChemicals.length}
              </span>
            </div>
            {favoriteChemicals.map((fav) => {
              if (selecting) {
                const key = favChemKey(fav);
                const isPicked = picked.has(key);
                return (
                  <PickableRow
                    key={key}
                    navKey={key}
                    picked={isPicked}
                    onToggle={() => togglePick(key)}
                  >
                    <div className="code-row__top">
                      <span className="code-row__code">{fav.substanceName}</span>
                      {fav.isOshaCarcinogen && (
                        <span className="badge badge--carcinogen">
                          Carcinogen
                        </span>
                      )}
                    </div>
                    <div className="code-row__desc">
                      {fav.oshaPelTwa
                        ? `OSHA PEL TWA: ${fav.oshaPelTwa}`
                        : "No PEL listed"}
                      {fav.idlh ? `  ·  IDLH: ${fav.idlh}` : ""}
                    </div>
                  </PickableRow>
                );
              }
              return (
                <div
                  key={fav.substanceName}
                  className={`code-row${
                    selectedItem?.kind === "chemical" &&
                    selectedItem.name === fav.substanceName
                      ? " code-row--selected"
                      : ""
                  }`}
                  data-nav-key={`chem:${fav.substanceName}`}
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    onSelectItem({ kind: "chemical", name: fav.substanceName })
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelectItem({
                        kind: "chemical",
                        name: fav.substanceName,
                      });
                    }
                  }}
                >
                  <div className="code-row__main">
                    <div className="code-row__top">
                      <span className="code-row__code">
                        {fav.substanceName}
                      </span>
                      {fav.isOshaCarcinogen && (
                        <span className="badge badge--carcinogen">
                          Carcinogen
                        </span>
                      )}
                    </div>
                    <div className="code-row__desc">
                      {fav.oshaPelTwa
                        ? `OSHA PEL TWA: ${fav.oshaPelTwa}`
                        : "No PEL listed"}
                      {fav.idlh ? `  ·  IDLH: ${fav.idlh}` : ""}
                    </div>
                  </div>
                  <button
                    className="star-btn star-btn--on"
                    title="Remove from favorites"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFavoriteChemical(fav.substanceName);
                    }}
                  >
                    ★
                  </button>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

/** A row in multi-select mode — checkbox + content slot. The label
 * wraps the whole row so clicking anywhere toggles the checkbox. */
function PickableRow({
  navKey,
  picked,
  onToggle,
  children,
}: {
  navKey: string;
  picked: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <label
      className={`code-row code-row--pickable${
        picked ? " code-row--picked" : ""
      }`}
      data-nav-key={navKey}
    >
      <input
        type="checkbox"
        className="code-row__check"
        checked={picked}
        onChange={onToggle}
      />
      <div className="code-row__main">{children}</div>
    </label>
  );
}

/** Bulk "add to collection" modal — choose ONE target collection;
 * all picks get added. Skips items already in the target without
 * warning (the underlying addToCollection is idempotent). */
function BulkAddToCollection({
  picked,
  favorites,
  favoriteLois,
  favoriteChemicals,
  onClose,
  onAdded,
}: {
  picked: Set<PickedKey>;
  favorites: FavoriteRegulation[];
  favoriteLois: FavoriteLoi[];
  favoriteChemicals: FavoriteChemical[];
  onClose: () => void;
  onAdded: () => void;
}) {
  const { collections, addToCollection } = useAppData();

  function send(collection: Collection) {
    let added = 0;
    picked.forEach((key) => {
      if (key.startsWith("reg:")) {
        const id = key.slice(4);
        const fav = favorites.find((f) => f.regulationId === id);
        if (!fav) return;
        const summary: RegulationSummary = {
          regulationId: fav.regulationId,
          citation: fav.citation,
          sectionNumber: "",
          heading: fav.heading,
          agency: fav.agency,
          industry: "General Industry",
          subpartLabel: fav.subpartLabel,
        };
        addToCollection(collection.id, toCollectionItem(summary));
        added += 1;
      } else if (key.startsWith("loi:")) {
        const id = key.slice(4);
        const fav = favoriteLois.find((f) => f.loiId === id);
        if (!fav) return;
        const summary: LoiSummary = {
          loiId: fav.loiId,
          title: fav.title,
          issueDate: fav.issueDate,
          relatedSections: [],
        };
        addToCollection(collection.id, toLoiCollectionItem(summary));
        added += 1;
      } else if (key.startsWith("chem:")) {
        const name = key.slice(5);
        const fav = favoriteChemicals.find((f) => f.substanceName === name);
        if (!fav) return;
        const summary: ChemicalSummary = {
          substanceName: fav.substanceName,
          oshaPelTwa: fav.oshaPelTwa,
          idlh: fav.idlh,
          isOshaCarcinogen: fav.isOshaCarcinogen,
        };
        addToCollection(collection.id, toChemicalCollectionItem(summary));
        added += 1;
      }
    });
    showToast(`Added ${added} to ${collection.name}`);
    onAdded();
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <h3 className="modal__title">
            Add {picked.size} to a collection
          </h3>
          <button className="modal__close" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="modal__body">
          {collections.length === 0 ? (
            <p className="settings-disclaimer">
              Create a collection from the Collections tab first, then come
              back to bulk-add favorites.
            </p>
          ) : (
            <div className="bulk-collection-list">
              {collections.map((c) => (
                <button
                  key={c.id}
                  className="bulk-collection-row"
                  onClick={() => send(c)}
                >
                  <span className="bulk-collection-row__emoji">{c.emoji}</span>
                  <span className="bulk-collection-row__name">{c.name}</span>
                  <span className="bulk-collection-row__count">
                    {c.items.length} items
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
