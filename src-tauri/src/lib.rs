mod abbreviations;
mod icd;
mod license;
mod pdf;
mod store;

use std::path::PathBuf;
use tauri::Manager;

/// Resolved at startup so commands never have to re-resolve paths.
struct AppState {
    db_path: PathBuf,
    data_dir: PathBuf,
}

#[tauri::command]
fn search_codes(
    state: tauri::State<'_, AppState>,
    query: String,
    limit: Option<usize>,
) -> Result<Vec<icd::SearchResult>, String> {
    icd::search(&state.db_path, &query, limit.unwrap_or(50))
}

#[tauri::command]
fn get_code_detail(
    state: tauri::State<'_, AppState>,
    code: String,
) -> Result<Option<icd::CodeDetail>, String> {
    icd::fetch_detail(&state.db_path, &code)
}

#[tauri::command]
fn store_read(state: tauri::State<'_, AppState>, name: String) -> Result<Option<String>, String> {
    store::read(&state.data_dir, &name)
}

#[tauri::command]
fn store_write(
    state: tauri::State<'_, AppState>,
    name: String,
    content: String,
) -> Result<(), String> {
    store::write(&state.data_dir, &name, &content)
}

/// Writes arbitrary text to a user-chosen path (the path comes from the
/// native save dialog). Used by collection CSV export.
#[tauri::command]
fn write_text_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, content).map_err(|e| format!("failed to write file: {e}"))
}

/// Renders a collection to a PDF at the user-chosen path.
#[tauri::command]
fn export_pdf(
    path: String,
    title: String,
    entries: Vec<pdf::ExportEntry>,
) -> Result<(), String> {
    pdf::export(&path, &title, &entries)
}

/// Returns the locally stored license state without any network call.
#[tauri::command]
fn license_status(state: tauri::State<'_, AppState>) -> license::LicenseState {
    license::status(&state.data_dir)
}

/// Activates a license key for this machine (online).
#[tauri::command]
fn license_activate(
    state: tauri::State<'_, AppState>,
    key: String,
) -> Result<license::LicenseState, String> {
    license::activate(&state.data_dir, &key)
}

/// Re-validates the stored license (online, with offline grace).
#[tauri::command]
fn license_validate(state: tauri::State<'_, AppState>) -> license::LicenseState {
    license::validate(&state.data_dir)
}

/// Releases this machine's activation slot.
#[tauri::command]
fn license_deactivate(
    state: tauri::State<'_, AppState>,
) -> Result<license::LicenseState, String> {
    license::deactivate(&state.data_dir)
}

/// Toggles the hidden premium override (demo / testing unlock).
#[tauri::command]
fn license_toggle_override(
    state: tauri::State<'_, AppState>,
) -> Result<license::LicenseState, String> {
    license::toggle_override(&state.data_dir)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let db_path = app
                .path()
                .resolve("resources/icd10cm_2026.sqlite", tauri::path::BaseDirectory::Resource)
                .expect("bundled ICD database resource is missing");
            let data_dir = app
                .path()
                .app_data_dir()
                .expect("could not resolve app data directory");
            app.manage(AppState { db_path, data_dir });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            search_codes,
            get_code_detail,
            store_read,
            store_write,
            write_text_file,
            export_pdf,
            license_status,
            license_activate,
            license_validate,
            license_deactivate,
            license_toggle_override
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
