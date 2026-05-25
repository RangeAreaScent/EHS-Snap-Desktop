export interface SearchResult {
  code: string;
  description: string;
  isBillable: boolean;
  chapterDescription: string;
  blockDescription: string;
}

export interface CodeDetail {
  code: string;
  description: string;
  isBillable: boolean;
  chapterNumber: string;
  chapterDescription: string;
  blockCode: string;
  blockDescription: string;
  categoryCode: string;
  categoryDescription: string;
}

export interface Favorite {
  code: string;
  description: string;
  isBillable: boolean;
  chapterDescription: string;
  addedAt: number;
}

export interface CollectionItem {
  code: string;
  description: string;
  isBillable: boolean;
  chapterDescription: string;
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

/** Map of ICD code -> note. */
export type NoteMap = Record<string, Note>;
