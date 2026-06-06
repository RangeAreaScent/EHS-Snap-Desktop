import { useState } from "react";
import {
  toChemicalCollectionItem,
  toCollectionItem,
  toLoiCollectionItem,
  useAppData,
} from "../state";
import type { ChemicalSummary, CollectionItem, LoiSummary, RegulationSummary } from "../types";
import { CollectionFormModal } from "./CollectionFormModal";
import { Modal } from "./Modal";

export type CollectionTarget =
  | { kind: "regulation"; data: RegulationSummary }
  | { kind: "loi"; data: LoiSummary }
  | { kind: "chemical"; data: ChemicalSummary };

interface Props {
  target: CollectionTarget;
  onClose: () => void;
}

function buildItem(target: CollectionTarget): CollectionItem {
  switch (target.kind) {
    case "regulation": return toCollectionItem(target.data);
    case "loi":        return toLoiCollectionItem(target.data);
    case "chemical":   return toChemicalCollectionItem(target.data);
  }
}

function targetId(target: CollectionTarget): string {
  switch (target.kind) {
    case "regulation": return target.data.regulationId;
    case "loi":        return target.data.loiId;
    case "chemical":   return target.data.substanceName;
  }
}

function targetLabel(target: CollectionTarget): string {
  switch (target.kind) {
    case "regulation": return target.data.citation || target.data.regulationId;
    case "loi":        return target.data.title;
    case "chemical":   return target.data.substanceName;
  }
}

export function AddToCollectionModal({ target, onClose }: Props) {
  const {
    collections,
    createCollection,
    addToCollection,
    removeFromCollection,
    isInCollection,
  } = useAppData();
  const [creating, setCreating] = useState(false);

  if (creating) {
    return (
      <CollectionFormModal
        title="New collection"
        submitLabel="Create"
        onClose={() => setCreating(false)}
        onSubmit={(name, emoji) => {
          const id = createCollection(name, emoji);
          if (id) addToCollection(id, buildItem(target));
        }}
      />
    );
  }

  const id = targetId(target);
  const label = targetLabel(target);

  return (
    <Modal
      title={`Add ${label} to collection`}
      onClose={onClose}
      footer={
        <button className="btn btn--primary" onClick={onClose}>
          Done
        </button>
      }
    >
      <button className="btn btn--block" onClick={() => setCreating(true)}>
        ＋ New collection
      </button>
      {collections.length === 0 ? (
        <p className="modal-empty">No collections yet.</p>
      ) : (
        <div className="pick-list">
          {collections.map((c) => {
            const inside = isInCollection(c.id, id);
            return (
              <button
                key={c.id}
                className="pick-row"
                onClick={() =>
                  inside
                    ? removeFromCollection(c.id, id)
                    : addToCollection(c.id, buildItem(target))
                }
              >
                <span className="pick-row__emoji">{c.emoji}</span>
                <span className="pick-row__name">{c.name}</span>
                <span className="pick-row__count">{c.items.length}</span>
                <span className="pick-row__check">{inside ? "✓" : ""}</span>
              </button>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
