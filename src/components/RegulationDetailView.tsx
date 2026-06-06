import { useEffect, useState } from "react";
import { getRegulationDetail, relatedLois } from "../api";
import { useAppData } from "../state";
import type { LoiSummary, RegulationDetail, RegulationSummary } from "../types";
import { AddToCollectionModal } from "./AddToCollectionModal";

interface Props {
  regulationId: string | null;
  /** Called when user clicks a related LOI row. */
  onNavigateToLoi?: (loiId: string) => void;
}

export function RegulationDetailView({ regulationId, onNavigateToLoi }: Props) {
  const [detail, setDetail] = useState<RegulationDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [addingToCollection, setAddingToCollection] = useState(false);
  const [relatedLoiList, setRelatedLoiList] = useState<LoiSummary[]>([]);
  const { isFavorite, toggleFavorite, notes } = useAppData();

  useEffect(() => {
    if (!regulationId) {
      setDetail(null);
      setRelatedLoiList([]);
      setError(null);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    getRegulationDetail(regulationId)
      .then((d) => {
        if (!active) return;
        setDetail(d);
        if (!d) setError(`Regulation "${regulationId}" was not found.`);
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
  }, [regulationId]);

  // Fan-out: fetch related LOIs whenever a new regulation lands.
  useEffect(() => {
    if (!detail) {
      setRelatedLoiList([]);
      return;
    }
    let active = true;
    relatedLois(detail.sectionNumber, 8)
      .then((res) => {
        if (active) setRelatedLoiList(res);
      })
      .catch((e) => console.error("relatedLois failed:", e));
    return () => {
      active = false;
    };
  }, [detail]);

  async function copy(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied((c) => (c === label ? null : c)), 1600);
    } catch (e) {
      console.error("copy failed:", e);
    }
  }

  if (!regulationId) {
    return (
      <div className="detail-pane detail-pane--empty">
        <p>Select a regulation to see its details.</p>
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

  const asSummary: RegulationSummary = {
    regulationId: detail.regulationId,
    citation: detail.citation,
    sectionNumber: detail.sectionNumber,
    heading: detail.heading,
    agency: detail.agency,
    industry: detail.industry,
    subpartLabel: detail.subpartLabel,
  };

  const note = notes[detail.regulationId];
  const citationLabel = detail.citation || detail.regulationId;

  const fullDetail = [
    `${citationLabel} — ${detail.heading}`,
    `Agency: ${detail.agency} · ${detail.industry}`,
    detail.subpartLabel && `Subpart: ${detail.subpartLabel}`,
    detail.partNumber &&
      `CFR: ${detail.cfrTitle} CFR Part ${detail.partNumber} § ${detail.sectionNumber}`,
    note?.text && `Note: ${note.text}`,
  ]
    .filter(Boolean)
    .join("\n");

  const fav = isFavorite(detail.regulationId);

  return (
    <div className="detail-pane">
      <div className="detail-scroll">
        <div className="detail-hero">
          <div className="detail-hero__actions">
            <button
              className={`star-btn star-btn--lg${fav ? " star-btn--on" : ""}`}
              title={fav ? "Remove from favorites" : "Add to favorites"}
              onClick={() => toggleFavorite(asSummary)}
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
          <div className="detail-hero__code">{citationLabel}</div>
          <div className="detail-hero__desc">{detail.heading}</div>
          <div className="detail-hero__badges">
            <span
              className={`badge ${detail.agency === "OSHA" ? "badge--osha" : "badge--msha"}`}
            >
              {detail.agency}
            </span>
            <span className="badge badge--industry">{detail.industry}</span>
          </div>
        </div>

        <div className="copy-group">
          <button
            className="copy-btn"
            onClick={() => copy("citation", citationLabel)}
          >
            Copy citation · {citationLabel}
          </button>
          <button
            className="copy-btn"
            onClick={() =>
              copy("citationHeading", `${citationLabel} ${detail.heading}`)
            }
          >
            Copy citation + heading
          </button>
          {note?.text && (
            <button
              className="copy-btn"
              onClick={() =>
                copy("citationNote", `${citationLabel}\n${note.text}`)
              }
            >
              Copy citation + note
            </button>
          )}
          <button className="copy-btn" onClick={() => copy("full", fullDetail)}>
            Copy full detail
          </button>
        </div>

        <div className="classification">
          <h3 className="classification__heading">Regulatory Hierarchy</h3>
          <ClassRow label="CFR Title" value={`${detail.cfrTitle} CFR`} />
          {detail.partNumber && (
            <ClassRow label="Part" value={`Part ${detail.partNumber}`} />
          )}
          {detail.subpartLabel && (
            <ClassRow label="Subpart" value={detail.subpartLabel} />
          )}
          {detail.sectionNumber && (
            <ClassRow label="Section" value={`§ ${detail.sectionNumber}`} />
          )}
        </div>

        {detail.body && (
          <div className="classification">
            <h3 className="classification__heading">Regulation text</h3>
            <div className="regulation-body">{detail.body}</div>
          </div>
        )}

        {relatedLoiList.length > 0 && (
          <div className="classification">
            <h3 className="classification__heading">
              Related Letters of Interpretation
              <span className="section-heading__count">
                {relatedLoiList.length}
              </span>
            </h3>
            {relatedLoiList.map((loi) => (
              <button
                key={loi.loiId}
                className="class-row class-row--btn"
                onClick={() => onNavigateToLoi?.(loi.loiId)}
                title="Open this letter"
              >
                <span className="class-row__label">{loi.issueDate}</span>
                <span className="class-row__value">{loi.title}</span>
                {onNavigateToLoi && (
                  <span className="class-row__arrow">›</span>
                )}
              </button>
            ))}
          </div>
        )}

        <NoteSection regulationId={detail.regulationId} />
      </div>

      <div className={`toast${copied ? " toast--show" : ""}`}>Copied</div>

      {addingToCollection && (
        <AddToCollectionModal
          target={{ kind: "regulation", data: asSummary }}
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

function NoteSection({ regulationId }: { regulationId: string }) {
  const { notes, setNote, deleteNote } = useAppData();
  const note = notes[regulationId];
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  // Leave edit mode when switching to a different regulation.
  useEffect(() => {
    setEditing(false);
    setDraft("");
  }, [regulationId]);

  function startEdit() {
    setDraft(note?.text ?? "");
    setEditing(true);
  }

  function save() {
    const trimmed = draft.trim();
    if (trimmed) {
      setNote(regulationId, trimmed);
    } else if (note) {
      deleteNote(regulationId);
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
            placeholder="Add a note (audit finding, training reminder, etc.)…"
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
              onClick={() => deleteNote(regulationId)}
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
