/**
 * @file gps_driver.c
 * @brief GPS Driver Implementation - Serial GPS module interface
 *
 * This module provides GPS position data from real GPS hardware via serial port.
 * Parses NMEA 0183 sentences and converts to gps_position_t format compatible
 * with the GPS Simulator interface.
 */

#ifdef _WIN32
#include <windows.h>
#else
// MCU includes (Realtek Bumblebee)
#include "rtl876x_uart.h"
#include "rtl876x_rcc.h"
#include "rtl876x_pinmux.h"
#include "rtl876x_nvic.h"
#include "os_msg.h"
#include "trace.h"
#include "vector_table.h"
// Dual buffer configuration
#define GPS_RX_BUFFER_SIZE      (1024*2)    // Larger buffer for complete NMEA sentences
#define GPS_NUM_BUFFERS   2       // Ping-pong buffers
#include "gps_driver_config_mcu.h"  // MCU-specific configuration
#endif

#include "gps_driver.h"
#include "map_types.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>

/* ============================================================================
 * Error Message Buffer
 * ============================================================================
 */

static char gps_driver_error_msg[256] = {0};

#ifndef _WIN32
/* ============================================================================
 * MCU GPS UART Configuration - Dual Buffer Implementation
 * ============================================================================
 */
#define GPS_UART_TX_PIN         P3_2
#define GPS_UART_RX_PIN         P3_4
#define GPS_UART                UART0
#define GPS_UART_IRQ            UART0_IRQn



// Dual buffer structure
typedef struct
{
    uint8_t buffer[GPS_NUM_BUFFERS][GPS_RX_BUFFER_SIZE];
    volatile uint16_t write_pos[GPS_NUM_BUFFERS];
    volatile uint8_t active_buffer;     // Buffer being written by ISR (0 or 1)
    volatile uint8_t process_buffer;    // Buffer ready for processing (0, 1, or 0xFF if none)
    volatile bool buffer_ready;         // Flag indicating data is ready
    volatile uint32_t overflow_count;   // Track buffer overflows
    volatile uint32_t isr_count;        // Track interrupt count
} gps_dual_buffer_t;

static gps_dual_buffer_t gps_rx_dual_buffer = {0};
static void *gps_msg_queue_handle = NULL;
#define GPS_EVENT_DATA_READY    0x01
#endif

/* ============================================================================
 * Serial Port Internal Structure
 * ============================================================================
 */

typedef struct
{
    void *handle;  // Platform-specific handle (Windows: HANDLE, MCU: UART_HandleTypeDef*)
    char port_name[32];
    uint32_t baudrate;
    uint32_t read_timeout_ms;
} serial_handle_t;

/* ============================================================================
 * NMEA Parser Internal Structure
 * ============================================================================
 */

typedef struct
{
    char buffer[GPS_DRIVER_BUFFER_SIZE];
    int buf_pos;
    uint32_t sentence_count;
    uint32_t error_count;
} nmea_parser_internal_t;

/* ============================================================================
 * GPS Driver Internal Structure
 * ============================================================================
 */

struct gps_driver
{
    /* Serial port */
    serial_handle_t serial;
    bool serial_open;

    /* NMEA parser */
    nmea_parser_internal_t parser;

    /* GPS data (extended) */
    gps_driver_data_t gps_data;

    /* GPS position (compatible with gps_position_t) */
    gps_position_t position;

    /* Statistics */
    uint32_t total_bytes;
    uint32_t total_updates;
};

/* ============================================================================
 * Serial Port Functions (Windows and MCU)
 * ============================================================================
 */

static bool serial_open(serial_handle_t *serial, const gps_driver_config_t *config)
{
#ifdef _WIN32
    char full_name[64];
    snprintf(full_name, sizeof(full_name), "\\\\.\\%s", config->port_name);

    /* Open the serial port */
    HANDLE h = CreateFileA(full_name,
                           GENERIC_READ | GENERIC_WRITE,
                           0,
                           NULL,
                           OPEN_EXISTING,
                           0,
                           NULL);

    if (h == INVALID_HANDLE_VALUE)
    {
        DWORD err = GetLastError();
        snprintf(gps_driver_error_msg, sizeof(gps_driver_error_msg),
                 "Failed to open %s (error %lu)", config->port_name, err);
        return false;
    }

    /* Configure the port */
    DCB dcb = {0};
    dcb.DCBlength = sizeof(DCB);

    if (!GetCommState(h, &dcb))
    {
        snprintf(gps_driver_error_msg, sizeof(gps_driver_error_msg),
                 "Failed to get port state");
        CloseHandle(h);
        return false;
    }

    /* Set baud rate and 8N1 */
    dcb.BaudRate = config->baudrate;
    dcb.ByteSize = 8;
    dcb.Parity = NOPARITY;
    dcb.StopBits = ONESTOPBIT;

    /* Disable flow control */
    dcb.fOutxCtsFlow = FALSE;
    dcb.fOutxDsrFlow = FALSE;
    dcb.fDtrControl = DTR_CONTROL_ENABLE;
    dcb.fRtsControl = RTS_CONTROL_ENABLE;
    dcb.fOutX = FALSE;
    dcb.fInX = FALSE;

    if (!SetCommState(h, &dcb))
    {
        snprintf(gps_driver_error_msg, sizeof(gps_driver_error_msg),
                 "Failed to set port state");
        CloseHandle(h);
        return false;
    }    /* Set timeouts - optimized for GPS NMEA data (continuous stream) */
    COMMTIMEOUTS timeouts = {0};
    timeouts.ReadIntervalTimeout = MAXDWORD;           // Return immediately when data available
    timeouts.ReadTotalTimeoutConstant = config->read_timeout_ms;
    timeouts.ReadTotalTimeoutMultiplier = 0;           // No per-byte timeout
    timeouts.WriteTotalTimeoutConstant = 500;
    timeouts.WriteTotalTimeoutMultiplier = 10;

    /* Set larger input buffer to prevent overflow */
    SetupComm(h, 4096, 1024);  // 4KB input buffer, 1KB output buffer

    if (!SetCommTimeouts(h, &timeouts))
    {
        snprintf(gps_driver_error_msg, sizeof(gps_driver_error_msg),
                 "Failed to set timeouts");
        CloseHandle(h);
        return false;
    }

    /* Clear buffers */
    PurgeComm(h, PURGE_RXCLEAR | PURGE_TXCLEAR);

    /* Store handle */
    serial->handle = h;
    strncpy(serial->port_name, config->port_name, sizeof(serial->port_name) - 1);
    serial->port_name[sizeof(serial->port_name) - 1] = '\0';
    serial->baudrate = config->baudrate;
    serial->read_timeout_ms = config->read_timeout_ms;
    return true;
#else
    // MCU implementation (Realtek Bumblebee)

    // Configure GPIO pins for UART
    Pinmux_Config(GPS_UART_TX_PIN, UART0_TX);
    Pinmux_Config(GPS_UART_RX_PIN, UART0_RX);
    Pad_Config(GPS_UART_TX_PIN, PAD_PINMUX_MODE, PAD_IS_PWRON, PAD_PULL_NONE, PAD_OUT_DISABLE, PAD_OUT_LOW);
    Pad_Config(GPS_UART_RX_PIN, PAD_PINMUX_MODE, PAD_IS_PWRON, PAD_PULL_UP, PAD_OUT_DISABLE, PAD_OUT_LOW);



    // Enable UART clock
    RCC_PeriphClockCmd(APBPeriph_UART0, APBPeriph_UART0_CLOCK, ENABLE);
    // Initialize UART
    UART_InitTypeDef uartInitStruct;
    UART_StructInit(&uartInitStruct);

    // Configure UART parameters
    uartInitStruct.UART_WordLen = UART_WORD_LENGTH_8BIT;
    uartInitStruct.UART_StopBits = UART_STOP_BITS_1;
    uartInitStruct.UART_Parity = UART_PARITY_NO_PARTY;
    uartInitStruct.UART_HardwareFlowControl = UART_HW_FLOW_CTRL_DISABLE;
    uartInitStruct.rxTriggerLevel = GPS_UART_RX_TRIGGER_LEVEL;

    UART_Init(GPS_UART, &uartInitStruct);
    // Set baudrate after UART_Init (UART_Init may reset baudrate settings)
    if (config->baudrate == 9600)
    {
        UART_SetBaudRate(UART0, BAUD_RATE_9600);
        MAP_PRINTF("GPS UART: Baudrate set to 9600\n");
    }
    else if (config->baudrate == 115200)
    {
        UART_SetBaudRate(UART0, BAUD_RATE_115200);
        MAP_PRINTF("GPS UART: Baudrate set to 115200\n");
    }
    else
    {
        // Default to 9600 if unsupported baudrate
        UART_SetBaudRate(UART0, BAUD_RATE_9600);
        MAP_PRINTF("GPS UART: Unsupported baudrate %u, defaulting to 9600\n", config->baudrate);
    }

    MAP_PRINTF("GPS UART: Configuration complete (TX=P3_1, RX=P3_0, 8N1)\n");

    // Enable RX interrupt and line status interrupt
    UART_INTConfig(GPS_UART, UART_INT_RD_AVA | UART_INT_LINE_STS | UART_INT_IDLE, ENABLE);    // Configure NVIC
    NVIC_InitTypeDef NVIC_InitStruct;
    NVIC_InitStruct.NVIC_IRQChannel = GPS_UART_IRQ;
    NVIC_InitStruct.NVIC_IRQChannelPriority = GPS_UART_IRQ_PRIORITY;
    NVIC_InitStruct.NVIC_IRQChannelCmd = ENABLE;
    NVIC_Init(&NVIC_InitStruct);

    // Initialize dual buffer system
    memset(&gps_rx_dual_buffer, 0, sizeof(gps_dual_buffer_t));
    gps_rx_dual_buffer.active_buffer = 0;
    gps_rx_dual_buffer.process_buffer = 0xFF;  // No buffer ready
    gps_rx_dual_buffer.buffer_ready = false;

    MAP_PRINTF("GPS UART: Dual buffer initialized (2 x %d bytes)\n", GPS_RX_BUFFER_SIZE);

    serial->baudrate = config->baudrate;
    serial->read_timeout_ms = config->read_timeout_ms;

    return true;
#endif
}

static void serial_close_handle(serial_handle_t *serial)
{
#ifdef _WIN32
    if (serial->handle != INVALID_HANDLE_VALUE)
    {
        CloseHandle(serial->handle);
        serial->handle = INVALID_HANDLE_VALUE;
    }
#else
    // MCU implementation (Realtek Bumblebee)
    // if (GPS_UART)
    // {
    //     // Disable UART interrupts
    //     UART_INTConfig(GPS_UART, UART_INT_RD_AVA | UART_INT_LINE_STS | UART_INT_IDLE, DISABLE);

    //     // Disable UART peripheral


    //     // Disable clock
    //     RCC_PeriphClockCmd(APBPeriph_UART0, APBPeriph_UART0_CLOCK, DISABLE);
    // }
#endif
}

static int serial_read_data(serial_handle_t *serial, uint8_t *buffer, int size)
{
#ifdef _WIN32
    if (serial->handle == INVALID_HANDLE_VALUE)
    {
        return -1;
    }

    DWORD bytes_read = 0;
    if (!ReadFile(serial->handle, buffer, size, &bytes_read, NULL))
    {
        return -1;
    }
    return (int)bytes_read;
#else
    // MCU implementation - Dual buffer read

    // Check if there's a buffer ready for processing
    if (!gps_rx_dual_buffer.buffer_ready || gps_rx_dual_buffer.process_buffer == 0xFF)
    {
        return 0; // No data available
    }

    // Get the buffer index to read from
    uint8_t read_buf_idx = gps_rx_dual_buffer.process_buffer;
    uint16_t bytes_available = gps_rx_dual_buffer.write_pos[read_buf_idx];

    if (bytes_available == 0)
    {
        // Mark buffer as consumed
        gps_rx_dual_buffer.buffer_ready = false;
        gps_rx_dual_buffer.process_buffer = 0xFF;
        return 0;
    }

    // Calculate bytes to read
    int bytes_to_read = (size < bytes_available) ? size : bytes_available;

    // Copy data from the process buffer
    memcpy(buffer, gps_rx_dual_buffer.buffer[read_buf_idx], bytes_to_read);

    // If we read all data, mark buffer as consumed
    if (bytes_to_read >= bytes_available)
    {
        gps_rx_dual_buffer.buffer_ready = false;
        gps_rx_dual_buffer.process_buffer = 0xFF;
        gps_rx_dual_buffer.write_pos[read_buf_idx] = 0;
    }
    else
    {
        // Partial read - move remaining data to front (rare case)
        memmove(gps_rx_dual_buffer.buffer[read_buf_idx],
                gps_rx_dual_buffer.buffer[read_buf_idx] + bytes_to_read,
                bytes_available - bytes_to_read);
        gps_rx_dual_buffer.write_pos[read_buf_idx] = bytes_available - bytes_to_read;
    }

    return bytes_to_read;
#endif
}

#ifndef _WIN32
/**
  * @brief  GPS UART interrupt handler function - Dual Buffer Implementation
  * @param   No parameter.
  * @return  void
  */
void gps_uart_handler(void)
{
    uint32_t int_status = 0;
    uint8_t recv_len;
    uint8_t line_status = 0;
    uint8_t temp_buf[GPS_ISR_MAX_READ_BYTES];  // Use configurable size

    gps_rx_dual_buffer.isr_count++;

    // Handle RX IDLE interrupt - indicates end of transmission
    if (UART_GetFlagState(GPS_UART, UART_FLAG_RX_IDLE) == SET)
    {
        UART_INTConfig(GPS_UART, UART_INT_IDLE, DISABLE);

        // Read any remaining data in FIFO
        recv_len = UART_GetRxFIFOLen(GPS_UART);
        if (recv_len > 0)
        {
            if (recv_len > sizeof(temp_buf))
            {
                recv_len = sizeof(temp_buf);
            }
            UART_ReceiveData(GPS_UART, temp_buf, recv_len);

            uint8_t active_idx = gps_rx_dual_buffer.active_buffer;
            uint16_t pos = gps_rx_dual_buffer.write_pos[active_idx];

            // Copy to active buffer
            for (uint8_t i = 0; i < recv_len; i++)
            {
                if (pos < GPS_RX_BUFFER_SIZE)
                {
                    gps_rx_dual_buffer.buffer[active_idx][pos++] = temp_buf[i];
                }
                else
                {
                    gps_rx_dual_buffer.overflow_count++;
                    break;
                }
            }
            gps_rx_dual_buffer.write_pos[active_idx] = pos;
        }

        // Swap buffers if current buffer has data
        if (gps_rx_dual_buffer.write_pos[gps_rx_dual_buffer.active_buffer] > 0)
        {
            // Check if previous process buffer is still being processed
            // If so, don't switch buffers - continue accumulating in active buffer
            // This prevents data loss when main loop is slow
            if (gps_rx_dual_buffer.buffer_ready && gps_rx_dual_buffer.process_buffer != 0xFF)
            {
                // Previous buffer not yet consumed - don't switch
                // Data will continue to accumulate in current active buffer
                // This may delay processing but prevents data loss
            }
            else
            {
                // Safe to switch - mark current buffer as ready for processing
                gps_rx_dual_buffer.process_buffer = gps_rx_dual_buffer.active_buffer;

                // Switch to the other buffer
                gps_rx_dual_buffer.active_buffer = 1 - gps_rx_dual_buffer.active_buffer;
                gps_rx_dual_buffer.write_pos[gps_rx_dual_buffer.active_buffer] = 0;

                // Set flag and send message
                gps_rx_dual_buffer.buffer_ready = true;

                if (gps_msg_queue_handle)
                {
                    uint8_t event = GPS_EVENT_DATA_READY;
                    os_msg_send(gps_msg_queue_handle, &event, 0);
                }
            }
        }

        UART_INTConfig(GPS_UART, UART_INT_IDLE, ENABLE);
    }

    // Read interrupt ID
    int_status = UART_GetIID(GPS_UART);

    switch (int_status)
    {
        case UART_INT_ID_TX_EMPTY:
            // TX FIFO empty - not used for GPS receiver
            break;
        case UART_INT_ID_RX_LEVEL_REACH:
            // RX FIFO reached trigger level - store data immediately
            recv_len = UART_GetRxFIFOLen(GPS_UART);
            if (recv_len > sizeof(temp_buf))
            {
                recv_len = sizeof(temp_buf);
            }
            UART_ReceiveData(GPS_UART, temp_buf, recv_len);

            {
                uint8_t active_idx = gps_rx_dual_buffer.active_buffer;
                uint16_t pos = gps_rx_dual_buffer.write_pos[active_idx];

                // Copy to active buffer
                for (uint8_t i = 0; i < recv_len; i++)
                {
                    if (pos < GPS_RX_BUFFER_SIZE)
                    {
                        gps_rx_dual_buffer.buffer[active_idx][pos++] = temp_buf[i];
                    }
                    else
                    {
                        // Buffer full - try to swap
                        gps_rx_dual_buffer.overflow_count++;

                        // Check if other buffer is available (not being processed)
                        if (!gps_rx_dual_buffer.buffer_ready || gps_rx_dual_buffer.process_buffer == 0xFF)
                        {
                            // Safe to switch - mark current buffer as ready
                            gps_rx_dual_buffer.write_pos[active_idx] = pos;
                            gps_rx_dual_buffer.process_buffer = active_idx;

                            // Switch buffer
                            active_idx = 1 - active_idx;
                            gps_rx_dual_buffer.active_buffer = active_idx;
                            pos = 0;
                            gps_rx_dual_buffer.buffer_ready = true;

                            // Continue storing remaining data
                            gps_rx_dual_buffer.buffer[active_idx][pos++] = temp_buf[i];
                        }
                        else
                        {
                            // Both buffers full/busy - drop data to prevent corruption
                            // This indicates main loop is too slow
                            break;
                        }
                    }
                }
                gps_rx_dual_buffer.write_pos[active_idx] = pos;
            }
            break;

        case UART_INT_ID_RX_TMEOUT:
            // RX timeout - similar to LEVEL_REACH
            recv_len = UART_GetRxFIFOLen(GPS_UART);
            if (recv_len > sizeof(temp_buf))
            {
                recv_len = sizeof(temp_buf);
            }
            UART_ReceiveData(GPS_UART, temp_buf, recv_len);

            {
                uint8_t active_idx = gps_rx_dual_buffer.active_buffer;
                uint16_t pos = gps_rx_dual_buffer.write_pos[active_idx];

                for (uint8_t i = 0; i < recv_len; i++)
                {
                    if (pos < GPS_RX_BUFFER_SIZE)
                    {
                        gps_rx_dual_buffer.buffer[active_idx][pos++] = temp_buf[i];
                    }
                    else
                    {
                        gps_rx_dual_buffer.overflow_count++;
                        break;
                    }
                }
                gps_rx_dual_buffer.write_pos[active_idx] = pos;
            }
            break;

        case UART_INT_ID_LINE_STATUS:
            // Line status error
            line_status = UART_GetLineStatus(GPS_UART);

            // Log error if needed
            break;

        default:
            break;
    }
}
#endif

/* ============================================================================
 * NMEA Parser Functions
 * ============================================================================
 */

/* Calculate NMEA checksum */
static uint8_t nmea_checksum(const char *sentence)
{
    uint8_t checksum = 0;
    if (*sentence == '$')
    {
        sentence++;
    }
    while (*sentence && *sentence != '*')
    {
        checksum ^= (uint8_t) * sentence++;
    }
    return checksum;
}

/* Verify NMEA sentence checksum */
static bool nmea_verify_checksum(const char *sentence)
{
    const char *star = strchr(sentence, '*');
    if (!star || strlen(star) < 3)
    {
        return false;
    }
    uint8_t calc = nmea_checksum(sentence);
    uint8_t recv = (uint8_t)strtol(star + 1, NULL, 16);
    return calc == recv;
}

/* Get a field from NMEA sentence */
static const char *nmea_get_field(const char *sentence, int field_num,
                                  char *buffer, int buf_size)
{
    const char *p = sentence;
    int current_field = 0;

    if (*p == '$')
    {
        p++;
    }

    while (*p && current_field < field_num)
    {
        if (*p == ',')
        {
            current_field++;
        }
        p++;
    }

    int i = 0;
    while (*p && *p != ',' && *p != '*' && i < buf_size - 1)
    {
        buffer[i++] = *p++;
    }
    buffer[i] = '\0';

    return buffer;
}

/* Parse latitude (ddmm.mmmmm format) */
static double nmea_parse_latitude(const char *field, const char *ns)
{
    if (!field || strlen(field) < 4)
    {
        return 0.0;
    }

    char deg_str[4] = {0};
    strncpy(deg_str, field, 2);
    double degrees = atof(deg_str);
    double minutes = atof(field + 2);

    double lat = degrees + minutes / 60.0;

    if (ns && (ns[0] == 'S' || ns[0] == 's'))
    {
        lat = -lat;
    }

    return lat;
}

/* Parse longitude (dddmm.mmmmm format) */
static double nmea_parse_longitude(const char *field, const char *ew)
{
    if (!field || strlen(field) < 5)
    {
        return 0.0;
    }

    char deg_str[5] = {0};
    strncpy(deg_str, field, 3);
    double degrees = atof(deg_str);
    double minutes = atof(field + 3);

    double lon = degrees + minutes / 60.0;

    if (ew && (ew[0] == 'W' || ew[0] == 'w'))
    {
        lon = -lon;
    }

    return lon;
}

/* Parse time (hhmmss.sss format) */
static void nmea_parse_time(const char *field, gps_driver_data_t *data)
{
    if (!field || strlen(field) < 6)
    {
        return;
    }

    char buf[3] = {0};

    strncpy(buf, field, 2);
    data->hour = (uint8_t)atoi(buf);

    strncpy(buf, field + 2, 2);
    data->minute = (uint8_t)atoi(buf);

    strncpy(buf, field + 4, 2);
    data->second = (uint8_t)atoi(buf);

    if (strlen(field) > 7 && field[6] == '.')
    {
        data->millisecond = (uint16_t)(atof(field + 6) * 1000);
    }
}

/* Parse date (ddmmyy format) */
static void nmea_parse_date(const char *field, gps_driver_data_t *data)
{
    if (!field || strlen(field) < 6)
    {
        return;
    }

    char buf[3] = {0};

    strncpy(buf, field, 2);
    data->day = (uint8_t)atoi(buf);

    strncpy(buf, field + 2, 2);
    data->month = (uint8_t)atoi(buf);

    strncpy(buf, field + 4, 2);
    int year = atoi(buf);
    data->year = (uint16_t)(year < 80 ? 2000 + year : 1900 + year);
}

/* Parse GGA sentence */
static void parse_gga(gps_driver_t *driver, const char *sentence)
{
    char field[32];
    gps_driver_data_t *data = &driver->gps_data;

    nmea_get_field(sentence, 1, field, sizeof(field));
    nmea_parse_time(field, data);

    char lat_field[20], ns_field[4];
    nmea_get_field(sentence, 2, lat_field, sizeof(lat_field));
    nmea_get_field(sentence, 3, ns_field, sizeof(ns_field));
    if (strlen(lat_field) > 0)
    {
        data->latitude = nmea_parse_latitude(lat_field, ns_field);
    }

    char lon_field[20], ew_field[4];
    nmea_get_field(sentence, 4, lon_field, sizeof(lon_field));
    nmea_get_field(sentence, 5, ew_field, sizeof(ew_field));
    if (strlen(lon_field) > 0)
    {
        data->longitude = nmea_parse_longitude(lon_field, ew_field);
    }

    nmea_get_field(sentence, 6, field, sizeof(field));
    if (strlen(field) > 0)
    {
        data->fix_quality = (gps_driver_fix_quality_t)atoi(field);
        data->valid = (data->fix_quality > GPS_DRIVER_FIX_INVALID);
    }

    nmea_get_field(sentence, 7, field, sizeof(field));
    if (strlen(field) > 0)
    {
        data->satellites_used = (uint8_t)atoi(field);
    }

    nmea_get_field(sentence, 8, field, sizeof(field));
    if (strlen(field) > 0)
    {
        data->hdop = (float)atof(field);
    }

    nmea_get_field(sentence, 9, field, sizeof(field));
    if (strlen(field) > 0)
    {
        data->altitude = (float)atof(field);
    }

    nmea_get_field(sentence, 11, field, sizeof(field));
    if (strlen(field) > 0)
    {
        data->geoid_sep = (float)atof(field);
    }

    data->update_count++;
    data->last_update = MAP_TIME(NULL);
}

/* Parse RMC sentence */
static void parse_rmc(gps_driver_t *driver, const char *sentence)
{
    char field[32];
    gps_driver_data_t *data = &driver->gps_data;

    nmea_get_field(sentence, 1, field, sizeof(field));
    nmea_parse_time(field, data);

    nmea_get_field(sentence, 2, field, sizeof(field));
    data->valid = (field[0] == 'A');

    char lat_field[20], ns_field[4];
    nmea_get_field(sentence, 3, lat_field, sizeof(lat_field));
    nmea_get_field(sentence, 4, ns_field, sizeof(ns_field));
    if (strlen(lat_field) > 0)
    {
        data->latitude = nmea_parse_latitude(lat_field, ns_field);
    }

    char lon_field[20], ew_field[4];
    nmea_get_field(sentence, 5, lon_field, sizeof(lon_field));
    nmea_get_field(sentence, 6, ew_field, sizeof(ew_field));
    if (strlen(lon_field) > 0)
    {
        data->longitude = nmea_parse_longitude(lon_field, ew_field);
    }

    nmea_get_field(sentence, 7, field, sizeof(field));
    if (strlen(field) > 0)
    {
        data->speed_knots = (float)atof(field);
        data->speed_kmh = data->speed_knots * 1.852f;
    }

    nmea_get_field(sentence, 8, field, sizeof(field));
    if (strlen(field) > 0)
    {
        data->course = (float)atof(field);
    }

    nmea_get_field(sentence, 9, field, sizeof(field));
    nmea_parse_date(field, data);

    data->update_count++;
    data->last_update = MAP_TIME(NULL);
}

/* Parse GSA sentence */
static void parse_gsa(gps_driver_t *driver, const char *sentence)
{
    char field[32];
    gps_driver_data_t *data = &driver->gps_data;

    nmea_get_field(sentence, 2, field, sizeof(field));
    if (strlen(field) > 0)
    {
        data->fix_mode = (gps_driver_fix_mode_t)atoi(field);
    }

    /* Mark satellites in use */
    for (int i = 3; i <= 14; i++)
    {
        nmea_get_field(sentence, i, field, sizeof(field));
        if (strlen(field) > 0)
        {
            int prn = atoi(field);
            for (int j = 0; j < GPS_DRIVER_MAX_SATELLITES; j++)
            {
                if (data->satellites[j].prn == prn)
                {
                    data->satellites[j].in_use = true;
                    break;
                }
            }
        }
    }

    nmea_get_field(sentence, 15, field, sizeof(field));
    if (strlen(field) > 0)
    {
        data->pdop = (float)atof(field);
    }

    nmea_get_field(sentence, 16, field, sizeof(field));
    if (strlen(field) > 0)
    {
        data->hdop = (float)atof(field);
    }

    nmea_get_field(sentence, 17, field, sizeof(field));
    if (strlen(field) > 0)
    {
        data->vdop = (float)atof(field);
    }
}

/* Parse GSV sentence */
static void parse_gsv(gps_driver_t *driver, const char *sentence)
{
    char field[32];
    gps_driver_data_t *data = &driver->gps_data;

    nmea_get_field(sentence, 3, field, sizeof(field));
    if (strlen(field) > 0)
    {
        data->satellites_view = (uint8_t)atoi(field);
    }

    nmea_get_field(sentence, 2, field, sizeof(field));
    int msg_num = atoi(field);

    for (int i = 0; i < 4; i++)
    {
        int base_field = 4 + i * 4;
        int sat_idx = (msg_num - 1) * 4 + i;

        if (sat_idx >= GPS_DRIVER_MAX_SATELLITES)
        {
            break;
        }

        nmea_get_field(sentence, base_field, field, sizeof(field));
        if (strlen(field) == 0)
        {
            break;
        }
        data->satellites[sat_idx].prn = (uint8_t)atoi(field);

        nmea_get_field(sentence, base_field + 1, field, sizeof(field));
        data->satellites[sat_idx].elevation = (uint8_t)atoi(field);

        nmea_get_field(sentence, base_field + 2, field, sizeof(field));
        data->satellites[sat_idx].azimuth = (uint16_t)atoi(field);

        nmea_get_field(sentence, base_field + 3, field, sizeof(field));
        data->satellites[sat_idx].snr = (uint8_t)atoi(field);

        data->satellites[sat_idx].in_use = false;
    }
}

/* Parse VTG sentence */
static void parse_vtg(gps_driver_t *driver, const char *sentence)
{
    char field[32];
    gps_driver_data_t *data = &driver->gps_data;

    nmea_get_field(sentence, 1, field, sizeof(field));
    if (strlen(field) > 0)
    {
        data->course = (float)atof(field);
    }

    nmea_get_field(sentence, 5, field, sizeof(field));
    if (strlen(field) > 0)
    {
        data->speed_knots = (float)atof(field);
    }

    nmea_get_field(sentence, 7, field, sizeof(field));
    if (strlen(field) > 0)
    {
        data->speed_kmh = (float)atof(field);
    }
}

/* Parse a complete NMEA sentence */
static bool nmea_parse_sentence(gps_driver_t *driver, const char *sentence)
{
    if (!nmea_verify_checksum(sentence))
    {
        MAP_PRINTF("NMEA checksum verification failed for sentence: %s\n", sentence);
        driver->parser.error_count++;
        return false;
    }
    //MAP_PRINTF("NMEA checksum verified for sentence: %s\n", sentence);
    char type[8] = {0};
    nmea_get_field(sentence, 0, type, sizeof(type));
    //MAP_PRINTF("NMEA sentence type: %s\n", type);
    if (strstr(type, "GGA"))
    {
        parse_gga(driver, sentence);
    }
    else if (strstr(type, "RMC"))
    {
        parse_rmc(driver, sentence);
    }
    else if (strstr(type, "GSA"))
    {
        parse_gsa(driver, sentence);
    }
    else if (strstr(type, "GSV"))
    {
        parse_gsv(driver, sentence);
    }
    else if (strstr(type, "VTG"))
    {
        parse_vtg(driver, sentence);
    }

    driver->parser.sentence_count++;
    return true;
}

/* Debug logging macro for NMEA parsing */
#if GPS_DRIVER_DEBUG_NMEA
#define NMEA_DEBUG(...) MAP_PRINTF(__VA_ARGS__)
#else
#define NMEA_DEBUG(...) ((void)0)
#endif

/* Feed a byte to the parser */
static bool nmea_parser_feed_byte(gps_driver_t *driver, char c)
{
    nmea_parser_internal_t *parser = &driver->parser;
    // NMEA_DEBUG("Feeding byte to parser: %c (0x%02X)\n", (c >= 32 && c < 127) ? c : '.', (unsigned char)c);

    if (c == '$')
    {
        NMEA_DEBUG("Start of new NMEA sentence detected\n");
        if (parser->buf_pos > 0)
        {
            NMEA_DEBUG("Warning: Previous incomplete sentence discarded (buf_pos=%d)\n", parser->buf_pos);
        }
        parser->buf_pos = 0;
        parser->buffer[parser->buf_pos++] = c;
        return false;
    }
    if (c == '\n' || c == '\r')
    {
        NMEA_DEBUG("End of NMEA sentence detected (char=0x%02X)\n", (unsigned char)c);
        if (parser->buf_pos > 0)
        {
            parser->buffer[parser->buf_pos] = '\0';
            NMEA_DEBUG("Parsing complete NMEA sentence (length=%d): %s\n", parser->buf_pos, parser->buffer);
            bool result = nmea_parse_sentence(driver, parser->buffer);
            parser->buf_pos = 0;
            if (result)
            {
                NMEA_DEBUG("NMEA sentence parsed successfully - update triggered\n");
            }
            else
            {
                NMEA_DEBUG("NMEA sentence parsing failed - no update (checksum error or invalid format)\n");
            }
            return result;
        }
        else
        {
            NMEA_DEBUG("Empty line detected - no update (buf_pos=0)\n");
            return false;
        }
    }

    if (parser->buf_pos < GPS_DRIVER_BUFFER_SIZE - 1)
    {
        parser->buffer[parser->buf_pos++] = c;
    }
    else
    {
        // MAP_PRINTF("Warning: Parser buffer full (size=%d) - character discarded, no update\n", GPS_DRIVER_BUFFER_SIZE);
        parser->error_count++;
    }

    // Not end of sentence yet, no update
    return false;
}

/* Update gps_position_t from gps_driver_data_t */
static void update_position_from_data(gps_driver_t *driver)
{
    const gps_driver_data_t *data = &driver->gps_data;
    gps_position_t *pos = &driver->position;

    pos->lat = (float)data->latitude;
    pos->lon = (float)data->longitude;
    pos->speed = data->speed_kmh / 3.6f;  /* Convert km/h to m/s */
    pos->heading = data->course;
    pos->accuracy = data->hdop * 5.0f;    /* Approximate accuracy from HDOP */
    pos->valid = data->valid;
    pos->timestamp = data->last_update;
    pos->update_count = data->update_count;
}

/* ============================================================================
 * Public API Implementation
 * ============================================================================
 */

void gps_driver_config_init(gps_driver_config_t *config)
{
    if (!config)
    {
        return;
    }

    config->port_name = NULL;
    config->baudrate = GPS_DRIVER_DEFAULT_BAUDRATE;
    config->read_timeout_ms = GPS_DRIVER_READ_TIMEOUT_MS;
}

int gps_driver_list_ports(char ports[][32], int max_ports)
{
#ifdef _WIN32
    int count = 0;
    char port_name[32];

    for (int i = 1; i <= 256 && count < max_ports; i++)
    {
        snprintf(port_name, sizeof(port_name), "COM%d", i);

        char full_name[64];
        snprintf(full_name, sizeof(full_name), "\\\\.\\%s", port_name);

        HANDLE h = CreateFileA(full_name, GENERIC_READ | GENERIC_WRITE,
                               0, NULL, OPEN_EXISTING, 0, NULL);

        if (h != INVALID_HANDLE_VALUE)
        {
            CloseHandle(h);
            strncpy(ports[count], port_name, 31);
            ports[count][31] = '\0';
            count++;
        }
    }

    return count;
#else
    // MCU implementation: No dynamic port listing, return 0 or fixed ports if needed
    return 0;
#endif
}

gps_driver_t *gps_driver_create(const gps_driver_config_t *config)
{
    if (!config || !config->port_name)
    {
        snprintf(gps_driver_error_msg, sizeof(gps_driver_error_msg),
                 "Invalid configuration: port_name is required");
        return NULL;
    }

    gps_driver_t *driver = (gps_driver_t *)MAP_MALLOC(sizeof(gps_driver_t));
    if (!driver)
    {
        snprintf(gps_driver_error_msg, sizeof(gps_driver_error_msg),
                 "Memory allocation failed");
        return NULL;
    }
    memset(driver, 0, sizeof(gps_driver_t));
#ifdef _WIN32
    driver->serial.handle = INVALID_HANDLE_VALUE;
#else
    // MCU: Create message queue for GPS events
    if (!gps_msg_queue_handle)
    {
        os_msg_queue_create(&gps_msg_queue_handle, "gpsRxQ", 16, sizeof(uint8_t));
    }

    // Register UART interrupt handler
    extern void gps_uart_handler(void);
    RamVectorTableUpdate(UART0_VECTORn, (IRQ_Fun)gps_uart_handler);
#endif

    /* Open serial port */
    if (!serial_open(&driver->serial, config))
    {
        MAP_FREE(driver);
        return NULL;
    }

    driver->serial_open = true;

    /* Initialize GPS data */
    driver->gps_data.fix_quality = GPS_DRIVER_FIX_INVALID;
    driver->gps_data.fix_mode = GPS_DRIVER_MODE_NO_FIX;

    MAP_PRINTF("GPS Driver: Opened %s at %u baud\n",
               config->port_name, config->baudrate);

    return driver;
}

void gps_driver_destroy(gps_driver_t *driver)
{
    if (!driver)
    {
        return;
    }

    if (driver->serial_open)
    {
        serial_close_handle(&driver->serial);
    }

    MAP_FREE(driver);
}

bool gps_driver_update(gps_driver_t *driver)
{
    //MAP_PRINTF("GPS Driver: Update called\n");

    if (!driver)
    {
        MAP_PRINTF("GPS Driver: Update failed - driver is NULL\n");
        return false;
    }

    if (!driver->serial_open)
    {
        MAP_PRINTF("GPS Driver: Update failed - serial port is not open\n");
        return false;
    }

    uint8_t buffer[256];
    bool updated = false;
    int total_bytes_this_call = 0;
    int read_iterations = 0;
    const int max_iterations = 10;  // Prevent infinite loop

    // Loop to read all available data from buffers
    // This ensures we don't lose data if multiple buffers are ready
    while (read_iterations < max_iterations)
    {
        int bytes_read = serial_read_data(&driver->serial, buffer, sizeof(buffer));

        if (bytes_read <= 0)
        {
            // No more data available
            break;
        }

        read_iterations++;
        total_bytes_this_call += bytes_read;
        driver->total_bytes += bytes_read;

        // Feed all bytes to the NMEA parser
        for (int i = 0; i < bytes_read; i++)
        {
            if (nmea_parser_feed_byte(driver, (char)buffer[i]))
            {
                updated = true;
            }
        }
    }

    if (total_bytes_this_call == 0)
    {
        MAP_PRINTF("GPS Driver: Update failed - no data available from serial port\n");
        return false;
    }

    //MAP_PRINTF("GPS Driver: Parser feed complete, updated=%d\n", updated);

    if (updated)
    {
        //MAP_PRINTF("GPS Driver: Updating position from data\n");
        update_position_from_data(driver);
        driver->total_updates++;

        // Log GPS data validity
        if (!driver->gps_data.valid)
        {
            MAP_PRINTF("GPS Driver: Warning - GPS data is marked as invalid (fix_quality=%d, fix_mode=%d)\n",
                       driver->gps_data.fix_quality, driver->gps_data.fix_mode);
        }
        if (driver->gps_data.fix_quality == GPS_DRIVER_FIX_INVALID)
        {
            MAP_PRINTF("GPS Driver: Warning - No GPS fix available\n");
        }
        if (driver->gps_data.satellites_used == 0)
        {
            MAP_PRINTF("GPS Driver: Warning - No satellites in use (satellites_view=%d)\n",
                       driver->gps_data.satellites_view);
        }
    }
    else
    {
        MAP_PRINTF("GPS Driver: Update failed - no valid NMEA sentence parsed (total_sentences=%u, errors=%u)\n",
                   driver->parser.sentence_count, driver->parser.error_count);
    }

    MAP_PRINTF("GPS Driver: Update complete\n");
    return updated;
}

const gps_position_t *gps_driver_get_position(const gps_driver_t *driver)
{
    if (!driver)
    {
        return NULL;
    }
    return &driver->position;
}

const gps_driver_data_t *gps_driver_get_data(const gps_driver_t *driver)
{
    if (!driver)
    {
        return NULL;
    }
    return &driver->gps_data;
}

bool gps_driver_has_fix(const gps_driver_t *driver)
{
    if (!driver)
    {
        return false;
    }
    return driver->gps_data.valid &&
           driver->gps_data.fix_quality > GPS_DRIVER_FIX_INVALID;
}

const char *gps_driver_fix_quality_str(gps_driver_fix_quality_t quality)
{
    switch (quality)
    {
        case GPS_DRIVER_FIX_INVALID:
            return "Invalid";
        case GPS_DRIVER_FIX_GPS:
            return "GPS";
        case GPS_DRIVER_FIX_DGPS:
            return "DGPS";
        case GPS_DRIVER_FIX_PPS:
            return "PPS";
        case GPS_DRIVER_FIX_RTK:
            return "RTK Fixed";
        case GPS_DRIVER_FIX_FLOAT_RTK:
            return "RTK Float";
        case GPS_DRIVER_FIX_ESTIMATED:
            return "Estimated";
        case GPS_DRIVER_FIX_MANUAL:
            return "Manual";
        case GPS_DRIVER_FIX_SIMULATION:
            return "Simulation";
        default:
            return "Unknown";
    }
}

const char *gps_driver_fix_mode_str(gps_driver_fix_mode_t mode)
{
    switch (mode)
    {
        case GPS_DRIVER_MODE_NO_FIX:
            return "No Fix";
        case GPS_DRIVER_MODE_2D:
            return "2D Fix";
        case GPS_DRIVER_MODE_3D:
            return "3D Fix";
        default:
            return "Unknown";
    }
}

const char *gps_driver_get_error(void)
{
    return gps_driver_error_msg;
}

uint32_t gps_driver_get_sentence_count(const gps_driver_t *driver)
{
    if (!driver)
    {
        return 0;
    }
    return driver->parser.sentence_count;
}

uint32_t gps_driver_get_error_count(const gps_driver_t *driver)
{
    if (!driver)
    {
        return 0;
    }
    return driver->parser.error_count;
}

#ifndef _WIN32
void gps_driver_get_buffer_diagnostics(const gps_driver_t *driver, gps_buffer_diagnostics_t *diag)
{
    if (!driver || !diag)
    {
        return;
    }

    // Read volatile values atomically
    diag->overflow_count = gps_rx_dual_buffer.overflow_count;
    diag->isr_count = gps_rx_dual_buffer.isr_count;
    diag->active_buffer = gps_rx_dual_buffer.active_buffer;
    diag->process_buffer = gps_rx_dual_buffer.process_buffer;
    diag->buffer_ready = gps_rx_dual_buffer.buffer_ready;
    diag->active_bytes = gps_rx_dual_buffer.write_pos[gps_rx_dual_buffer.active_buffer];

    if (gps_rx_dual_buffer.process_buffer != 0xFF)
    {
        diag->process_bytes = gps_rx_dual_buffer.write_pos[gps_rx_dual_buffer.process_buffer];
    }
    else
    {
        diag->process_bytes = 0;
    }
}
#endif
