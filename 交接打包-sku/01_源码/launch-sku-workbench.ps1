param([switch]$NoOpen, [switch]$Open, [string]$ProjectPath = '')

$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$url = 'http://127.0.0.1:4173'
$port = 4173
$pidFile = Join-Path $root '.vite.pid'
$viteScript = Join-Path $root 'node_modules\vite\bin\vite.js'

function Get-WorkbenchListener {
  Get-NetTCPConnection -State Listen -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -First 1
}

function Test-Workbench($listener) {
  if (-not $listener) { return $false }
  try {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)"
    if ($process.Name -ne 'node.exe' -or -not $process.CommandLine) { return $false }
    $arguments = [regex]::Matches($process.CommandLine, '"([^"]*)"|(\S+)')
    if ($arguments.Count -lt 2) { return $false }
    $scriptPath = if ($arguments[1].Groups[1].Success) { $arguments[1].Groups[1].Value } else { $arguments[1].Groups[2].Value }
    # npm starts Vite through node_modules\.bin\..; compare the resolved script path.
    if ($scriptPath -notmatch '^(?:[a-zA-Z]:[\\/]|\\\\)') { return $false }
    $scriptPath = [IO.Path]::GetFullPath($scriptPath.Replace('/', '\'))
    if ($scriptPath -ne [IO.Path]::GetFullPath($viteScript)) { return $false }
    if ((Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 $url).StatusCode -ne 200) { return $false }
    $health = (Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 "$url/__skuwork/health").Content
    $healthText = if ($health -is [byte[]]) { [Text.Encoding]::UTF8.GetString($health) } else { [string]$health }
    return $healthText -eq 'ok'
  }
  catch { return $false }
}

# Serialize double-clicks. PID files are only records, never authority to kill a process.
$mutex = New-Object System.Threading.Mutex($false, 'Local\SkuWorkbenchLauncher4173')
$locked = $false
$exitCode = 0
try {
  try { $locked = $mutex.WaitOne(30000) }
  catch [System.Threading.AbandonedMutexException] { $locked = $true }
  if (-not $locked) { throw 'Another launcher is still starting. Please try again shortly.' }
  $listener = Get-WorkbenchListener
  $reused = Test-Workbench $listener
  if ($listener -and -not $reused) {
    throw "Port $port is occupied by another or unhealthy service (PID $($listener.OwningProcess)). No process was stopped."
  }
  if (-not $reused) {
    if (-not (Test-Path -LiteralPath $viteScript)) { throw 'Vite is missing. Restore project dependencies first.' }
    $node = (Get-Command node.exe -ErrorAction Stop).Source
    if (Test-Path -LiteralPath $pidFile) { Remove-Item -LiteralPath $pidFile -Force }
    $output = Join-Path $root '.vite.log'
    $errorOutput = Join-Path $root '.vite-error.log'
    $arguments = '"' + $viteScript + '" --host 127.0.0.1 --port 4173 --strictPort'
    $started = Start-Process -WindowStyle Hidden -FilePath $node -WorkingDirectory $root -ArgumentList $arguments -RedirectStandardOutput $output -RedirectStandardError $errorOutput -PassThru
    $ready = $false
    for ($attempt = 0; $attempt -lt 30; $attempt++) {
      Start-Sleep -Milliseconds 500
      $listener = Get-WorkbenchListener
      if (Test-Workbench $listener) { $ready = $true; break }
      if ($started.HasExited) { break }
    }
    if (-not $ready) { throw "Workbench did not become ready. See $errorOutput. No existing process was stopped." }
  }
  try { & (Join-Path $root 'public\windows\install-source-icon.ps1') -Quiet }
  catch { Write-Warning "SKU source icon setup failed: $($_.Exception.Message)" }
  Set-Content -LiteralPath $pidFile -Value $listener.OwningProcess -Encoding ascii
  $action = if ($reused) { 'Reused' } else { 'Started' }
  Write-Host "$action workbench: $url (PID $($listener.OwningProcess))"
  if (Get-Command git -ErrorAction SilentlyContinue) {
    $revision = & git -c "safe.directory=$root" -C $root rev-parse --short HEAD 2>$null
    if ($LASTEXITCODE -eq 0) { Write-Host "Local revision: $revision" }
  }
  $openUrl = $url
  if ($ProjectPath) {
    $resolvedProject = (Resolve-Path -LiteralPath $ProjectPath -ErrorAction Stop).Path
    if ([IO.Path]::GetExtension($resolvedProject) -ne '.skuwork') { throw 'Only .skuwork project files can be opened.' }
    $encodedPath = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($resolvedProject))
    $relay = Invoke-RestMethod -Method Post -Uri "$url/__skuwork/open" -Headers @{ 'X-Skuwork-Path' = $encodedPath } -TimeoutSec 10
    if (-not $relay.token) { throw 'Workbench did not accept the project file.' }
    $openUrl = "$url/?open=$($relay.token)"
  }
  if (-not $NoOpen) { Start-Process $openUrl }
}
catch {
  Write-Host $_.Exception.Message -ForegroundColor Red
  $exitCode = 1
}
finally {
  if ($locked) { $mutex.ReleaseMutex() }
  $mutex.Dispose()
}
exit $exitCode
