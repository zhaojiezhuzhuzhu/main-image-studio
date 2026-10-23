$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$viteScript = Join-Path $root 'node_modules\vite\bin\vite.js'
$url = 'http://127.0.0.1:4173'
$parseErrors = $null
$tokens = $null
$ast = [Management.Automation.Language.Parser]::ParseFile((Join-Path $root 'launch-sku-workbench.ps1'), [ref]$tokens, [ref]$parseErrors)
if ($parseErrors.Count) { throw ($parseErrors | Out-String) }
$healthFunction = $ast.Find({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Test-Workbench' }, $true)
. ([scriptblock]::Create($healthFunction.Extent.Text))

function Get-CimInstance {
  param($ClassName, $Filter)
  return $script:mockProcess
}
function Invoke-WebRequest {
  param([Parameter(Position=0)]$Uri, [switch]$UseBasicParsing, $TimeoutSec)
  if ($script:mockHttpError) { throw 'Connection failed' }
  return [pscustomobject]@{ StatusCode = $script:mockStatus; Content = $script:mockHealth }
}

$listener = [pscustomobject]@{ OwningProcess = 123 }
$script:mockProcess = [pscustomobject]@{ Name = 'node.exe'; CommandLine = '' }
$script:mockStatus = 200
$script:mockHealth = 'ok'
$script:mockHttpError = $false
$passed = 0
function Assert-Health($label, $expected, $candidate = $listener) {
  $actual = Test-Workbench $candidate
  if ($actual -ne $expected) { throw "$label : expected $expected, got $actual" }
  $script:passed++
}

$script:mockProcess.CommandLine = '"node" "' + $viteScript + '" --host 127.0.0.1 --port 4173 --strictPort'
Assert-Health 'Direct launcher path' $true
$script:mockProcess.CommandLine = '"node" "' + $root + '\node_modules\.bin\\..\vite\bin\vite.js" --host 127.0.0.1 --port 4173 --strictPort --force'
Assert-Health 'npm development preview path' $true
$script:mockProcess.CommandLine = 'node "' + $viteScript.Replace('\', '/') + '" --port 4173'
Assert-Health 'Forward slash path' $true
$script:mockProcess.CommandLine = 'node "' + $viteScript.ToUpperInvariant() + '" --port 4173'
Assert-Health 'Windows case-insensitive path' $true
$script:mockProcess.CommandLine = 'node "' + $root + '\other-project\node_modules\vite\bin\vite.js" --port 4173'
Assert-Health 'Different project must not be reused' $false
$script:mockProcess.CommandLine = 'node "' + $viteScript + '.other" --port 4173'
Assert-Health 'Script filename must match exactly' $false
$script:mockProcess.CommandLine = 'node other-server.js "' + $viteScript + '"'
Assert-Health 'Vite path passed as data to another script' $false
$script:mockProcess.CommandLine = 'node .\node_modules\vite\bin\vite.js --port 4173'
Assert-Health 'Unresolved relative path' $false
$script:mockProcess.CommandLine = $null
Assert-Health 'Unavailable command line' $false

$originalViteScript = $viteScript
$viteScript = 'C:\SKU Workspace\node_modules\vite\bin\vite.js'
$script:mockProcess.CommandLine = '"C:\Program Files\nodejs\node.exe" "C:\SKU Workspace\node_modules\.bin\..\vite\bin\vite.js" --port 4173'
Assert-Health 'Executable and project paths with spaces' $true
$viteScript = $originalViteScript
$script:mockProcess.CommandLine = 'node "' + $viteScript + '" --port 4173'
$script:mockProcess.Name = 'python.exe'
Assert-Health 'Different executable' $false
$script:mockProcess.Name = 'node.exe'
$script:mockHealth = [Text.Encoding]::UTF8.GetBytes('ok')
Assert-Health 'Windows PowerShell byte response' $true
$script:mockHealth = '<html>Another server</html>'
Assert-Health 'Wrong health endpoint' $false
$script:mockHealth = 'ok'
$script:mockStatus = 503
Assert-Health 'Unhealthy HTTP status' $false
$script:mockStatus = 200
$script:mockHttpError = $true
Assert-Health 'Connection failure' $false
Assert-Health 'No listener' $false $null
Write-Host "Passed $passed launcher checks."
