mod projects;

use tauri_plugin_shell::{process::CommandEvent, ShellExt};
use tauri::Manager;

// Legacy single-file storage. Read once to migrate into managed projects; never deleted.
#[tauri::command]
fn load_yaml(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let path = app.path().app_data_dir().map_err(|error| error.to_string())?.join("capabilities.yaml");
    match std::fs::read_to_string(path) {
        Ok(text) => Ok(Some(text)),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
fn print_page(app: tauri::AppHandle) -> Result<(), String> {
    let window = app.get_webview_window("main").ok_or("Main window not found")?;
    window.print().map_err(|error| error.to_string())
}

#[tauri::command]
async fn process_data(app: tauri::AppHandle, operation: String, payload: String) -> Result<String, String> {
    if !matches!(operation.as_str(), "validate" | "migrate" | "content-manifest" | "report-summary" | "schema") {
        return Err("Unsupported sidecar operation".into());
    }
    if payload.len() > 4_000_000 {
        return Err("Capability document is too large".into());
    }
    let command = app
        .shell()
        .sidecar("capability-sidecar")
        .map_err(|error| error.to_string())?;
    let (mut events, mut child) = command.spawn().map_err(|error| error.to_string())?;
    child
        .write(format!("{payload}\n").as_bytes())
        .map_err(|error| error.to_string())?;

    let mut output = String::new();
    let mut stderr = String::new();
    while let Some(event) = events.recv().await {
        match event {
            CommandEvent::Stdout(bytes) => output.push_str(&String::from_utf8_lossy(&bytes)),
            CommandEvent::Stderr(bytes) => stderr.push_str(&String::from_utf8_lossy(&bytes)),
            CommandEvent::Terminated(_) => break,
            _ => {}
        }
    }
    if output.trim().is_empty() {
        return Err(if stderr.trim().is_empty() { "Sidecar produced no output".into() } else { stderr });
    }
    Ok(output.trim().to_owned())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .manage(projects::SaveLock::default())
        .invoke_handler(tauri::generate_handler![
            process_data,
            load_yaml,
            print_page,
            projects::projects_list,
            projects::project_load,
            projects::project_save,
            projects::project_trash,
            projects::projects_trash_list,
            projects::project_restore,
            projects::project_backup,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Capability and Ownership Matrix");
}
