/**
 * @file gps_driver.h
 * @brief GPS Driver - Serial GPS module interface for navigation
 *
 * This module provides GPS position data from real GPS hardware via serial port.
 * It integrates with the GPS Provider interface to provide the same gps_position_t
 * output as the GPS Simulator.
 *
 * Features:
 * - Serial port communication (Windows)
 * - NMEA 0183 sentence parsing (GGA, RMC, GSA, GSV, VTG)
 * - Converts GPS data to gps_position_t format
 * - Thread-safe position reading
 */

#ifndef GPS_DRIVER_H
#define GPS_DRIVER_H

#include <stdint.h>
#include <stdbool.h>
#include <time.h>
#include "gps_simulator.h"  /* For gps_position_t */

#ifdef __cplusplus
extern "C" {
#endif

/* ============================================================================
 * Configuration Constants
 * ============================================================================
 */

#define GPS_DRIVER_DEFAULT_BAUDRATE     9600
#define GPS_DRIVER_BUFFER_SIZE          256
#define GPS_DRIVER_MAX_SATELLITES       32
#define GPS_DRIVER_READ_TIMEOUT_MS      100

/* Debug logging control - set to 0 to disable verbose NMEA parsing logs */
#ifndef GPS_DRIVER_DEBUG_NMEA
#define GPS_DRIVER_DEBUG_NMEA           0
#endif

/* ============================================================================
 * GPS Driver Data Types
 * ============================================================================
 */

/**
 * @brief GPS fix quality (from NMEA GGA)
 */
typedef enum
{
    GPS_DRIVER_FIX_INVALID = 0,     /**< Invalid */
    GPS_DRIVER_FIX_GPS = 1,         /**< GPS fix */
    GPS_DRIVER_FIX_DGPS = 2,        /**< Differential GPS */
    GPS_DRIVER_FIX_PPS = 3,         /**< PPS */
    GPS_DRIVER_FIX_RTK = 4,         /**< RTK fixed */
    GPS_DRIVER_FIX_FLOAT_RTK = 5,   /**< RTK float */
    GPS_DRIVER_FIX_ESTIMATED = 6,   /**< Estimated */
    GPS_DRIVER_FIX_MANUAL = 7,      /**< Manual input */
    GPS_DRIVER_FIX_SIMULATION = 8   /**< Simulation */
} gps_driver_fix_quality_t;

/**
 * @brief GPS fix mode (from NMEA GSA)
 */
typedef enum
{
    GPS_DRIVER_MODE_NO_FIX = 1,     /**< No fix */
    GPS_DRIVER_MODE_2D = 2,         /**< 2D fix */
    GPS_DRIVER_MODE_3D = 3          /**< 3D fix */
} gps_driver_fix_mode_t;

/**
 * @brief Satellite information
 */
typedef struct
{
    uint8_t prn;            /**< Satellite PRN number */
    uint8_t elevation;      /**< Elevation in degrees */
    uint16_t azimuth;       /**< Azimuth in degrees */
    uint8_t snr;            /**< Signal to Noise Ratio (dB-Hz) */
    bool in_use;            /**< Whether used for positioning */
} gps_driver_satellite_t;

/**
 * @brief Extended GPS data (internal format)
 */
typedef struct
{
    /* Position information */
    double latitude;        /**< Latitude (degrees, North positive) */
    double longitude;       /**< Longitude (degrees, East positive) */
    float altitude;         /**< Altitude above sea level (meters) */
    float geoid_sep;        /**< Geoid separation (meters) */

    /* Time information */
    uint8_t hour;           /**< Hour (UTC) */
    uint8_t minute;         /**< Minute */
    uint8_t second;         /**< Second */
    uint16_t millisecond;   /**< Millisecond */
    uint8_t day;            /**< Day */
    uint8_t month;          /**< Month */
    uint16_t year;          /**< Year */

    /* Motion information */
    float speed_knots;      /**< Speed in knots */
    float speed_kmh;        /**< Speed in km/h */
    float course;           /**< Course over ground (degrees, true north) */

    /* Fix quality */
    gps_driver_fix_quality_t fix_quality;   /**< Fix quality */
    gps_driver_fix_mode_t fix_mode;         /**< Fix mode */
    uint8_t satellites_used;        /**< Number of satellites used */
    uint8_t satellites_view;        /**< Number of satellites in view */
    float hdop;             /**< Horizontal dilution of precision */
    float vdop;             /**< Vertical dilution of precision */
    float pdop;             /**< Position dilution of precision */

    /* Satellite information */
    gps_driver_satellite_t satellites[GPS_DRIVER_MAX_SATELLITES];

    /* Status flags */
    bool valid;             /**< Data valid flag */
    uint32_t update_count;  /**< Update counter */
    time_t last_update;     /**< Last update timestamp */
} gps_driver_data_t;

/**
 * @brief GPS driver configuration
 */
typedef struct
{
    const char *port_name;      /**< Serial port name (e.g., "COM3") */
    uint32_t baudrate;          /**< Baud rate (default: 9600) */
    uint32_t read_timeout_ms;   /**< Read timeout in milliseconds */
} gps_driver_config_t;

/* Forward declaration of internal structure */
typedef struct gps_driver gps_driver_t;

/* ============================================================================
 * GPS Driver API
 * ============================================================================
 */

/**
 * @brief Initialize GPS driver configuration with defaults
 *
 * @param config Configuration structure to initialize
 */
void gps_driver_config_init(gps_driver_config_t *config);

/**
 * @brief List available serial ports
 *
 * @param ports Array to store port names
 * @param max_ports Maximum number of ports to list
 * @return Number of ports found
 */
int gps_driver_list_ports(char ports[][32], int max_ports);

/**
 * @brief Create and initialize GPS driver
 *
 * Opens the serial port and prepares for GPS data reception.
 *
 * @param config GPS driver configuration
 * @return GPS driver handle, or NULL on failure
 */
gps_driver_t *gps_driver_create(const gps_driver_config_t *config);

/**
 * @brief Destroy GPS driver and free resources
 *
 * Closes the serial port and releases all resources.
 *
 * @param driver GPS driver handle
 */
void gps_driver_destroy(gps_driver_t *driver);

/**
 * @brief Update GPS data from serial port
 *
 * Reads available data from the serial port and parses NMEA sentences.
 * Should be called periodically (e.g., every 100ms).
 *
 * @param driver GPS driver handle
 * @return true if new data was received, false otherwise
 */
bool gps_driver_update(gps_driver_t *driver);

/**
 * @brief Get current GPS position (compatible with gps_position_t)
 *
 * Returns the current GPS position in the same format as the GPS simulator.
 * This allows the navigation program to use either data source transparently.
 *
 * @param driver GPS driver handle
 * @return Pointer to current GPS position (valid until next update or destroy)
 */
const gps_position_t *gps_driver_get_position(const gps_driver_t *driver);

/**
 * @brief Get extended GPS data
 *
 * Returns the full GPS data including satellite information.
 *
 * @param driver GPS driver handle
 * @return Pointer to GPS data (valid until next update or destroy)
 */
const gps_driver_data_t *gps_driver_get_data(const gps_driver_t *driver);

/**
 * @brief Check if GPS driver has valid fix
 *
 * @param driver GPS driver handle
 * @return true if GPS has valid fix, false otherwise
 */
bool gps_driver_has_fix(const gps_driver_t *driver);

/**
 * @brief Get GPS fix quality description string
 *
 * @param quality Fix quality enum value
 * @return Description string
 */
const char *gps_driver_fix_quality_str(gps_driver_fix_quality_t quality);

/**
 * @brief Get GPS fix mode description string
 *
 * @param mode Fix mode enum value
 * @return Description string
 */
const char *gps_driver_fix_mode_str(gps_driver_fix_mode_t mode);

/**
 * @brief Get GPS driver error message
 *
 * @return Last error message string
 */
const char *gps_driver_get_error(void);

/**
 * @brief Get number of parsed sentences
 *
 * @param driver GPS driver handle
 * @return Number of successfully parsed NMEA sentences
 */
uint32_t gps_driver_get_sentence_count(const gps_driver_t *driver);

/**
 * @brief Get number of parsing errors
 *
 * @param driver GPS driver handle
 * @return Number of NMEA parsing errors
 */
uint32_t gps_driver_get_error_count(const gps_driver_t *driver);

#ifndef _WIN32
/**
 * @brief GPS buffer diagnostics (MCU only)
 */
typedef struct
{
    uint32_t overflow_count;        /**< Number of buffer overflows */
    uint32_t isr_count;             /**< Total interrupt count */
    uint8_t active_buffer;          /**< Currently active buffer (0 or 1) */
    uint8_t process_buffer;         /**< Buffer ready for processing (0, 1, or 0xFF) */
    bool buffer_ready;              /**< Data ready flag */
    uint16_t active_bytes;          /**< Bytes in active buffer */
    uint16_t process_bytes;         /**< Bytes in process buffer */
} gps_buffer_diagnostics_t;

/**
 * @brief Get GPS buffer diagnostics (MCU only)
 *
 * @param driver GPS driver handle
 * @param diag Pointer to diagnostics structure to fill
 */
void gps_driver_get_buffer_diagnostics(const gps_driver_t *driver, gps_buffer_diagnostics_t *diag);
#endif

#ifdef __cplusplus
}
#endif

#endif /* GPS_DRIVER_H */
