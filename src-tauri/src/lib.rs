// Прогресс хранится в служебной папке приложения — переживает перенос и удаление .exe
use std::fs;
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;

const FILE: &str = "progress.json";

fn data_dir(app: &AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir)
}

#[tauri::command]
fn save_progress(app: AppHandle, contents: String) -> Result<(), String> {
    let dir = data_dir(&app)?;
    fs::write(dir.join(FILE), contents).map_err(|e| e.to_string())
}

#[tauri::command]
fn load_progress(app: AppHandle) -> Option<String> {
    let dir = data_dir(&app).ok()?;
    fs::read_to_string(dir.join(FILE)).ok()
}

#[tauri::command]
async fn export_progress(app: AppHandle, contents: String) -> Result<Option<String>, String> {
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog()
        .file()
        .set_file_name("gwent-progress.json")
        .add_filter("Gwent progress", &["json"])
        .save_file(move |p| {
            let _ = tx.send(p);
        });
    match rx.await.map_err(|e| e.to_string())? {
        Some(p) => {
            let path = p.into_path().map_err(|e| e.to_string())?;
            fs::write(&path, contents).map_err(|e| e.to_string())?;
            Ok(Some(path.to_string_lossy().to_string()))
        }
        None => Ok(None),
    }
}

#[tauri::command]
async fn import_progress(app: AppHandle) -> Result<Option<String>, String> {
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog()
        .file()
        .add_filter("Gwent progress", &["json"])
        .pick_file(move |p| {
            let _ = tx.send(p);
        });
    match rx.await.map_err(|e| e.to_string())? {
        Some(p) => {
            let path = p.into_path().map_err(|e| e.to_string())?;
            let text = fs::read_to_string(&path).map_err(|e| e.to_string())?;
            Ok(Some(text))
        }
        None => Ok(None),
    }
}

#[tauri::command]
fn open_data_dir(app: AppHandle) -> Result<String, String> {
    let dir = data_dir(&app)?;
    app.opener()
        .open_path(dir.to_string_lossy().to_string(), None::<&str>)
        .map_err(|e| e.to_string())?;
    Ok(dir.to_string_lossy().to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            save_progress,
            load_progress,
            export_progress,
            import_progress,
            open_data_dir
        ])
        .run(tauri::generate_context!())
        .expect("error while running application");
}
