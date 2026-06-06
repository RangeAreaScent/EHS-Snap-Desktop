import { useEffect, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { getLoiDetail } from "../api";
import { useAppData } from "../state";
import type { LoiDetail, LoiSummary } from "../types";
import { AddToCollectionModal } from "./AddToCollectionModal";

interface Props {
  loiId: string;
  /** Called when user taps a related CFR section chip. */
  onNavigateToRegulation: (regulationId: string) => void;
}

export function LoiDetailView({ loiId, onNavigateToRegulation }: Props) {
  const [detail, setDetail] = useState<LoiDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [addingToCollection, setAddingToCollection] = useState(false);
  const { isFavoriteLoi, toggleFavoriteLoi } = useAppData();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setDetail(null);
    getLoiDetail(loiId)
      .then((d) => {
        if (!active) return;
        setDetail(d);
        if (!d) setError(`Letter "${loiId}" was not found.`);
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
  }, [loiId]);

  async function copy(label: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setTimeout(() => setCopied((c) => (c === label ? null : c)), 1600);
    } catch (e) {
      console.error("copy failed:", e);
    }
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

  const asSummary: LoiSummary = {
    loiId: detail.loiId,
    title: detail.title,
    issueDate: detail.issueDate,
    relatedSections: detail.relatedSections,
  };

  const fav = isFavoriteLoi(detail.loiId);

  const fullText = [
    detail.title,
    `Issued: ${detail.issueDate}`,
    detail.addressee ? `To: ${detail.addressee}` : null,
    detail.relatedSections.length > 0
      ? `Cites: ${detail.relatedSections.join(", ")}`
      : null,
    detail.summary ? `Summary: ${detail.summary}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div className="detail-pane">
      <div className="detail-scroll">
        {/* Hero */}
        <div className="detail-hero">
          <div className="detail-hero__actions">
            <button
              className={`star-btn star-btn--lg${fav ? " star-btn--on" : ""}`}
              title={fav ? "Remove from favorites" : "Add to favorites"}
              onClick={() => toggleFavoriteLoi(asSummary)}
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
            {detail.url && (
              <button
                className="icon-btn"
                title="Open on osha.gov"
                onClick={() => openUrl(detail.url)}
              >
                ↗
              </button>
            )}
          </div>
          <div className="detail-hero__code loi-badge">
            <span className="badge badge--loi">LOI</span>
            <span className="loi-date">{detail.issueDate}</span>
          </div>
          <div className="detail-hero__desc">{detail.title}</div>
          {detail.addressee && (
            <div className="loi-addressee">To: {detail.addressee}</div>
          )}
        </div>

        {/* Copy buttons */}
        <div className="copy-group">
          <button className="copy-btn" onClick={() => copy("title", detail.title)}>
            Copy title
          </button>
          <button className="copy-btn" onClick={() => copy("full", fullText)}>
            Copy full detail
          </button>
        </div>

        {/* Related CFR sections — clickable chips → regulation detail */}
        {detail.relatedSections.length > 0 && (
          <div className="classification">
            <h3 className="classification__heading">Related CFR Sections</h3>
            <div className="chip-group">
              {detail.relatedSections.map((sec) => (
                <button
                  key={sec}
                  className="cfr-chip"
                  onClick={() => onNavigateToRegulation(`29-cfr-${sec}`)}
                  title={`Open 29 CFR § ${sec}`}
                >
                  § {sec}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Summary */}
        {detail.summary && (
          <div className="classification">
            <h3 className="classification__heading">Summary</h3>
            <div className="regulation-body">{detail.summary}</div>
          </div>
        )}

        {/* Body — full text */}
        {detail.body && detail.body !== detail.summary && (
          <div className="classification">
            <h3 className="classification__heading">Full Letter</h3>
            <div className="regulation-body">{detail.body}</div>
          </div>
        )}
      </div>

      <div className={`toast${copied ? " toast--show" : ""}`}>Copied</div>

      {addingToCollection && (
        <AddToCollectionModal
          target={{ kind: "loi", data: asSummary }}
          onClose={() => setAddingToCollection(false)}
        />
      )}
    </div>
  );
}
