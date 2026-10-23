#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod auth;
mod cutout;

use auth::{LocalState, Result, User};
use base64::{engine::general_purpose::STANDARD, Engine};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::{fs, io::Read, path::{Path, PathBuf}, sync::Mutex};
use tauri::{Manager, State, WebviewWindow};

type Store<'a> = State<'a, Mutex<LocalState>>;
const MAX_BYTES: usize = 64 * 1024 * 1024;

#[derive(Serialize)]
struct ProjectHandle { id: String, name: String }

fn project_path(path: &Path) -> Result<()> {
    if path.extension().and_then(|s| s.to_str()).is_some_and(|s| s.eq_ignore_ascii_case("skuwork")) { Ok(()) }
    else { Err("请选择 .skuwork 源文件".into()) }
}
fn read_limited(path: &Path) -> Result<Vec<u8>> {
    let file = fs::File::open(path).map_err(|_| "无法读取源文件，请检查文件位置与权限")?;
    let mut bytes = Vec::new();
    file.take((MAX_BYTES + 1) as u64).read_to_end(&mut bytes).map_err(|_| "源文件读取失败")?;
    if bytes.len() > MAX_BYTES { return Err("源文件超过 64 MB，请减少图片大小".into()); }
    Ok(bytes)
}
fn fingerprint(path: &Path) -> Result<Option<Vec<u8>>> {
    if !path.try_exists().map_err(|_| "无法检查源文件")? { return Ok(None); }
    Ok(Some(Sha256::digest(read_limited(path)?).to_vec()))
}
fn project_owner(state: &LocalState, path: &Path) -> Option<String> {
    let canonical = fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
    state.windows.iter().find_map(|(label, window)| {
        window.project.as_ref().or(window.pending.as_ref()).filter(|p| {
            fs::canonicalize(p).unwrap_or_else(|_| (*p).clone()) == canonical
        }).map(|_| label.clone())
    })
}
fn ensure_project_available(state: &LocalState, label: &str, path: &Path) -> Result<()> {
    if project_owner(state, path).is_some_and(|owner| owner != label) {
        return Err("该源文件已在另一个窗口打开，请切换到原窗口编辑或选择其他保存位置".into());
    }
    Ok(())
}
fn update_project_title(window: &WebviewWindow, path: &Path) {
    if let Some(name) = path.file_name() { let _ = window.set_title(&format!("{} · SKU 制作台", name.to_string_lossy())); }
}
fn file_for(state: &LocalState, label: &str, id: &str) -> Result<PathBuf> {
    let user = state.user(label)?;
    state.db.files.get(&user.id).and_then(|files| files.get(id)).cloned().ok_or("该文件未授权给当前账号，请重新打开源文件".into())
}
fn grant(state: &mut LocalState, label: &str, path: PathBuf) -> Result<ProjectHandle> {
    let user = state.user(label)?;
    project_path(&path)?;
    let expected = fingerprint(&path)?;
    let id = uuid::Uuid::new_v4().to_string();
    let handle = ProjectHandle { id: id.clone(), name: path.file_name().ok_or("文件名无效")?.to_string_lossy().into_owned() };
    state.db.files.entry(user.id.clone()).or_default().insert(id.clone(), path);
    if let Err(e) = state.save() { state.db.files.get_mut(&user.id).unwrap().remove(&id); return Err(e); }
    state.window(label).fingerprints.insert(id, expected);
    Ok(handle)
}

#[tauri::command]
fn setup_required(state: Store) -> bool { state.lock().unwrap().db.accounts.is_empty() }
#[tauri::command]
fn current_user(window: WebviewWindow, state: Store) -> Option<User> { state.lock().unwrap().user(window.label()).ok() }
#[tauri::command]
fn setup_admin(window: WebviewWindow, state: Store, name: String, password: String) -> Result<User> { state.lock().unwrap().create(window.label(), name, password, true) }
#[tauri::command]
fn login(window: WebviewWindow, state: Store, name: String, password: String) -> Result<User> { state.lock().unwrap().login(window.label(), &name, &password) }
#[tauri::command]
fn logout(window: WebviewWindow, state: Store) { state.lock().unwrap().logout(window.label()); }
#[tauri::command]
fn list_users(window: WebviewWindow, state: Store) -> Result<Vec<User>> { let s = state.lock().unwrap(); s.admin(window.label())?; Ok(s.db.accounts.iter().map(User::from).collect()) }
#[tauri::command]
fn create_user(window: WebviewWindow, state: Store, name: String, password: String) -> Result<User> { state.lock().unwrap().create(window.label(), name, password, false) }
#[tauri::command]
fn update_user(window: WebviewWindow, state: Store, id: String, enabled: Option<bool>, password: Option<String>) -> Result<()> { state.lock().unwrap().update_user(window.label(), &id, enabled, password) }
#[tauri::command]
fn change_password(window: WebviewWindow, state: Store, current: String, next: String) -> Result<()> { state.lock().unwrap().change_password(window.label(), &current, &next) }

#[tauri::command]
async fn pick_project(window: WebviewWindow, state: Store<'_>, save: bool, suggested_name: Option<String>) -> Result<Option<ProjectHandle>> {
    let user = state.lock().unwrap().user(window.label())?;
    let mut dialog = rfd::AsyncFileDialog::new().add_filter("SKU 制作台源文件", &["skuwork"]);
    if let Some(name) = suggested_name { dialog = dialog.set_file_name(safe_filename(&name)); }
    let chosen = if save { dialog.save_file().await } else { dialog.pick_file().await };
    let Some(file) = chosen else { return Ok(None); };
    let mut s = state.lock().unwrap();
    if s.user(window.label())?.id != user.id { return Err("账号已切换，请重新选择文件".into()); }
    if save { ensure_project_available(&s, window.label(), file.path())?; }
    grant(&mut s, window.label(), file.path().to_path_buf()).map(Some)
}
#[tauri::command]
fn project_info(window: WebviewWindow, state: Store, id: String) -> Result<ProjectHandle> {
    let s = state.lock().unwrap(); let path = file_for(&s, window.label(), &id)?;
    Ok(ProjectHandle { id, name: path.file_name().ok_or("文件名无效")?.to_string_lossy().into_owned() })
}
#[tauri::command]
fn read_project(window: WebviewWindow, state: Store, id: String) -> Result<tauri::ipc::Response> {
    let mut s = state.lock().unwrap(); let path = file_for(&s, window.label(), &id)?;
    ensure_project_available(&s, window.label(), &path)?;
    let bytes = read_limited(&path)?;
    if !bytes.starts_with(b"SKUWORK1") { return Err("这不是有效的 SKU 源文件".into()); }
    s.window(window.label()).fingerprints.insert(id, Some(Sha256::digest(&bytes).to_vec()));
    s.window(window.label()).project = Some(path.clone());
    drop(s);
    update_project_title(&window, &path);
    Ok(tauri::ipc::Response::new(bytes))
}
fn write_project_bytes(state: &mut LocalState, label: &str, id: &str, bytes: &[u8]) -> Result<()> {
    let path = file_for(state, label, id)?;
    ensure_project_available(state, label, &path)?;
    if bytes.len() > MAX_BYTES || !bytes.starts_with(b"SKUWORK1") { return Err("源文件内容无效或超过 64 MB".into()); }
    let expected = state.window(label).fingerprints.get(id).ok_or("请重新打开源文件后再保存")?;
    if &fingerprint(&path)? != expected { return Err("源文件已被其他程序修改，请另存为，避免覆盖".into()); }
    auth::atomic_write(&path, bytes)?;
    state.window(label).fingerprints.insert(id.to_owned(), Some(Sha256::digest(bytes).to_vec()));
    state.window(label).project = Some(path);
    Ok(())
}
#[tauri::command]
fn write_project(window: WebviewWindow, state: Store, id: String, contents: String) -> Result<()> {
    if contents.len() > MAX_BYTES * 4 / 3 + 8 { return Err("源文件过大".into()); }
    let bytes = STANDARD.decode(contents).map_err(|_| "源文件编码无效")?;
    let mut s = state.lock().unwrap();
    write_project_bytes(&mut s, window.label(), &id, &bytes)?;
    let path = file_for(&s, window.label(), &id)?;
    drop(s);
    update_project_title(&window, &path);
    Ok(())
}
fn safe_filename(name: &str) -> String { name.chars().map(|c| if c.is_control() || "<>:\"/\\|?*".contains(c) { '_' } else { c }).collect() }
#[tauri::command]
async fn export_jpg(window: WebviewWindow, state: Store<'_>, name: String, contents: String) -> Result<bool> {
    let user = state.lock().unwrap().user(window.label())?;
    if contents.len() > MAX_BYTES * 4 / 3 + 8 { return Err("导出图片过大".into()); }
    let bytes = STANDARD.decode(contents).map_err(|_| "图片编码无效")?;
    if !bytes.starts_with(&[0xff, 0xd8, 0xff]) { return Err("导出内容不是 JPG 图片".into()); }
    let chosen = rfd::AsyncFileDialog::new().add_filter("JPG 图片", &["jpg", "jpeg"]).set_file_name(safe_filename(&name)).save_file().await;
    let Some(file) = chosen else { return Ok(false); };
    let s = state.lock().unwrap();
    if s.user(window.label())?.id != user.id { return Err("账号已切换，请重新导出".into()); }
    if !file.path().extension().and_then(|e| e.to_str()).is_some_and(|e| e.eq_ignore_ascii_case("jpg") || e.eq_ignore_ascii_case("jpeg")) { return Err("请保存为 .jpg 或 .jpeg 图片".into()); }
    auth::atomic_write(file.path(), &bytes)?;
    Ok(true)
}
#[tauri::command]
fn take_pending_project(window: WebviewWindow, state: Store) -> Result<Option<ProjectHandle>> {
    let mut s = state.lock().unwrap(); s.user(window.label())?;
    match s.window(window.label()).pending.take() {
        Some(path) => {
            let handle = grant(&mut s, window.label(), path.clone())?;
            s.window(window.label()).project = Some(path);
            Ok(Some(handle))
        },
        None => Ok(None),
    }
}

#[tauri::command]
fn release_project(window: WebviewWindow, state: Store) {
    let mut s = state.lock().unwrap();
    let active = s.window(window.label());
    active.project = None; active.pending = None; active.fingerprints.clear();
    drop(s);
    let _ = window.set_title("SKU 制作台 · 本地测试版");
}

fn show_project_window(app: &tauri::AppHandle, path: PathBuf, session: Option<String>) -> Result<()> {
    project_path(&path)?;
    let path = fs::canonicalize(path).map_err(|_| "无法读取源文件，请检查文件位置与权限")?;
    let store = app.state::<Mutex<LocalState>>();
    let mut s = store.lock().unwrap();
    if let Some(label) = project_owner(&s, &path) {
        drop(s);
        if let Some(window) = app.get_webview_window(&label) { let _ = window.unminimize(); let _ = window.set_focus(); }
        return Ok(());
    }
    let label = format!("project-{}", uuid::Uuid::new_v4());
    let active = s.window(&label);
    active.session = session;
    active.pending = Some(path.clone());
    drop(s);
    let mut config = app.config().app.windows[0].clone();
    config.label = label.clone();
    config.title = format!("{} · SKU 制作台", path.file_name().unwrap().to_string_lossy());
    let result = tauri::WebviewWindowBuilder::from_config(app, &config).and_then(|builder| builder.build());
    if let Err(error) = result {
        store.lock().unwrap().windows.remove(&label);
        return Err(format!("新窗口打开失败：{error}"));
    }
    Ok(())
}

#[tauri::command]
async fn open_project_window(window: WebviewWindow, state: Store<'_>, id: String) -> Result<()> {
    let (path, session) = {
        let s = state.lock().unwrap();
        (file_for(&s, window.label(), &id)?, s.user(window.label())?.id)
    };
    show_project_window(window.app_handle(), path, Some(session))
}

#[tauri::command]
async fn cutout_image(window: WebviewWindow, state: Store<'_>, contents: String) -> Result<tauri::ipc::Response> {
    let user = state.lock().unwrap().user(window.label())?;
    if contents.len() > 30 * 1024 * 1024 * 4 / 3 + 8 { return Err("图片超过 30 MB".into()); }
    let bytes = STANDARD.decode(contents).map_err(|_| "图片编码无效")?;
    let result = tauri::async_runtime::spawn_blocking(move || cutout::run(bytes)).await.map_err(|_| "图片处理任务中断")??;
    if state.lock().unwrap().user(window.label())?.id != user.id { return Err("账号已切换，请重新导入图片".into()); }
    Ok(tauri::ipc::Response::new(result))
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            if let Some(path) = args.iter().skip(1).map(PathBuf::from).find(|p| project_path(p).is_ok()) {
                let windows = app.webview_windows();
                let mut labels: Vec<_> = windows.keys().collect();
                labels.sort_by_key(|label| (!windows[*label].is_focused().unwrap_or(false), *label != "main"));
                let session = {
                    let store = app.state::<Mutex<LocalState>>();
                    let s = store.lock().unwrap();
                    labels.iter().find_map(|label| s.user(label).ok().map(|user| user.id))
                };
                let app = app.clone();
                tauri::async_runtime::spawn(async move {
                    if let Err(error) = show_project_window(&app, path, session) {
                        rfd::AsyncMessageDialog::new().set_title("源文件无法打开").set_description(error).show().await;
                    }
                });
            } else if let Some(window) = app.get_webview_window("main").or_else(|| app.webview_windows().into_values().next()) {
                let _ = window.unminimize(); let _ = window.set_focus();
            }
        }))
        .setup(|app| {
            let dir = app.path().app_local_data_dir()?;
            fs::create_dir_all(&dir)?;
            let mut state = LocalState::load(dir.join("accounts.json")).map_err(std::io::Error::other)?;
            state.window("main").pending = std::env::args_os().skip(1).map(PathBuf::from).find(|p| project_path(p).is_ok());
            app.manage(Mutex::new(state));
            Ok(())
        })
        .on_window_event(|window, event| {
            if matches!(event, tauri::WindowEvent::Destroyed) {
                window.state::<Mutex<LocalState>>().lock().unwrap().windows.remove(window.label());
            }
        })
        .invoke_handler(tauri::generate_handler![setup_required, current_user, setup_admin, login, logout, list_users, create_user, update_user, change_password, pick_project, project_info, read_project, write_project, export_jpg, take_pending_project, open_project_window, release_project, cutout_image])
        .run(tauri::generate_context!())
        .expect("SKU 制作台启动失败，请检查本机应用数据与 WebView2");
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn file_grants_are_per_user_and_external_changes_are_not_overwritten() {
        let dir = tempfile::tempdir().unwrap();
        let mut s = LocalState::load(dir.path().join("accounts.json")).unwrap();
        let p = uuid::Uuid::new_v4().to_string();
        s.create("main", "admin".into(), p.clone(), true).unwrap();
        s.create("main", "user".into(), p.clone(), false).unwrap();
        let path = dir.path().join("项目.skuwork");
        let handle = grant(&mut s, "main", path.clone()).unwrap();
        write_project_bytes(&mut s, "main", &handle.id, b"SKUWORK1original").unwrap();
        fs::write(&path, b"SKUWORK1external").unwrap();
        assert!(write_project_bytes(&mut s, "main", &handle.id, b"SKUWORK1new").is_err());
        assert_eq!(fs::read(&path).unwrap(), b"SKUWORK1external");
        s.login("main", "user", &p).unwrap();
        assert!(file_for(&s, "main", &handle.id).is_err());
        assert!(write_project_bytes(&mut s, "main", &handle.id, b"SKUWORK1new").is_err());
    }
    #[test]
    fn two_projects_save_independently_and_cannot_overwrite_another_open_window() {
        let dir = tempfile::tempdir().unwrap();
        let mut s = LocalState::load(dir.path().join("accounts.json")).unwrap();
        let user = s.create("main", "admin".into(), uuid::Uuid::new_v4().to_string(), true).unwrap();
        s.window("project-two").session = Some(user.id);
        let a = grant(&mut s, "main", dir.path().join("A.skuwork")).unwrap();
        let b = grant(&mut s, "project-two", dir.path().join("B.skuwork")).unwrap();
        write_project_bytes(&mut s, "main", &a.id, b"SKUWORK1A").unwrap();
        write_project_bytes(&mut s, "project-two", &b.id, b"SKUWORK1B").unwrap();
        let same_a = grant(&mut s, "project-two", dir.path().join("A.skuwork")).unwrap();
        assert!(write_project_bytes(&mut s, "project-two", &same_a.id, b"SKUWORK1overwrite").is_err());
        assert!(write_project_bytes(&mut s, "project-two", &a.id, b"SKUWORK1overwrite").is_err());
        s.logout("project-two");
        write_project_bytes(&mut s, "main", &a.id, b"SKUWORK1A-updated").unwrap();
        assert_eq!(fs::read(dir.path().join("A.skuwork")).unwrap(), b"SKUWORK1A-updated");
        assert_eq!(fs::read(dir.path().join("B.skuwork")).unwrap(), b"SKUWORK1B");
    }
    #[test]
    fn pending_files_are_reserved_per_window_and_closing_releases_only_its_file() {
        let dir = tempfile::tempdir().unwrap();
        let mut s = LocalState::load(dir.path().join("accounts.json")).unwrap();
        let a = dir.path().join("A.skuwork");
        let b = dir.path().join("B.skuwork");
        fs::write(&a, b"SKUWORK1A").unwrap(); fs::write(&b, b"SKUWORK1B").unwrap();
        s.window("main").pending = Some(a.clone());
        s.window("project-two").pending = Some(b.clone());
        assert_eq!(project_owner(&s, &a), Some("main".into()));
        assert_eq!(project_owner(&s, &dir.path().join(".\\B.skuwork")), Some("project-two".into()));
        assert!(ensure_project_available(&s, "project-two", &a).is_err());
        assert!(ensure_project_available(&s, "main", &a).is_ok());
        s.windows.remove("main");
        assert_eq!(project_owner(&s, &a), None);
        assert_eq!(project_owner(&s, &b), Some("project-two".into()));
    }
}
