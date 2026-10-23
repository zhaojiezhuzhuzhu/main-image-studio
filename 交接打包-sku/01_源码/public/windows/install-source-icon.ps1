param([switch]$Quiet)

$ErrorActionPreference = 'Stop'
$source = Join-Path $PSScriptRoot 'sku-source.ico'
$destination = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'SkuWorkbench\sku-source.ico'
$iconKey = 'HKCU:\Software\Classes\.skuwork\DefaultIcon'
$iconValue = '"' + $destination + '",0'

if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw 'SKU source icon is missing. Extract the complete installation package first.' }

$classes = 'HKCU:\Software\Classes'
$extension = Get-Item -LiteralPath "$classes\.skuwork" -ErrorAction SilentlyContinue
$progId = if ($extension) { $extension.GetValue('') } else { '' }
$choice = (Get-ItemProperty -LiteralPath 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\FileExts\.skuwork\UserChoice' -Name ProgId -ErrorAction SilentlyContinue).ProgId
$iconKeys = @($iconKey)
$newType = -not $progId -and -not $choice
if ($newType) { $progId = 'SkuWorkbench.SourceFile' }
# Windows can prefer the selected launcher's icon over the extension icon.
# Only update dedicated SKU handlers, never a general-purpose application's icon.
foreach ($handler in @($progId, $choice) | Select-Object -Unique) {
  if ($handler -in @('SkuWorkbench.SourceFile', 'skuwork_auto_file', 'Applications\打开SKU工作台.cmd')) {
    $iconKeys += "$classes\$handler\DefaultIcon"
  }
}
$copyNeeded = -not (Test-Path -LiteralPath $destination -PathType Leaf)
if (-not $copyNeeded) {
  $copyNeeded = (Get-FileHash -LiteralPath $source).Hash -ne (Get-FileHash -LiteralPath $destination).Hash
}
$pendingKeys = @($iconKeys | Where-Object {
  $current = Get-Item -LiteralPath $_ -ErrorAction SilentlyContinue
  -not $current -or $current.GetValue('') -ne $iconValue
})

if ($copyNeeded) {
  New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
  Copy-Item -LiteralPath $source -Destination $destination -Force
}
if ($newType) {
  New-Item -Path "$classes\$progId" -Force | Out-Null
  Set-Item -LiteralPath "$classes\$progId" -Value 'SKU 源文件'
  New-Item -Path "$classes\.skuwork" -Force | Out-Null
  Set-Item -LiteralPath "$classes\.skuwork" -Value $progId
}
foreach ($key in $pendingKeys) {
  New-Item -Path $key -Force | Out-Null
  Set-Item -LiteralPath $key -Value $iconValue
}
if ($copyNeeded -or $pendingKeys.Count -or $newType) {
  if (-not ('SkuWorkbench.IconNotification' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
namespace SkuWorkbench {
  public static class IconNotification {
    [DllImport("shell32.dll")]
    public static extern void SHChangeNotify(uint eventId, uint flags, IntPtr item1, IntPtr item2);
  }
}
'@
  }
  [SkuWorkbench.IconNotification]::SHChangeNotify(0x08000000, 0, [IntPtr]::Zero, [IntPtr]::Zero)
}
if (-not $Quiet) { Write-Host 'SKU source file icon installed. Refresh the folder to see it.' }
if ($choice -and $choice -notin @('SkuWorkbench.SourceFile', 'skuwork_auto_file', 'Applications\打开SKU工作台.cmd')) {
  Write-Warning 'A custom default application may override the SKU icon. Its icon and your default application have been preserved.'
}
