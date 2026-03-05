/**
 * @file gps_driver_config_mcu.h
 * @brief GPS Driver MCU Configuration - Tunable Parameters
 *
 * This file contains compile-time configuration for the GPS driver
 * dual buffer implementation on MCU platforms.
 *
 * Adjust these parameters based on your specific requirements:
 * - GPS data rate
 * - Main loop update frequency
 * - Available memory
 */

#ifndef GPS_DRIVER_CONFIG_MCU_H
#define GPS_DRIVER_CONFIG_MCU_H

/* ============================================================================
 * Dual Buffer Configuration
 * ============================================================================
 */

/**
 * @brief Size of each GPS RX buffer in bytes
 *
 * Recommendations by GPS data rate:
 * - 9600 baud, 1Hz update:   512 - 1024 bytes (typical)
 * - 9600 baud, 5Hz update:   1024 - 2048 bytes
 * - 115200 baud, 10Hz update: 2048 - 4096 bytes
 *
 * Calculation guide:
 * - Bytes per second = baudrate / 10
 * - Buffer should hold at least 1-2 seconds of data
 * - Consider main loop worst-case delay
 *
 * Default: 1024 bytes (suitable for 9600 baud, 1-5Hz update)
 */
#ifndef GPS_RX_BUFFER_SIZE
#define GPS_RX_BUFFER_SIZE      (1024*2)
#endif

/**
 * @brief Number of buffers (ping-pong)
 *
 * Must be 2 for dual buffer implementation.
 * Do not change unless you modify the buffer management logic.
 */
#ifndef GPS_NUM_BUFFERS
#define GPS_NUM_BUFFERS         2
#endif

/* ============================================================================
 * UART Hardware Configuration
 * ============================================================================
 */

/**
 * @brief UART RX trigger level
 *
 * Options (Realtek Bumblebee):
 * - UART_RX_FIFO_TRIGGER_LEVEL_1BYTE
 * - UART_RX_FIFO_TRIGGER_LEVEL_4BYTE
 * - UART_RX_FIFO_TRIGGER_LEVEL_8BYTE
 * - UART_RX_FIFO_TRIGGER_LEVEL_14BYTE (default)
 *
 * Higher values reduce interrupt frequency but may increase latency.
 */
#ifndef GPS_UART_RX_TRIGGER_LEVEL
#define GPS_UART_RX_TRIGGER_LEVEL   UART_RX_FIFO_TRIGGER_LEVEL_14BYTE
#endif

/**
 * @brief UART interrupt priority
 *
 * Range: 0 (highest) to 7 (lowest)
 * Default: 3 (medium priority)
 *
 * Recommendations:
 * - Use higher priority (lower number) if data loss occurs
 * - Use lower priority if GPS is not time-critical
 */
#ifndef GPS_UART_IRQ_PRIORITY
#define GPS_UART_IRQ_PRIORITY       3
#endif

/* ============================================================================
 * Performance Tuning
 * ============================================================================
 */

/**
 * @brief Enable detailed ISR logging (debug only)
 *
 * WARNING: Enabling this will significantly increase ISR execution time
 * and may cause data loss. Only use for debugging.
 *
 * 0 = Disabled (production)
 * 1 = Enabled (debug only)
 */
#ifndef GPS_DEBUG_ISR_LOGGING
#define GPS_DEBUG_ISR_LOGGING       0
#endif

/**
 * @brief Maximum consecutive bytes to read in ISR
 *
 * This limits the amount of data processed in a single interrupt.
 * Higher values reduce interrupt frequency but increase ISR duration.
 *
 * Default: 32 bytes
 * Range: 16 - 64 bytes
 */
#ifndef GPS_ISR_MAX_READ_BYTES
#define GPS_ISR_MAX_READ_BYTES      32
#endif

/* ============================================================================
 * Memory Usage Summary
 * ============================================================================
 */

/**
 * Total static memory usage:
 *
 * GPS_RX_BUFFER_SIZE = 1024 bytes (default)
 * GPS_NUM_BUFFERS = 2
 *
 * Total buffer memory = 1024 * 2 = 2048 bytes
 * Metadata ~= 20 bytes
 * ─────────────────────────────────────────────
 * Total = ~2068 bytes in .bss segment
 *
 * Adjust GPS_RX_BUFFER_SIZE if memory is constrained.
 */

/* ============================================================================
 * Validation
 * ============================================================================
 */

#if GPS_RX_BUFFER_SIZE < 256
#error "GPS_RX_BUFFER_SIZE too small! Minimum 256 bytes recommended."
#endif

#if GPS_RX_BUFFER_SIZE > 8192
#warning "GPS_RX_BUFFER_SIZE very large! Consider if this much memory is needed."
#endif

#if GPS_NUM_BUFFERS != 2
#error "GPS_NUM_BUFFERS must be 2 for dual buffer implementation!"
#endif

#if GPS_ISR_MAX_READ_BYTES > GPS_RX_BUFFER_SIZE
#error "GPS_ISR_MAX_READ_BYTES cannot exceed GPS_RX_BUFFER_SIZE!"
#endif

/* ============================================================================
 * Configuration Presets
 * ============================================================================
 */

/**
 * To use a preset, define one of these before including this header:
 *
 * GPS_CONFIG_MINIMAL:
 *   - 512 byte buffers
 *   - Low memory footprint
 *   - Suitable for 9600 baud, 1Hz update
 *
 * GPS_CONFIG_STANDARD:
 *   - 1024 byte buffers (default)
 *   - Balanced performance/memory
 *   - Suitable for 9600 baud, up to 5Hz update
 *
 * GPS_CONFIG_HIGH_PERFORMANCE:
 *   - 2048 byte buffers
 *   - High reliability
 *   - Suitable for 115200 baud, up to 10Hz update
 */

#ifdef GPS_CONFIG_MINIMAL
#undef GPS_RX_BUFFER_SIZE
#define GPS_RX_BUFFER_SIZE      512
#endif

#ifdef GPS_CONFIG_STANDARD
#undef GPS_RX_BUFFER_SIZE
#define GPS_RX_BUFFER_SIZE      1024
#endif

#ifdef GPS_CONFIG_HIGH_PERFORMANCE
#undef GPS_RX_BUFFER_SIZE
#define GPS_RX_BUFFER_SIZE      2048
#undef GPS_UART_IRQ_PRIORITY
#define GPS_UART_IRQ_PRIORITY   2
#endif

#endif /* GPS_DRIVER_CONFIG_MCU_H */
