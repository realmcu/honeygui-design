cmake_minimum_required(VERSION 3.20)

project(lvgl_pc LANGUAGES C CXX)

# LVGL v9.x 内置 ThorVG（C++ 实现），必须用 g++ 链接，否则出现
# undefined reference to __gxx_personality_sj0 / std::allocator 等错误
set(CMAKE_CXX_STANDARD 14)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

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
    src/lv_gltf_override.c
    src/generated/lvgl_generated_ui.c
)

# 源文件全是 .c，但 liblvgl.a 内含 C++ 对象（ThorVG / tvgCapi.cpp.obj）
# 强制 CMake 用 g++ 驱动链接，自动带入 libstdc++ 和 C++ EH personality
set_target_properties(lvgl_pc PROPERTIES LINKER_LANGUAGE CXX)

target_include_directories(lvgl_pc PRIVATE
    "${CMAKE_CURRENT_LIST_DIR}/src"
)

target_compile_options(lvgl_pc PRIVATE
    $<$<COMPILE_LANG_AND_ID:C,GNU,Clang,AppleClang>:-include;lv_gltf_override.h>
    $<$<COMPILE_LANG_AND_ID:C,MSVC>:/FIlv_gltf_override.h>
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

set(RUSTGLB_DLL "${LVGL_PREBUILT_DIR}/lib/rustglb.dll")
if(EXISTS "${RUSTGLB_DLL}")
    add_custom_command(TARGET lvgl_pc POST_BUILD
        COMMAND ${CMAKE_COMMAND} -E copy_if_different "${RUSTGLB_DLL}" $<TARGET_FILE_DIR:lvgl_pc>
        COMMENT "Copying rustglb.dll to output directory")
else()
    message(WARNING "rustglb.dll not found in ${LVGL_PREBUILT_DIR}/lib, GLB rendering will be unavailable in simulator runtime.")
endif()

# FFmpeg libraries required by lv_ffmpeg (LV_USE_FFMPEG=1)
# Look for FFmpeg in -DFFMPEG_ROOT=... cmake arg, FFMPEG_ROOT env var, or auto-detect from PATH
set(FFMPEG_ROOT "" CACHE PATH "Path to FFmpeg dev installation (contains include/lib/bin)")
if(NOT FFMPEG_ROOT AND DEFINED ENV{FFMPEG_ROOT})
    set(FFMPEG_ROOT "$ENV{FFMPEG_ROOT}")
endif()

# Auto-detect FFmpeg from PATH if not explicitly set
if(NOT FFMPEG_ROOT)
    if(WIN32)
        execute_process(
            COMMAND cmd /c where ffmpeg
            OUTPUT_VARIABLE FFMPEG_EXE_PATH
            OUTPUT_STRIP_TRAILING_WHITESPACE
            ERROR_QUIET
            RESULT_VARIABLE FFMPEG_FOUND_RESULT
        )
    else()
        execute_process(
            COMMAND which ffmpeg
            OUTPUT_VARIABLE FFMPEG_EXE_PATH
            OUTPUT_STRIP_TRAILING_WHITESPACE
            ERROR_QUIET
            RESULT_VARIABLE FFMPEG_FOUND_RESULT
        )
    endif()
    
    if(FFMPEG_FOUND_RESULT EQUAL 0 AND FFMPEG_EXE_PATH)
        # Handle multiple results (where may return multiple lines), take the first one
        string(REGEX REPLACE "\n.*" "" FFMPEG_EXE_PATH "${FFMPEG_EXE_PATH}")
        # Get the bin directory (parent of ffmpeg.exe)
        get_filename_component(FFMPEG_BIN_DIR "${FFMPEG_EXE_PATH}" DIRECTORY)
        # Get the root directory (parent of bin)
        get_filename_component(FFMPEG_ROOT "${FFMPEG_BIN_DIR}" DIRECTORY)
        message(STATUS "Auto-detected FFmpeg installation: ${FFMPEG_ROOT}")
    endif()
endif()

if(FFMPEG_ROOT)
    list(APPEND CMAKE_PREFIX_PATH "${FFMPEG_ROOT}")
    set(FFMPEG_LIB_DIR "${FFMPEG_ROOT}/lib")
    set(FFMPEG_INCLUDE_DIR "${FFMPEG_ROOT}/include")
endif()

find_library(AVFORMAT_LIBRARY  NAMES avformat  PATHS "${FFMPEG_LIB_DIR}" NO_DEFAULT_PATH)
find_library(AVCODEC_LIBRARY   NAMES avcodec   PATHS "${FFMPEG_LIB_DIR}" NO_DEFAULT_PATH)
find_library(AVUTIL_LIBRARY    NAMES avutil    PATHS "${FFMPEG_LIB_DIR}" NO_DEFAULT_PATH)
find_library(SWSCALE_LIBRARY   NAMES swscale   PATHS "${FFMPEG_LIB_DIR}" NO_DEFAULT_PATH)
find_library(SWRESAMPLE_LIBRARY NAMES swresample PATHS "${FFMPEG_LIB_DIR}" NO_DEFAULT_PATH)

# Fallback: search system paths
if(NOT AVFORMAT_LIBRARY)
    find_library(AVFORMAT_LIBRARY  NAMES avformat)
endif()
if(NOT AVCODEC_LIBRARY)
    find_library(AVCODEC_LIBRARY   NAMES avcodec)
endif()
if(NOT AVUTIL_LIBRARY)
    find_library(AVUTIL_LIBRARY    NAMES avutil)
endif()
if(NOT SWSCALE_LIBRARY)
    find_library(SWSCALE_LIBRARY   NAMES swscale)
endif()
if(NOT SWRESAMPLE_LIBRARY)
    find_library(SWRESAMPLE_LIBRARY NAMES swresample)
endif()

if(AVFORMAT_LIBRARY AND AVCODEC_LIBRARY AND AVUTIL_LIBRARY AND SWSCALE_LIBRARY)
    message(STATUS "FFmpeg libraries found:")
    message(STATUS "  avformat:   ${AVFORMAT_LIBRARY}")
    message(STATUS "  avcodec:    ${AVCODEC_LIBRARY}")
    message(STATUS "  avutil:     ${AVUTIL_LIBRARY}")
    message(STATUS "  swscale:    ${SWSCALE_LIBRARY}")
    target_link_libraries(lvgl_pc PRIVATE
        ${AVFORMAT_LIBRARY}
        ${AVCODEC_LIBRARY}
        ${AVUTIL_LIBRARY}
        ${SWSCALE_LIBRARY})
    if(SWRESAMPLE_LIBRARY)
        message(STATUS "  swresample: ${SWRESAMPLE_LIBRARY}")
        target_link_libraries(lvgl_pc PRIVATE ${SWRESAMPLE_LIBRARY})
    endif()
    if(FFMPEG_INCLUDE_DIR)
        target_include_directories(lvgl_pc PRIVATE "${FFMPEG_INCLUDE_DIR}")
    endif()
    # Copy FFmpeg DLLs to build output for runtime
    if(WIN32 AND DEFINED FFMPEG_ROOT)
        file(GLOB FFMPEG_DLLS "${FFMPEG_ROOT}/bin/*.dll")
        if(FFMPEG_DLLS)
            add_custom_command(TARGET lvgl_pc POST_BUILD
                COMMAND ${CMAKE_COMMAND} -E copy_if_different ${FFMPEG_DLLS} $<TARGET_FILE_DIR:lvgl_pc>
                COMMENT "Copying FFmpeg DLLs to output directory")
        endif()
    endif()
else()
    message(WARNING "FFmpeg libraries not found. Video playback (lv_ffmpeg) will have link errors.\n"
        "Please ensure FFmpeg is installed and 'ffmpeg' is in your PATH,\n"
        "or set FFMPEG_ROOT environment variable to your FFmpeg dev installation path.")
endif()

target_compile_definitions(lvgl_pc PRIVATE WIN32_LEAN_AND_MEAN NOMINMAX LCD_WIDTH=${LCD_WIDTH} LCD_HEIGHT=${LCD_HEIGHT})

if(WIN32)
    target_link_libraries(lvgl_pc PRIVATE user32 gdi32 imm32)
endif()

# 显式链接 C++ 标准库（MinGW / GCC 工具链需要；MSVC 会自动处理）
if(CMAKE_CXX_COMPILER_ID MATCHES "GNU|Clang")
    target_link_libraries(lvgl_pc PRIVATE stdc++)
endif()
