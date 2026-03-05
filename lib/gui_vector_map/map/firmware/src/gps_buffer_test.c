/**
 * @file gps_buffer_test.c
 * @brief GPS dual buffer test and diagnostic examples
 *
 * This file demonstrates how to use GPS driver dual buffer diagnostics
 */

#include "gps_driver.h"
#include "map_types.h"

#ifndef _WIN32

/**
 * @brief Print GPS buffer diagnostic information
 */
void print_gps_buffer_diagnostics(const gps_driver_t *driver)
{
    gps_buffer_diagnostics_t diag;
    gps_driver_get_buffer_diagnostics(driver, &diag);

    MAP_PRINTF("\n========== GPS Buffer Diagnostics ==========\n");
    MAP_PRINTF("ISR Count:       %u\n", diag.isr_count);
    MAP_PRINTF("Overflow Count:  %u\n", diag.overflow_count);
    MAP_PRINTF("Active Buffer:   %u (%u bytes)\n", diag.active_buffer, diag.active_bytes);

    if (diag.process_buffer != 0xFF)
    {
        MAP_PRINTF("Process Buffer:  %u (%u bytes) [READY]\n",
                   diag.process_buffer, diag.process_bytes);
    }
    else
    {
        MAP_PRINTF("Process Buffer:  None [EMPTY]\n");
    }

    MAP_PRINTF("Buffer Ready:    %s\n", diag.buffer_ready ? "YES" : "NO");

    // Health status evaluation
    if (diag.overflow_count > 0)
    {
        MAP_PRINTF("WARNING: Buffer overflows detected! (%u times)\n", diag.overflow_count);
        MAP_PRINTF("  -> Increase gps_driver_update() call frequency\n");
    }

    if (diag.isr_count == 0)
    {
        MAP_PRINTF("WARNING: No UART interrupts received!\n");
        MAP_PRINTF("  -> Check GPS module connection and power\n");
        MAP_PRINTF("  -> Verify UART pin configuration\n");
    }

    MAP_PRINTF("============================================\n\n");
}

/**
 * @brief GPS driver test example
 */
void gps_driver_test_example(void)
{
    // Configure GPS driver
    gps_driver_config_t config;
    gps_driver_config_init(&config);
    config.port_name = "UART0";  // Fixed to UART0 on MCU
    config.baudrate = 9600;
    config.read_timeout_ms = 100;

    // Create GPS driver
    gps_driver_t *driver = gps_driver_create(&config);
    if (!driver)
    {
        MAP_PRINTF("ERROR: Failed to create GPS driver: %s\n", gps_driver_get_error());
        return;
    }

    MAP_PRINTF("GPS Driver created successfully\n");

    // Test loop
    uint32_t test_cycles = 0;
    uint32_t last_diag_time = 0;

    while (test_cycles < 100)    // Run 100 cycles
    {
        test_cycles++;

        // Update GPS data
        bool updated = gps_driver_update(driver);

        if (updated)
        {
            const gps_position_t *pos = gps_driver_get_position(driver);
            const gps_driver_data_t *data = gps_driver_get_data(driver);

            MAP_PRINTF("\n--- GPS Update #%u ---\n", test_cycles);
            MAP_PRINTF("Position: %.6f, %.6f\n", pos->lat, pos->lon);
            MAP_PRINTF("Speed: %.2f km/h, Heading: %.1f°\n",
                       data->speed_kmh, data->course);
            MAP_PRINTF("Satellites: %u used, %u in view\n",
                       data->satellites_used, data->satellites_view);
            MAP_PRINTF("Fix: %s, Quality: %s\n",
                       gps_driver_fix_mode_str(data->fix_mode),
                       gps_driver_fix_quality_str(data->fix_quality));
            MAP_PRINTF("HDOP: %.2f, Altitude: %.1f m\n",
                       data->hdop, data->altitude);
        }

        // Print diagnostic info every 10 seconds
        uint32_t current_time = MAP_TIME(NULL);
        if (current_time - last_diag_time >= 10)
        {
            print_gps_buffer_diagnostics(driver);

            // Print statistics
            MAP_PRINTF("Parser Statistics:\n");
            MAP_PRINTF("  Total Sentences: %u\n", gps_driver_get_sentence_count(driver));
            MAP_PRINTF("  Parse Errors:    %u\n", gps_driver_get_error_count(driver));

            uint32_t total = gps_driver_get_sentence_count(driver);
            uint32_t errors = gps_driver_get_error_count(driver);
            if (total > 0)
            {
                float success_rate = (float)(total - errors) / total * 100.0f;
                MAP_PRINTF("  Success Rate:    %.1f%%\n", success_rate);
            }

            last_diag_time = current_time;
        }

        // Simulate other task delays
        os_delay(100);  // 100ms delay
    }

    // Final diagnostics
    MAP_PRINTF("\n========== Final Diagnostics ==========\n");
    print_gps_buffer_diagnostics(driver);

    // Cleanup
    gps_driver_destroy(driver);
    MAP_PRINTF("GPS Driver test completed\n");
}

/**
 * @brief Stress test: Check buffer performance under high load
 */
void gps_driver_stress_test(void)
{
    gps_driver_config_t config;
    gps_driver_config_init(&config);
    config.port_name = "UART0";
    config.baudrate = 115200;  // Use high baud rate
    config.read_timeout_ms = 100;

    gps_driver_t *driver = gps_driver_create(&config);
    if (!driver)
    {
        MAP_PRINTF("ERROR: Failed to create GPS driver\n");
        return;
    }

    MAP_PRINTF("Starting GPS stress test (115200 baud)...\n");

    gps_buffer_diagnostics_t diag_start, diag_end;
    gps_driver_get_buffer_diagnostics(driver, &diag_start);

    // Simulate main loop blocking for extended periods
    for (int i = 0; i < 10; i++)
    {
        MAP_PRINTF("Stress cycle %d: Delaying 500ms...\n", i + 1);
        os_delay(500);  // Deliberately delay 500ms

        bool updated = gps_driver_update(driver);
        MAP_PRINTF("  Update result: %s\n", updated ? "SUCCESS" : "NO DATA");

        gps_buffer_diagnostics_t diag;
        gps_driver_get_buffer_diagnostics(driver, &diag);
        if (diag.overflow_count > diag_start.overflow_count)
        {
            MAP_PRINTF("  WARNING: Overflow occurred! Total: %u\n", diag.overflow_count);
        }
    }

    gps_driver_get_buffer_diagnostics(driver, &diag_end);

    MAP_PRINTF("\n========== Stress Test Results ==========\n");
    MAP_PRINTF("Overflows: %u -> %u (delta: %u)\n",
               diag_start.overflow_count, diag_end.overflow_count,
               diag_end.overflow_count - diag_start.overflow_count);
    MAP_PRINTF("ISR Count: %u -> %u (delta: %u)\n",
               diag_start.isr_count, diag_end.isr_count,
               diag_end.isr_count - diag_start.isr_count);

    if (diag_end.overflow_count == diag_start.overflow_count)
    {
        MAP_PRINTF("PASS: No overflows under stress!\n");
    }
    else
    {
        MAP_PRINTF("FAIL: Overflows detected under stress\n");
        MAP_PRINTF("  -> Consider increasing buffer size or update frequency\n");
    }

    gps_driver_destroy(driver);
}

#endif  // _WIN32
