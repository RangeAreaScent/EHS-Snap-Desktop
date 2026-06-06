// EHS Snap domain types — kept in lockstep with iOS' RegulationSummary /
// RegulationDetail / LOIDetail / ChemicalDetail and the Rust serde structs
// in `src-tauri/src/ehs.rs`. Field names use camelCase (camelCase rename is
// enforced on the Rust side via #[serde(rename_all = "camelCase")]).

// --------------------------------------------------------------------------
//  Enums
// --------------------------------------------------------------------------

export type Agency = "OSHA" | "MSHA";

export type Industry =
  | "General Industry"
  | "Coal Mining"
  | "Metal/Nonmetal Mining"
  | "Mine Products";

/** Segmented filter chip in the SearchView header. */
export type SearchFilter = "all" | "osha" | "msha" | "loi" | "chemicals";

// --------------------------------------------------------------------------
//  Regulation
// --------------------------------------------------------------------------

export interface RegulationSummary {
  regulationId: string;        // "29-cfr-1910.147"
  citation: string;            // "29 CFR § 1910.147"
  sectionNumber: string;       // "1910.147"
  heading: string;
  agency: Agency;
  industry: Industry;
  subpartLabel: string;        // "Subpart J" | "Part 1910"
}

export interface RegulationDetail {
  regulationId: string;
  cfrTitle: number;
  partNumber: string;
  subpart: string | null;
  subpartLabel: string;
  sectionNumber: string;
  citation: string;
  heading: string;
  body: string;
  agency: Agency;
  industry: Industry;
  topicTags: string[];
  lastAmended: string | null;
}

// --------------------------------------------------------------------------
//  Letter of Interpretation
// --------------------------------------------------------------------------

export interface LoiSummary {
  loiId: string;
  title: string;
  issueDate: string;           // ISO yyyy-MM-dd
  relatedSections: string[];   // ["1910.147", "1910.146"]
}

export interface LoiDetail {
  loiId: string;
  title: string;
  issueDate: string;
  addressee: string | null;
  summary: string;
  body: string;
  relatedSections: string[];
  url: string;
}

// --------------------------------------------------------------------------
//  Chemical
// --------------------------------------------------------------------------

export interface ChemicalSummary {
  substanceName: string;
  oshaPelTwa: string | null;
  idlh: string | null;
  isOshaCarcinogen: boolean;
}

export interface ChemicalDetail {
  substanceName: string;
  casNumber: string | null;
  pubchemCid: number | null;
  oshaPelTwa: string | null;
  oshaPelStel: string | null;
  oshaPelCeiling: string | null;
  nioshRelTwa: string | null;
  nioshRelStel: string | null;
  idlh: string | null;
  physicalState: string | null;
  notes: string | null;
  npgUrl: string | null;
  isOshaCarcinogen: boolean;
  relatedCitations: string[];
}

// --------------------------------------------------------------------------
//  Persistence (favorites / collections / notes — desktop only, never synced)
// --------------------------------------------------------------------------

/** A user-favorited regulation snapshot. Indexed by `regulationId`. */
export interface FavoriteRegulation {
  regulationId: string;
  citation: string;
  heading: string;
  agency: Agency;
  subpartLabel: string;
  addedAt: number;
}

export interface FavoriteLoi {
  loiId: string;
  title: string;
  issueDate: string;
  addedAt: number;
}

export interface FavoriteChemical {
  substanceName: string;
  oshaPelTwa: string | null;
  idlh: string | null;
  isOshaCarcinogen: boolean;
  addedAt: number;
}

/** Item inside a collection — flattened union over the three entity kinds. */
export type CollectionItemKind = "regulation" | "loi" | "chemical";

export interface CollectionItem {
  kind: CollectionItemKind;
  /** Unique within the collection — regulationId / loiId / substanceName. */
  id: string;
  /** Display heading / title / substance name. */
  label: string;
  /** Secondary display (citation / issue date / PEL). */
  sublabel: string;
  agency: Agency | null;
  addedAt: number;
}

export interface Collection {
  id: string;
  name: string;
  emoji: string;
  createdAt: number;
  items: CollectionItem[];
}

export interface Note {
  text: string;
  editedAt: number;
}

/** Map of regulationId -> note. */
export type NoteMap = Record<string, Note>;

/**
 * What's currently open in the right-pane detail view.
 * `null` = nothing selected (empty placeholder state).
 */
export type SelectedItem =
  | { kind: "regulation"; id: string }
  | { kind: "loi"; id: string }
  | { kind: "chemical"; name: string }
  | null;

/** Stable `data-nav-key` for a SelectedItem — keeps the three entity-kind
 * keyspaces disjoint so keyboard navigation never picks the wrong row.
 * Mirror the same prefixing in `*Row.tsx` `data-nav-key` attributes. */
export function selectedItemKey(item: SelectedItem): string | null {
  if (!item) return null;
  if (item.kind === "regulation") return `reg:${item.id}`;
  if (item.kind === "loi") return `loi:${item.id}`;
  return `chem:${item.name}`;
}

// Discriminated union for the unified Recent list.
export type RecentItem =
  | { kind: "regulation"; payload: RegulationSummary; touchedAt: number }
  | { kind: "loi"; payload: LoiSummary; touchedAt: number }
  | { kind: "chemical"; payload: ChemicalSummary; touchedAt: number };
