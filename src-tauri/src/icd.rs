//! Read-only access to the bundled ICD-10-CM SQLite database.

use crate::abbreviations;
use rusqlite::{Connection, OpenFlags};
use serde::Serialize;
use std::collections::HashSet;
use std::path::Path;

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    pub code: String,
    pub description: String,
    pub is_billable: bool,
    pub chapter_description: String,
    pub block_description: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CodeDetail {
    pub code: String,
    pub description: String,
    pub is_billable: bool,
    pub chapter_number: String,
    pub chapter_description: String,
    pub block_code: String,
    pub block_description: String,
    pub category_code: String,
    pub category_description: String,
}

/// Opens a fresh read-only connection. Cheap (just a file handle) and avoids
/// any shared-state locking — each lookup is fully independent.
fn open(db_path: &Path) -> Result<Connection, String> {
    Connection::open_with_flags(
        db_path,
        OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX,
    )
    .map_err(|e| format!("failed to open ICD database: {e}"))
}

/// Builds an injection-safe FTS5 MATCH expression: alphanumeric tokens of
/// length >= 2, each wrapped as a quoted prefix term, joined by space (AND).
fn make_fts_query(expanded: &str) -> String {
    expanded
        .split(|c: char| !c.is_alphanumeric())
        .filter(|t| t.chars().count() >= 2)
        .map(|t| format!("\"{t}\"*"))
        .collect::<Vec<_>>()
        .join(" ")
}

pub fn search(db_path: &Path, query: &str, limit: usize) -> Result<Vec<SearchResult>, String> {
    let trimmed = query.trim();
    if trimmed.is_empty() {
        return Ok(Vec::new());
    }

    let conn = open(db_path)?;
    let expanded = abbreviations::expand(trimmed);
    let fts_query = make_fts_query(&expanded);
    let code_prefix = format!("{}%", trimmed.to_uppercase());
    let code_budget = limit.min(20) as i64;
    let fts_budget = limit.max(50) as i64;

    let mut seen: HashSet<String> = HashSet::new();
    let mut results: Vec<SearchResult> = Vec::with_capacity(limit);

    // 1. Code-prefix matches (e.g. "I10" -> I10, I10.x ...).
    {
        let mut stmt = conn
            .prepare(
                "SELECT code, description, is_billable, \
                 chapter_description, block_description \
                 FROM codes \
                 WHERE is_billable = 1 AND code LIKE ?1 \
                 ORDER BY length(code), code \
                 LIMIT ?2",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(rusqlite::params![code_prefix, code_budget], map_search_row)
            .map_err(|e| e.to_string())?;
        for row in rows {
            let r = row.map_err(|e| e.to_string())?;
            if seen.insert(r.code.clone()) {
                results.push(r);
            }
        }
    }

    // 2. FTS5 full-text matches on the description.
    if !fts_query.is_empty() && results.len() < limit {
        let mut stmt = conn
            .prepare(
                "SELECT c.code, c.description, c.is_billable, \
                 c.chapter_description, c.block_description \
                 FROM codes_fts f \
                 JOIN codes c ON f.rowid = c.rowid \
                 WHERE codes_fts MATCH ?1 AND c.is_billable = 1 \
                 ORDER BY rank \
                 LIMIT ?2",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map(rusqlite::params![fts_query, fts_budget], map_search_row)
            .map_err(|e| e.to_string())?;
        for row in rows {
            let r = row.map_err(|e| e.to_string())?;
            if seen.insert(r.code.clone()) {
                results.push(r);
                if results.len() >= limit {
                    break;
                }
            }
        }
    }

    Ok(results)
}

pub fn fetch_detail(db_path: &Path, code: &str) -> Result<Option<CodeDetail>, String> {
    let conn = open(db_path)?;
    let mut stmt = conn
        .prepare(
            "SELECT code, description, is_billable, chapter_number, \
             chapter_description, block_code, block_description, \
             category_code, category_description \
             FROM codes WHERE code = ?1",
        )
        .map_err(|e| e.to_string())?;
    let mut rows = stmt
        .query_map(rusqlite::params![code], |row| {
            Ok(CodeDetail {
                code: row.get(0)?,
                description: row.get(1)?,
                is_billable: row.get::<_, i64>(2)? == 1,
                chapter_number: row.get::<_, Option<String>>(3)?.unwrap_or_default(),
                chapter_description: row.get::<_, Option<String>>(4)?.unwrap_or_default(),
                block_code: row.get::<_, Option<String>>(5)?.unwrap_or_default(),
                block_description: row.get::<_, Option<String>>(6)?.unwrap_or_default(),
                category_code: row.get::<_, Option<String>>(7)?.unwrap_or_default(),
                category_description: row.get::<_, Option<String>>(8)?.unwrap_or_default(),
            })
        })
        .map_err(|e| e.to_string())?;
    match rows.next() {
        Some(r) => Ok(Some(r.map_err(|e| e.to_string())?)),
        None => Ok(None),
    }
}

fn map_search_row(row: &rusqlite::Row) -> rusqlite::Result<SearchResult> {
    Ok(SearchResult {
        code: row.get(0)?,
        description: row.get(1)?,
        is_billable: row.get::<_, i64>(2)? == 1,
        chapter_description: row.get::<_, Option<String>>(3)?.unwrap_or_default(),
        block_description: row.get::<_, Option<String>>(4)?.unwrap_or_default(),
    })
}
