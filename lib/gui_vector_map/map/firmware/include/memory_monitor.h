/**
 * @file memory_monitor.h
 * @brief Memory usage monitoring utilities
 */

#ifndef MEMORY_MONITOR_H
#define MEMORY_MONITOR_H

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/**
 * @brief Memory statistics structure
 */
typedef struct
{
    size_t current_usage;      /* Current memory usage in bytes */
    size_t peak_usage;         /* Peak memory usage in bytes */
    size_t allocated_count;    /* Number of allocations */
    size_t freed_count;        /* Number of frees */
    size_t total_allocated;    /* Total bytes allocated */
    size_t total_freed;        /* Total bytes freed */
} memory_stats_t;

/**
 * @brief Initialize memory monitoring
 */
void memory_monitor_init(void);

/**
 * @brief Get current memory statistics
 *
 * @param stats Pointer to stats structure to fill
 */
void memory_monitor_get_stats(memory_stats_t *stats);

/**
 * @brief Print memory statistics
 *
 * @param label Optional label to print
 */
void memory_monitor_print(const char *label);

/**
 * @brief Reset memory statistics
 */
void memory_monitor_reset(void);

/**
 * @brief Get process memory usage (platform-specific)
 *
 * @return Current process memory usage in bytes, or 0 if unavailable
 */
size_t memory_monitor_get_process_memory(void);

/**
 * @brief Check for memory leaks
 *
 * @return Number of potential leaks (allocated - freed)
 */
size_t memory_monitor_check_leaks(void);

#ifdef __cplusplus
}
#endif

#endif /* MEMORY_MONITOR_H */
