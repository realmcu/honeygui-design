/**
 * @file gps_provider.h
 * @brief GPS Provider Interface - Unified interface for GPS data sources
 *
 * This module provides a unified interface for different GPS data sources:
 * - GPS Simulator: For testing without real hardware
 * - GPS Driver: For real GPS hardware via serial port
 *
 * Data flow: GPS Provider -> Navigation Program
 */

#ifndef GPS_PROVIDER_H
#define GPS_PROVIDER_H

#include <stdint.h>
#include <stdbool.h>
#include "gps_simulator.h"
#include "map_types.h"

#ifdef __cplusplus
extern "C" {
#endif

/* ============================================================================
 * GPS Provider Types
 * ============================================================================
 */

/**
 * @brief GPS provider type enumeration
 */
typedef enum
{
    GPS_PROVIDER_SIMULATOR,     /**< GPS Simulator (for testing) */
    GPS_PROVIDER_SERIAL,        /**< Serial GPS Driver (real hardware) */
} gps_provider_type_t;

/**
 * @brief GPS provider configuration
 */
typedef struct
{
    gps_provider_type_t type;   /**< Provider type */

    /* Simulator-specific settings */
    gps_simulator_config_t sim_config;  /**< Simulator configuration */

    /* Serial driver-specific settings */
    const char *serial_port;    /**< Serial port name (e.g., "COM3") */
    uint32_t baudrate;          /**< Serial baud rate (default: 9600) */
} gps_provider_config_t;

/* Forward declaration */
typedef struct gps_provider gps_provider_t;

/* ============================================================================
 * GPS Provider API
 * ============================================================================
 */

/**
 * @brief Initialize GPS provider configuration with defaults
 *
 * @param config Configuration structure to initialize
 */
void gps_provider_config_init(gps_provider_config_t *config);

/**
 * @brief Create and initialize a GPS provider
 *
 * For SIMULATOR type: Requires map, start/end coordinates, and transport mode.
 * For SERIAL type: Opens serial port and starts reading GPS data.
 *
 * @param config Provider configuration
 * @param map Map data (required for simulator, ignored for serial)
 * @param start_lat Start latitude (simulator only)
 * @param start_lon Start longitude (simulator only)
 * @param end_lat End latitude (simulator only)
 * @param end_lon End longitude (simulator only)
 * @param mode Transport mode (simulator only)
 * @return GPS provider handle, or NULL on failure
 */
gps_provider_t *gps_provider_create(const gps_provider_config_t *config,
                                    const map_t *map,
                                    float start_lat, float start_lon,
                                    float end_lat, float end_lon,
                                    transport_mode_t mode);

/**
 * @brief Destroy GPS provider and free resources
 *
 * @param provider GPS provider handle
 */
void gps_provider_destroy(gps_provider_t *provider);

/**
 * @brief Get current GPS position
 *
 * Returns the current GPS position from the provider.
 * This is the ONLY function that should be used to get current position.
 *
 * @param provider GPS provider handle
 * @return Pointer to current GPS position (valid until next update or destroy)
 */
const gps_position_t *gps_provider_get_position(const gps_provider_t *provider);

/**
 * @brief Update GPS position
 *
 * For SIMULATOR: Advances the simulation by delta_time seconds.
 * For SERIAL: Reads and parses new data from serial port.
 *
 * @param provider GPS provider handle
 * @param delta_time Time elapsed since last update (seconds)
 * @return true if position was updated, false otherwise
 */
bool gps_provider_update(gps_provider_t *provider, float delta_time);

/**
 * @brief Check if GPS provider has finished
 *
 * For SIMULATOR: Returns true when destination is reached.
 * For SERIAL: Always returns false (continuous operation).
 *
 * @param provider GPS provider handle
 * @return true if finished, false otherwise
 */
bool gps_provider_is_complete(const gps_provider_t *provider);

/**
 * @brief Get GPS provider type
 *
 * @param provider GPS provider handle
 * @return Provider type
 */
gps_provider_type_t gps_provider_get_type(const gps_provider_t *provider);

/**
 * @brief Re-route from current position (simulator only)
 *
 * @param provider GPS provider handle
 * @param map Map data
 * @param mode Transport mode
 * @return true on success, false on failure or not supported
 */
bool gps_provider_reroute(gps_provider_t *provider,
                          const map_t *map,
                          transport_mode_t mode);

/**
 * @brief Get the planned route (simulator only)
 *
 * @param provider GPS provider handle
 * @param count Output: number of points in path
 * @return Pointer to waypoint array, or NULL for serial provider
 */
const coord_t *gps_provider_get_route(const gps_provider_t *provider,
                                      uint32_t *count);

/**
 * @brief Get underlying GPS simulator (if type is SIMULATOR)
 *
 * @param provider GPS provider handle
 * @return Pointer to GPS simulator, or NULL if not simulator type
 */
gps_simulator_t *gps_provider_get_simulator(gps_provider_t *provider);

/**
 * @brief Get underlying GPS driver (if type is SERIAL)
 *
 * @param provider GPS provider handle
 * @return Pointer to GPS driver, or NULL if not serial type
 */
struct gps_driver *gps_provider_get_driver(gps_provider_t *provider);

/**
 * @brief Get GPS provider type name as string
 *
 * @param type Provider type
 * @return Type name string
 */
const char *gps_provider_type_str(gps_provider_type_t type);

#ifdef __cplusplus
}
#endif

#endif /* GPS_PROVIDER_H */
