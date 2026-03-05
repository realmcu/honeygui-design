/**
 * @file gps_provider.c
 * @brief GPS Provider Implementation - Unified interface for GPS data sources
 *
 * This module provides a unified interface that abstracts between:
 * - GPS Simulator: For testing without real hardware
 * - GPS Driver: For real GPS hardware via serial port
 */

#include "gps_provider.h"
#include "gps_driver.h"
#include "map_types.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/* ============================================================================
 * GPS Provider Internal Structure
 * ============================================================================
 */

struct gps_provider
{
    gps_provider_type_t type;

    /* Provider-specific handles */
    union
    {
        gps_simulator_t simulator;
        gps_driver_t *driver;
    } impl;

    /* Cached position for serial driver */
    gps_position_t cached_position;

    /* State flags */
    bool initialized;
};

/* ============================================================================
 * Public API Implementation
 * ============================================================================
 */

void gps_provider_config_init(gps_provider_config_t *config)
{
    if (!config)
    {
        return;
    }

    memset(config, 0, sizeof(gps_provider_config_t));

    /* Default to simulator */
    config->type = GPS_PROVIDER_SIMULATOR;

    /* Initialize simulator config */
    gps_simulator_config_init(&config->sim_config);

    /* Serial driver defaults */
    config->serial_port = NULL;
    config->baudrate = 9600;
}

gps_provider_t *gps_provider_create(const gps_provider_config_t *config,
                                    const map_t *map,
                                    float start_lat, float start_lon,
                                    float end_lat, float end_lon,
                                    transport_mode_t mode)
{
    if (!config)
    {
        MAP_FPRINTF("GPS Provider: Invalid configuration\n");
        return NULL;
    }

    gps_provider_t *provider = (gps_provider_t *)MAP_MALLOC(sizeof(gps_provider_t));
    if (!provider)
    {
        MAP_FPRINTF("GPS Provider: Memory allocation failed\n");
        return NULL;
    }

    memset(provider, 0, sizeof(gps_provider_t));
    provider->type = config->type;

    switch (config->type)
    {
        case GPS_PROVIDER_SIMULATOR:
            {
                if (!map)
                {
                    MAP_FPRINTF("GPS Provider: Map required for simulator\n");
                    MAP_FREE(provider);
                    return NULL;
                }

                bool result = gps_simulator_init(&provider->impl.simulator,
                                                 map,
                                                 start_lat, start_lon,
                                                 end_lat, end_lon,
                                                 mode,
                                                 &config->sim_config);
                if (!result)
                {
                    MAP_FPRINTF("GPS Provider: Failed to initialize simulator\n");
                    MAP_FREE(provider);
                    return NULL;
                }

                MAP_PRINTF("GPS Provider: Initialized SIMULATOR mode\n");
                break;
            }

        case GPS_PROVIDER_SERIAL:
            {
                if (!config->serial_port)
                {
                    MAP_FPRINTF("GPS Provider: Serial port required\n");
                    MAP_FREE(provider);
                    return NULL;
                }

                gps_driver_config_t driver_config;
                gps_driver_config_init(&driver_config);
                driver_config.port_name = config->serial_port;
                driver_config.baudrate = config->baudrate;

                provider->impl.driver = gps_driver_create(&driver_config);
                if (!provider->impl.driver)
                {
                    MAP_FPRINTF("GPS Provider: Failed to open serial port: %s\n",
                                gps_driver_get_error());
                    MAP_FREE(provider);
                    //return NULL;
                }

                MAP_PRINTF("GPS Provider: Initialized SERIAL mode on %s @ %u baud\n",
                           config->serial_port, config->baudrate);
                break;
            }

        default:
            MAP_FPRINTF("GPS Provider: Unknown type %d\n", config->type);
            MAP_FREE(provider);
            return NULL;
    }

    provider->initialized = true;
    return provider;
}

void gps_provider_destroy(gps_provider_t *provider)
{
    if (!provider)
    {
        return;
    }

    switch (provider->type)
    {
        case GPS_PROVIDER_SIMULATOR:
            gps_simulator_destroy(&provider->impl.simulator);
            break;

        case GPS_PROVIDER_SERIAL:
            if (provider->impl.driver)
            {
                gps_driver_destroy(provider->impl.driver);
            }
            break;
    }

    MAP_FREE(provider);
}

const gps_position_t *gps_provider_get_position(const gps_provider_t *provider)
{
    if (!provider || !provider->initialized)
    {
        return NULL;
    }

    switch (provider->type)
    {
        case GPS_PROVIDER_SIMULATOR:
            return gps_simulator_get_position(&provider->impl.simulator);

        case GPS_PROVIDER_SERIAL:
            if (provider->impl.driver)
            {
                return gps_driver_get_position(provider->impl.driver);
            }
            return NULL;

        default:
            return NULL;
    }
}

bool gps_provider_update(gps_provider_t *provider, float delta_time)
{
    //MAP_PRINTF("gps_provider_update enter\n");
    //MAP_PRINTF("provider type: %d\n", provider->type);
    if (!provider || !provider->initialized)
    {
        return false;
    }

    switch (provider->type)
    {
        case GPS_PROVIDER_SIMULATOR:
            return gps_simulator_update(&provider->impl.simulator, delta_time);

        case GPS_PROVIDER_SERIAL:
            // MAP_PRINTF("Updating SERIAL GPS provider\n");
            if (provider->impl.driver)
            {
                return gps_driver_update(provider->impl.driver);
            }
            return false;

        default:
            return false;
    }
}

bool gps_provider_is_complete(const gps_provider_t *provider)
{
    if (!provider || !provider->initialized)
    {
        return true;
    }

    switch (provider->type)
    {
        case GPS_PROVIDER_SIMULATOR:
            return gps_simulator_is_complete(&provider->impl.simulator);

        case GPS_PROVIDER_SERIAL:
            /* Serial GPS never completes - runs continuously */
            return false;

        default:
            return true;
    }
}

gps_provider_type_t gps_provider_get_type(const gps_provider_t *provider)
{
    if (!provider)
    {
        return GPS_PROVIDER_SIMULATOR;
    }
    return provider->type;
}

bool gps_provider_reroute(gps_provider_t *provider,
                          const map_t *map,
                          transport_mode_t mode)
{
    if (!provider || !provider->initialized)
    {
        return false;
    }

    switch (provider->type)
    {
        case GPS_PROVIDER_SIMULATOR:
            return gps_simulator_reroute(&provider->impl.simulator, map, mode);

        case GPS_PROVIDER_SERIAL:
            /* Serial GPS doesn't support rerouting - it's real-time */
            return false;

        default:
            return false;
    }
}

const coord_t *gps_provider_get_route(const gps_provider_t *provider,
                                      uint32_t *count)
{
    if (!provider || !provider->initialized)
    {
        if (count)
        {
            *count = 0;
        }
        return NULL;
    }

    switch (provider->type)
    {
        case GPS_PROVIDER_SIMULATOR:
            return gps_simulator_get_route(&provider->impl.simulator, count);

        case GPS_PROVIDER_SERIAL:
            /* Serial GPS doesn't have a planned route */
            if (count)
            {
                *count = 0;
            }
            return NULL;

        default:
            if (count)
            {
                *count = 0;
            }
            return NULL;
    }
}

gps_simulator_t *gps_provider_get_simulator(gps_provider_t *provider)
{
    if (!provider || provider->type != GPS_PROVIDER_SIMULATOR)
    {
        return NULL;
    }
    return &provider->impl.simulator;
}

gps_driver_t *gps_provider_get_driver(gps_provider_t *provider)
{
    if (!provider || provider->type != GPS_PROVIDER_SERIAL)
    {
        return NULL;
    }
    return provider->impl.driver;
}

const char *gps_provider_type_str(gps_provider_type_t type)
{
    switch (type)
    {
        case GPS_PROVIDER_SIMULATOR:
            return "Simulator";
        case GPS_PROVIDER_SERIAL:
            return "Serial GPS";
        default:
            return "Unknown";
    }
}
#ifdef USE_HONEY_GUI
#include "gui_api_os.h"
void *gui_lower_calloc(size_t num, size_t size)
{
    return gui_lower_malloc(num * size);
}
#endif