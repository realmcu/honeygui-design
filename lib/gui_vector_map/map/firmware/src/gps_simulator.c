/**
 * @file gps_simulator.c
 * @brief GPS Simulator Implementation
 *
 * Provides simulated GPS coordinates for navigation testing.
 * Data flow: GPS Simulator -> Navigation Program
 */

#include "gps_simulator.h"
#include "nav_api.h"
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <time.h>

/* ============================================================================
 * Constants
 * ============================================================================
 */

#define PI 3.14159265358979323846f
#define EARTH_RADIUS_M 6371000.0f
#define METERS_PER_DEGREE_LAT (111320.0f)

/* Jitter amounts for each mode (in meters) */
static const float JITTER_AMOUNTS[] =
{
    0.0f,   /* GPS_JITTER_NONE */
    3.0f,   /* GPS_JITTER_NORMAL */
    8.0f,   /* GPS_JITTER_HIGH */
    15.0f,  /* GPS_JITTER_EXTREME */
    0.0f    /* GPS_JITTER_CUSTOM (use config value) */
};

/* ============================================================================
 * Helper Functions
 * ============================================================================
 */

/**
 * @brief Simple pseudo-random number generator
 */
static uint32_t random_next(uint32_t *seed)
{
    *seed = (*seed * 1103515245 + 12345) & 0x7FFFFFFF;
    return *seed;
}

/**
 * @brief Generate random float in range [0, 1]
 */
static float random_float(uint32_t *seed)
{
    return (float)random_next(seed) / (float)0x7FFFFFFF;
}

/**
 * @brief Generate random float in range [-1, 1]
 */
static float random_float_signed(uint32_t *seed)
{
    return random_float(seed) * 2.0f - 1.0f;
}

/**
 * @brief Convert meters to latitude degrees
 */
static float meters_to_lat(float meters)
{
    return meters / METERS_PER_DEGREE_LAT;
}

/**
 * @brief Convert meters to longitude degrees at given latitude
 */
static float meters_to_lon(float meters, float lat)
{
    float meters_per_degree = METERS_PER_DEGREE_LAT * cosf(lat * PI / 180.0f);
    if (meters_per_degree < 1.0f)
    {
        meters_per_degree = 1.0f;
    }
    return meters / meters_per_degree;
}

/**
 * @brief Calculate heading from point 1 to point 2
 */
static float calculate_heading(float lat1, float lon1, float lat2, float lon2)
{
    float dlat = lat2 - lat1;
    float dlon = lon2 - lon1;

    if (fabsf(dlat) < 0.000001f && fabsf(dlon) < 0.000001f)
    {
        return 0.0f;  /* No movement */
    }

    float heading = atan2f(dlon, dlat) * 180.0f / PI;
    if (heading < 0)
    {
        heading += 360.0f;
    }
    return heading;
}

/**
 * @brief Sample points from a path
 */
static uint32_t sample_path_points(const path_t *path, coord_t **out_points, uint32_t max_samples)
{
    if (!path || path->count < 2 || max_samples < 2)
    {
        return 0;
    }

    uint32_t sample_count = (path->count < max_samples) ? path->count : max_samples;

    *out_points = (coord_t *)MAP_MALLOC(sizeof(coord_t) * sample_count);
    if (!*out_points)
    {
        return 0;
    }

    /* Always include start and end points */
    (*out_points)[0] = path->points[0];
    (*out_points)[sample_count - 1] = path->points[path->count - 1];

    if (sample_count > 2)
    {
        /* Sample intermediate points evenly */
        float step = (float)(path->count - 1) / (sample_count - 1);
        for (uint32_t i = 1; i < sample_count - 1; i++)
        {
            uint32_t idx = (uint32_t)(i * step);
            if (idx >= path->count)
            {
                idx = path->count - 1;
            }
            (*out_points)[i] = path->points[idx];
        }
    }

    return sample_count;
}

/**
 * @brief Get jitter amount based on mode
 */
static float get_jitter_amount(const gps_simulator_t *sim)
{
    if (sim->config.jitter_mode == GPS_JITTER_CUSTOM)
    {
        return sim->config.jitter_amount_m;
    }
    if (sim->config.jitter_mode < sizeof(JITTER_AMOUNTS) / sizeof(JITTER_AMOUNTS[0]))
    {
        return JITTER_AMOUNTS[sim->config.jitter_mode];
    }
    return 0.0f;
}

/**
 * @brief Apply jitter to position
 */
static void apply_jitter(gps_simulator_t *sim, float base_lat, float base_lon,
                         float *out_lat, float *out_lon)
{
    float jitter_m = get_jitter_amount(sim);

    if (jitter_m <= 0.0f)
    {
        *out_lat = base_lat;
        *out_lon = base_lon;
        return;
    }

    /* Smooth jitter transition */
    float rate = sim->config.jitter_change_rate;
    if (rate <= 0.0f)
    {
        rate = 0.3f;    /* Default change rate */
    }

    /* Generate new jitter target */
    float new_jitter_lat = random_float_signed(&sim->jitter_seed) * jitter_m;
    float new_jitter_lon = random_float_signed(&sim->jitter_seed) * jitter_m;

    /* Smooth interpolation to new jitter */
    sim->jitter_offset_lat = sim->jitter_offset_lat * (1.0f - rate) +
                             meters_to_lat(new_jitter_lat) * rate;
    sim->jitter_offset_lon = sim->jitter_offset_lon * (1.0f - rate) +
                             meters_to_lon(new_jitter_lon, base_lat) * rate;

    /* Apply jitter */
    *out_lat = base_lat + sim->jitter_offset_lat;
    *out_lon = base_lon + sim->jitter_offset_lon;
}

/* ============================================================================
 * Initialization Functions
 * ============================================================================
 */

void gps_simulator_config_init(gps_simulator_config_t *config)
{
    if (!config)
    {
        return;
    }

    memset(config, 0, sizeof(gps_simulator_config_t));

    config->simulation_speed = 20.0f;       /* 20 m/s (~72 km/h) */
    config->max_waypoints = GPS_MAX_WAYPOINTS;
    config->jitter_mode = GPS_JITTER_NORMAL;
    config->jitter_amount_m = GPS_DEFAULT_JITTER_M;
    config->jitter_change_rate = 0.3f;
    config->enable_deviation = false;
    config->deviation_probability = 0.0f;
    config->deviation_distance_m = 60.0f;   /* 60m deviation triggers off-route */
    config->deviation_start_idx = 0;
    config->deviation_end_idx = 0;
}

bool gps_simulator_init(gps_simulator_t *sim,
                        const map_t *map,
                        float start_lat, float start_lon,
                        float end_lat, float end_lon,
                        transport_mode_t mode,
                        const gps_simulator_config_t *config)
{
    if (!sim || !map)
    {
        return false;
    }

    /* Clear state */
    memset(sim, 0, sizeof(gps_simulator_t));

    /* Apply configuration */
    if (config)
    {
        sim->config = *config;
    }
    else
    {
        gps_simulator_config_init(&sim->config);
    }

    /* Save destination */
    sim->dest_lat = end_lat;
    sim->dest_lon = end_lon;

    /* Plan route */
    path_t *path = nav_find_path_with_mode(map,
                                           start_lat, start_lon,
                                           end_lat, end_lon,
                                           mode);
    if (!path)
    {
        return false;
    }

    /* Sample waypoints from path */
    sim->waypoint_count = sample_path_points(path, &sim->waypoints, sim->config.max_waypoints);

    /* Free the path (we keep only the sampled waypoints) */
    path_free(path);

    if (sim->waypoint_count < 2)
    {
        if (sim->waypoints)
        {
            MAP_FREE(sim->waypoints);
            sim->waypoints = NULL;
        }
        return false;
    }

    /* Initialize position to first waypoint */
    sim->current_waypoint = 0;
    sim->interpolation_t = 0.0f;

    sim->current_position.lat = sim->waypoints[0].lat;
    sim->current_position.lon = sim->waypoints[0].lon;
    sim->current_position.speed = 0.0f;
    sim->current_position.heading = 0.0f;
    sim->current_position.accuracy = get_jitter_amount(sim);
    sim->current_position.valid = true;
    sim->current_position.timestamp = MAP_TIME(NULL);
    sim->current_position.update_count = 0;

    /* Calculate initial heading */
    if (sim->waypoint_count > 1)
    {
        sim->current_position.heading = calculate_heading(
                                            sim->waypoints[0].lat, sim->waypoints[0].lon,
                                            sim->waypoints[1].lat, sim->waypoints[1].lon);
    }

    /* Initialize jitter */
    sim->jitter_seed = (uint32_t)MAP_TIME(NULL);
    sim->jitter_offset_lat = 0.0f;
    sim->jitter_offset_lon = 0.0f;

    /* Apply initial jitter */
    float jittered_lat, jittered_lon;
    apply_jitter(sim, sim->waypoints[0].lat, sim->waypoints[0].lon,
                 &jittered_lat, &jittered_lon);
    sim->current_position.lat = jittered_lat;
    sim->current_position.lon = jittered_lon;

    sim->initialized = true;
    sim->route_complete = false;
    sim->in_deviation = false;

    return true;
}

bool gps_simulator_init_with_path(gps_simulator_t *sim,
                                  const path_t *path,
                                  const gps_simulator_config_t *config)
{
    if (!sim || !path || path->count < 2)
    {
        return false;
    }

    /* Clear state */
    memset(sim, 0, sizeof(gps_simulator_t));

    /* Apply configuration */
    if (config)
    {
        sim->config = *config;
    }
    else
    {
        gps_simulator_config_init(&sim->config);
    }

    /* Save destination */
    sim->dest_lat = path->points[path->count - 1].lat;
    sim->dest_lon = path->points[path->count - 1].lon;

    /* Sample waypoints from path */
    sim->waypoint_count = sample_path_points(path, &sim->waypoints, sim->config.max_waypoints);

    if (sim->waypoint_count < 2)
    {
        if (sim->waypoints)
        {
            MAP_FREE(sim->waypoints);
            sim->waypoints = NULL;
        }
        return false;
    }

    /* Initialize position to first waypoint */
    sim->current_waypoint = 0;
    sim->interpolation_t = 0.0f;

    sim->current_position.lat = sim->waypoints[0].lat;
    sim->current_position.lon = sim->waypoints[0].lon;
    sim->current_position.speed = 0.0f;
    sim->current_position.heading = 0.0f;
    sim->current_position.accuracy = get_jitter_amount(sim);
    sim->current_position.valid = true;
    sim->current_position.timestamp = MAP_TIME(NULL);
    sim->current_position.update_count = 0;

    /* Calculate initial heading */
    if (sim->waypoint_count > 1)
    {
        sim->current_position.heading = calculate_heading(
                                            sim->waypoints[0].lat, sim->waypoints[0].lon,
                                            sim->waypoints[1].lat, sim->waypoints[1].lon);
    }

    /* Initialize jitter */
    sim->jitter_seed = (uint32_t)MAP_TIME(NULL);
    sim->jitter_offset_lat = 0.0f;
    sim->jitter_offset_lon = 0.0f;

    /* Apply initial jitter */
    float jittered_lat, jittered_lon;
    apply_jitter(sim, sim->waypoints[0].lat, sim->waypoints[0].lon,
                 &jittered_lat, &jittered_lon);
    sim->current_position.lat = jittered_lat;
    sim->current_position.lon = jittered_lon;

    sim->initialized = true;
    sim->route_complete = false;
    sim->in_deviation = false;

    return true;
}

void gps_simulator_destroy(gps_simulator_t *sim)
{
    if (!sim)
    {
        return;
    }

    if (sim->waypoints)
    {
        MAP_FREE(sim->waypoints);
        sim->waypoints = NULL;
    }

    sim->initialized = false;
    sim->waypoint_count = 0;
    sim->current_waypoint = 0;
}

/* ============================================================================
 * Position Functions
 * ============================================================================
 */

const gps_position_t *gps_simulator_get_position(const gps_simulator_t *sim)
{
    if (!sim || !sim->initialized)
    {
        return NULL;
    }
    return &sim->current_position;
}

bool gps_simulator_update(gps_simulator_t *sim, float delta_time)
{
    if (!sim || !sim->initialized || sim->route_complete)
    {
        return false;
    }

    /* Check if already at last waypoint */
    if (sim->current_waypoint >= sim->waypoint_count - 1)
    {
        sim->route_complete = true;
        return false;
    }

    /* Get current and next waypoint */
    coord_t *curr_wp = &sim->waypoints[sim->current_waypoint];
    coord_t *next_wp = &sim->waypoints[sim->current_waypoint + 1];

    /* Calculate distance between waypoints */
    float segment_dist = nav_calculate_distance(
                             curr_wp->lat, curr_wp->lon,
                             next_wp->lat, next_wp->lon);

    /* Calculate how much to advance (based on speed) */
    float distance_to_travel = sim->config.simulation_speed * delta_time;

    /* Update position */
    float base_lat, base_lon;

    if (segment_dist <= 0.0001f)
    {
        /* Waypoints are same, move to next */
        sim->current_waypoint++;
        sim->interpolation_t = 0.0f;
        base_lat = next_wp->lat;
        base_lon = next_wp->lon;
    }
    else
    {
        /* Interpolate along segment */
        float segment_progress = distance_to_travel / segment_dist;
        sim->interpolation_t += segment_progress;

        if (sim->interpolation_t >= 1.0f)
        {
            /* Move to next waypoint */
            sim->current_waypoint++;
            sim->interpolation_t = 0.0f;

            if (sim->current_waypoint >= sim->waypoint_count - 1)
            {
                /* Reached destination */
                base_lat = sim->waypoints[sim->waypoint_count - 1].lat;
                base_lon = sim->waypoints[sim->waypoint_count - 1].lon;
                sim->route_complete = true;
            }
            else
            {
                base_lat = sim->waypoints[sim->current_waypoint].lat;
                base_lon = sim->waypoints[sim->current_waypoint].lon;
            }
        }
        else
        {
            /* Interpolate between waypoints */
            float t = sim->interpolation_t;
            base_lat = curr_wp->lat + (next_wp->lat - curr_wp->lat) * t;
            base_lon = curr_wp->lon + (next_wp->lon - curr_wp->lon) * t;
        }
    }

    /* Check for deviation simulation */
    if (sim->config.enable_deviation && !sim->in_deviation)
    {
        bool should_deviate = false;

        /* Check if within deviation range */
        if (sim->config.deviation_start_idx > 0 &&
                sim->config.deviation_end_idx > sim->config.deviation_start_idx)
        {
            if (sim->current_waypoint >= sim->config.deviation_start_idx &&
                    sim->current_waypoint <= sim->config.deviation_end_idx)
            {
                should_deviate = true;
            }
        }
        else if (sim->config.deviation_probability > 0.0f)
        {
            /* Random deviation based on probability */
            if (random_float(&sim->jitter_seed) < sim->config.deviation_probability)
            {
                should_deviate = true;
            }
        }

        if (should_deviate)
        {
            /* Apply deviation perpendicular to heading */
            float dev_angle = sim->current_position.heading + 90.0f;
            if (random_float(&sim->jitter_seed) < 0.5f)
            {
                dev_angle -= 180.0f;
            }

            float dev_rad = dev_angle * PI / 180.0f;
            float dev_lat = meters_to_lat(sim->config.deviation_distance_m * cosf(dev_rad));
            float dev_lon = meters_to_lon(sim->config.deviation_distance_m * sinf(dev_rad), base_lat);

            base_lat += dev_lat;
            base_lon += dev_lon;
            sim->in_deviation = true;
        }
    }

    /* Apply jitter */
    float jittered_lat, jittered_lon;
    apply_jitter(sim, base_lat, base_lon, &jittered_lat, &jittered_lon);

    /* Update heading */
    if (!sim->route_complete && sim->current_waypoint < sim->waypoint_count - 1)
    {
        sim->current_position.heading = calculate_heading(
                                            base_lat, base_lon,
                                            sim->waypoints[sim->current_waypoint + 1].lat,
                                            sim->waypoints[sim->current_waypoint + 1].lon);
    }

    /* Update position */
    sim->current_position.lat = jittered_lat;
    sim->current_position.lon = jittered_lon;
    sim->current_position.speed = sim->config.simulation_speed;
    sim->current_position.accuracy = get_jitter_amount(sim);
    sim->current_position.timestamp = MAP_TIME(NULL);
    sim->current_position.update_count++;
    sim->current_position.valid = true;

    return true;
}

bool gps_simulator_is_complete(const gps_simulator_t *sim)
{
    if (!sim)
    {
        return true;
    }
    return sim->route_complete;
}

uint32_t gps_simulator_remaining_waypoints(const gps_simulator_t *sim)
{
    if (!sim || !sim->initialized)
    {
        return 0;
    }
    if (sim->current_waypoint >= sim->waypoint_count)
    {
        return 0;
    }
    return sim->waypoint_count - sim->current_waypoint - 1;
}

float gps_simulator_get_progress(const gps_simulator_t *sim)
{
    if (!sim || !sim->initialized || sim->waypoint_count == 0)
    {
        return 0.0f;
    }

    float base_progress = (float)sim->current_waypoint / (float)(sim->waypoint_count - 1);
    float segment_progress = sim->interpolation_t / (float)(sim->waypoint_count - 1);

    float progress = base_progress + segment_progress;
    if (progress > 1.0f)
    {
        progress = 1.0f;
    }
    if (progress < 0.0f)
    {
        progress = 0.0f;
    }

    return progress;
}

/* ============================================================================
 * Route Management Functions
 * ============================================================================
 */

bool gps_simulator_reroute(gps_simulator_t *sim,
                           const map_t *map,
                           transport_mode_t mode)
{
    if (!sim || !sim->initialized || !map)
    {
        return false;
    }

    /* Get current position (without jitter for accurate rerouting) */
    float curr_lat, curr_lon;
    gps_simulator_get_true_position(sim, &curr_lat, &curr_lon);

    /* Plan new route from current position to destination */
    path_t *new_path = nav_find_path_with_mode(map,
                       curr_lat, curr_lon,
                       sim->dest_lat, sim->dest_lon,
                       mode);
    if (!new_path)
    {
        return false;
    }

    /* Free old waypoints */
    if (sim->waypoints)
    {
        MAP_FREE(sim->waypoints);
        sim->waypoints = NULL;
    }

    /* Sample new waypoints */
    sim->waypoint_count = sample_path_points(new_path, &sim->waypoints, sim->config.max_waypoints);
    path_free(new_path);

    if (sim->waypoint_count < 2)
    {
        return false;
    }

    /* Reset state */
    sim->current_waypoint = 0;
    sim->interpolation_t = 0.0f;
    sim->route_complete = false;
    sim->in_deviation = false;

    return true;
}

const coord_t *gps_simulator_get_route(const gps_simulator_t *sim, uint32_t *count)
{
    if (!sim || !sim->initialized)
    {
        if (count)
        {
            *count = 0;
        }
        return NULL;
    }

    if (count)
    {
        *count = sim->waypoint_count;
    }
    return sim->waypoints;
}

void gps_simulator_get_destination(const gps_simulator_t *sim,
                                   float *lat, float *lon)
{
    if (!sim)
    {
        if (lat)
        {
            *lat = 0.0f;
        }
        if (lon)
        {
            *lon = 0.0f;
        }
        return;
    }

    if (lat)
    {
        *lat = sim->dest_lat;
    }
    if (lon)
    {
        *lon = sim->dest_lon;
    }
}

/* ============================================================================
 * Jitter Control Functions
 * ============================================================================
 */

void gps_simulator_set_jitter_mode(gps_simulator_t *sim, gps_jitter_mode_t mode)
{
    if (!sim)
    {
        return;
    }
    sim->config.jitter_mode = mode;
}

void gps_simulator_set_jitter_amount(gps_simulator_t *sim, float jitter_m)
{
    if (!sim)
    {
        return;
    }
    sim->config.jitter_mode = GPS_JITTER_CUSTOM;
    sim->config.jitter_amount_m = jitter_m;
    if (sim->config.jitter_amount_m > GPS_MAX_JITTER_M)
    {
        sim->config.jitter_amount_m = GPS_MAX_JITTER_M;
    }
    if (sim->config.jitter_amount_m < 0.0f)
    {
        sim->config.jitter_amount_m = 0.0f;
    }
}

void gps_simulator_get_true_position(const gps_simulator_t *sim,
                                     float *lat, float *lon)
{
    if (!sim || !sim->initialized)
    {
        if (lat)
        {
            *lat = 0.0f;
        }
        if (lon)
        {
            *lon = 0.0f;
        }
        return;
    }

    /* Calculate true position (current position minus jitter) */
    if (lat)
    {
        *lat = sim->current_position.lat - sim->jitter_offset_lat;
    }
    if (lon)
    {
        *lon = sim->current_position.lon - sim->jitter_offset_lon;
    }
}

/* ============================================================================
 * Deviation Simulation Functions
 * ============================================================================
 */

void gps_simulator_force_deviation(gps_simulator_t *sim,
                                   float distance_m, float angle_deg)
{
    if (!sim || !sim->initialized)
    {
        return;
    }

    float angle_rad = angle_deg * PI / 180.0f;
    float heading_rad = sim->current_position.heading * PI / 180.0f;
    float total_angle = heading_rad + angle_rad;

    float dev_lat = meters_to_lat(distance_m * cosf(total_angle));
    float dev_lon = meters_to_lon(distance_m * sinf(total_angle), sim->current_position.lat);

    sim->current_position.lat += dev_lat;
    sim->current_position.lon += dev_lon;
    sim->in_deviation = true;
}

void gps_simulator_reset_deviation(gps_simulator_t *sim)
{
    if (!sim)
    {
        return;
    }
    sim->in_deviation = false;
}
