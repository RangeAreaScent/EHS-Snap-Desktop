import { useEffect, useRef, useState } from "react";
import { searchRegulations } from "../api";
import { toCollectionItem, useAppData } from "../state";
import type { RegulationSummary } from "../types";
import { Modal } from "./Modal";

interface Props {
  collectionId: string;
  onClose: () => void;
}

export function AddCodeModal({ collectionId, onClose }: Props) {
  const { addToCollection, removeFromCollection, isInCollection } = useAppData();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<RegulationSummary[]>([]);
  const runId = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }
    const id = ++runId.current;
    const timer = setTimeout(() => {
      searchRegulations(trimmed, 30)
        .then((res) => {
          if (id === runId.current) setResults(res);
        })
        .catch((e) => console.error("search failed:", e));
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <Modal
      title="Add regulation"
      onClose={onClose}
      footer={
        <button className="btn btn--primary" onClick={onClose}>
          Done
        </button>
      }
    >
      <input
        className="text-input"
        autoFocus
        placeholder="Search citation, topic, or chemical…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        spellCheck={false}
      />
      <div className="pick-list pick-list--tall">
        {results.map((r) => {
          const inside = isInCollection(collectionId, r.regulationId);
          return (
            <button
              key={r.regulationId}
              className="pick-row"
              onClick={() =>
                inside
                  ? removeFromCollection(collectionId, r.regulationId)
                  : addToCollection(collectionId, toCollectionItem(r))
              }
            >
              <span className="pick-row__code">{r.citation || r.regulationId}</span>
              <span className="pick-row__name">{r.heading}</span>
              <span className="pick-row__check">{inside ? "✓" : "＋"}</span>
            </button>
          );
        })}
        {query.trim() && results.length === 0 && (
          <p className="modal-empty">No results.</p>
        )}
      </div>
    </Modal>
  );
}
