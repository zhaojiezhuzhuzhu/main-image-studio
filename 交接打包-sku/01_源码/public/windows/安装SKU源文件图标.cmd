@echo off
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-source-icon.ps1"
if errorlevel 1 (
  echo Installation failed. Please keep all extracted files together and try again.
  pause
  exit /b 1
)
pause
