# EHS Snap Desktop — Handoff

<!-- snap-series:manager-block:start -->
- **App:** EHS Snap
- **Platform:** desktop
- **Wave:** 3 (Field track)
- **Stage:** 2 features — v1.1 complete + SNAP_DESKTOP Phase A~D + Polish Pack rounds A~D applied 2026-06-06 (keyboard nav, splitter, ⌘K palette, native menubar, status bar, Tauri ask(), How-to-Use modal, multi-select favorites, PDF polish, 2×2 copy grid, search sort). tsc 0 errors; Rust 10/10; vite 340 KB / 102 KB gzip.
- **Last updated:** 2026-06-06
- **Repo:** not yet pushed — local-only iCloud Drive folder until series-wide signing block lifts (~2026-06-30)
- **Latest release:** none
- **Latest CI:** n/a (no CI yet)
- **Bundle id:** com.ryan.ehssnap
- **Dataset:** `ehs_snap_v1.sqlite` (42 MB, copied verbatim from iOS sibling) — safety_regulations 2,176 · regulatory_loi 4,223 · chemical_exposure_limits 677. FTS5 virtual tables: `safety_fts` / `loi_fts` / `chemical_fts`. License: public domain (eCFR.gov · OSHA.gov · CDC NIOSH).
- **Dataset update cadence:** **Quarterly bundle cap** (4×/yr), locked to the iOS schedule — same SQLite ships on both platforms. **Next refresh ship window: 2026-09-15 → 2026-09-30** (resource swap + tag `v1.0.1`). Annual NIOSH/PEL refresh: **2027-03**. See iOS `HANDOFF.md` §"Dataset refresh schedule" for the full per-source table.
- **Deviations from playbook:**
  - **Single segmented filter row** inside SearchView (`All · OSHA · MSHA · LOI · Chemicals`) — same SearchFilter enum as iOS.
  - **Three-entity backend**: `ehs.rs` exposes `search_regulations` / `search_lois` / `search_chemicals` + `related_lois` cross-link command. iOS Repository pattern ported almost verbatim (actor → short-lived rusqlite Connection per call).
  - **EHS-specific abbreviation dictionary** (`abbreviations.rs`): LOTO, HAZWOPER, HAZCOM, PEL, TWA, IDLH, SCBA, PIT, etc. Each entry verified verbatim against safety_regulations.heading / regulatory_loi.title / chemical notes (FTS5 would silently zero out otherwise). 4 unit tests pass.
  - **ExportEntry fields renamed** in `pdf.rs`: `code/description/billable/chapter/block/category` → `citation/heading/agency/subpart/industry/topics`. PDF header line: `"N regulations  -  29 CFR 1910 + 30 CFR + OSHA LOI"`.
  - **Three-entity favorites (completed).** `state.tsx` persists `favorites.loi` + `favorites.chemicals` as separate JSON docs alongside `favorites`. Regulation favorites capped at 15 (free tier); LOI/Chemical favorites uncapped. FavoritesView renders three sections dynamically. SearchView LOI/Chemical rows now open their respective detail views.
  - **`SelectedItem` discriminated union** — `App.tsx` routes the right-pane detail view to `RegulationDetailView` / `LoiDetailView` / `ChemicalDetailView` based on `{ kind, id|name }`. Cross-links: LOI rows in `RegulationDetailView` are now clickable (→ LoiDetailView); related CFR chips in `LoiDetailView` + `ChemicalDetailView` jump back to regulation. External links (osha.gov LOI URL, NPG URL, PubChem) use `openUrl` from `@tauri-apps/plugin-opener`.
  - **No `RegulationDetailLoaderView` analog** — each detail view handles its own loading state (kept lighter for the small Tauri footprint).
  - **Polish Pack rounds A~D (2026-06-06)** — adapted §11.5:
    - **Round A** — replaced 2 `window.confirm` call sites (CollectionsView delete · SettingsView deactivate) with `@tauri-apps/plugin-dialog` `ask()` — Tauri 2 webview silently ignores `window.confirm`.
    - **Round B** — Settings → Help → "How to Use" modal with 6 sections (Search · Favorites & Collections · Detail panes · Export · Keyboard Shortcuts (12 rows) · Tips). Native menu `Help → How to Use…` dispatches `snap:open-howto` window event to open it.
    - **Round C** — FavoritesView multi-select mode with one unified `Set<"reg:id" | "loi:id" | "chem:name">` (3-kind picked keyspace). Top bar: 📁 add to collection · 🗑 remove · ✕ cancel. `BulkAddToCollection` modal reuses `toCollectionItem` / `toLoiCollectionItem` / `toChemicalCollectionItem` helpers. `useListKeyNav` gets an empty array while selecting so ↑↓ doesn't fight the checkboxes. EHS-specific decision: skipped the "📄 export PDF" bulk button (collection PDF export already covers this path).
    - **Round D** — `pdf.rs::Layout` gained `text_centered()` (title) and `hr(gap)` (thin grey rule between entries, positioned at `self.y + 4.5mm` to sit midway between adjacent baselines, not crossing glyphs). Copy buttons in detail pane become 2×2 grid (`grid-template-columns: 1fr 1fr`) — `.detail-pane` gets `container-type: inline-size` so the grid collapses on narrow *panes* (not narrow *windows* — `@media` would be wrong here). SearchView added Relevance/Citation sort toggle (regulations only — LOIs/chemicals have inherent ordering); citation sort splits `section_number` into numeric components so `1910.9 < 1910.19 < 1910.147`.
  - **SNAP_DESKTOP Phase A~D adapted (2026-06-06)** — applied the Snap Series desktop improvement standard (`SNAP_DESKTOP_IMPROVEMENT_PLAN.md`) verbatim with EHS adaptations:
    - **4 tabs only** (Search/Favorites/Collections/Settings — no Calculator/Browse) → ⌘1~3 + ⌘, mapping; menubar `View` submenu uses these IDs.
    - **`useListKeyNav` made kind-agnostic** — Tariff's `T extends { code: string }` doesn't fit EHS's three discriminated entity kinds, so the hook now takes `NavItem[]` (`{ key, onSelect }`). Callers prefix keys by kind (`reg:` / `loi:` / `chem:`) to keep keyspaces disjoint. Each Row component carries the matching `data-nav-key`.
    - **⌘K palette** — 3 entity result groups (regulations / LOIs / chemicals) + 3 favorites groups (idle only) + Go-to (4 tabs) + Filters group (replaces Tariff's "NI Mode" toggle with `All / OSHA / MSHA / LOI / Chemicals` filter pushers).
    - **`externalFilter` prop on SearchView** — palette and menu push pending filter; SearchView applies once and clears via `onFilterApplied`.
    - **Native menubar** (`src-tauri/src/menu.rs`) — Help links to OSHA standards + NIOSH NPG (replaces HMRC); View submenu has 5 filter accelerators (`⌘⌥0~4`).
    - **Rail width 84px** (vs Tariff 92px) → Splitter `RAIL_WIDTH = 84`. Default list width 380px (vs 410).
- **Active blockers:**
  - Series-wide signing & store block (~2026-06-30): Apple Developer cert + Windows code-signing cert + Lemon Squeezy product.
  - No CI yet (will copy ICD's `.github/workflows/build.yml` verbatim once the repo is published).
- **Packaging smoke test** ✅ (2026-06-05) — `npm run tauri build` completed clean: Rust release build 374s, 0 errors. Outputs: `ehssnap` binary 11MB · `EHS Snap.app` 52MB · `EHS Snap_1.0.0_aarch64.dmg` 20MB (compressed). All at `src-tauri/target/release/bundle/`.
- **v1.1 completed (2026-06-04):**
  - **Multi-kind AddToCollectionModal** — `AddToCollectionModal` now accepts `CollectionTarget` union (`regulation | loi | chemical`). `LoiDetailView` and `ChemicalDetailView` each gained a `＋` folder button wired to the modal. `state.tsx`: `addToCollection` takes `CollectionItem` directly; `toLoiCollectionItem` + `toChemicalCollectionItem` helpers exported. `AddCodeModal` updated to use `toCollectionItem` helper. tsc 0 errors.
  - **iOS parallel** — `AddToCollectionSheet` on iOS likewise unified under `CollectionTarget` enum; `AddLOIToCollectionSheet` + `AddChemicalToCollectionSheet` removed. BUILD SUCCEEDED.
- **Next 3 steps:**
  1. Visual smoke test of Phase A~D + Polish in a running window — verify ⌘K filters push, multi-select 📁/🗑 flow, How-to-Use modal opens from menu, 2×2 copy grid collapses at narrow widths, PDF rendering with grey rules + centered header.
  2. When the signing block lifts (~2026-06-30): create GitHub repo `EHS-Snap-Desktop` (public) · copy ICD's CI workflow · cut v1.0.0 tag · sign + notarize DMG · publish Mac universal + Windows MSI/NSIS.
  3. iOS back-port candidates from this round (see IMPROVEMENT_PLAN §10.8): `ask()` audit on iOS (`confirmationDialog`), How-to-Use NavigationLink in Settings Help, PDF row separators in `CollectionExporter`.
- **Report-back trigger:** any commit on main, any tag push, dataset swap, SPEC change, new blocker, Stage transition.
<!-- snap-series:manager-block:end -->

## What this is

EHS Snap Desktop is the macOS + Windows companion to the iOS app — same
dataset, same icon, same theme system, same Lemon Squeezy premium model.
Forked from `ICD Snap_mac_win_app/` on 2026-06-03 via the standard rsync
pattern (excluding `node_modules/`, `target/`, `dist/`, `gen/`).

## Layout

```
EHS Snap_Mac_Win_app/
├── index.html                              ← Vite entry; title "EHS Snap"
├── package.json                            ← name "ehs-snap-desktop"
├── public/
├── src/
│   ├── App.tsx                             ← 4-tab shell (Search/Favorites/Collections/Settings)
│   ├── api.ts                              ← IPC wrappers (search_regulations, related_lois, …)
│   ├── state.tsx                           ← AppDataProvider — favorites/collections/notes
│   ├── settings.tsx                        ← SettingsProvider — theme/premium/license/onboarding
│   ├── types.ts                            ← Domain types (RegulationSummary/Detail, LoiSummary/Detail, ChemicalSummary/Detail, FavoriteRegulation, …)
│   ├── export.ts                           ← CSV + PDF builders
│   ├── styles.css                          ← 7-theme palette + new EHS badge classes (osha/msha/loi/carcinogen/industry)
│   └── components/
│       ├── SearchView.tsx                  ← segmented filter row + 3-entity results
│       ├── RegulationRow.tsx               ← new (replaces CodeRow)
│       ├── LoiRow.tsx                      ← new
│       ├── ChemicalRow.tsx                 ← new
│       ├── RegulationDetailView.tsx        ← new (replaces CodeDetailView) — citation/heading/regulatory hierarchy + related LOIs panel
│       ├── FavoritesView.tsx               ← regulationId-keyed
│       ├── CollectionsView.tsx             ← discriminated CollectionItem (regulation kind only in v1.0)
│       ├── AddCodeModal.tsx                ← searchRegulations-backed
│       ├── AddToCollectionModal.tsx        ← regulation-only in v1.0
│       ├── SettingsView.tsx                ← Data section: 29 CFR / 30 CFR / LOI / NIOSH counts
│       ├── OnboardingView.tsx              ← EHS feature copy
│       └── (CollectionFormModal / Modal / PremiumPromptModal — unchanged shell)
└── src-tauri/
    ├── Cargo.toml                          ← name "ehssnap", lib "ehssnap_lib"
    ├── tauri.conf.json                     ← productName "EHS Snap", identifier com.ryan.ehssnap
    ├── icons/                              ← generated by `npx tauri icon` from EHS hi-vis source
    ├── resources/
    │   ├── ehs_snap_v1.sqlite              ← 42 MB, copied from iOS Data/
    │   └── fonts/                          ← NanumGothic for Korean PDF export
    └── src/
        ├── main.rs                         ← ehssnap_lib::run()
        ├── lib.rs                          ← IPC commands (search_regulations / related_lois / search_lois / search_chemicals / store_* / license_* / export_pdf)
        ├── ehs.rs                          ← 3-entity query module (replaces icd.rs)
        ├── abbreviations.rs                ← EHS shortcut dictionary + 4 unit tests
        ├── pdf.rs                          ← export engine; ExportEntry now citation/heading/agency/subpart/industry/topics
        ├── license.rs                      ← Lemon Squeezy + override (INSTANCE_NAME = "EHS Snap Desktop")
        └── store.rs                        ← atomic JSON document store (unchanged)
```

## Build & run

Frontend only (vite dev server, no Rust):
```
npm install
npm run dev
```

Full Tauri dev (boots a window):
```
npm run tauri dev
```

Production build (Mac universal DMG locally, Windows MSI in CI later):
```
npm run tauri build
```

## Dataset refresh schedule (desktop side)

Source-side cadence and per-source detail live in **iOS HANDOFF §"Dataset
refresh schedule"** — single source of truth. Desktop just consumes the
same `ehs_snap_v1.sqlite` artifact.

### Next refresh ship windows

| Release | Window | Dataset capture | Notes |
|---|---|---|---|
| v1.0.0 (initial) | post-cert (~2026-07) | snapshot frozen 2026-06-03 | unsigned until signing block lifts |
| **v1.0.1** | **2026-09-15 → 09-30** | CFR + LOI quarterly refresh | first regular refresh |
| v1.0.2 | 2026-12-15 → 12-30 | CFR + LOI quarterly refresh | |
| **v1.1.0** | **2027-03-15 → 03-30** | CFR + LOI **+ NIOSH NPG + PEL** | annual annual chemical-side bump |
| v1.0.3 / v1.1.1 | 2027-06-15 → 06-30 | CFR + LOI quarterly refresh | |

### Per-release maintenance checklist (desktop)

When dropping a refreshed SQLite for a quarterly release:

1. `cp <iOS path>/EHSSnap/Data/ehs_snap_v1.sqlite src-tauri/resources/` —
   binary-identical to the iOS bundle.
2. Bump the **four version locations** in lockstep:
   - `package.json` `version`
   - `src-tauri/Cargo.toml` `[package].version`
   - `src-tauri/tauri.conf.json` `version`
   - HANDOFF manager-block `Latest release`
3. `cargo test --lib` and `npm run build` must stay green (no schema-drift
   surprises — the Rust struct layout in `ehs.rs` should already match).
4. `npm run tauri build` → produces Mac universal DMG locally; Windows MSI
   ships via CI.
5. Tag `vX.Y.Z` on `main`; CI cuts the GitHub Release with both artifacts.
6. Bump the iOS `HANDOFF.md`'s "Latest release" date in the same commit
   batch so the manager session sees both platforms move in sync.

### Out-of-band trigger conditions

Mirror iOS:
- Major new OSHA standard published (heat-injury, infectious disease, etc.)
- IDLH/PEL drift on any bundled chemical
- Scraped LOI cross-link integrity regression at scale (>50 letters)

For any out-of-band cut, **ship iOS and desktop together** — premium parity
breaks otherwise (a Lemon Squeezy product price tier vs. App Store IAP must
not drift across the same dataset snapshot).

## Quality gates passed

- `cargo check` ✓
- `cargo test --lib` → **7/7 pass** (4 abbreviations + 3 pdf incl. CJK subset) ✓
- `tsc && vite build` → **62 modules, 0 TypeScript errors, 554 ms** ✓

## Not yet done

- `npm run tauri dev` smoke test — window has not been booted end-to-end.
- `npm run tauri build` — Mac DMG / Windows MSI packaging not produced yet.
- LOI/Chemical collections (`AddToCollectionModal` only accepts regulations; multi-kind modal is v1.1).
- GitHub repo + CI workflow (`build.yml` copy from ICD desktop).

## When you pick this up next

1. Boot once with `npm run tauri dev` and run the smoke checklist (segmented
   filter switches results · favorite a regulation · related-LOI list
   populates · note round-trips · CSV export opens cleanly · PDF export
   opens cleanly with the new EHS header line).
2. ~~LOI/Chemical detail panels~~ — **done.** `LoiDetailView.tsx` and
   `ChemicalDetailView.tsx` are complete with favorites + cross-links.
   Next: LOI/Chemical **collection** plumbing (`AddToCollectionModal` → multi-kind).
3. Once the signing block lifts, replicate the ICD-Snap-Desktop CI
   workflow verbatim and tag v1.0.0.
