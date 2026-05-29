import { useEffect, useState } from "react";
import { getCodeDetail } from "../api";
import { useAppData } from "../state";
import type { CodeDetail, SearchResult } from "../types";
import { AddToCollectionModal } from "./AddToCollectionModal";

interface Props {
  code: string | null;
}

export function CodeDetailView({ code }: Props) {
  const [detail, setDetail] = useState<CodeDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [addingToCollection, setAddingToCollection] = useState(false);
  const { isFavorite, toggleFavorite, notes } = useAppData();

  useEffect(() => {
    if (!code) {
      setDetail(null);
      setError(null);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    getCodeDetail(code)
      .then((d) => {
        if (!active) return;
        setDetail(d);
        if (!d) setError(`Code "${code}" was not found.`);
      })
      .catch((e) => {
        if (active) setError(String(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [code]);

  async function copy(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied((c) => (c === label ? null : c)), 1600);
    } catch (e) {
      console.error("copy failed:", e);
    }
  }

  if (!code) {
    return (
      <div className="detail-pane detail-pane--empty">
        <p>Select a code to see its details.</p>
      </div>
    );
  }
  if (loading) {
    return (
      <div className="detail-pane detail-pane--empty">
        <p>Loading…</p>
      </div>
    );
  }
  if (error || !detail) {
    return (
      <div className="detail-pane detail-pane--empty">
        <p>{error ?? "Not found."}</p>
      </div>
    );
  }

  const asItem: SearchResult = {
    code: detail.code,
    description: detail.description,
    isBillable: detail.isBillable,
    chapterDescription: detail.chapterDescription,
    blockDescription: detail.blockDescription,
  };

  const note = notes[detail.code];
  const fullDetail = [
    detail.code,
    detail.description,
    note?.text && `Note: ${note.text}`,
    detail.isBillable ? "Billable" : "Non-billable",
    detail.chapterDescription && `Chapter: ${detail.chapterDescription}`,
    detail.blockDescription && `Block: ${detail.blockDescription}`,
    detail.categoryDescription && `Category: ${detail.categoryDescription}`,
  ]
    .filter(Boolean)
    .join("\n");

  const fav = isFavorite(detail.code);

  return (
    <div className="detail-pane">
      <div className="detail-scroll">
        <div className="detail-hero">
          <div className="detail-hero__actions">
            <button
              className={`star-btn star-btn--lg${fav ? " star-btn--on" : ""}`}
              title={fav ? "Remove from favorites" : "Add to favorites"}
              onClick={() => toggleFavorite(asItem)}
            >
              {fav ? "★" : "☆"}
            </button>
            <button
              className="icon-btn"
              title="Add to collection"
              onClick={() => setAddingToCollection(true)}
            >
              ＋
            </button>
          </div>
          <div className="detail-hero__code">{detail.code}</div>
          <div className="detail-hero__desc">{detail.description}</div>
          <span
            className={`badge ${
              detail.isBillable ? "badge--billable" : "badge--nonbillable"
            }`}
          >
            {detail.isBillable ? "Billable" : "Non-billable"}
          </span>
        </div>

        <div className="copy-group">
          <button className="copy-btn" onClick={() => copy("code", detail.code)}>
            Copy code · {detail.code}
          </button>
          <button
            className="copy-btn"
            onClick={() =>
              copy("codeDesc", `${detail.code} ${detail.description}`)
            }
          >
            Copy code + description
          </button>
          {note?.text && (
            <button
              className="copy-btn"
              onClick={() =>
                copy("codeNote", `${detail.code}\n${note.text}`)
              }
            >
              Copy code + Note
            </button>
          )}
          <button className="copy-btn" onClick={() => copy("full", fullDetail)}>
            Copy full detail
          </button>
        </div>

        <div className="classification">
          <h3 className="classification__heading">Classification (CDC)</h3>
          {detail.chapterDescription && (
            <ClassRow label="Chapter" value={detail.chapterDescription} />
          )}
          {detail.blockDescription && (
            <ClassRow label="Block" value={detail.blockDescription} />
          )}
          {detail.categoryDescription && (
            <ClassRow label="Category" value={detail.categoryDescription} />
          )}
        </div>

        <NoteSection code={detail.code} />
      </div>

      <div className={`toast${copied ? " toast--show" : ""}`}>Copied</div>

      {addingToCollection && (
        <AddToCollectionModal
          item={asItem}
          onClose={() => setAddingToCollection(false)}
        />
      )}
    </div>
  );
}

function ClassRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="class-row">
      <span className="class-row__label">{label}</span>
      <span className="class-row__value">{value}</span>
    </div>
  );
}

function NoteSection({ code }: { code: string }) {
  const { notes, setNote, deleteNote } = useAppData();
  const note = notes[code];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  // Leave edit mode when switching to a different code.
  useEffect(() => {
    setEditing(false);
    setDraft("");
  }, [code]);

  function startEdit() {
    setDraft(note?.text ?? "");
    setEditing(true);
  }

  function save() {
    const trimmed = draft.trim();
    if (trimmed) {
      setNote(code, trimmed);
    } else if (note) {
      deleteNote(code);
    }
    setEditing(false);
  }

  return (
    <div className="note-section">
      <h3 className="classification__heading">Note</h3>
      {editing ? (
        <>
          <textarea
            className="note-input"
            value={draft}
            autoFocus
            placeholder="Add a note for this code…"
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="note-actions">
            <button className="btn" onClick={() => setEditing(false)}>
              Cancel
            </button>
            <button className="btn btn--primary" onClick={save}>
              Save
            </button>
          </div>
        </>
      ) : note ? (
        <>
          <div className="note-text">{note.text}</div>
          <div className="note-actions">
            <button className="btn" onClick={startEdit}>
              Edit
            </button>
            <button
              className="btn btn--danger"
              onClick={() => deleteNote(code)}
            >
              Delete
            </button>
          </div>
        </>
      ) : (
        <button className="note-add" onClick={startEdit}>
          ＋ Add a note
        </button>
      )}
    </div>
  );
}
