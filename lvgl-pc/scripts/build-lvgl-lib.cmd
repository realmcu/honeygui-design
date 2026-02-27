@echo off
setlocal

set SCRIPT_DIR=%~dp0

if "%RUSTGLB_ROOT%"=="" set "RUSTGLB_ROOT=%SCRIPT_DIR%..\..\..\rustglb"
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%build-lvgl-lib.ps1"  -RustglbRoot "%RUSTGLB_ROOT%" %*
pause
endlocal
