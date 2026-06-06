import { useEffect, useState } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { getChemicalDetail } from "../api";
import { useAppData } from "../state";
import type { ChemicalDetail, ChemicalSummary } from "../types";
import { AddToCollectionModal } from "./AddToCollectionModal";

interface Props {
  substanceName: string;
  /** Called when user taps a related CFR citation chip. */
  onNavigateToRegulation: (regulationId: string) => void;
}

export function ChemicalDetailView({
  substanceName,
  onNavigateToRegulation,
}: Props) {
  const [detail, setDetail] = useState<ChemicalDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [addingToCollection, setAddingToCollection] = useState(false);
  const { isFavoriteChemical, toggleFavoriteChemical } = useAppData();

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setDetail(null);
    getChemicalDetail(substanceName)
      .then((d) => {
        if (!active) return;
        setDetail(d);
        if (!d) setError(`Chemical "${substanceName}" was not found.`);
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
  }, [substanceName]);

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

  const asSummary: ChemicalSummary = {
    substanceName: detail.substanceName,
    oshaPelTwa: detail.oshaPelTwa,
    idlh: detail.idlh,
    isOshaCarcinogen: detail.isOshaCarcinogen,
  };

  const fav = isFavoriteChemical(detail.substanceName);

  const fullText = [
    detail.substanceName,
    detail.casNumber ? `CAS: ${detail.casNumber}` : null,
    detail.oshaPelTwa ? `OSHA PEL TWA: ${detail.oshaPelTwa}` : null,
    detail.oshaPelStel ? `OSHA PEL STEL: ${detail.oshaPelStel}` : null,
    detail.oshaPelCeiling ? `OSHA PEL Ceiling: ${detail.oshaPelCeiling}` : null,
    detail.nioshRelTwa ? `NIOSH REL TWA: ${detail.nioshRelTwa}` : null,
    detail.nioshRelStel ? `NIOSH REL STEL: ${detail.nioshRelStel}` : null,
    detail.idlh ? `IDLH: ${detail.idlh}` : null,
    detail.physicalState ? `Physical state: ${detail.physicalState}` : null,
    detail.isOshaCarcinogen ? "OSHA carcinogen: Yes" : null,
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
              onClick={() => toggleFavoriteChemical(asSummary)}
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
            {detail.npgUrl && (
              <button
                className="icon-btn"
                title="Open NIOSH Pocket Guide"
                onClick={() => openUrl(detail.npgUrl!)}
              >
                ↗
              </button>
            )}
          </div>
          <div className="detail-hero__code">{detail.substanceName}</div>
          <div className="detail-hero__badges">
            {detail.isOshaCarcinogen && (
              <span className="badge badge--carcinogen">Carcinogen</span>
            )}
            {detail.physicalState && (
              <span className="badge badge--industry">{detail.physicalState}</span>
            )}
            {detail.casNumber && (
              <span className="badge badge--cas">CAS {detail.casNumber}</span>
            )}
          </div>
        </div>

        {/* Copy */}
        <div className="copy-group">
          <button
            className="copy-btn"
            onClick={() => copy("name", detail.substanceName)}
          >
            Copy name
          </button>
          <button className="copy-btn" onClick={() => copy("full", fullText)}>
            Copy exposure limits
          </button>
        </div>

        {/* Exposure limits table */}
        <div className="classification">
          <h3 className="classification__heading">Exposure Limits</h3>
          <div className="exposure-table">
            <ExposureRow
              label="OSHA PEL TWA"
              value={detail.oshaPelTwa}
              authority="osha"
            />
            <ExposureRow
              label="OSHA PEL STEL"
              value={detail.oshaPelStel}
              authority="osha"
            />
            <ExposureRow
              label="OSHA PEL Ceiling"
              value={detail.oshaPelCeiling}
              authority="osha"
            />
            <ExposureRow
              label="NIOSH REL TWA"
              value={detail.nioshRelTwa}
              authority="niosh"
            />
            <ExposureRow
              label="NIOSH REL STEL"
              value={detail.nioshRelStel}
              authority="niosh"
            />
            <ExposureRow
              label="IDLH"
              value={detail.idlh}
              authority="idlh"
            />
          </div>
        </div>

        {/* PubChem link */}
        {detail.pubchemCid != null && (
          <div className="classification">
            <h3 className="classification__heading">External Resources</h3>
            <button
              className="class-row class-row--btn"
              onClick={() =>
                openUrl(
                  `https://pubchem.ncbi.nlm.nih.gov/compound/${detail.pubchemCid}`,
                )
              }
            >
              <span className="class-row__label">PubChem CID</span>
              <span className="class-row__value">{detail.pubchemCid}</span>
              <span className="class-row__arrow">↗</span>
            </button>
          </div>
        )}

        {/* Related CFR citations */}
        {detail.relatedCitations.length > 0 && (
          <div className="classification">
            <h3 className="classification__heading">Related CFR Citations</h3>
            <div className="chip-group">
              {detail.relatedCitations.map((cit) => {
                // citation format is e.g. "1910.1000" — build an ID
                const regId = `29-cfr-${cit}`;
                return (
                  <button
                    key={cit}
                    className="cfr-chip"
                    onClick={() => onNavigateToRegulation(regId)}
                    title={`Open 29 CFR § ${cit}`}
                  >
                    § {cit}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* NPG notes */}
        {detail.notes && (
          <div className="classification">
            <h3 className="classification__heading">NIOSH NPG Notes</h3>
            <div className="regulation-body">{detail.notes}</div>
          </div>
        )}
      </div>

      <div className={`toast${copied ? " toast--show" : ""}`}>Copied</div>

      {addingToCollection && (
        <AddToCollectionModal
          target={{ kind: "chemical", data: asSummary }}
          onClose={() => setAddingToCollection(false)}
        />
      )}
    </div>
  );
}

function ExposureRow({
  label,
  value,
  authority,
}: {
  label: string;
  value: string | null;
  authority: "osha" | "niosh" | "idlh";
}) {
  if (!value) return null;
  const cls =
    authority === "osha"
      ? "exposure-row__badge exposure-row__badge--osha"
      : authority === "niosh"
        ? "exposure-row__badge exposure-row__badge--niosh"
        : "exposure-row__badge exposure-row__badge--idlh";
  return (
    <div className="exposure-row">
      <span className={cls}>{label}</span>
      <span className="exposure-row__value">{value}</span>
    </div>
  );
}
