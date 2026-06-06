import { invoke } from "@tauri-apps/api/core";
import type {
  ChemicalDetail,
  ChemicalSummary,
  LoiDetail,
  LoiSummary,
  RegulationDetail,
  RegulationSummary,
} from "./types";

// --------------------------------------------------------------------------
//  Regulations
// --------------------------------------------------------------------------

export function searchRegulations(
  query: string,
  limit = 50,
  agency: "OSHA" | "MSHA" | null = null,
): Promise<RegulationSummary[]> {
  return invoke<RegulationSummary[]>("search_regulations", {
    query,
    limit,
    agency,
  });
}

export function getRegulationDetail(
  regulationId: string,
): Promise<RegulationDetail | null> {
  return invoke<RegulationDetail | null>("get_regulation_detail", {
    regulationId,
  });
}

export function relatedLois(
  sectionNumber: string,
  limit = 8,
): Promise<LoiSummary[]> {
  return invoke<LoiSummary[]>("related_lois", { sectionNumber, limit });
}

// --------------------------------------------------------------------------
//  LOIs
// --------------------------------------------------------------------------

export function searchLois(query: string, limit = 50): Promise<LoiSummary[]> {
  return invoke<LoiSummary[]>("search_lois", { query, limit });
}

export function getLoiDetail(loiId: string): Promise<LoiDetail | null> {
  return invoke<LoiDetail | null>("get_loi_detail", { loiId });
}

// --------------------------------------------------------------------------
//  Chemicals
// --------------------------------------------------------------------------

export function searchChemicals(
  query: string,
  limit = 50,
): Promise<ChemicalSummary[]> {
  return invoke<ChemicalSummary[]>("search_chemicals", { query, limit });
}

export function getChemicalDetail(
  substanceName: string,
): Promise<ChemicalDetail | null> {
  return invoke<ChemicalDetail | null>("get_chemical_detail", {
    substanceName,
  });
}

// --------------------------------------------------------------------------
//  Atomic JSON document store (shared shell)
// --------------------------------------------------------------------------

export async function storeRead<T>(name: string): Promise<T | null> {
  const raw = await invoke<string | null>("store_read", { name });
  if (raw == null) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function storeWrite(name: string, value: unknown): Promise<void> {
  return invoke<void>("store_write", {
    name,
    content: JSON.stringify(value),
  });
}
