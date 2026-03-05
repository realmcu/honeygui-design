/**
 * @file memory_monitor.c
 * @brief Memory usage monitoring implementation
 */

#include "memory_monitor.h"
#include <stdio.h>
#include <string.h>
#include "map_types.h"
#ifdef USE_HONEY_GUI

#include "gui_api_os.h"
void memory_monitor_init(void)
{
    /* HoneyGUI has built-in memory monitoring */
}
void memory_monitor_get_stats(memory_stats_t *stats)
{
    /* HoneyGUI has built-in memory monitoring */
    if (stats)
    {
        memset(stats, 0, sizeof(memory_stats_t));
    }
}
void memory_monitor_print(const char *label)
{
    /* HoneyGUI has built-in memory monitoring */
    MAP_PRINTF("map %s\n", label);
    MAP_PRINTF("Low mem used: %d\n", gui_low_mem_used());
    // MAP_PRINTF(" mem used: %d\n", gui_mem_used());
    (void)label;
}
size_t memory_monitor_check_leaks(void)
{
    /* HoneyGUI has built-in memory monitoring */
    return 0;
}
size_t memory_monitor_get_process_memory(void)
{
    /* HoneyGUI has built-in memory monitoring */
    return 0;
}

#else
#ifdef _WIN32
#include <windows.h>
#include <psapi.h>
#else
#include <unistd.h>
#include <sys/resource.h>
#endif

/* Global memory statistics */
static memory_stats_t g_stats = {0};
static int g_initialized = 0;

void memory_monitor_init(void)
{
    memset(&g_stats, 0, sizeof(memory_stats_t));
    g_initialized = 1;
}

void memory_monitor_get_stats(memory_stats_t *stats)
{
    if (!g_initialized)
    {
        memory_monitor_init();
    }
    if (stats)
    {
        memcpy(stats, &g_stats, sizeof(memory_stats_t));
    }
}

void memory_monitor_print(const char *label)
{
    if (!g_initialized)
    {
        memory_monitor_init();
    }

    size_t process_mem = memory_monitor_get_process_memory();

    MAP_PRINTF("\n=== Memory Monitor%s%s ===\n",
               label ? ": " : "",
               label ? label : "");
    MAP_PRINTF("  Process Memory:    %10.2f MB\n", process_mem / (1024.0 * 1024.0));
    MAP_PRINTF("  Current Usage:     %10.2f MB\n", g_stats.current_usage / (1024.0 * 1024.0));
    MAP_PRINTF("  Peak Usage:        %10.2f MB\n", g_stats.peak_usage / (1024.0 * 1024.0));
    MAP_PRINTF("  Allocations:       %10zu\n", g_stats.allocated_count);
    MAP_PRINTF("  Frees:             %10zu\n", g_stats.freed_count);
    MAP_PRINTF("  Total Allocated:   %10.2f MB\n", g_stats.total_allocated / (1024.0 * 1024.0));
    MAP_PRINTF("  Total Freed:       %10.2f MB\n", g_stats.total_freed / (1024.0 * 1024.0));
    MAP_PRINTF("  Potential Leaks:   %10zu allocations\n",
               g_stats.allocated_count > g_stats.freed_count ?
               g_stats.allocated_count - g_stats.freed_count : 0);
    MAP_PRINTF("  Leak Size:         %10.2f MB\n",
               (g_stats.total_allocated - g_stats.total_freed) / (1024.0 * 1024.0));
    MAP_PRINTF("========================================\n\n");
}

void memory_monitor_reset(void)
{
    memset(&g_stats, 0, sizeof(memory_stats_t));
}

size_t memory_monitor_get_process_memory(void)
{
#ifdef _WIN32
    /* Windows: Use GetProcessMemoryInfo */
    PROCESS_MEMORY_COUNTERS_EX pmc;
    if (GetProcessMemoryInfo(GetCurrentProcess(),
                             (PROCESS_MEMORY_COUNTERS *)&pmc,
                             sizeof(pmc)))
    {
        return (size_t)pmc.WorkingSetSize;
    }
    return 0;
#elif defined(__linux__)
    /* Linux: Read /proc/self/statm */
    FILE *fp = fopen("/proc/self/statm", "r");
    if (fp)
    {
        long pages = 0;
        if (fscanf(fp, "%ld", &pages) == 1)
        {
            fclose(fp);
            return (size_t)pages * (size_t)sysconf(_SC_PAGESIZE);
        }
        fclose(fp);
    }
    return 0;
#elif defined(__APPLE__)
    /* macOS: Use getrusage */
    struct rusage usage;
    if (getrusage(RUSAGE_SELF, &usage) == 0)
    {
        return (size_t)usage.ru_maxrss;
    }
    return 0;
#else
    return 0;
#endif
}

size_t memory_monitor_check_leaks(void)
{
    if (!g_initialized)
    {
        memory_monitor_init();
    }

    if (g_stats.allocated_count > g_stats.freed_count)
    {
        return g_stats.allocated_count - g_stats.freed_count;
    }
    return 0;
}

/* Internal tracking functions */
void memory_monitor_track_alloc(size_t size)
{
    if (!g_initialized)
    {
        memory_monitor_init();
    }

    g_stats.current_usage += size;
    g_stats.total_allocated += size;
    g_stats.allocated_count++;

    if (g_stats.current_usage > g_stats.peak_usage)
    {
        g_stats.peak_usage = g_stats.current_usage;
    }
}

void memory_monitor_track_free(size_t size)
{
    if (!g_initialized)
    {
        memory_monitor_init();
    }

    if (g_stats.current_usage >= size)
    {
        g_stats.current_usage -= size;
    }
    g_stats.total_freed += size;
    g_stats.freed_count++;
}
#endif
