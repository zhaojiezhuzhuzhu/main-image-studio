$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$installer = Join-Path $root 'public\windows\install-source-icon.ps1'
$errors = $null
$tokens = $null
$null = [Management.Automation.Language.Parser]::ParseFile($installer, [ref]$tokens, [ref]$errors)
if ($errors.Count) { throw ($errors | Out-String) }

# All registry, file and Shell writes are replaced; tests never change the real user profile.
Add-Type @'
using System;
namespace SkuWorkbench {
  public static class IconNotification {
    public static int Calls;
    public static void SHChangeNotify(uint eventId, uint flags, IntPtr a, IntPtr b) { Calls++; }
  }
}
'@
$script:sourceExists = $true
$script:installed = $false
$script:installedHash = ''
$classes = 'HKCU:\Software\Classes'
$script:registry = @{ "$classes\.skuwork" = 'skuwork_auto_file'; "$classes\skuwork_auto_file\shell\open\command" = 'original-open-command' }
$script:choice = 'Applications\打开SKU工作台.cmd'
$script:writes = 0
$script:copies = 0
function Test-Path {
  param($LiteralPath, $PathType)
  if ($LiteralPath -eq (Join-Path $root 'public\windows\sku-source.ico')) { return $script:sourceExists }
  return $script:installed
}
function Get-FileHash {
  param($LiteralPath)
  $hash = if ($LiteralPath -eq (Join-Path $root 'public\windows\sku-source.ico')) { 'current-icon' } else { $script:installedHash }
  return [pscustomobject]@{ Hash = $hash }
}
function New-Item {
  param($Path, $ItemType, [switch]$Force)
  if ($ItemType -ne 'Directory' -and $Path -notmatch '^HKCU:\\Software\\Classes\\(\.skuwork|SkuWorkbench\.SourceFile|skuwork_auto_file|Applications\\打开SKU工作台\.cmd)(\\DefaultIcon)?$') { throw "Unexpected registry write: $Path" }
}
function Copy-Item {
  param($LiteralPath, $Destination, [switch]$Force)
  if ([IO.Path]::GetFileName($Destination) -ne 'sku-source.ico') { throw 'Unexpected file write' }
  $script:installed = $true
  $script:installedHash = 'current-icon'
  $script:copies++
}
function Get-Item {
  param($LiteralPath, $ErrorAction)
  if ($script:registry.ContainsKey($LiteralPath)) {
    $key = [pscustomobject]@{ StoredValue = $script:registry[$LiteralPath] }
    $key | Add-Member -MemberType ScriptMethod -Name GetValue -Value { param($name) return $this.StoredValue }
    return $key
  }
}
function Get-ItemProperty {
  param($LiteralPath, $Name, $ErrorAction)
  return [pscustomobject]@{ ProgId = $script:choice }
}
function Set-Item {
  param($LiteralPath, $Value)
  if ($LiteralPath -notmatch '^HKCU:\\Software\\Classes\\(\.skuwork|SkuWorkbench\.SourceFile|skuwork_auto_file|Applications\\打开SKU工作台\.cmd)(\\DefaultIcon)?$') { throw "Would overwrite an association: $LiteralPath" }
  $script:registry[$LiteralPath] = $Value
  $script:writes++
}
function Assert-Equal($actual, $expected, $label) {
  if ($actual -ne $expected) { throw "$label : expected $expected, got $actual" }
}

. $installer -Quiet
Assert-Equal $script:copies 1 'First installation copies the icon'
Assert-Equal $script:writes 3 'Extension and dedicated SKU handler icons are registered'
Assert-Equal ([SkuWorkbench.IconNotification]::Calls) 1 'Shell cache is notified'
Assert-Equal $script:registry["$classes\.skuwork\DefaultIcon"] ('"' + (Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'SkuWorkbench\sku-source.ico') + '",0') 'Persistent quoted icon path'
Assert-Equal $script:registry["$classes\.skuwork"] 'skuwork_auto_file' 'Existing file association is preserved'
Assert-Equal $script:registry["$classes\skuwork_auto_file\shell\open\command"] 'original-open-command' 'Existing open command is preserved'
. $installer -Quiet
Assert-Equal $script:copies 1 'Repeated launch does not recopy'
Assert-Equal $script:writes 3 'Repeated launch does not rewrite the registry'
Assert-Equal ([SkuWorkbench.IconNotification]::Calls) 1 'Repeated launch does not flush the cache'
$script:installedHash = 'old-icon'
. $installer -Quiet
Assert-Equal $script:copies 2 'Icon update is copied'
Assert-Equal ([SkuWorkbench.IconNotification]::Calls) 2 'Updated icon refreshes the cache'
$script:registry["$classes\.skuwork\DefaultIcon"] = 'obsolete-location'
. $installer -Quiet
Assert-Equal $script:writes 4 'Moved icon registration is repaired'
$script:sourceExists = $false
$failed = $false
try { . $installer -Quiet } catch { $failed = $true }
Assert-Equal $failed $true 'Incomplete package fails before any write'
Assert-Equal $script:copies 2 'Incomplete package leaves the installed icon intact'
Assert-Equal $script:writes 4 'Incomplete package leaves the association intact'
$script:sourceExists = $true
$script:registry = @{}
$script:choice = ''
. $installer -Quiet
Assert-Equal $script:registry["$classes\.skuwork"] 'SkuWorkbench.SourceFile' 'A new computer gets a dedicated file type'
Assert-Equal $script:registry.ContainsKey("$classes\SkuWorkbench.SourceFile\DefaultIcon") $true 'New file type gets the SKU icon'
$script:registry = @{ "$classes\.skuwork" = 'OtherApp.File'; "$classes\OtherApp.File\DefaultIcon" = 'original-other-icon' }
$script:choice = 'Applications\notepad.exe'
. $installer -Quiet 3>$null
Assert-Equal $script:registry["$classes\.skuwork"] 'OtherApp.File' 'Foreign file association is preserved'
Assert-Equal $script:registry["$classes\OtherApp.File\DefaultIcon"] 'original-other-icon' 'Foreign app icon is preserved'
Assert-Equal $script:registry.ContainsKey("$classes\Applications\notepad.exe\DefaultIcon") $false 'General-purpose application icon is never changed'
Write-Host 'Passed 20 source icon installer checks (no real registry or profile writes).'
