//! Phase D (SNAP_DESKTOP_IMPROVEMENT_PLAN.md) — native menu bar.
//!
//! Defines the macOS / Windows menu bar. Every menu item that fires a
//! UI action emits a `menu:<id>` window event; the React side (App.tsx)
//! listens via `@tauri-apps/api/event` and routes to the same handlers
//! the keyboard shortcuts already use. No duplicated behavior — the
//! menu is a discoverable surface over the existing keyboard contract.
//!
//! EHS menu IDs (kept stable; the React side hard-codes these strings):
//!   file.new_search             ⌘N
//!   file.command_palette        ⌘K
//!   file.export_collection      ⌘E
//!   edit.copy_citation          ⌘⇧C
//!   edit.find                   ⌘F
//!   view.tab_search             ⌘1
//!   view.tab_favorites          ⌘2
//!   view.tab_collections        ⌘3
//!   view.tab_settings           ⌘4
//!   view.filter_all             ⌘⌥0
//!   view.filter_osha            ⌘⌥1
//!   view.filter_msha            ⌘⌥2
//!   view.filter_loi             ⌘⌥3
//!   view.filter_chemicals       ⌘⌥4
//!   view.reset_splitter
//!   help.how_to_use
//!   help.dataset_details
//!   help.privacy_policy         (opens URL)
//!   help.osha_link              (opens URL)
//!   help.niosh_link             (opens URL)

use tauri::menu::{
    AboutMetadata, Menu, MenuBuilder, MenuItem, PredefinedMenuItem, SubmenuBuilder,
};
use tauri::{AppHandle, Emitter, Runtime, Wry};

pub fn install<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let menu = build_menu(app)?;
    app.set_menu(menu)?;
    Ok(())
}

fn build_menu<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    let app_about = AboutMetadata {
        name: Some("EHS Snap".into()),
        version: Some(env!("CARGO_PKG_VERSION").into()),
        copyright: Some("© Ryan".into()),
        ..Default::default()
    };
    let app_submenu = SubmenuBuilder::new(app, "EHS Snap")
        .item(&PredefinedMenuItem::about(app, None, Some(app_about))?)
        .separator()
        .item(&MenuItem::with_id(
            app,
            "view.tab_settings",
            "Preferences…",
            true,
            Some("CmdOrCtrl+,"),
        )?)
        .separator()
        .item(&PredefinedMenuItem::services(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::hide(app, None)?)
        .item(&PredefinedMenuItem::hide_others(app, None)?)
        .item(&PredefinedMenuItem::show_all(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::quit(app, None)?)
        .build()?;

    let file_submenu = SubmenuBuilder::new(app, "File")
        .item(&MenuItem::with_id(
            app,
            "file.new_search",
            "New Search",
            true,
            Some("CmdOrCtrl+N"),
        )?)
        .item(&MenuItem::with_id(
            app,
            "file.command_palette",
            "Open Command Palette…",
            true,
            Some("CmdOrCtrl+K"),
        )?)
        .separator()
        .item(&MenuItem::with_id(
            app,
            "file.export_collection",
            "Export Open Collection as PDF…",
            true,
            Some("CmdOrCtrl+E"),
        )?)
        .build()?;

    let edit_submenu = SubmenuBuilder::new(app, "Edit")
        .item(&PredefinedMenuItem::undo(app, None)?)
        .item(&PredefinedMenuItem::redo(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::cut(app, None)?)
        .item(&PredefinedMenuItem::copy(app, None)?)
        .item(&PredefinedMenuItem::paste(app, None)?)
        .item(&PredefinedMenuItem::select_all(app, None)?)
        .separator()
        .item(&MenuItem::with_id(
            app,
            "edit.copy_citation",
            "Copy Citation",
            true,
            Some("CmdOrCtrl+Shift+C"),
        )?)
        .item(&MenuItem::with_id(
            app,
            "edit.find",
            "Find…",
            true,
            Some("CmdOrCtrl+F"),
        )?)
        .build()?;

    let view_submenu = SubmenuBuilder::new(app, "View")
        .item(&MenuItem::with_id(
            app,
            "view.tab_search",
            "Search",
            true,
            Some("CmdOrCtrl+1"),
        )?)
        .item(&MenuItem::with_id(
            app,
            "view.tab_favorites",
            "Favorites",
            true,
            Some("CmdOrCtrl+2"),
        )?)
        .item(&MenuItem::with_id(
            app,
            "view.tab_collections",
            "Collections",
            true,
            Some("CmdOrCtrl+3"),
        )?)
        .separator()
        .item(&MenuItem::with_id(
            app,
            "view.filter_all",
            "Filter: All",
            true,
            Some("CmdOrCtrl+Alt+0"),
        )?)
        .item(&MenuItem::with_id(
            app,
            "view.filter_osha",
            "Filter: OSHA (29 CFR)",
            true,
            Some("CmdOrCtrl+Alt+1"),
        )?)
        .item(&MenuItem::with_id(
            app,
            "view.filter_msha",
            "Filter: MSHA (30 CFR)",
            true,
            Some("CmdOrCtrl+Alt+2"),
        )?)
        .item(&MenuItem::with_id(
            app,
            "view.filter_loi",
            "Filter: Letters of Interpretation",
            true,
            Some("CmdOrCtrl+Alt+3"),
        )?)
        .item(&MenuItem::with_id(
            app,
            "view.filter_chemicals",
            "Filter: Chemicals",
            true,
            Some("CmdOrCtrl+Alt+4"),
        )?)
        .separator()
        .item(&MenuItem::with_id(
            app,
            "view.reset_splitter",
            "Reset Splitter Width",
            true,
            None::<&str>,
        )?)
        .build()?;

    let window_submenu = SubmenuBuilder::new(app, "Window")
        .item(&PredefinedMenuItem::minimize(app, None)?)
        .item(&PredefinedMenuItem::maximize(app, None)?)
        .separator()
        .item(&PredefinedMenuItem::close_window(app, None)?)
        .build()?;

    let help_submenu = SubmenuBuilder::new(app, "Help")
        .item(&MenuItem::with_id(
            app,
            "help.how_to_use",
            "How to Use…",
            true,
            None::<&str>,
        )?)
        .item(&MenuItem::with_id(
            app,
            "help.dataset_details",
            "Dataset Details…",
            true,
            None::<&str>,
        )?)
        .separator()
        .item(&MenuItem::with_id(
            app,
            "help.privacy_policy",
            "Privacy Policy",
            true,
            None::<&str>,
        )?)
        .item(&MenuItem::with_id(
            app,
            "help.osha_link",
            "OSHA Standards (web)",
            true,
            None::<&str>,
        )?)
        .item(&MenuItem::with_id(
            app,
            "help.niosh_link",
            "NIOSH Pocket Guide (web)",
            true,
            None::<&str>,
        )?)
        .build()?;

    MenuBuilder::new(app)
        .item(&app_submenu)
        .item(&file_submenu)
        .item(&edit_submenu)
        .item(&view_submenu)
        .item(&window_submenu)
        .item(&help_submenu)
        .build()
}

pub fn handle(app: &AppHandle<Wry>, id: &str) {
    match id {
        "help.privacy_policy" => open_url(
            app,
            "https://rangeareascent.github.io/Snap_Series/ehssnap/privacy/",
        ),
        "help.osha_link" => {
            open_url(app, "https://www.osha.gov/laws-regs/regulations/standardnumber/1910")
        }
        "help.niosh_link" => open_url(app, "https://www.cdc.gov/niosh/npg/"),
        other => {
            let _ = app.emit(&format!("menu:{other}"), ());
        }
    }
}

fn open_url(app: &AppHandle<Wry>, url: &str) {
    use tauri_plugin_opener::OpenerExt;
    let _ = app.opener().open_url(url, None::<&str>);
}
