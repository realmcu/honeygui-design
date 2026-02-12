cmake_minimum_required(VERSION 3.20)

project(lvgl_pc LANGUAGES C)

set(CMAKE_C_STANDARD 99)
set(CMAKE_C_STANDARD_REQUIRED ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

set(LVGL_PREBUILT_DIR "${CMAKE_CURRENT_LIST_DIR}/lvgl-lib" CACHE PATH "Path to prebuilt LVGL install prefix")

set(LVGL_PREBUILT_INCLUDE_DIR "${LVGL_PREBUILT_DIR}/include/lvgl")

find_library(LVGL_PREBUILT_LIBRARY
    NAMES lvgl
    PATHS "${LVGL_PREBUILT_DIR}/lib"
    NO_DEFAULT_PATH)

if(NOT LVGL_PREBUILT_LIBRARY)
    message(FATAL_ERROR
        "Prebuilt LVGL library not found in ${LVGL_PREBUILT_DIR}.\n"
        "Build/install it first:\n"
        "  lvgl-pc\\scripts\\build-lvgl-lib.cmd\n")
endif()

add_library(lvgl STATIC IMPORTED GLOBAL)
set_target_properties(lvgl PROPERTIES
    IMPORTED_LOCATION "${LVGL_PREBUILT_LIBRARY}"
    INTERFACE_INCLUDE_DIRECTORIES "${LVGL_PREBUILT_INCLUDE_DIR}"
    INTERFACE_COMPILE_DEFINITIONS "LV_CONF_INCLUDE_SIMPLE;LV_LVGL_H_INCLUDE_SIMPLE")

add_executable(lvgl_pc
    src/main.c
)

target_link_libraries(lvgl_pc PRIVATE lvgl)

target_compile_definitions(lvgl_pc PRIVATE WIN32_LEAN_AND_MEAN NOMINMAX)

if(WIN32)
    target_link_libraries(lvgl_pc PRIVATE user32 gdi32 imm32)
endif()
