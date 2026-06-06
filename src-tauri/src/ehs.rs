//! Read-only access to the bundled EHS Snap SQLite database.
//!
//! Three searchable entities live side-by-side in `ehs_snap_v1.sqlite`:
//!
//! * `safety_regulations` (+ `safety_fts`)        — 29 CFR 1910 + 30 CFR
//! * `regulatory_loi`     (+ `loi_fts`)           — OSHA Letters of Interpretation
//! * `chemical_exposure_limits` (+ `chemical_fts`) — NIOSH NPG / OSHA PEL / IDLH
//!
//! Each lookup opens its own short-lived read-only connection (cheap,
//! mutex-free) so concurrent IPC calls don't serialize.

use crate::abbreviations;
use rusqlite::{Connection, OpenFlags};
use serde::Serialize;
use std::collections::HashSet;
use std::path::Path;

// --------------------------------------------------------------------------
//  Regulation
// --------------------------------------------------------------------------

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RegulationSummary {
    pub regulation_id: String,
    pub citation: String,
    pub section_number: String,
    pub heading: String,
    pub agency: String,         // "OSHA" | "MSHA"
    pub industry: String,       // "General Industry" | "Coal Mining" | …
    pub subpart_label: String,  // "Subpart J" or "Part 1910"
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RegulationDetail {
    pub regulation_id: String,
    pub cfr_title: i64,
    pub part_number: String,
    pub subpart: Option<String>,
    pub subpart_label: String,
    pub section_number: String,
    pub citation: String,
    pub heading: String,
    pub body: String,
    pub agency: String,
    pub industry: String,
    pub topic_tags: Vec<String>,
    pub last_amended: Option<String>,
}

// --------------------------------------------------------------------------
//  Letter of Interpretation
// --------------------------------------------------------------------------

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LoiSummary {
    pub loi_id: String,
    pub title: String,
    pub issue_date: String,
    pub related_sections: Vec<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct LoiDetail {
    pub loi_id: String,
    pub title: String,
    pub issue_date: String,
    pub addressee: Option<String>,
    pub summary: String,
    pub body: String,
    pub related_sections: Vec<String>,
    pub url: String,
}

// --------------------------------------------------------------------------
//  Chemical
// --------------------------------------------------------------------------

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ChemicalSummary {
    pub substance_name: String,
    pub osha_pel_twa: Option<String>,
    pub idlh: Option<String>,
    pub is_osha_carcinogen: bool,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ChemicalDetail {
    pub substance_name: String,
    pub cas_number: Option<String>,
    pub pubchem_cid: Option<i64>,
    pub osha_pel_twa: Option<String>,
    pub osha_pel_stel: Option<String>,
    pub osha_pel_ceiling: Option<String>,
    pub niosh_rel_twa: Option<String>,
    pub niosh_rel_stel: Option<String>,
    pub idlh: Option<String>,
    pub physical_state: Option<String>,
    pub notes: Option<String>,
    pub npg_url: Option<String>,
    pub is_osha_carcinogen: bool,
    pub related_citations: Vec<String>,
}

// --------------------------------------------------------------------------
//  Connection / helpers
// --------------------------------------------------------------------------

fn open(db_path: &Path) -> Result<Connection, String> {
    Connection::open_with_flags(
        db_path,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .map_err(|e| format!("failed to open EHS database: {e}"))
}

/// Injection-safe FTS5 MATCH expression: alphanumeric tokens of length >= 2,
/// each wrapped as a quoted prefix term, joined by space (AND).
fn make_fts_query(expanded: &str) -> String {
    expanded
        .split(|c: char| !c.is_alphanumeric())
        .filter(|t| t.chars().count() >= 2)
        .map(|t| format!("\"{t}\"*"))
        .collect::<Vec<_>>()
        .join(" ")
}

fn split_csv(raw: Option<String>) -> Vec<String> {
    raw.unwrap_or_default()
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect()
}

fn subpart_label(subpart: &Option<String>, part_number: &str) -> String {
    match subpart {
        Some(s) if !s.is_empty() => format!("Subpart {s}"),
        _ => format!("Part {part_number}"),
    }
}

// --------------------------------------------------------------------------
//  Regulation queries
// --------------------------------------------------------------------------

/// `agency_filter`:
///   `Some("OSHA")` / `Some("MSHA")` — limit to that administering agency.
///   `None` — both.
pub fn search_regulations(
    db_path: &Path,
    query: &str,
    limit: usize,
    agency_filter: Option<&str>,
) -> Result<Vec<RegulationSummary>, String> {
    let trimmed = query.trim();
    if trimmed.is_empty() {
        return Ok(Vec::new());
    }

    let conn = open(db_path)?;
    let expanded = abbreviations::expand(trimmed);
    let fts_query = make_fts_query(&expanded);

    // Citation-prefix matches first ("1910.147" / "29 CFR" etc.).
    let prefix = format!("%{}%", trimmed.replace('%', ""));
    let citation_budget = limit.min(20) as i64;
    let fts_budget = limit.max(50) as i64;

    let mut seen: HashSet<String> = HashSet::new();
    let mut results: Vec<RegulationSummary> = Vec::with_capacity(limit);

    // 1. Section-number / citation prefix matches.
    let (sql_citation, agency_arg): (String, Option<String>) = match agency_filter {
        Some(a) => (
            "SELECT id, citation, section_number, heading, administering_agency, \
                    COALESCE(industry, 'General Industry'), subpart, part_number \
             FROM safety_regulations \
             WHERE (section_number LIKE ?1 OR citation LIKE ?1) \
             AND administering_agency = ?2 \
             ORDER BY length(section_number), section_number \
             LIMIT ?3"
                .to_string(),
            Some(a.to_string()),
        ),
        None => (
            "SELECT id, citation, section_number, heading, administering_agency, \
                    COALESCE(industry, 'General Industry'), subpart, part_number \
             FROM safety_regulations \
             WHERE section_number LIKE ?1 OR citation LIKE ?1 \
             ORDER BY length(section_number), section_number \
             LIMIT ?2"
                .to_string(),
            None,
        ),
    };
    {
        let mut stmt = conn.prepare(&sql_citation).map_err(|e| e.to_string())?;
        let rows = match &agency_arg {
            Some(a) => stmt.query_map(rusqlite::params![prefix, a, citation_budget], map_reg_row)
                .map_err(|e| e.to_string())?
                .collect::<Vec<_>>(),
            None => stmt.query_map(rusqlite::params![prefix, citation_budget], map_reg_row)
                .map_err(|e| e.to_string())?
                .collect::<Vec<_>>(),
        };
        for row in rows {
            let r = row.map_err(|e| e.to_string())?;
            if seen.insert(r.regulation_id.clone()) {
                results.push(r);
            }
        }
    }

    // 2. FTS5 full-text fallback.
    if !fts_query.is_empty() && results.len() < limit {
        let (sql_fts, _) = match agency_filter {
            Some(_) => (
                "SELECT s.id, s.citation, s.section_number, s.heading, s.administering_agency, \
                        COALESCE(s.industry, 'General Industry'), s.subpart, s.part_number \
                 FROM safety_fts f \
                 JOIN safety_regulations s ON f.rowid = s.rowid \
                 WHERE safety_fts MATCH ?1 AND s.administering_agency = ?2 \
                 ORDER BY rank \
                 LIMIT ?3"
                    .to_string(),
                (),
            ),
            None => (
                "SELECT s.id, s.citation, s.section_number, s.heading, s.administering_agency, \
                        COALESCE(s.industry, 'General Industry'), s.subpart, s.part_number \
                 FROM safety_fts f \
                 JOIN safety_regulations s ON f.rowid = s.rowid \
                 WHERE safety_fts MATCH ?1 \
                 ORDER BY rank \
                 LIMIT ?2"
                    .to_string(),
                (),
            ),
        };

        let mut stmt = conn.prepare(&sql_fts).map_err(|e| e.to_string())?;
        let rows = match &agency_arg {
            Some(a) => stmt.query_map(rusqlite::params![fts_query, a, fts_budget], map_reg_row)
                .map_err(|e| e.to_string())?
                .collect::<Vec<_>>(),
            None => stmt.query_map(rusqlite::params![fts_query, fts_budget], map_reg_row)
                .map_err(|e| e.to_string())?
                .collect::<Vec<_>>(),
        };
        for row in rows {
            let r = row.map_err(|e| e.to_string())?;
            if seen.insert(r.regulation_id.clone()) {
                results.push(r);
                if results.len() >= limit {
                    break;
                }
            }
        }
    }

    Ok(results)
}

pub fn fetch_regulation_detail(
    db_path: &Path,
    regulation_id: &str,
) -> Result<Option<RegulationDetail>, String> {
    let conn = open(db_path)?;
    let mut stmt = conn
        .prepare(
            "SELECT id, cfr_title, part_number, subpart, section_number, citation, heading, \
                    body, administering_agency, COALESCE(industry, 'General Industry'), \
                    COALESCE(topic_tags, ''), last_amended \
             FROM safety_regulations WHERE id = ?1",
        )
        .map_err(|e| e.to_string())?;
    let mut rows = stmt
        .query_map(rusqlite::params![regulation_id], |row| {
            let subpart: Option<String> = row.get(3)?;
            let part_number: String = row.get(2)?;
            let topic_tags_raw: String = row.get(10)?;
            let topic_tags: Vec<String> = topic_tags_raw
                .split(',')
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect();
            Ok(RegulationDetail {
                regulation_id: row.get(0)?,
                cfr_title: row.get(1)?,
                subpart_label: subpart_label(&subpart, &part_number),
                part_number,
                subpart,
                section_number: row.get(4)?,
                citation: row.get(5)?,
                heading: row.get(6)?,
                body: row.get(7)?,
                agency: row.get(8)?,
                industry: row.get(9)?,
                topic_tags,
                last_amended: row.get(11)?,
            })
        })
        .map_err(|e| e.to_string())?;
    match rows.next() {
        Some(r) => Ok(Some(r.map_err(|e| e.to_string())?)),
        None => Ok(None),
    }
}

fn map_reg_row(row: &rusqlite::Row) -> rusqlite::Result<RegulationSummary> {
    let subpart: Option<String> = row.get(6)?;
    let part_number: String = row.get(7)?;
    Ok(RegulationSummary {
        regulation_id: row.get(0)?,
        citation: row.get(1)?,
        section_number: row.get(2)?,
        heading: row.get(3)?,
        agency: row.get(4)?,
        industry: row.get(5)?,
        subpart_label: subpart_label(&subpart, &part_number),
    })
}

// --------------------------------------------------------------------------
//  LOI queries
// --------------------------------------------------------------------------

pub fn search_lois(
    db_path: &Path,
    query: &str,
    limit: usize,
) -> Result<Vec<LoiSummary>, String> {
    let trimmed = query.trim();
    if trimmed.is_empty() {
        return Ok(Vec::new());
    }
    let conn = open(db_path)?;
    let expanded = abbreviations::expand(trimmed);
    let fts_query = make_fts_query(&expanded);
    if fts_query.is_empty() {
        return Ok(Vec::new());
    }

    let mut stmt = conn
        .prepare(
            "SELECT l.loi_id, l.title, l.issue_date, COALESCE(l.related_sections, '') \
             FROM loi_fts f JOIN regulatory_loi l ON f.rowid = l.rowid \
             WHERE loi_fts MATCH ?1 \
             ORDER BY rank \
             LIMIT ?2",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(rusqlite::params![fts_query, limit as i64], |row| {
            Ok(LoiSummary {
                loi_id: row.get(0)?,
                title: row.get(1)?,
                issue_date: row.get(2)?,
                related_sections: split_csv(Some(row.get::<_, String>(3)?)),
            })
        })
        .map_err(|e| e.to_string())?;

    let mut out = Vec::with_capacity(limit);
    for r in rows {
        out.push(r.map_err(|e| e.to_string())?);
    }
    Ok(out)
}

pub fn fetch_loi_detail(db_path: &Path, loi_id: &str) -> Result<Option<LoiDetail>, String> {
    let conn = open(db_path)?;
    let mut stmt = conn
        .prepare(
            "SELECT loi_id, title, issue_date, addressee, summary, body, \
                    COALESCE(related_sections, ''), url \
             FROM regulatory_loi WHERE loi_id = ?1",
        )
        .map_err(|e| e.to_string())?;
    let mut rows = stmt
        .query_map(rusqlite::params![loi_id], |row| {
            Ok(LoiDetail {
                loi_id: row.get(0)?,
                title: row.get(1)?,
                issue_date: row.get(2)?,
                addressee: row.get(3)?,
                summary: row.get(4)?,
                body: row.get(5)?,
                related_sections: split_csv(Some(row.get::<_, String>(6)?)),
                url: row.get(7)?,
            })
        })
        .map_err(|e| e.to_string())?;
    match rows.next() {
        Some(r) => Ok(Some(r.map_err(|e| e.to_string())?)),
        None => Ok(None),
    }
}

/// LOIs that reference `section_number` (e.g. "1910.147") in their
/// `related_sections` CSV column. Drives the RegulationDetailView
/// "Related Letters of Interpretation" panel.
pub fn related_lois_for_section(
    db_path: &Path,
    section_number: &str,
    limit: usize,
) -> Result<Vec<LoiSummary>, String> {
    let conn = open(db_path)?;
    let pattern = format!("%{section_number}%");
    let mut stmt = conn
        .prepare(
            "SELECT loi_id, title, issue_date, COALESCE(related_sections, '') \
             FROM regulatory_loi \
             WHERE related_sections LIKE ?1 \
             ORDER BY issue_date DESC \
             LIMIT ?2",
        )
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map(rusqlite::params![pattern, limit as i64], |row| {
            Ok(LoiSummary {
                loi_id: row.get(0)?,
                title: row.get(1)?,
                issue_date: row.get(2)?,
                related_sections: split_csv(Some(row.get::<_, String>(3)?)),
            })
        })
        .map_err(|e| e.to_string())?;

    let mut out = Vec::with_capacity(limit);
    for r in rows {
        let loi = r.map_err(|e| e.to_string())?;
        if loi.related_sections.iter().any(|s| s == section_number) {
            out.push(loi);
        }
    }
    Ok(out)
}

// --------------------------------------------------------------------------
//  Chemical queries
// --------------------------------------------------------------------------

pub fn search_chemicals(
    db_path: &Path,
    query: &str,
    limit: usize,
) -> Result<Vec<ChemicalSummary>, String> {
    let trimmed = query.trim();
    if trimmed.is_empty() {
        return Ok(Vec::new());
    }
    let conn = open(db_path)?;

    // 1. Name-prefix matches first (fast, intuitive ordering).
    let prefix = format!("{}%", trimmed);
    let mut seen: HashSet<String> = HashSet::new();
    let mut results: Vec<ChemicalSummary> = Vec::with_capacity(limit);
    {
        let mut stmt = conn
            .prepare(
                "SELECT substance_name, osha_pel_twa, idlh, is_osha_carcinogen \
                 FROM chemical_exposure_limits \
                 WHERE substance_name LIKE ?1 \
                 ORDER BY length(substance_name), substance_name \
                 LIMIT ?2",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(rusqlite::params![prefix, limit.min(20) as i64], map_chem_row)
            .map_err(|e| e.to_string())?;
        for row in rows {
            let c = row.map_err(|e| e.to_string())?;
            if seen.insert(c.substance_name.clone()) {
                results.push(c);
            }
        }
    }

    // 2. FTS fallback (name + notes, e.g. CAS lookup via notes).
    let fts_query = make_fts_query(trimmed);
    if !fts_query.is_empty() && results.len() < limit {
        let mut stmt = conn
            .prepare(
                "SELECT c.substance_name, c.osha_pel_twa, c.idlh, c.is_osha_carcinogen \
                 FROM chemical_fts f JOIN chemical_exposure_limits c ON f.rowid = c.rowid \
                 WHERE chemical_fts MATCH ?1 \
                 ORDER BY rank \
                 LIMIT ?2",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(rusqlite::params![fts_query, limit as i64], map_chem_row)
            .map_err(|e| e.to_string())?;
        for row in rows {
            let c = row.map_err(|e| e.to_string())?;
            if seen.insert(c.substance_name.clone()) {
                results.push(c);
                if results.len() >= limit {
                    break;
                }
            }
        }
    }

    Ok(results)
}

pub fn fetch_chemical_detail(
    db_path: &Path,
    substance_name: &str,
) -> Result<Option<ChemicalDetail>, String> {
    let conn = open(db_path)?;
    let mut stmt = conn
        .prepare(
            "SELECT substance_name, cas_number, pubchem_cid, osha_pel_twa, osha_pel_stel, \
                    osha_pel_ceiling, niosh_rel_twa, niosh_rel_stel, idlh, physical_state, \
                    notes, npg_url, is_osha_carcinogen, COALESCE(related_citations, '') \
             FROM chemical_exposure_limits WHERE substance_name = ?1",
        )
        .map_err(|e| e.to_string())?;
    let mut rows = stmt
        .query_map(rusqlite::params![substance_name], |row| {
            Ok(ChemicalDetail {
                substance_name: row.get(0)?,
                cas_number: row.get(1)?,
                pubchem_cid: row.get(2)?,
                osha_pel_twa: row.get(3)?,
                osha_pel_stel: row.get(4)?,
                osha_pel_ceiling: row.get(5)?,
                niosh_rel_twa: row.get(6)?,
                niosh_rel_stel: row.get(7)?,
                idlh: row.get(8)?,
                physical_state: row.get(9)?,
                notes: row.get(10)?,
                npg_url: row.get(11)?,
                is_osha_carcinogen: row.get::<_, i64>(12)? == 1,
                related_citations: split_csv(Some(row.get::<_, String>(13)?)),
            })
        })
        .map_err(|e| e.to_string())?;
    match rows.next() {
        Some(r) => Ok(Some(r.map_err(|e| e.to_string())?)),
        None => Ok(None),
    }
}

fn map_chem_row(row: &rusqlite::Row) -> rusqlite::Result<ChemicalSummary> {
    Ok(ChemicalSummary {
        substance_name: row.get(0)?,
        osha_pel_twa: row.get(1)?,
        idlh: row.get(2)?,
        is_osha_carcinogen: row.get::<_, i64>(3)? == 1,
    })
}
