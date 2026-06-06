mod abbreviations;
mod ehs;
mod license;
mod menu;
mod pdf;
mod store;

use std::path::PathBuf;
use tauri::Manager;

/// Resolved at startup so commands never have to re-resolve paths.
struct AppState {
    db_path: PathBuf,
    data_dir: PathBuf,
}

// --------------------------------------------------------------------------
//  Regulations
// --------------------------------------------------------------------------

#[tauri::command]
fn search_regulations(
    state: tauri::State<'_, AppState>,
    query: String,
    limit: Option<usize>,
    agency: Option<String>,
) -> Result<Vec<ehs::RegulationSummary>, String> {
    ehs::search_regulations(
        &state.db_path,
        &query,
        limit.unwrap_or(50),
        agency.as_deref(),
    )
}

#[tauri::command]
fn get_regulation_detail(
    state: tauri::State<'_, AppState>,
    regulation_id: String,
) -> Result<Option<ehs::RegulationDetail>, String> {
    ehs::fetch_regulation_detail(&state.db_path, &regulation_id)
}

#[tauri::command]
fn related_lois(
    state: tauri::State<'_, AppState>,
    section_number: String,
    limit: Option<usize>,
) -> Result<Vec<ehs::LoiSummary>, String> {
    ehs::related_lois_for_section(&state.db_path, &section_number, limit.unwrap_or(8))
}

// --------------------------------------------------------------------------
//  Letters of Interpretation
// --------------------------------------------------------------------------

#[tauri::command]
fn search_lois(
    state: tauri::State<'_, AppState>,
    query: String,
    limit: Option<usize>,
) -> Result<Vec<ehs::LoiSummary>, String> {
    ehs::search_lois(&state.db_path, &query, limit.unwrap_or(50))
}

#[tauri::command]
fn get_loi_detail(
    state: tauri::State<'_, AppState>,
    loi_id: String,
) -> Result<Option<ehs::LoiDetail>, String> {
    ehs::fetch_loi_detail(&state.db_path, &loi_id)
}

// --------------------------------------------------------------------------
//  Chemicals
// --------------------------------------------------------------------------

#[tauri::command]
fn search_chemicals(
    state: tauri::State<'_, AppState>,
    query: String,
    limit: Option<usize>,
) -> Result<Vec<ehs::ChemicalSummary>, String> {
    ehs::search_chemicals(&state.db_path, &query, limit.unwrap_or(50))
}

#[tauri::command]
fn get_chemical_detail(
    state: tauri::State<'_, AppState>,
    substance_name: String,
) -> Result<Option<ehs::ChemicalDetail>, String> {
    ehs::fetch_chemical_detail(&state.db_path, &substance_name)
}

// --------------------------------------------------------------------------
//  Store / export / license (shared shell — unchanged from ICD reference)
// --------------------------------------------------------------------------

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

#[tauri::command]
fn write_text_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, content).map_err(|e| format!("failed to write file: {e}"))
}

#[tauri::command]
fn export_pdf(
    path: String,
    title: String,
    entries: Vec<pdf::ExportEntry>,
) -> Result<(), String> {
    pdf::export(&path, &title, &entries)
}

#[tauri::command]
fn license_status(state: tauri::State<'_, AppState>) -> license::LicenseState {
    license::status(&state.data_dir)
}

#[tauri::command]
fn license_activate(
    state: tauri::State<'_, AppState>,
    key: String,
) -> Result<license::LicenseState, String> {
    license::activate(&state.data_dir, &key)
}

#[tauri::command]
fn license_validate(state: tauri::State<'_, AppState>) -> license::LicenseState {
    license::validate(&state.data_dir)
}

#[tauri::command]
fn license_deactivate(
    state: tauri::State<'_, AppState>,
) -> Result<license::LicenseState, String> {
    license::deactivate(&state.data_dir)
}

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
                .resolve(
                    "resources/ehs_snap_v1.sqlite",
                    tauri::path::BaseDirectory::Resource,
                )
                .expect("bundled EHS database resource is missing");
            let data_dir = app
                .path()
                .app_data_dir()
                .expect("could not resolve app data directory");
            app.manage(AppState { db_path, data_dir });
            // Phase D: install the native menu bar.
            menu::install(app.handle())?;
            Ok(())
        })
        .on_menu_event(|app, event| {
            menu::handle(app, event.id().as_ref());
        })
        .invoke_handler(tauri::generate_handler![
            search_regulations,
            get_regulation_detail,
            related_lois,
            search_lois,
            get_loi_detail,
            search_chemicals,
            get_chemical_detail,
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
