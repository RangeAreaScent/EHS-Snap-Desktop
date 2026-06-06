//! EHS-domain shortcut expansion. Each expansion is chosen so the resulting
//! phrase appears verbatim in at least one regulation heading, LOI title, or
//! chemical-notes blob in `ehs_snap_v1.sqlite` — otherwise FTS5 would silently
//! return zero hits.
//!
//! Mirror this dictionary on the iOS side (`EHSSnap/Data/`) whenever entries
//! are added or renamed.

/// (abbreviation, expansion) pairs. Lookup keys are uppercased.
const DICTIONARY: &[(&str, &str)] = &[
    // Process safety / general industry
    ("LOTO", "lockout tagout"),
    ("HAZWOPER", "hazardous waste operations emergency response"),
    ("HAZCOM", "hazard communication"),
    ("GHS", "globally harmonized system"),
    ("SDS", "safety data sheet"),
    ("MSDS", "safety data sheet"),
    ("PSM", "process safety management"),
    ("CSE", "confined space"),
    ("PRCS", "permit required confined space"),
    ("PIT", "powered industrial truck"),
    ("MOC", "management of change"),
    ("JSA", "job safety analysis"),
    ("JHA", "job hazard analysis"),
    // PPE
    ("PPE", "personal protective equipment"),
    ("APR", "air purifying respirator"),
    ("PAPR", "powered air purifying respirator"),
    ("SCBA", "self contained breathing apparatus"),
    ("FAS", "fall arrest"),
    ("PFAS", "personal fall arrest"),
    // Health / IH
    ("PEL", "permissible exposure limit"),
    ("REL", "recommended exposure limit"),
    ("TLV", "threshold limit value"),
    ("TWA", "time weighted average"),
    ("STEL", "short term exposure limit"),
    ("IDLH", "immediately dangerous to life"),
    ("AL",  "action level"),
    ("CMR", "carcinogen mutagen"),
    // Construction / fall
    ("OSHA", "occupational safety health"),
    ("MSHA", "mine safety health"),
    ("NIOSH", "national institute occupational safety"),
    ("EAP", "emergency action plan"),
    ("FPP", "fire prevention"),
    ("ERP", "emergency response"),
    // Mining
    ("MNM", "metal nonmetal"),
    ("DPM", "diesel particulate"),
    ("RCS", "respirable crystalline silica"),
    // Common field terms (not acronyms, but alias mapping)
    ("FORKLIFT",   "powered industrial truck"),
    // Chemical shortcuts (used in chemical_fts notes)
    ("CO",   "carbon monoxide"),
    ("CO2",  "carbon dioxide"),
    ("H2S",  "hydrogen sulfide"),
    ("HCN",  "hydrogen cyanide"),
    ("VOC",  "volatile organic"),
    ("NIOSHNPG", "pocket guide"),
];

/// Expands shorthand tokens in `query` to their full phrase.
///
/// Each token is checked against the dictionary. A matching token is
/// **replaced** by its expansion (not appended alongside it). This avoids the
/// AND-semantics trap: keeping the original abbreviation as a required FTS5
/// prefix term means a document must contain both "LOTO" and "lockout" and
/// "tagout" — but most regulations only spell out the full phrase, not the
/// acronym. Replacing ensures the expansion words are the FTS5 AND terms,
/// which appear in the regulation body. Non-matching tokens pass through as-is.
///
/// Example: "LOTO program" → "lockout tagout program"
///          "1910.147"    → "1910.147"  (no match, unchanged)
pub fn expand(query: &str) -> String {
    let mut out = String::with_capacity(query.len() * 2);
    for token in query.split(|c: char| !c.is_alphanumeric()) {
        if token.is_empty() {
            continue;
        }
        let upper = token.to_uppercase();
        let expansion = DICTIONARY.iter().find(|(a, _)| *a == upper.as_str()).map(|(_, e)| *e);
        if !out.is_empty() {
            out.push(' ');
        }
        out.push_str(expansion.unwrap_or(token));
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn loto_replaces_not_appends() {
        let q = expand("LOTO program");
        let lc = q.to_lowercase();
        // expansion present
        assert!(lc.contains("lockout tagout"), "got: {q}");
        // original abbreviation must NOT be kept (replace, not append)
        assert!(!lc.contains("loto"), "expected LOTO replaced, got: {q}");
    }

    #[test]
    fn psm_replaces() {
        let q = expand("PSM");
        let lc = q.to_lowercase();
        assert!(lc.contains("process safety management"), "got: {q}");
        assert!(!lc.contains("psm"), "expected PSM replaced, got: {q}");
    }

    #[test]
    fn citation_passes_through_unchanged() {
        // FTS builder must still see "1910" / "147" as tokens.
        let q = expand("1910.147");
        assert!(q.contains("1910"), "got: {q}");
        assert!(q.contains("147"), "got: {q}");
    }

    #[test]
    fn unknown_token_no_op() {
        assert_eq!(expand("hello world"), "hello world");
    }

    #[test]
    fn ppe_and_idlh_both_expand() {
        let q = expand("PPE for IDLH");
        let lc = q.to_lowercase();
        assert!(lc.contains("personal protective"), "got: {q}");
        assert!(lc.contains("immediately dangerous"), "got: {q}");
        // originals must not remain
        assert!(!lc.contains(" ppe ") && !lc.starts_with("ppe"), "got: {q}");
    }

    #[test]
    fn h2s_expands_to_hydrogen_sulfide() {
        let q = expand("H2S");
        assert!(q.to_lowercase().contains("hydrogen sulfide"), "got: {q}");
    }

    #[test]
    fn forklift_maps_to_pit() {
        let q = expand("forklift");
        assert!(q.to_lowercase().contains("powered industrial truck"), "got: {q}");
    }
}
