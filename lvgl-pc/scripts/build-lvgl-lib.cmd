@echo off
setlocal

set SCRIPT_DIR=%~dp0
if "%FFMPEG_ROOT%"=="" set "FFMPEG_ROOT=C:\Users\xxx\ffmpeg-8.0.1-full_build-shared\ffmpeg-8.0.1-full_build-shared"
powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%build-lvgl-lib.ps1" -FfmpegRoot "%FFMPEG_ROOT%" %*
pause
endlocal
