import type { ChemicalSummary } from "../types";

interface Props {
  item: ChemicalSummary;
  selected: boolean;
  favorite: boolean;
  onSelect: () => void;
}

export function ChemicalRow({ item, selected, favorite, onSelect }: Props) {
  return (
    <div
      className={`code-row${selected ? " code-row--selected" : ""}`}
      data-nav-key={`chem:${item.substanceName}`}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
    >
      <div className="code-row__main">
        <div className="code-row__top">
          <span className="code-row__code">{item.substanceName}</span>
          {item.isOshaCarcinogen && (
            <span className="badge badge--carcinogen">Carcinogen</span>
          )}
          {/* Faint star indicator — no toggle in list, done in detail pane */}
          {favorite && (
            <span
              className="star-btn star-btn--on"
              style={{ pointerEvents: "none", fontSize: 13 }}
            >
              ★
            </span>
          )}
        </div>
        <div className="code-row__desc">
          {item.oshaPelTwa ? `OSHA PEL TWA: ${item.oshaPelTwa}` : "No PEL listed"}
          {item.idlh ? `  ·  IDLH: ${item.idlh}` : ""}
        </div>
      </div>
    </div>
  );
}
