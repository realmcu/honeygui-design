# TRVG - Triton Vector Graphics Library
# CMakeLists.txt

cmake_minimum_required(VERSION 3.10)
project(trvg C)

# C standard
set(CMAKE_C_STANDARD 99)
set(CMAKE_C_STANDARD_REQUIRED ON)

# Compile options
if(MSVC)
    add_compile_options(/W4)
else()
    add_compile_options(-Wall -Wextra -pedantic)
endif()

# Include directories
include_directories(
    ${CMAKE_CURRENT_SOURCE_DIR}
    ${CMAKE_CURRENT_SOURCE_DIR}/../../include
)

# TRVG library source files
set(TRVG_SOURCES
    trvg.c
   # trvg_render.c
)

set(TRVG_HEADERS
    trvg.h
    #trvg_render.h
)

# Create static library
add_library(trvg STATIC ${TRVG_SOURCES} ${TRVG_HEADERS})

# Link math library (Unix)
if(UNIX)
    target_link_libraries(trvg m)
endif()

# Test program
add_executable(trvg_test trvg_test.c)
target_link_libraries(trvg_test trvg)
if(UNIX)
    target_link_libraries(trvg_test m)
endif()

# Install rules
install(TARGETS trvg
    ARCHIVE DESTINATION lib
    LIBRARY DESTINATION lib
)

install(FILES ${TRVG_HEADERS}
    DESTINATION include/trvg
)

# Optional: MCU configuration
option(TRVG_MCU_MODE "Enable MCU-specific optimizations" OFF)

if(TRVG_MCU_MODE)
    # Reduce buffer sizes in MCU mode
    target_compile_definitions(trvg PRIVATE
        TRVG_MAX_EDGES=2048
        TRVG_SCANLINE_BUFFER_SIZE=1024
        TRVG_MAX_PATH_POINTS=512
    )
endif()

# Optional: Debug mode
option(TRVG_DEBUG "Enable debug output" OFF)

if(TRVG_DEBUG)
    target_compile_definitions(trvg PRIVATE TRVG_DEBUG=1)
endif()

# Output configuration info
message(STATUS "TRVG Configuration:")
message(STATUS "  MCU Mode: ${TRVG_MCU_MODE}")
message(STATUS "  Debug: ${TRVG_DEBUG}")
