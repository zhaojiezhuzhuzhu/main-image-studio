[CmdletBinding()]
param([Parameter(Mandatory = $true)][string]$JobDirectory, [switch]$ValidateOnly)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.UTF8Encoding]::new($false)
$executable = $null
$progId = $null
$job = (Resolve-Path -LiteralPath $JobDirectory).Path
$inputFile = Join-Path $job 'input.jpg'
if (-not (Test-Path -LiteralPath $inputFile)) { $inputFile = Join-Path $job 'input.png' }
$outputFile = Join-Path $job 'output.png'
$reportFile = Join-Path $job 'report.json'
$jsxFile = Join-Path $PSScriptRoot 'photoshop-cutout.jsx'
$wrapper = Join-Path $job 'run.jsx'
$errorFile = Join-Path $job 'error.txt'
$gate = [Threading.Mutex]::new($false, 'Local\SkuWorkbenchPhotoshopCutout')
$locked = $false
$photoshop = $null

function Resolve-PhotoshopRegistration {
    param([Parameter(Mandatory = $true)][string]$CandidateProgId)
    if ($CandidateProgId -notmatch '^Photoshop\.Application(?:\.\d+)?$') { return $null }
    $clsidEntry = Get-ItemProperty -LiteralPath "Registry::HKEY_CLASSES_ROOT\$CandidateProgId\CLSID" -ErrorAction SilentlyContinue
    $candidateClsid = if ($null -ne $clsidEntry) { [string]$clsidEntry.'(default)' } else { '' }
    if ($candidateClsid -notmatch '^\{[0-9A-F-]+\}$') { return $null }
    $serverEntry = Get-ItemProperty -LiteralPath "Registry::HKEY_CLASSES_ROOT\CLSID\$candidateClsid\LocalServer32" -ErrorAction SilentlyContinue
    $registered = if ($null -ne $serverEntry) { [string]$serverEntry.'(default)' } else { '' }
    if ($registered -notmatch '^(?:"(?<path>[^"]+\.exe)"|(?<path>.+?\.exe))(?:\s|$)') { return $null }
    $candidateExecutable = [IO.Path]::GetFullPath($Matches['path'])
    if (-not (Test-Path -LiteralPath $candidateExecutable -PathType Leaf)) { return $null }
    return [PSCustomObject]@{ ProgId = $CandidateProgId; Executable = $candidateExecutable }
}

try {
    if (-not (Test-Path -LiteralPath $inputFile -PathType Leaf)) { throw '待处理图片不存在' }
    if (-not (Test-Path -LiteralPath $jsxFile -PathType Leaf)) { throw '缺少图片处理脚本' }
    if (Test-Path -LiteralPath $outputFile) { throw '此处理任务已有输出，请勿重复运行' }
    if (Test-Path -LiteralPath $errorFile) { Remove-Item -LiteralPath $errorFile -Force }

    # Prefer the already-running Photoshop so an unsaved user document never
    # has to be closed just because another installed version owns CurVer.
    $initialRunning = @(Get-Process Photoshop -ErrorAction SilentlyContinue | Where-Object { $_.Path })
    $runningPaths = @($initialRunning | ForEach-Object { [IO.Path]::GetFullPath($_.Path) } | Select-Object -Unique)
    if ($runningPaths.Count -gt 1) { throw '检测到多个 Photoshop 版本正在运行，请只保留一个版本后重新上传图片' }
    $registration = $null
    if ($runningPaths.Count -eq 1) {
        $runningPath = $runningPaths[0]
        $runningVersion = [Diagnostics.FileVersionInfo]::GetVersionInfo($runningPath).ProductVersion
        $runningMajor = 0
        if ([int]::TryParse(($runningVersion -split '\.')[0], [ref]$runningMajor) -and $runningMajor -ge 8) {
            $runningProgId = "Photoshop.Application.$(($runningMajor - 7) * 10)"
            $candidate = Resolve-PhotoshopRegistration $runningProgId
            if ($null -ne $candidate -and $candidate.Executable.Equals($runningPath, [StringComparison]::OrdinalIgnoreCase)) {
                $registration = $candidate
            }
        }
        if ($null -eq $registration) { throw "当前运行的 Photoshop 未正确注册自动调用组件：$runningPath" }
    } else {
        # With no running instance, use Adobe's registered current version.
        $curVerEntry = Get-ItemProperty -LiteralPath 'Registry::HKEY_CLASSES_ROOT\Photoshop.Application\CurVer' -ErrorAction SilentlyContinue
        $curVer = if ($null -ne $curVerEntry) { [string]$curVerEntry.'(default)' } else { '' }
        $registration = Resolve-PhotoshopRegistration $(if ($curVer) { $curVer } else { 'Photoshop.Application' })
        if ($null -eq $registration) { throw '未找到可自动调用的 Photoshop，请重新安装或修复 Photoshop 后重试' }
    }
    $progId = $registration.ProgId
    $executable = $registration.Executable
    if ($ValidateOnly) { Write-Output 'PHOTOSHOP_CUTOUT_VALIDATION_OK'; exit 0 }
    try { $locked = $gate.WaitOne(0) } catch [Threading.AbandonedMutexException] { $locked = $true }
    if (-not $locked) { throw '另一张图片正在处理，请稍后重新上传' }
    $running = @(Get-Process Photoshop -ErrorAction SilentlyContinue)
    $existing = @($running | Where-Object { $_.Path -eq $executable })
    if ($existing.Count -eq 0) {
        if (@($running | Where-Object { $_.Path -and $_.Path -ne $executable }).Count -gt 0) {
            throw '请先保存并退出其他版本的 Photoshop，再重新上传图片'
        }
        Start-Process -FilePath $executable -ArgumentList '/Automation' -WindowStyle Hidden | Out-Null
    }
    try { $photoshop = New-Object -ComObject $progId }
    catch { throw '无法连接 Photoshop，请确认它能正常启动、没有阻塞的启动提示，再重新上传' }
    $majorVersion = 0
    $versionText = [string]$photoshop.Version
    if (-not [int]::TryParse(($versionText -split '\.')[0], [ref]$majorVersion) -or $majorVersion -lt 21) {
        throw "当前 Photoshop 版本 $versionText 过旧，需要 Photoshop 2020 或更高版本"
    }
    # Hide only an instance started for this request; never hide an existing user's PS window.
    if ($existing.Count -eq 0) {
        Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public static class SkuPhotoshopWindow { [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr window, int command); }'
        Get-Process Photoshop -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $executable } | ForEach-Object {
            if ($_.MainWindowHandle -ne [IntPtr]::Zero) { [void][SkuPhotoshopWindow]::ShowWindowAsync($_.MainWindowHandle, 0) }
        }
    }
    $request = @{ input = $inputFile; output = $outputFile; report = $reportFile } | ConvertTo-Json -Compress
    $scriptPath = $jsxFile | ConvertTo-Json -Compress
    [IO.File]::WriteAllText($wrapper, "var SKU_CUTOUT_REQUEST = $request;`n`$.evalFile($scriptPath);", [Text.UTF8Encoding]::new($false))
    [void]$photoshop.DoJavaScriptFile($wrapper)
    if (-not (Test-Path -LiteralPath $outputFile) -or -not (Test-Path -LiteralPath $reportFile)) { throw '未生成透明 PNG，请重新上传' }
    Write-Output 'PHOTOSHOP_CUTOUT_OK'
} catch {
    [IO.File]::WriteAllText($errorFile, $_.Exception.Message, [Text.UTF8Encoding]::new($false))
    [Console]::Error.WriteLine($_.Exception.Message)
    exit 1
} finally {
    if ($null -ne $photoshop) { [void][Runtime.InteropServices.Marshal]::FinalReleaseComObject($photoshop) }
    if (Test-Path -LiteralPath $wrapper) { Remove-Item -LiteralPath $wrapper -Force }
    if ($locked) { $gate.ReleaseMutex() }
    $gate.Dispose()
}
