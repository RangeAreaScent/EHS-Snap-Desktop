# EHS Snap Desktop

Offline reference for U.S. workplace safety regulations — OSHA 29 CFR Part
1910, MSHA 30 CFR, OSHA Letters of Interpretation, and NIOSH chemical
exposure limits. The macOS + Windows companion to **EHS Snap** for iOS.

* No cloud. No telemetry. No ads. Everything ships in a single 42 MB SQLite.
* One-time premium (themes + unlimited favorites / collections) via Lemon
  Squeezy.

## Quick start

```
npm install
npm run tauri dev
```

See [`HANDOFF.md`](./HANDOFF.md) for architecture, fork notes, and the
running v1.0 punch list.

## Stack

| Layer    | Technology                                  |
| -------- | ------------------------------------------- |
| Frontend | React 19 + TypeScript + Vite                |
| Shell    | Tauri 2 (Rust)                              |
| DB       | rusqlite (bundled SQLite) + FTS5            |
| PDF      | printpdf (with NanumGothic for Korean text) |

## License

Source code: TBD (private until repo is public). Bundled dataset is U.S.
federal-government work, public domain.
