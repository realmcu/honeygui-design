/**
 * @file gps_simulator.h
 * @brief GPS Simulator - Provides simulated GPS coordinates for navigation testing
 *
 * The GPS simulator is the single source of current position data.
 * Data flow: GPS Simulator -> Navigation Program
 *
 * Features:
 * - Generates initial coordinates and subsequent waypoints
 * - Path planning at initialization (samples points along route)
 * - Adds GPS jitter to simulate real-world conditions
 * - Supports off-route detection testing via deviation simulation
 */

#ifndef GPS_SIMULATOR_H
#define GPS_SIMULATOR_H

#include <stdint.h>
#include <stdbool.h>
#include <time.h>
#include "map_types.h"

#ifdef __cplusplus
extern "C" {
#endif

/* ============================================================================
 * Configuration Constants
 * ============================================================================
 */

#define GPS_MAX_WAYPOINTS       500     /**< Maximum number of simulated waypoints */
#define GPS_DEFAULT_JITTER_M    3.0f    /**< Default GPS jitter in meters */
#define GPS_MAX_JITTER_M        15.0f   /**< Maximum GPS jitter in meters */
#define GPS_UPDATE_INTERVAL_MS  100     /**< Default GPS update interval (ms) */

/* ============================================================================
 * GPS Position Structure (Output)
 * ============================================================================
 */

/**
 * @brief GPS position data structure
 *
 * This is the output structure that navigation programs should use.
 * All position data flows from the GPS simulator through this structure.
 */
typedef struct
{
    float lat;              /**< Latitude (degrees) */
    float lon;              /**< Longitude (degrees) */
    float speed;            /**< Speed (m/s) */
    float heading;          /**< Heading angle (degrees, 0 = North, clockwise) */
    float accuracy;         /**< Position accuracy (meters) */
    bool valid;             /**< GPS signal validity */
    time_t timestamp;       /**< Unix timestamp */
    uint32_t update_count;  /**< Number of position updates */
} gps_position_t;

/* ============================================================================
 * GPS Simulator Configuration
 * ============================================================================
 */

/**
 * @brief GPS jitter mode for simulating real-world GPS behavior
 */
typedef enum
{
    GPS_JITTER_NONE = 0,        /**< No jitter (perfect GPS) */
    GPS_JITTER_NORMAL,          /**< Normal jitter (~3m) */
    GPS_JITTER_HIGH,            /**< High jitter (~8m, urban canyon simulation) */
    GPS_JITTER_EXTREME,         /**< Extreme jitter (~15m, for off-route testing) */
    GPS_JITTER_CUSTOM           /**< Custom jitter amount */
} gps_jitter_mode_t;

/**
 * @brief GPS simulator configuration
 */
typedef struct
{
    /* Simulation behavior */
    float simulation_speed;     /**< Movement speed (m/s), 0 = use path timing */
    uint32_t max_waypoints;     /**< Maximum waypoints to generate */

    /* GPS jitter settings */
    gps_jitter_mode_t jitter_mode;  /**< Jitter simulation mode */
    float jitter_amount_m;          /**< Custom jitter amount (meters) */
    float jitter_change_rate;       /**< How fast jitter changes (0-1) */

    /* Off-route simulation */
    bool enable_deviation;      /**< Enable deliberate deviation simulation */
    float deviation_probability;/**< Probability of deviation per update (0-1) */
    float deviation_distance_m; /**< Deviation distance (meters) */
    uint32_t deviation_start_idx;   /**< Start deviation at this waypoint index */
    uint32_t deviation_end_idx;     /**< End deviation at this waypoint index */
} gps_simulator_config_t;

/* ============================================================================
 * GPS Simulator State
 * ============================================================================
 */

/**
 * @brief GPS simulator internal state
 */
typedef struct
{
    /* Configuration */
    gps_simulator_config_t config;

    /* Route waypoints (generated at init) */
    coord_t *waypoints;         /**< Array of route waypoints */
    uint32_t waypoint_count;    /**< Total number of waypoints */
    uint32_t current_waypoint;  /**< Current waypoint index */

    /* Interpolation state (for smooth movement between waypoints) */
    float interpolation_t;      /**< Interpolation factor (0-1) */

    /* Current GPS output */
    gps_position_t current_position;

    /* Jitter state */
    float jitter_offset_lat;    /**< Current jitter offset (lat) */
    float jitter_offset_lon;    /**< Current jitter offset (lon) */
    uint32_t jitter_seed;       /**< Random seed for jitter */

    /* Status flags */
    bool initialized;           /**< Simulator initialized */
    bool route_complete;        /**< All waypoints traversed */
    bool in_deviation;          /**< Currently in deviation mode */

    /* Original route info (for reroute) */
    float dest_lat;             /**< Destination latitude */
    float dest_lon;             /**< Destination longitude */
} gps_simulator_t;

/* ============================================================================
 * Initialization Functions
 * ============================================================================
 */

/**
 * @brief Initialize GPS simulator configuration with defaults
 *
 * @param config Configuration structure to initialize
 */
void gps_simulator_config_init(gps_simulator_config_t *config);

/**
 * @brief Initialize GPS simulator with route planning
 *
 * This function:
 * 1. Plans a route from start to end coordinates
 * 2. Samples waypoints along the route
 * 3. Initializes internal state for GPS simulation
 *
 * After this call, gps_simulator_get_position() will return the start position.
 *
 * @param sim GPS simulator state
 * @param map Map data for route planning
 * @param start_lat Start latitude
 * @param start_lon Start longitude
 * @param end_lat End latitude (destination)
 * @param end_lon End longitude (destination)
 * @param mode Transport mode for route planning
 * @param config Simulator configuration (NULL for defaults)
 * @return true on success, false on failure
 */
bool gps_simulator_init(gps_simulator_t *sim,
                        const map_t *map,
                        float start_lat, float start_lon,
                        float end_lat, float end_lon,
                        transport_mode_t mode,
                        const gps_simulator_config_t *config);

/**
 * @brief Initialize GPS simulator with pre-computed path
 *
 * Alternative initialization when you already have a path.
 *
 * @param sim GPS simulator state
 * @param path Pre-computed path (will be sampled)
 * @param config Simulator configuration (NULL for defaults)
 * @return true on success, false on failure
 */
bool gps_simulator_init_with_path(gps_simulator_t *sim,
                                  const path_t *path,
                                  const gps_simulator_config_t *config);

/**
 * @brief Destroy GPS simulator and free resources
 *
 * @param sim GPS simulator state
 */
void gps_simulator_destroy(gps_simulator_t *sim);

/* ============================================================================
 * Position Functions
 * ============================================================================
 */

/**
 * @brief Get current GPS position
 *
 * Returns the current simulated GPS position with jitter applied.
 * This is the ONLY function that should be used to get current position.
 *
 * @param sim GPS simulator state
 * @return Pointer to current GPS position (valid until next update or destroy)
 */
const gps_position_t *gps_simulator_get_position(const gps_simulator_t *sim);

/**
 * @brief Update GPS position (advance simulation)
 *
 * Moves to the next waypoint or interpolates between waypoints.
 * Applies jitter if configured.
 *
 * @param sim GPS simulator state
 * @param delta_time Time elapsed since last update (seconds)
 * @return true if position was updated, false if route complete
 */
bool gps_simulator_update(gps_simulator_t *sim, float delta_time);

/**
 * @brief Check if simulation has reached destination
 *
 * @param sim GPS simulator state
 * @return true if all waypoints traversed
 */
bool gps_simulator_is_complete(const gps_simulator_t *sim);

/**
 * @brief Get number of remaining waypoints
 *
 * @param sim GPS simulator state
 * @return Number of waypoints remaining
 */
uint32_t gps_simulator_remaining_waypoints(const gps_simulator_t *sim);

/**
 * @brief Get simulation progress (0.0 - 1.0)
 *
 * @param sim GPS simulator state
 * @return Progress fraction
 */
float gps_simulator_get_progress(const gps_simulator_t *sim);

/* ============================================================================
 * Route Management Functions
 * ============================================================================
 */

/**
 * @brief Re-plan route from current position
 *
 * This is called when navigation detects off-route condition.
 * The GPS simulator will re-plan and generate new waypoints.
 *
 * @param sim GPS simulator state
 * @param map Map data for route planning
 * @param mode Transport mode for route planning
 * @return true on success, false on failure
 */
bool gps_simulator_reroute(gps_simulator_t *sim,
                           const map_t *map,
                           transport_mode_t mode);

/**
 * @brief Get the planned path (read-only)
 *
 * Returns the internal path for display purposes.
 * Do NOT modify or free the returned path.
 *
 * @param sim GPS simulator state
 * @param count Output: number of points in path
 * @return Pointer to waypoint array
 */
const coord_t *gps_simulator_get_route(const gps_simulator_t *sim, uint32_t *count);

/**
 * @brief Get destination coordinates
 *
 * @param sim GPS simulator state
 * @param lat Output: destination latitude
 * @param lon Output: destination longitude
 */
void gps_simulator_get_destination(const gps_simulator_t *sim,
                                   float *lat, float *lon);

/* ============================================================================
 * Jitter Control Functions
 * ============================================================================
 */

/**
 * @brief Set jitter mode dynamically
 *
 * @param sim GPS simulator state
 * @param mode New jitter mode
 */
void gps_simulator_set_jitter_mode(gps_simulator_t *sim, gps_jitter_mode_t mode);

/**
 * @brief Set custom jitter amount
 *
 * @param sim GPS simulator state
 * @param jitter_m Jitter amount in meters
 */
void gps_simulator_set_jitter_amount(gps_simulator_t *sim, float jitter_m);

/**
 * @brief Get position without jitter (true position)
 *
 * For debugging/display purposes only.
 *
 * @param sim GPS simulator state
 * @param lat Output: true latitude
 * @param lon Output: true longitude
 */
void gps_simulator_get_true_position(const gps_simulator_t *sim,
                                     float *lat, float *lon);

/* ============================================================================
 * Deviation Simulation Functions
 * ============================================================================
 */

/**
 * @brief Manually trigger deviation (for testing off-route handling)
 *
 * @param sim GPS simulator state
 * @param distance_m Distance to deviate (meters)
 * @param angle_deg Direction to deviate (degrees from heading)
 */
void gps_simulator_force_deviation(gps_simulator_t *sim,
                                   float distance_m, float angle_deg);

/**
 * @brief Reset from deviation back to planned route
 *
 * @param sim GPS simulator state
 */
void gps_simulator_reset_deviation(gps_simulator_t *sim);

#ifdef __cplusplus
}
#endif

#endif /* GPS_SIMULATOR_H */
