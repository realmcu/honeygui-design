# LVGL PC (MinGW)

This folder contains a minimal LVGL desktop runner for **Windows + MinGW**, using LVGL's built-in **Windows backend** (no SDL required).

## Build (MinGW Makefiles)

From the repository root:

### 1) Build LVGL as a prebuilt library

```powershell
cd lvgl-pc
./scripts/build-lvgl-lib.cmd
```

This installs:

- `lvgl-pc/lvgl-lib/include/lvgl` (headers, including `lv_conf.h`)
- `lvgl-pc/lvgl-lib/lib` (static library)

### 2) Build the runner

```powershell
cd lvgl-pc
mkdir build
cd build
cmake -G "MinGW Makefiles" ..
cmake --build . -j
```

## Run

```powershell
.\lvgl_pc.exe
```

## Notes

- Configuration is in `lvgl-pc/lv_conf.h` (used when building the prebuilt LVGL library).
- The runner links against the prebuilt LVGL installed to `lvgl-pc/lvgl-lib`.
