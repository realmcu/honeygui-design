cmake_minimum_required(VERSION 3.10)
project(trmap_sim C CXX)

set(CMAKE_C_STANDARD 99)
set(CMAKE_CXX_STANDARD 11)

# Option to enable PNG save functionality (requires stb_image_write)
option(ENABLE_PNG_SAVE "Enable PNG save functionality" ON)

# Option to select rendering backend: TRVG or NanoVG
option(USE_TRVG "Use TRVG (Triton Vector Graphics) rendering backend" ON)

# NanoVG paths
set(NANOVG_DIR ${CMAKE_SOURCE_DIR}/../external/nanovg)
set(NANOVG_BASE_DIR ${NANOVG_DIR}/base)
set(NANOVG_AGGE_DIR ${NANOVG_DIR}/agge)
set(STB_DIR ${CMAKE_SOURCE_DIR}/../external/stb)

# TRVG paths
set(TRVG_DIR ${CMAKE_SOURCE_DIR}/../src/trvg)

# Include directories
include_directories(${CMAKE_SOURCE_DIR}/../include)
include_directories(${CMAKE_SOURCE_DIR}/../src)  # For trvg/trvg.h
include_directories(${NANOVG_BASE_DIR})
include_directories(${NANOVG_AGGE_DIR})
include_directories(${STB_DIR})
# For <agge/xxx.h> style includes
include_directories(${NANOVG_DIR})

# NanoVG base sources (C)
set(NANOVG_BASE_SOURCES
    ${NANOVG_BASE_DIR}/nanovg.c
    ${NANOVG_BASE_DIR}/nanovg_port.c
)

# NanoVG AGGE backend sources (C++)
set(NANOVG_AGGE_SOURCES
    ${NANOVG_AGGE_DIR}/nanovg_agge.cpp
    ${NANOVG_AGGE_DIR}/nanovg_vertex.cpp
    ${NANOVG_AGGE_DIR}/math.cpp
    ${NANOVG_AGGE_DIR}/stroke.cpp
    ${NANOVG_AGGE_DIR}/stroke_features.cpp
    ${NANOVG_AGGE_DIR}/vector_rasterizer.cpp
)

# TRVG sources (C)
set(TRVG_SOURCES
    ${TRVG_DIR}/trvg.c
   # ${TRVG_DIR}/trvg_render.c
)

# Source files (common)
set(COMMON_SOURCES
    main.c
    app.c
    ${CMAKE_SOURCE_DIR}/../src/nav_api.c
    ${CMAKE_SOURCE_DIR}/../src/render_api.c
    ${CMAKE_SOURCE_DIR}/../src/memory_monitor.c
    ${CMAKE_SOURCE_DIR}/../src/lane_guidance.c
    ${CMAKE_SOURCE_DIR}/../src/gps_simulator.c
    ${CMAKE_SOURCE_DIR}/../src/gps_driver.c
    ${CMAKE_SOURCE_DIR}/../src/gps_provider.c
)

# Select rendering backend
if(USE_TRVG)
    message(STATUS "Using TRVG rendering backend")
    set(SOURCES ${COMMON_SOURCES} ${TRVG_SOURCES})
else()
    message(STATUS "Using NanoVG rendering backend")
    set(SOURCES ${COMMON_SOURCES} ${NANOVG_BASE_SOURCES} ${NANOVG_AGGE_SOURCES})
endif()

# Create executable
add_executable(trmap_sim ${SOURCES})

# Enable rendering backend macro


# Enable PNG save if option is ON
if(ENABLE_PNG_SAVE)
    target_compile_definitions(trmap_sim PRIVATE ENABLE_PNG_SAVE)
endif()

# Link math library on Unix
if(UNIX)
    target_link_libraries(trmap_sim m)
endif()

# Windows specific settings
if(WIN32)
    target_compile_definitions(trmap_sim PRIVATE _CRT_SECURE_NO_WARNINGS)
    # Link psapi for process memory info
    target_link_libraries(trmap_sim psapi)
endif()

# Set output directory
set_target_properties(trmap_sim PROPERTIES
    RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin
)

# Copy map data for testing (if exists)
add_custom_command(TARGET trmap_sim POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E make_directory ${CMAKE_BINARY_DIR}/bin
)

# ============================================================================
# Lane Guidance Test Target (Always uses TRVG)
# ============================================================================

# Test sources - always use TRVG for lane guidance
set(TEST_LANE_SOURCES
    test_lane_guidance.c
    ${CMAKE_SOURCE_DIR}/../src/nav_api.c
    ${CMAKE_SOURCE_DIR}/../src/render_api.c
    ${CMAKE_SOURCE_DIR}/../src/memory_monitor.c
    ${CMAKE_SOURCE_DIR}/../src/lane_guidance.c
    ${TRVG_SOURCES}
)

# Create test executable
add_executable(test_lane_guidance ${TEST_LANE_SOURCES})



# Enable PNG save for test
if(ENABLE_PNG_SAVE)
    target_compile_definitions(test_lane_guidance PRIVATE ENABLE_PNG_SAVE)
endif()

# Link libraries for test
if(UNIX)
    target_link_libraries(test_lane_guidance m)
endif()
if(WIN32)
    target_compile_definitions(test_lane_guidance PRIVATE _CRT_SECURE_NO_WARNINGS)
    target_link_libraries(test_lane_guidance psapi)
endif()

# Set output directory for test
set_target_properties(test_lane_guidance PROPERTIES
    RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin
)
