[CmdletBinding()]
param(
    [string]$Generator = "MinGW Makefiles",
    [ValidateSet("Release","Debug","RelWithDebInfo","MinSizeRel")]
    [string]$Config = "Release",
    [int]$Parallel = 8,
    [switch]$Clean,
    [string]$FfmpegRoot = ""
)

$ErrorActionPreference = 'Stop'

$LvglPcRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$LvglSrc = Join-Path $LvglPcRoot "..\..\lvgl"

if(-not (Test-Path $LvglSrc)) {
    throw "LVGL source folder not found: $LvglSrc"
}

$BuildDir = Join-Path $LvglPcRoot "_lvgl_build"
$InstallDir = Join-Path $LvglPcRoot "lvgl-lib"

if([string]::IsNullOrWhiteSpace($FfmpegRoot) -and $env:FFMPEG_ROOT) {
    $FfmpegRoot = $env:FFMPEG_ROOT
}

$HasFfmpeg = $false
$FfmpegInclude = $null
$FfmpegLib = $null
$FfmpegBin = $null
$FfmpegIncludePosix = $null

if(-not [string]::IsNullOrWhiteSpace($FfmpegRoot)) {
    $ResolvedFfmpegRoot = Resolve-Path $FfmpegRoot -ErrorAction SilentlyContinue
    if($ResolvedFfmpegRoot) {
        $FfmpegRoot = $ResolvedFfmpegRoot.Path
        $FfmpegInclude = Join-Path $FfmpegRoot "include"
        $FfmpegLib = Join-Path $FfmpegRoot "lib"
        $FfmpegBin = Join-Path $FfmpegRoot "bin"

        if((Test-Path $FfmpegInclude) -and (Test-Path $FfmpegLib)) {
            $HasFfmpeg = $true
            $FfmpegIncludePosix = ($FfmpegInclude -replace "\\", "/")
            if(Test-Path $FfmpegBin) {
                $env:Path = "$FfmpegBin;$env:Path"
            }
            $env:CMAKE_INCLUDE_PATH = if($env:CMAKE_INCLUDE_PATH) { "$FfmpegInclude;$($env:CMAKE_INCLUDE_PATH)" } else { $FfmpegInclude }
            $env:CMAKE_LIBRARY_PATH = if($env:CMAKE_LIBRARY_PATH) { "$FfmpegLib;$($env:CMAKE_LIBRARY_PATH)" } else { $FfmpegLib }
        }
    }
}

if($Clean) {
    if(Test-Path $BuildDir) { Remove-Item -Recurse -Force $BuildDir }
    if(Test-Path $InstallDir) { Remove-Item -Recurse -Force $InstallDir }
}

New-Item -ItemType Directory -Force -Path $BuildDir | Out-Null
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

Write-Host "== Configure LVGL ==" -ForegroundColor Cyan

# Use LV_BUILD_CONF_DIR so LVGL builds with LV_CONF_INCLUDE_SIMPLE.
# This makes consumers pick up lv_conf.h from the include path.
$cmakeArgs = @(
    "-S", $LvglSrc,
    "-B", $BuildDir,
    "-G", $Generator,
    "-DLV_BUILD_CONF_DIR=$LvglPcRoot",
    "-DCMAKE_INSTALL_PREFIX=$InstallDir",
    "-DBUILD_SHARED_LIBS=OFF",
    "-DCONFIG_LV_BUILD_DEMOS=OFF",
    "-DCONFIG_LV_BUILD_EXAMPLES=OFF",
    "-DCONFIG_LV_USE_THORVG_INTERNAL=OFF"
)

if($HasFfmpeg) {
    Write-Host "FFmpeg enabled: $FfmpegRoot" -ForegroundColor Yellow
    $cFlags = "-I$FfmpegIncludePosix"
    $cxxFlags = "-I$FfmpegIncludePosix"
    if($env:CFLAGS) {
        $cFlags = "$($env:CFLAGS) $cFlags"
    }
    if($env:CXXFLAGS) {
        $cxxFlags = "$($env:CXXFLAGS) $cxxFlags"
    }
    $cmakeArgs += @(
        "-DCONFIG_LV_USE_FFMPEG=ON",
        "-DCMAKE_PREFIX_PATH=$FfmpegRoot",
        "-DCMAKE_INCLUDE_PATH=$FfmpegInclude",
        "-DCMAKE_LIBRARY_PATH=$FfmpegLib",
        "-DCMAKE_C_FLAGS=$cFlags",
        "-DCMAKE_CXX_FLAGS=$cxxFlags"
    )
}
else {
    Write-Host "FFmpeg path not found or incomplete, continue without extra FFmpeg CMake path." -ForegroundColor DarkYellow
}

& cmake @cmakeArgs

Write-Host "== Build + Install LVGL ($Config) ==" -ForegroundColor Cyan

$buildArgs = @(
    "--build", $BuildDir,
    "--target", "install",
    "--parallel", 64
)

# Multi-config generators (e.g. Visual Studio) need --config.
if($Generator -match "Visual Studio" -or $Generator -match "Multi-Config") {
    $buildArgs += @("--config", $Config)
}

& cmake @buildArgs

Write-Host "== Done ==" -ForegroundColor Green
Write-Host "Installed to: $InstallDir" -ForegroundColor Green
Write-Host "- Headers:   $(Join-Path $InstallDir 'include\lvgl')" -ForegroundColor Green
Write-Host "- Library:   $(Join-Path $InstallDir 'lib')" -ForegroundColor Green
