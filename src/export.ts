import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { getCodeDetail } from "./api";
import type { Collection, NoteMap } from "./types";

interface ExportEntry {
  code: string;
  description: string;
  note: string;
  billable: string;
  chapter: string;
  block: string;
  category: string;
}

/** Enriches collection items with full CDC classification + the saved note.
 *  Block/category aren't stored on the collection item, so they're fetched
 *  fresh from the database at export time. */
async function buildEntries(
  c: Collection,
  notes: NoteMap,
): Promise<ExportEntry[]> {
  const details = await Promise.all(
    c.items.map((i) => getCodeDetail(i.code).catch(() => null)),
  );
  return c.items.map((item, idx) => {
    const d = details[idx];
    return {
      code: item.code,
      description: d?.description ?? item.description,
      note: notes[item.code]?.text ?? "",
      billable: (d?.isBillable ?? item.isBillable) ? "Yes" : "No",
      chapter: d?.chapterDescription ?? item.chapterDescription,
      block: d?.blockDescription ?? "",
      category: d?.categoryDescription ?? "",
    };
  });
}

/** RFC 4180 quoting. */
function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

const CSV_HEADER = [
  "Code",
  "Description",
  "Note",
  "Billable",
  "Chapter",
  "Block",
  "Category",
];

/** Opens a native save dialog and writes the collection as CSV.
 *  Returns false if the user cancelled. */
export async function exportCollectionCSV(
  c: Collection,
  notes: NoteMap,
): Promise<boolean> {
  const path = await save({
    defaultPath: `${c.name}.csv`,
    filters: [{ name: "CSV", extensions: ["csv"] }],
  });
  if (!path) return false;

  const entries = await buildEntries(c, notes);
  const rows = [
    CSV_HEADER,
    ...entries.map((e) => [
      e.code,
      e.description,
      e.note,
      e.billable,
      e.chapter,
      e.block,
      e.category,
    ]),
  ];
  const csv = rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
  await invoke("write_text_file", { path, content: csv });
  return true;
}

/** Opens a native save dialog and writes the collection as a PDF
 *  (generated natively in Rust). Returns false if the user cancelled. */
export async function exportCollectionPDF(
  c: Collection,
  notes: NoteMap,
): Promise<boolean> {
  const path = await save({
    defaultPath: `${c.name}.pdf`,
    filters: [{ name: "PDF", extensions: ["pdf"] }],
  });
  if (!path) return false;

  const entries = await buildEntries(c, notes);
  await invoke("export_pdf", { path, title: c.name, entries });
  return true;
}
