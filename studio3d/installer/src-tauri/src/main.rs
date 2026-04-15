// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod gpu_detect;
mod downloader;
mod installer;
mod launcher;
mod updater;

use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            gpu_detect::scan_system,
            downloader::download_file,
            downloader::pause_download,
            downloader::resume_download,
            installer::install_python_deps,
            launcher::start_services,
            launcher::stop_services,
            launcher::get_service_status,
            launcher::get_vram_usage,
            updater::check_updates,
            updater::apply_update,
        ])
        .setup(|app| {
            // On first launch after install, show launcher screen
            let _ = app.get_webview_window("main");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
