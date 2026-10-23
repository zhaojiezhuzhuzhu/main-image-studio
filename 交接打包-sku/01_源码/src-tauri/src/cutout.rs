use std::{fs, process::Command, sync::Mutex};

static CUTOUT: Mutex<()> = Mutex::new(());
const LIMIT: usize = 30 * 1024 * 1024;

pub fn run(bytes: Vec<u8>) -> Result<Vec<u8>, String> {
    let _guard = CUTOUT.try_lock().map_err(|_| "另一张图片正在处理，请稍后重新上传")?;
    if bytes.is_empty() || bytes.len() > LIMIT { return Err("图片为空或超过 30 MB".into()); }
    let job = tempfile::Builder::new().prefix("sku-ps-cutout-").tempdir().map_err(|_| "无法建立图片处理目录")?;
    let ext = if bytes.starts_with(b"\x89PNG\r\n\x1a\n") { "png" } else if bytes.starts_with(&[255, 216, 255]) { "jpg" } else { return Err("请选择 JPG 或 PNG 图片".into()); };
    fs::write(job.path().join(format!("input.{ext}")), bytes).map_err(|_| "无法准备图片副本")?;
    fs::write(job.path().join("photoshop-cutout.ps1"), include_str!("../../scripts/photoshop-cutout.ps1")).map_err(|_| "无法准备处理脚本")?;
    fs::write(job.path().join("photoshop-cutout.jsx"), include_str!("../../scripts/photoshop-cutout.jsx")).map_err(|_| "无法准备处理脚本")?;
    let mut command = Command::new("powershell.exe");
    command.args(["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File"])
        .arg(job.path().join("photoshop-cutout.ps1")).arg("-JobDirectory").arg(job.path());
    #[cfg(windows)] {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000); // CREATE_NO_WINDOW: never show a shell window.
    }
    let result = command.output().map_err(|_| "无法启动本机图片处理程序")?;
    if !result.status.success() {
        return Err(fs::read_to_string(job.path().join("error.txt")).unwrap_or_else(|_| "图片处理失败，请确认已安装 Photoshop 2020".into()));
    }
    let png = fs::read(job.path().join("output.png")).map_err(|_| "未生成透明 PNG")?;
    if !png.starts_with(b"\x89PNG\r\n\x1a\n") { return Err("抠图输出不是有效 PNG".into()); }
    Ok(png)
}
