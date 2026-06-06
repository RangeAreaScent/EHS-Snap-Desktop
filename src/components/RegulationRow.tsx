import type { RegulationSummary } from "../types";

interface Props {
  item: RegulationSummary;
  selected: boolean;
  favorite: boolean;
  onSelect: () => void;
  onToggleFavorite: () => void;
}

export function RegulationRow({
  item,
  selected,
  favorite,
  onSelect,
  onToggleFavorite,
}: Props) {
  return (
    <div
      className={`code-row${selected ? " code-row--selected" : ""}`}
      data-nav-key={`reg:${item.regulationId}`}
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
          <span className="code-row__code">{item.citation || item.regulationId}</span>
          <span
            className={`badge ${item.agency === "OSHA" ? "badge--osha" : "badge--msha"}`}
          >
            {item.agency}
          </span>
        </div>
        <div className="code-row__desc">{item.heading}</div>
        {item.subpartLabel && (
          <div className="code-row__chapter">{item.subpartLabel}</div>
        )}
      </div>
      <button
        className={`star-btn${favorite ? " star-btn--on" : ""}`}
        title={favorite ? "Remove from favorites" : "Add to favorites"}
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite();
        }}
      >
        {favorite ? "★" : "☆"}
      </button>
    </div>
  );
}
