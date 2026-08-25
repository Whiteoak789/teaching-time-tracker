mod api;
mod db;
mod error;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let state = db::initialize(app.handle()).expect("database initialization failed");
            if let Some(request) = api::backup::scheduled_request(&state) {
                if let Err(error) = api::backup::create_backup_internal(request, &state) {
                    eprintln!("Automatic backup failed: {error}");
                }
            }
            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            api::commands::get_app_snapshot,
            api::commands::save_semester,
            api::commands::save_category,
            api::commands::save_time_entry,
            api::commands::delete_time_entry,
            api::commands::duplicate_time_entry,
            api::commands::bulk_verify,
            api::commands::save_note,
            api::commands::delete_note,
            api::commands::save_reminder,
            api::commands::delete_reminder,
            api::commands::save_settings,
            api::commands::export_data,
            api::backup::create_backup,
            api::backup::restore_backup
        ])
        .build(tauri::generate_context!())
        .expect("error while building Teaching Time Tracker")
        .run(|app_handle, event| {
            if matches!(event, tauri::RunEvent::ExitRequested { .. }) {
                let state = app_handle.state::<db::DbState>();
                if let Some(request) = api::backup::close_request(&state) {
                    if let Err(error) = api::backup::create_backup_internal(request, &state) {
                        eprintln!("Backup on close failed: {error}");
                    }
                }
            }
        });
}
