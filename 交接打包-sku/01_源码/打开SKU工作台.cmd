@echo off
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0launch-sku-workbench.ps1" -ProjectPath "%~f1"
if errorlevel 1 pause
