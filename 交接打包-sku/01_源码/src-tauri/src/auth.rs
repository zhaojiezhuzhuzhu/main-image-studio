use argon2::{password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString}, Argon2};
use rand_core::OsRng;
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, fs, io::Write, path::{Path, PathBuf}, time::{Duration, Instant}};

pub type Result<T> = std::result::Result<T, String>;

#[derive(Clone, Serialize, Deserialize)]
pub struct Account {
    pub id: String,
    pub name: String,
    pub role: String,
    pub enabled: bool,
    pub password_hash: String,
}

#[derive(Clone, Serialize)]
pub struct User {
    pub id: String,
    pub name: String,
    pub role: String,
    pub enabled: bool,
}
impl From<&Account> for User {
    fn from(a: &Account) -> Self { Self { id: a.id.clone(), name: a.name.clone(), role: a.role.clone(), enabled: a.enabled } }
}

#[derive(Default, Serialize, Deserialize)]
pub struct Database {
    pub accounts: Vec<Account>,
    #[serde(default)]
    pub files: HashMap<String, HashMap<String, PathBuf>>,
}

#[derive(Default)]
pub struct WindowState {
    pub session: Option<String>,
    pub fingerprints: HashMap<String, Option<Vec<u8>>>,
    pub pending: Option<PathBuf>,
    pub project: Option<PathBuf>,
}

pub struct LocalState {
    pub path: PathBuf,
    pub db: Database,
    pub windows: HashMap<String, WindowState>,
    failures: u32,
    retry_at: Option<Instant>,
}

pub fn atomic_write(path: &Path, bytes: &[u8]) -> Result<()> {
    let parent = path.parent().ok_or("保存位置无效")?;
    let mut temp = tempfile::NamedTempFile::new_in(parent).map_err(|_| "无法在该位置创建临时文件，请检查写入权限")?;
    temp.write_all(bytes).map_err(|_| "文件写入失败，原文件未替换")?;
    temp.as_file().sync_all().map_err(|_| "文件同步失败，原文件未替换")?;
    temp.persist(path).map_err(|_| "无法替换文件，请检查文件是否被占用")?;
    Ok(())
}

fn hash(password: &str) -> Result<String> {
    if password.chars().count() < 8 || password.len() > 256 { return Err("密码请使用至少 8 个字符，且不超过 256 字节".into()); }
    Argon2::default().hash_password(password.as_bytes(), &SaltString::generate(&mut OsRng)).map(|h| h.to_string()).map_err(|_| "密码设置失败".into())
}
fn matches(password: &str, encoded: &str) -> bool {
    PasswordHash::new(encoded).map(|h| Argon2::default().verify_password(password.as_bytes(), &h).is_ok()).unwrap_or(false)
}

impl LocalState {
    pub fn load(path: PathBuf) -> Result<Self> {
        let db = match fs::read(&path) {
            Ok(bytes) => serde_json::from_slice(&bytes).map_err(|_| "本机账号数据损坏，请保留数据并联系维护人员恢复")?,
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Database::default(),
            Err(_) => return Err("无法读取本机账号数据".into()),
        };
        Ok(Self { path, db, windows: HashMap::new(), failures: 0, retry_at: None })
    }
    pub fn save(&self) -> Result<()> {
        atomic_write(&self.path, &serde_json::to_vec(&self.db).map_err(|_| "账号数据保存失败")?)
    }
    pub fn window(&mut self, label: &str) -> &mut WindowState {
        self.windows.entry(label.to_owned()).or_default()
    }
    pub fn user(&self, label: &str) -> Result<User> {
        let session = self.windows.get(label).and_then(|w| w.session.as_ref());
        self.db.accounts.iter().find(|a| Some(&a.id) == session && a.enabled).map(User::from).ok_or("请先登录".into())
    }
    pub fn logout(&mut self, label: &str) {
        let window = self.window(label);
        window.session = None; window.fingerprints.clear(); window.project = None;
    }
    pub fn admin(&self, label: &str) -> Result<User> {
        let user = self.user(label)?;
        if user.role != "admin" { return Err("此操作仅限管理员".into()); }
        Ok(user)
    }
    pub fn create(&mut self, label: &str, name: String, password: String, setup: bool) -> Result<User> {
        if setup {
            if !self.db.accounts.is_empty() { return Err("管理员已设置，请登录".into()); }
        } else { self.admin(label)?; }
        let name = name.trim().to_owned();
        if name.is_empty() || name.chars().count() > 32 || name.chars().any(char::is_control) { return Err("账号请填写 1 至 32 个可见字符".into()); }
        if self.db.accounts.iter().any(|a| a.name.to_lowercase() == name.to_lowercase()) { return Err("该账号已存在".into()); }
        let account = Account { id: uuid::Uuid::new_v4().to_string(), name, role: if setup { "admin" } else { "user" }.into(), enabled: true, password_hash: hash(&password)? };
        let user = User::from(&account);
        self.db.accounts.push(account);
        if let Err(e) = self.save() { self.db.accounts.pop(); return Err(e); }
        if setup { self.window(label).session = Some(user.id.clone()); }
        Ok(user)
    }
    pub fn login(&mut self, label: &str, name: &str, password: &str) -> Result<User> {
        if self.retry_at.is_some_and(|t| t > Instant::now()) { return Err("尝试次数较多，请稍后再试".into()); }
        let account = self.db.accounts.iter().find(|a| a.name.to_lowercase() == name.trim().to_lowercase());
        if let Some(a) = account.filter(|a| a.enabled && password.len() <= 256 && matches(password, &a.password_hash)) {
            let user = User::from(a);
            self.logout(label); self.window(label).session = Some(user.id.clone()); self.failures = 0; self.retry_at = None;
            return Ok(user);
        }
        self.failures += 1;
        if self.failures >= 5 { self.retry_at = Some(Instant::now() + Duration::from_secs(30)); }
        Err("账号或密码不正确，或账号已停用".into())
    }
    pub fn change_password(&mut self, label: &str, current: &str, next: &str) -> Result<()> {
        let user = self.user(label)?;
        let i = self.db.accounts.iter().position(|a| a.id == user.id).unwrap();
        if !matches(current, &self.db.accounts[i].password_hash) { return Err("当前密码不正确".into()); }
        let old = std::mem::replace(&mut self.db.accounts[i].password_hash, hash(next)?);
        if let Err(e) = self.save() { self.db.accounts[i].password_hash = old; return Err(e); }
        Ok(())
    }
    pub fn update_user(&mut self, label: &str, id: &str, enabled: Option<bool>, password: Option<String>) -> Result<()> {
        self.admin(label)?;
        let i = self.db.accounts.iter().position(|a| a.id == id && a.role == "user").ok_or("只能管理普通用户")?;
        let old = self.db.accounts[i].clone();
        if let Some(p) = password { self.db.accounts[i].password_hash = hash(&p)?; }
        if let Some(e) = enabled { self.db.accounts[i].enabled = e; }
        if let Err(e) = self.save() { self.db.accounts[i] = old; return Err(e); }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn state() -> (tempfile::TempDir, LocalState, String) {
        let dir = tempfile::tempdir().unwrap();
        let state = LocalState::load(dir.path().join("accounts.json")).unwrap();
        (dir, state, uuid::Uuid::new_v4().to_string())
    }
    #[test]
    fn roles_and_disabled_accounts_are_enforced_natively() {
        let (_dir, mut s, p) = state();
        assert!(s.admin("main").is_err());
        s.create("main", "管理员".into(), p.clone(), true).unwrap();
        assert!(s.create("main", "第二管理员".into(), p.clone(), true).is_err());
        let u = s.create("main", "测试员".into(), p.clone(), false).unwrap();
        s.logout("main");
        s.login("main", "测试员", &p).unwrap();
        assert!(s.admin("main").is_err());
        assert!(s.create("main", "越权".into(), p.clone(), false).is_err());
        assert!(s.update_user("main", &u.id, Some(false), None).is_err());
        s.login("main", "管理员", &p).unwrap();
        s.update_user("main", &u.id, Some(false), None).unwrap();
        s.logout("main");
        assert!(s.login("main", "测试员", &p).is_err());
        assert!(!fs::read_to_string(&s.path).unwrap().contains(&p));
    }
    #[test]
    fn password_reset_and_reload_preserve_accounts() {
        let (_dir, mut s, p) = state();
        s.create("main", "admin".into(), p.clone(), true).unwrap();
        let u = s.create("main", "tester".into(), p.clone(), false).unwrap();
        let next = uuid::Uuid::new_v4().to_string();
        s.update_user("main", &u.id, None, Some(next.clone())).unwrap();
        let mut reloaded = LocalState::load(s.path.clone()).unwrap();
        assert!(reloaded.login("main", "tester", &p).is_err());
        assert!(reloaded.login("main", "tester", &next).is_ok());
        assert!(reloaded.change_password("main", &p, &next).is_err());
        reloaded.change_password("main", &next, &p).unwrap();
        assert!(reloaded.login("main", "tester", &p).is_ok());
    }
    #[test]
    fn corrupt_store_cannot_reset_admin() {
        let (dir, _s, _p) = state();
        let path = dir.path().join("bad.json");
        fs::write(&path, b"invalid").unwrap();
        assert!(LocalState::load(path).is_err());
    }
    #[test]
    fn window_login_and_logout_leave_other_windows_authenticated() {
        let (_dir, mut s, p) = state();
        let admin = s.create("main", "admin".into(), p.clone(), true).unwrap();
        let user = s.create("main", "user".into(), p.clone(), false).unwrap();
        s.window("project-one").session = Some(admin.id.clone());
        s.window("project-one").fingerprints.insert("file".into(), Some(vec![1]));
        s.logout("main");
        assert!(s.user("main").is_err());
        assert_eq!(s.user("project-one").unwrap().id, admin.id);
        s.login("main", "user", &p).unwrap();
        assert_eq!(s.user("main").unwrap().id, user.id);
        assert!(s.admin("main").is_err());
        assert!(s.admin("project-one").is_ok());
        assert_eq!(s.window("project-one").fingerprints.get("file"), Some(&Some(vec![1])));
        assert!(s.user("unregistered-window").is_err());
    }
}
