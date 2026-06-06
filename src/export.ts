import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { getRegulationDetail } from "./api";
import type { Collection, NoteMap } from "./types";

interface ExportEntry {
  citation: string;
  heading: string;
  note: string;
  agency: string;
  subpart: string;
  industry: string;
  topics: string;
}

/** Enriches collection items with the full CFR hierarchy + the saved note.
 *  Industry / topic_tags aren't stored on the collection item, so they're
 *  fetched fresh from the database at export time. LOI / chemical items are
 *  exported in a leaner shape (heading + sublabel only). */
async function buildEntries(
  c: Collection,
  notes: NoteMap,
): Promise<ExportEntry[]> {
  const details = await Promise.all(
    c.items.map((i) =>
      i.kind === "regulation"
        ? getRegulationDetail(i.id).catch(() => null)
        : Promise.resolve(null),
    ),
  );
  return c.items.map((item, idx) => {
    const d = details[idx];
    if (item.kind === "regulation" && d) {
      return {
        citation: d.citation || d.regulationId,
        heading: d.heading,
        note: notes[d.regulationId]?.text ?? "",
        agency: d.agency,
        subpart: d.subpartLabel,
        industry: d.industry,
        topics: d.topicTags.join(", "),
      };
    }
    return {
      citation: item.sublabel || item.id,
      heading: item.label,
      note: notes[item.id]?.text ?? "",
      agency: item.agency ?? "",
      subpart: "",
      industry: "",
      topics: item.kind === "regulation" ? "" : item.kind.toUpperCase(),
    };
  });
}

/** RFC 4180 quoting. */
function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

const CSV_HEADER = [
  "Citation",
  "Heading",
  "Note",
  "Agency",
  "Subpart",
  "Industry",
  "Topics",
];

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
      e.citation,
      e.heading,
      e.note,
      e.agency,
      e.subpart,
      e.industry,
      e.topics,
    ]),
  ];
  const csv = rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
  await invoke("write_text_file", { path, content: csv });
  return true;
}

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
