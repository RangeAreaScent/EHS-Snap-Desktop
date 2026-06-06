import type { LoiSummary } from "../types";

interface Props {
  item: LoiSummary;
  selected: boolean;
  favorite: boolean;
  onSelect: () => void;
  onToggleFavorite: () => void;
}

export function LoiRow({
  item,
  selected,
  favorite,
  onSelect,
  onToggleFavorite,
}: Props) {
  return (
    <div
      className={`code-row${selected ? " code-row--selected" : ""}`}
      data-nav-key={`loi:${item.loiId}`}
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
          <span className="badge badge--loi">LOI</span>
          <span className="code-row__chapter">{item.issueDate}</span>
        </div>
        <div className="code-row__desc">{item.title}</div>
        {item.relatedSections.length > 0 && (
          <div className="code-row__chapter">
            cites: {item.relatedSections.slice(0, 4).join(" · ")}
            {item.relatedSections.length > 4 ? " · …" : ""}
          </div>
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
