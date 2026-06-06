import { useEffect, useMemo, useRef, useState } from "react";
import { ask } from "@tauri-apps/plugin-dialog";
import { exportCollectionCSV, exportCollectionPDF } from "../export";
import { useAppData } from "../state";
import {
  selectedItemKey,
  type Collection,
  type SelectedItem,
} from "../types";
import { useListKeyNav, type NavItem } from "../hooks/useListKeyNav";
import { AddCodeModal } from "./AddCodeModal";
import { CollectionFormModal } from "./CollectionFormModal";

interface Props {
  selectedItem: SelectedItem;
  onSelectItem: (item: SelectedItem) => void;
}

export function CollectionsView({ selectedItem, onSelectItem }: Props) {
  const { collections } = useAppData();
  const [openId, setOpenId] = useState<string | null>(null);

  const open = collections.find((c) => c.id === openId) ?? null;

  // The open collection was deleted elsewhere — fall back to the list.
  useEffect(() => {
    if (openId && !open) setOpenId(null);
  }, [openId, open]);

  if (open) {
    return (
      <CollectionDetail
        collection={open}
        selectedItem={selectedItem}
        onSelectItem={onSelectItem}
        onBack={() => setOpenId(null)}
      />
    );
  }
  return <CollectionList onOpen={setOpenId} />;
}

function CollectionList({ onOpen }: { onOpen: (id: string) => void }) {
  const { collections, createCollection, collectionsMax, promptPremium } =
    useAppData();
  const [creating, setCreating] = useState(false);

  const atLimit = collections.length >= collectionsMax;
  function startNew() {
    if (atLimit) {
      promptPremium(
        "The free plan keeps up to 10 collections. " +
          "Unlock unlimited collections with premium.",
      );
    } else {
      setCreating(true);
    }
  }

  return (
    <div className="list-pane">
      <div className="pane-header">
        <h2 className="pane-header__title">Collections</h2>
        <span className="pane-header__count">{collections.length}</span>
        <button
          className="pane-header__action"
          title="New collection"
          onClick={startNew}
        >
          ＋
        </button>
      </div>
      <div className="list-scroll">
        {collections.length === 0 && (
          <div className="state-msg">
            <p className="state-msg__title">No collections yet</p>
            <p>Group regulations, LOIs, and chemicals — e.g. "LOTO program", "Site A audit".</p>
          </div>
        )}
        {collections.map((c) => (
          <button
            key={c.id}
            className="collection-row"
            onClick={() => onOpen(c.id)}
          >
            <span className="collection-row__emoji">{c.emoji}</span>
            <span className="collection-row__main">
              <span className="collection-row__name">{c.name}</span>
              <span className="collection-row__count">
                {c.items.length} item{c.items.length === 1 ? "" : "s"}
              </span>
            </span>
            <span className="collection-row__chevron">›</span>
          </button>
        ))}
      </div>

      {creating && (
        <CollectionFormModal
          title="New collection"
          submitLabel="Create"
          onClose={() => setCreating(false)}
          onSubmit={(name, emoji) => createCollection(name, emoji)}
        />
      )}
    </div>
  );
}

interface DetailProps {
  collection: Collection;
  selectedItem: SelectedItem;
  onSelectItem: (item: SelectedItem) => void;
  onBack: () => void;
}

function CollectionDetail({
  collection,
  selectedItem,
  onSelectItem,
  onBack,
}: DetailProps) {
  const { notes, renameCollection, deleteCollection, removeFromCollection } =
    useAppData();
  const [menuOpen, setMenuOpen] = useState(false);
  const [modal, setModal] = useState<"rename" | "addcode" | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Phase A: keyboard navigation over the collection's items.
  const navItems = useMemo<NavItem[]>(
    () =>
      collection.items.map((item) => ({
        key:
          item.kind === "regulation"
            ? `reg:${item.id}`
            : item.kind === "loi"
              ? `loi:${item.id}`
              : `chem:${item.id}`,
        onSelect: () => {
          if (item.kind === "regulation")
            onSelectItem({ kind: "regulation", id: item.id });
          else if (item.kind === "loi")
            onSelectItem({ kind: "loi", id: item.id });
          else onSelectItem({ kind: "chemical", name: item.id });
        },
      })),
    [collection.items, onSelectItem],
  );
  useListKeyNav(navItems, selectedItemKey(selectedItem));

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  // Phase A — ⌘E exports this open collection as PDF. Lives here (not in
  // App.tsx) so the handler captures the current `collection` + `notes`.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key.toLowerCase() !== "e") return;
      if (collection.items.length === 0) return;
      e.preventDefault();
      void exportPDF();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collection, notes]);

  function flash(msg: string) {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg((m) => (m === msg ? null : m)), 2000);
  }

  async function copyAll() {
    setMenuOpen(false);
    if (collection.items.length === 0) return;
    await navigator.clipboard.writeText(
      collection.items.map((i) => i.sublabel || i.id).join(", "),
    );
    flash("Citations copied");
  }

  async function exportCSV() {
    setMenuOpen(false);
    try {
      if (await exportCollectionCSV(collection, notes)) flash("CSV saved");
    } catch (e) {
      flash(`Export failed: ${e}`);
    }
  }

  async function exportPDF() {
    setMenuOpen(false);
    if (collection.items.length === 0) return; // items includes all kinds
    try {
      if (await exportCollectionPDF(collection, notes)) flash("PDF saved");
    } catch (e) {
      flash(`Export failed: ${e}`);
    }
  }

  async function confirmDelete() {
    setMenuOpen(false);
    const ok = await ask(`Delete "${collection.name}"? This cannot be undone.`, {
      title: "Delete collection",
      kind: "warning",
    });
    if (ok) {
      deleteCollection(collection.id);
      onBack();
    }
  }

  return (
    <div className="list-pane">
      <div className="pane-header pane-header--detail">
        <button className="back-btn" onClick={onBack} title="Back">
          ‹
        </button>
        <div className="collection-head">
          <span className="collection-head__emoji">{collection.emoji}</span>
          <div>
            <div className="collection-head__name">{collection.name}</div>
            <div className="collection-head__count">
              {collection.items.length} item
              {collection.items.length === 1 ? "" : "s"}
            </div>
          </div>
        </div>
        <div className="menu-wrap" ref={menuRef}>
          <button
            className="pane-header__action"
            title="Actions"
            onClick={() => setMenuOpen((o) => !o)}
          >
            ⋯
          </button>
          {menuOpen && (
            <div className="menu">
              <button
                className="menu__item"
                onClick={() => {
                  setMenuOpen(false);
                  setModal("addcode");
                }}
              >
                Add regulation
              </button>
              <button className="menu__item" onClick={copyAll}>
                Copy all citations
              </button>
              <button className="menu__item" onClick={exportCSV}>
                Export as CSV…
              </button>
              <button className="menu__item" onClick={exportPDF}>
                Export as PDF…
              </button>
              <button
                className="menu__item"
                onClick={() => {
                  setMenuOpen(false);
                  setModal("rename");
                }}
              >
                Rename
              </button>
              <button
                className="menu__item menu__item--danger"
                onClick={confirmDelete}
              >
                Delete collection
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="list-scroll">
        {collection.items.length === 0 && (
          <div className="state-msg">
            <p className="state-msg__title">Empty collection</p>
            <p>Use ⋯ to add regulations, or the + button on any LOI or chemical.</p>
          </div>
        )}
        {collection.items.map((item) => {
          const isSelected =
            selectedItem != null &&
            ((selectedItem.kind === "regulation" && item.kind === "regulation" && selectedItem.id === item.id) ||
             (selectedItem.kind === "loi" && item.kind === "loi" && selectedItem.id === item.id) ||
             (selectedItem.kind === "chemical" && item.kind === "chemical" && selectedItem.name === item.id));

          function handleSelect() {
            if (item.kind === "regulation") onSelectItem({ kind: "regulation", id: item.id });
            else if (item.kind === "loi") onSelectItem({ kind: "loi", id: item.id });
            else if (item.kind === "chemical") onSelectItem({ kind: "chemical", name: item.id });
          }

          const navKey =
            item.kind === "regulation"
              ? `reg:${item.id}`
              : item.kind === "loi"
                ? `loi:${item.id}`
                : `chem:${item.id}`;
          return (
            <div
              key={item.id}
              className={`code-row${isSelected ? " code-row--selected" : ""}`}
              data-nav-key={navKey}
              role="button"
              tabIndex={0}
              onClick={handleSelect}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleSelect();
                }
              }}
            >
              <div className="code-row__main">
                <div className="code-row__top">
                  {item.kind === "loi" && (
                    <span className="badge badge--loi">LOI</span>
                  )}
                  <span className="code-row__code">{item.sublabel || item.id}</span>
                  {item.agency && item.kind === "regulation" && (
                    <span
                      className={`badge ${item.agency === "OSHA" ? "badge--osha" : "badge--msha"}`}
                    >
                      {item.agency}
                    </span>
                  )}
                </div>
                <div className="code-row__desc">{item.label}</div>
              </div>
              <button
                className="star-btn"
                title="Remove from collection"
                onClick={(e) => {
                  e.stopPropagation();
                  removeFromCollection(collection.id, item.id);
                }}
              >
                ✕
              </button>
            </div>
          );
        })}
      </div>

      {statusMsg && <div className="inline-status">{statusMsg}</div>}

      {modal === "rename" && (
        <CollectionFormModal
          title="Rename collection"
          submitLabel="Save"
          initialName={collection.name}
          initialEmoji={collection.emoji}
          onClose={() => setModal(null)}
          onSubmit={(name, emoji) =>
            renameCollection(collection.id, name, emoji)
          }
        />
      )}
      {modal === "addcode" && (
        <AddCodeModal
          collectionId={collection.id}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
