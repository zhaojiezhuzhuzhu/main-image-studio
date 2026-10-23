param([switch]$SkipTests)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$localCargo = Join-Path (Get-Location) 'tmp/desktop-tools/cargo'
if (!(Get-Command cargo -ErrorAction SilentlyContinue) -and (Test-Path -LiteralPath "$localCargo/bin/cargo.exe")) {
  $env:CARGO_HOME = $localCargo
  $env:RUSTUP_HOME = Join-Path (Get-Location) 'tmp/desktop-tools/rustup'
  $env:PATH = "$localCargo/bin;$env:PATH"
}
if (!(Get-Command cargo -ErrorAction SilentlyContinue)) { throw '请先安装 Rust stable MSVC 工具链及 Visual Studio C++ 构建工具。' }
if (!$SkipTests) {
  & npm.cmd test -- --dir src --maxWorkers 4
  if ($LASTEXITCODE -ne 0) { throw '应用测试未通过，已停止打包。' }
  & cargo test --manifest-path src-tauri/Cargo.toml --locked
  if ($LASTEXITCODE -ne 0) { throw '桌面权限与文件测试未通过，已停止打包。' }
}
& npm.cmd run desktop:build -- -- --locked
if ($LASTEXITCODE -ne 0) { throw '桌面安装包构建失败。' }
$desktopVersion = (Get-Content -LiteralPath src-tauri/tauri.conf.json -Raw -Encoding UTF8 | ConvertFrom-Json).version
$desktopOutput = Join-Path (Get-Location) "releases/$desktopVersion"
New-Item -ItemType Directory -Path $desktopOutput -Force | Out-Null
Get-ChildItem -LiteralPath src-tauri/target/release/bundle/nsis -Filter "*_${desktopVersion}_x64-setup.exe" | Copy-Item -Destination $desktopOutput
Copy-Item -LiteralPath docs/desktop-testing-guide.md -Destination (Join-Path $desktopOutput '测试使用说明.txt')
Get-ChildItem -LiteralPath $desktopOutput -Filter '*.exe' | Get-FileHash -Algorithm SHA256 | ForEach-Object { "$($_.Hash)  $(Split-Path $_.Path -Leaf)" } | Set-Content -LiteralPath (Join-Path $desktopOutput 'SHA256.txt') -Encoding UTF8
Write-Output "测试安装包已输出：$desktopOutput"
