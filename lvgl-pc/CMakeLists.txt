cmake_minimum_required(VERSION 3.20)

project(lvgl_pc LANGUAGES C)

set(CMAKE_C_STANDARD 99)
set(CMAKE_C_STANDARD_REQUIRED ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

set(LVGL_PREBUILT_DIR "${CMAKE_CURRENT_LIST_DIR}/lvgl-lib" CACHE PATH "Path to prebuilt LVGL install prefix")

set(LVGL_PREBUILT_INCLUDE_DIR "${LVGL_PREBUILT_DIR}/include/lvgl")

# Display resolution (can be overridden via cmake -DLCD_WIDTH=xxx -DLCD_HEIGHT=xxx)
set(LCD_WIDTH 480 CACHE STRING "LCD display width")
set(LCD_HEIGHT 480 CACHE STRING "LCD display height")

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
    src/generated/lvgl_generated_ui.c
)

file(GLOB LVGL_GENERATED_UI_SOURCES
    "${CMAKE_CURRENT_LIST_DIR}/src/generated/*_lvgl_ui.c")

file(GLOB LVGL_GENERATED_IMG_SOURCES
    "${CMAKE_CURRENT_LIST_DIR}/src/generated/img_*.c")

file(GLOB LVGL_GENERATED_FONT_SOURCES
    "${CMAKE_CURRENT_LIST_DIR}/src/generated/fonts/*.c"
    "${CMAKE_CURRENT_LIST_DIR}/src/generated/font_*.c")

target_sources(lvgl_pc PRIVATE ${LVGL_GENERATED_UI_SOURCES} ${LVGL_GENERATED_IMG_SOURCES} ${LVGL_GENERATED_FONT_SOURCES})

target_link_libraries(lvgl_pc PRIVATE lvgl)

target_compile_definitions(lvgl_pc PRIVATE WIN32_LEAN_AND_MEAN NOMINMAX LCD_WIDTH=${LCD_WIDTH} LCD_HEIGHT=${LCD_HEIGHT})

if(WIN32)
    target_link_libraries(lvgl_pc PRIVATE user32 gdi32 imm32)
endif()
