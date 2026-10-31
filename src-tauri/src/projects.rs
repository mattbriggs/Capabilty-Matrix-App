//! Managed project storage: `<app-data>/projects/<project-id>/capabilities.yaml`.
//!
//! * Paths are built only from validated project IDs, never from user-supplied paths.
//! * Writes go to a temp file that is synced and renamed over the target, so an interrupted
//!   write leaves the previous valid file in place.
//! * Saves are serialized and compare the on-disk revision (FNV-1a 64 of the bytes) with the
//!   revision the caller last saw; a mismatch is reported as `conflict:<current-revision>`.
//! * Delete moves the project folder to `<app-data>/trash/` so it can be restored.
//! * `projects-index.json` caches names for listing and is rebuildable from the files.

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Manager;

const DOCUMENT: &str = "capabilities.yaml";
const MAX_BYTES: usize = 2_000_000;

#[derive(Default)]
pub struct SaveLock(pub Mutex<()>);

pub fn revision_of(bytes: &[u8]) -> String {
    let mut hash: u64 = 0xcbf29ce484222325;
    for byte in bytes {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("{hash:016x}")
}

pub fn valid_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 64
        && id.chars().enumerate().all(|(index, c)| c.is_ascii_alphanumeric() || (index > 0 && (c == '-' || c == '_')))
}

fn valid_file_name(name: &str) -> bool {
    !name.is_empty() && name.len() <= 80 && !name.starts_with('.') && name.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '.' || c == '_')
}

#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct ProjectMeta {
    pub name: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub updated_at: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSummary {
    id: String,
    name: Option<String>,
    description: Option<String>,
    updated_at: Option<String>,
    modified_ms: u128,
    location: String,
    revision: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadedProject {
    text: String,
    revision: String,
    location: String,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TrashEntry {
    trash_id: String,
    id: String,
    name: String,
    deleted_at_ms: u128,
}

fn data_dir(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    app.path().app_data_dir().map_err(|error| error.to_string())
}

fn project_dir(root: &Path, id: &str) -> Result<PathBuf, String> {
    if !valid_id(id) {
        return Err(format!("Invalid project id: {id}"));
    }
    Ok(root.join("projects").join(id))
}

fn now_ms() -> u128 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis()).unwrap_or(0)
}

pub fn atomic_write(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let dir = path.parent().ok_or("Path has no parent directory")?;
    fs::create_dir_all(dir).map_err(|error| error.to_string())?;
    let file_name = path.file_name().and_then(|n| n.to_str()).ok_or("Invalid file name")?;
    let temp = dir.join(format!(".{file_name}.tmp-{}", std::process::id()));
    let result = (|| -> std::io::Result<()> {
        let mut file = fs::File::create(&temp)?;
        file.write_all(bytes)?;
        file.sync_all()?;
        fs::rename(&temp, path)
    })();
    if let Err(error) = result {
        let _ = fs::remove_file(&temp);
        return Err(error.to_string());
    }
    Ok(())
}

fn read_index(root: &Path) -> BTreeMap<String, ProjectMeta> {
    fs::read(root.join("projects-index.json"))
        .ok()
        .and_then(|bytes| serde_json::from_slice(&bytes).ok())
        .unwrap_or_default()
}

fn write_index(root: &Path, index: &BTreeMap<String, ProjectMeta>) -> Result<(), String> {
    let bytes = serde_json::to_vec_pretty(index).map_err(|error| error.to_string())?;
    atomic_write(&root.join("projects-index.json"), &bytes)
}

fn update_index(root: &Path, id: &str, meta: Option<ProjectMeta>) -> Result<(), String> {
    let mut index = read_index(root);
    match meta {
        Some(meta) => index.insert(id.to_owned(), meta),
        None => index.remove(id),
    };
    write_index(root, &index)
}

pub fn list_projects(root: &Path) -> Result<Vec<ProjectSummary>, String> {
    let index = read_index(root);
    let mut out = Vec::new();
    let entries = match fs::read_dir(root.join("projects")) {
        Ok(entries) => entries,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(out),
        Err(error) => return Err(error.to_string()),
    };
    for entry in entries.flatten() {
        let id = entry.file_name().to_string_lossy().to_string();
        let file = entry.path().join(DOCUMENT);
        if !valid_id(&id) || !file.is_file() {
            continue;
        }
        let bytes = fs::read(&file).map_err(|error| error.to_string())?;
        let modified_ms = fs::metadata(&file)
            .and_then(|m| m.modified())
            .ok()
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_millis())
            .unwrap_or(0);
        let meta = index.get(&id);
        out.push(ProjectSummary {
            name: meta.map(|m| m.name.clone()),
            description: meta.map(|m| m.description.clone()),
            updated_at: meta.map(|m| m.updated_at.clone()),
            modified_ms,
            location: file.to_string_lossy().to_string(),
            revision: revision_of(&bytes),
            id,
        });
    }
    out.sort_by(|a, b| b.modified_ms.cmp(&a.modified_ms));
    Ok(out)
}

pub fn load_project(root: &Path, id: &str) -> Result<LoadedProject, String> {
    let file = project_dir(root, id)?.join(DOCUMENT);
    let bytes = fs::read(&file).map_err(|error| error.to_string())?;
    let text = String::from_utf8(bytes).map_err(|_| "The project file is not UTF-8 text".to_string())?;
    Ok(LoadedProject { revision: revision_of(text.as_bytes()), text, location: file.to_string_lossy().to_string() })
}

pub fn save_project(root: &Path, id: &str, text: &str, expected: Option<&str>, meta: ProjectMeta) -> Result<String, String> {
    if text.len() > MAX_BYTES {
        return Err("Capability document is too large".into());
    }
    let file = project_dir(root, id)?.join(DOCUMENT);
    match fs::read(&file) {
        Ok(bytes) => {
            let current = revision_of(&bytes);
            if expected != Some(current.as_str()) {
                return Err(format!("conflict:{current}"));
            }
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            if expected.is_some() {
                return Err("conflict:missing".into());
            }
        }
        Err(error) => return Err(error.to_string()),
    }
    atomic_write(&file, text.as_bytes())?;
    update_index(root, id, Some(meta))?;
    Ok(revision_of(text.as_bytes()))
}

pub fn trash_project(root: &Path, id: &str) -> Result<String, String> {
    let dir = project_dir(root, id)?;
    if !dir.is_dir() {
        return Err(format!("Project {id} does not exist"));
    }
    let name = read_index(root).get(id).map(|m| m.name.clone()).unwrap_or_else(|| id.to_owned());
    let mut deleted_at_ms = now_ms();
    while root.join("trash").join(format!("{id}--{deleted_at_ms}")).exists() {
        deleted_at_ms += 1;
    }
    let trash_id = format!("{id}--{deleted_at_ms}");
    let target = root.join("trash").join(&trash_id);
    fs::create_dir_all(root.join("trash")).map_err(|error| error.to_string())?;
    fs::rename(&dir, &target).map_err(|error| error.to_string())?;
    let info = TrashEntry { trash_id: trash_id.clone(), id: id.to_owned(), name, deleted_at_ms };
    atomic_write(&target.join("trash-info.json"), &serde_json::to_vec_pretty(&info).map_err(|error| error.to_string())?)?;
    update_index(root, id, None)?;
    Ok(trash_id)
}

pub fn list_trash(root: &Path) -> Result<Vec<TrashEntry>, String> {
    let mut out = Vec::new();
    if let Ok(entries) = fs::read_dir(root.join("trash")) {
        for entry in entries.flatten() {
            if let Some(info) = fs::read(entry.path().join("trash-info.json")).ok().and_then(|b| serde_json::from_slice::<TrashEntry>(&b).ok()) {
                out.push(info);
            }
        }
    }
    out.sort_by(|a, b| b.deleted_at_ms.cmp(&a.deleted_at_ms));
    Ok(out)
}

pub fn restore_project(root: &Path, trash_id: &str) -> Result<String, String> {
    let (id, stamp) = trash_id.rsplit_once("--").ok_or("Invalid trash id")?;
    if !valid_id(id) || stamp.is_empty() || !stamp.chars().all(|c| c.is_ascii_digit()) {
        return Err("Invalid trash id".into());
    }
    let source = root.join("trash").join(trash_id);
    let target = project_dir(root, id)?;
    if target.exists() {
        return Err(format!("A project with id {id} already exists. Delete or rename it before restoring."));
    }
    let info: Option<TrashEntry> = fs::read(source.join("trash-info.json")).ok().and_then(|b| serde_json::from_slice(&b).ok());
    fs::create_dir_all(root.join("projects")).map_err(|error| error.to_string())?;
    fs::rename(&source, &target).map_err(|error| error.to_string())?;
    let _ = fs::remove_file(target.join("trash-info.json"));
    let name = info.map(|i| i.name).unwrap_or_else(|| id.to_owned());
    update_index(root, id, Some(ProjectMeta { name, description: String::new(), updated_at: String::new() }))?;
    Ok(id.to_owned())
}

pub fn write_backup(root: &Path, id: &str, file_name: &str, text: &str) -> Result<String, String> {
    if !valid_file_name(file_name) || file_name == DOCUMENT {
        return Err("Invalid backup file name".into());
    }
    if text.len() > MAX_BYTES {
        return Err("Backup is too large".into());
    }
    let path = project_dir(root, id)?.join(file_name);
    atomic_write(&path, text.as_bytes())?;
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn projects_list(app: tauri::AppHandle) -> Result<Vec<ProjectSummary>, String> {
    list_projects(&data_dir(&app)?)
}

#[tauri::command]
pub fn project_load(app: tauri::AppHandle, id: String) -> Result<LoadedProject, String> {
    load_project(&data_dir(&app)?, &id)
}

#[tauri::command]
pub fn project_save(
    app: tauri::AppHandle,
    lock: tauri::State<'_, SaveLock>,
    id: String,
    yaml_text: String,
    expected_revision: Option<String>,
    meta: ProjectMeta,
) -> Result<String, String> {
    let _guard = lock.0.lock().map_err(|_| "Save lock poisoned")?;
    save_project(&data_dir(&app)?, &id, &yaml_text, expected_revision.as_deref(), meta)
}

#[tauri::command]
pub fn project_trash(app: tauri::AppHandle, lock: tauri::State<'_, SaveLock>, id: String) -> Result<String, String> {
    let _guard = lock.0.lock().map_err(|_| "Save lock poisoned")?;
    trash_project(&data_dir(&app)?, &id)
}

#[tauri::command]
pub fn projects_trash_list(app: tauri::AppHandle) -> Result<Vec<TrashEntry>, String> {
    list_trash(&data_dir(&app)?)
}

#[tauri::command]
pub fn project_restore(app: tauri::AppHandle, lock: tauri::State<'_, SaveLock>, trash_id: String) -> Result<String, String> {
    let _guard = lock.0.lock().map_err(|_| "Save lock poisoned")?;
    restore_project(&data_dir(&app)?, &trash_id)
}

#[tauri::command]
pub fn project_backup(app: tauri::AppHandle, id: String, file_name: String, text: String) -> Result<String, String> {
    write_backup(&data_dir(&app)?, &id, &file_name, &text)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_root(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("capmatrix-test-{name}-{}", now_ms()));
        fs::create_dir_all(&dir).unwrap();
        dir
    }
    fn meta(name: &str) -> ProjectMeta {
        ProjectMeta { name: name.into(), description: String::new(), updated_at: "2026-10-29T00:00:00Z".into() }
    }

    #[test]
    fn revision_matches_browser_fnv() {
        // Same vector as tests/js/ids.test.mjs.
        assert_eq!(revision_of(b""), "cbf29ce484222325");
        assert_eq!(revision_of(b"version: 2\n"), revision_of("version: 2\n".as_bytes()));
        assert_eq!(revision_of("a".as_bytes()), "af63dc4c8601ec8c");
    }

    #[test]
    fn rejects_path_like_ids() {
        assert!(valid_id("prj-abc_1"));
        for bad in ["", "../x", "a/b", "-lead", "a.b", &"x".repeat(65)] {
            assert!(!valid_id(bad), "{bad}");
        }
    }

    #[test]
    fn create_save_conflict_trash_restore() {
        let root = temp_root("crud");
        let first = save_project(&root, "p1", "one", None, meta("One")).unwrap();
        assert!(save_project(&root, "p1", "dup", None, meta("One")).unwrap_err().starts_with("conflict:"));
        let second = save_project(&root, "p1", "two", Some(&first), meta("One")).unwrap();
        // A stale revision is rejected and the newer file is untouched.
        assert_eq!(save_project(&root, "p1", "stale", Some(&first), meta("One")).unwrap_err(), format!("conflict:{second}"));
        assert_eq!(load_project(&root, "p1").unwrap().text, "two");
        save_project(&root, "p2", "other", None, meta("Two")).unwrap();
        assert_eq!(list_projects(&root).unwrap().len(), 2);

        let trash_id = trash_project(&root, "p1").unwrap();
        assert_eq!(list_projects(&root).unwrap().len(), 1);
        assert_eq!(load_project(&root, "p2").unwrap().text, "other");
        assert_eq!(list_trash(&root).unwrap()[0].name, "One");
        assert_eq!(restore_project(&root, &trash_id).unwrap(), "p1");
        assert_eq!(load_project(&root, "p1").unwrap().text, "two");
        assert!(restore_project(&root, "../p1--1").is_err());
        // Deleting the same project twice in quick succession keeps both trash entries.
        let first_trash = trash_project(&root, "p1").unwrap();
        save_project(&root, "p1", "three", None, meta("One")).unwrap();
        let second_trash = trash_project(&root, "p1").unwrap();
        assert_ne!(first_trash, second_trash);
        assert_eq!(list_trash(&root).unwrap().len(), 2);
        assert_eq!(restore_project(&root, &first_trash).unwrap(), "p1");
        assert_eq!(load_project(&root, "p1").unwrap().text, "two");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn interrupted_write_keeps_previous_file() {
        let root = temp_root("atomic");
        let revision = save_project(&root, "p1", "good", None, meta("P")).unwrap();
        // A write that cannot complete (target path is a directory) must not damage the project.
        let blocked = project_dir(&root, "p1").unwrap().join("blocked");
        fs::create_dir_all(blocked.join("x")).unwrap();
        assert!(atomic_write(&blocked, b"bad").is_err());
        assert_eq!(load_project(&root, "p1").unwrap().revision, revision);
        let leftovers: Vec<_> = fs::read_dir(project_dir(&root, "p1").unwrap()).unwrap().flatten().filter(|e| e.file_name().to_string_lossy().contains(".tmp-")).collect();
        assert!(leftovers.is_empty());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn backups_are_constrained_to_the_project_folder() {
        let root = temp_root("backup");
        save_project(&root, "p1", "x", None, meta("P")).unwrap();
        assert!(write_backup(&root, "p1", "original-v1.yaml", "v1").is_ok());
        assert!(write_backup(&root, "p1", "../escape.yaml", "v1").is_err());
        assert!(write_backup(&root, "p1", DOCUMENT, "v1").is_err());
        fs::remove_dir_all(root).unwrap();
    }
}
