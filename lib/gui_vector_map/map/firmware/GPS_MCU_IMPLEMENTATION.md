# GPS Driver MCU Implementation for Realtek Bumblebee

## Overview
This document describes the GPS driver implementation for the Realtek Bumblebee (RTL876x) MCU platform, based on the reference UART interrupt demo.

## Key Changes

### 1. Hardware Configuration
- **UART Pins**: 
  - TX: P3_1
  - RX: P3_0
- **UART Peripheral**: UART0
- **Interrupt**: UART0_IRQn (Priority 3)

### 2. Baudrate Support
The implementation supports two common GPS baudrates:
- **9600 baud** (most common for GPS modules)
  - UART_Div: UART_CLOCK_40M
  - UART_Ovsr: 12
  - UART_Ovsr_adj: 0x252
  
- **115200 baud** (high-speed GPS modules)
  - UART_Div: UART_CLOCK_40M
  - UART_Ovsr: 20
  - UART_Ovsr_adj: 0x24A

### 3. Interrupt-Based Reception
The implementation uses interrupt-driven UART reception with:
- **RX FIFO Trigger Level**: 14 bytes
- **Interrupt Types**:
  - `UART_INT_RD_AVA`: Data available
  - `UART_INT_LINE_STS`: Line status errors
  - `UART_INT_IDLE`: RX idle detection

### 4. Circular Buffer
- **Size**: 256 bytes (GPS_RX_BUFFER_SIZE)
- **Thread-safe**: Uses write/read pointers
- **Overflow handling**: Automatically advances read pointer on overflow

### 5. Message Queue
- **Queue Name**: "gpsRxQ"
- **Size**: 16 messages
- **Event**: GPS_EVENT_DATA_READY (0x01)
- Used to signal data availability from interrupt context

## Code Structure

### Initialization Flow
```c
gps_driver_create()
  └─> serial_open()
      ├─> Configure GPIO pads (Pad_Config)
      ├─> Configure pinmux (Pinmux_Config)
      ├─> Enable UART clock (RCC_PeriphClockCmd)
      ├─> Initialize UART (UART_Init)
      ├─> Enable interrupts (UART_INTConfig)
      ├─> Configure NVIC (NVIC_Init)
      └─> Register interrupt handler (RamVectorTableUpdate)
```

### Data Reception Flow
```
GPS Module (NMEA) ──[UART]──> RX FIFO (16 bytes)
                                   │
                                   ▼
                           [UART Interrupt]
                                   │
                                   ▼
                         gps_uart_handler()
                                   │
                                   ├──> Copy to circular buffer
                                   └──> Send message to queue
                                            │
                                            ▼
                                   gps_driver_update()
                                            │
                                            ├──> serial_read_data()
                                            │    (read from circular buffer)
                                            │
                                            └──> nmea_parser_feed_byte()
                                                 (parse NMEA sentences)
```

### Interrupt Handler (gps_uart_handler)
Handles three interrupt types:
1. **UART_INT_ID_RX_LEVEL_REACH**: FIFO reached 14 bytes
2. **UART_INT_ID_RX_TMEOUT**: Timeout (partial data)
3. **UART_INT_ID_LINE_STATUS**: Error conditions

For each received byte:
- Store in circular buffer `gps_rx_buffer[gps_rx_write_pos]`
- Advance write pointer: `gps_rx_write_pos = (gps_rx_write_pos + 1) % GPS_RX_BUFFER_SIZE`
- Handle overflow by advancing read pointer if needed

## Usage Example

```c
#include "gps_driver.h"

void gps_task(void *param)
{
    // Configure GPS driver
    gps_driver_config_t config;
    gps_driver_config_init(&config);
    config.port_name = "GPS";  // Not used on MCU, but required
    config.baudrate = 9600;     // Standard GPS baudrate
    config.read_timeout_ms = 100;
    
    // Create GPS driver instance
    gps_driver_t *gps = gps_driver_create(&config);
    if (!gps) {
        // Handle error
        return;
    }
    
    // Main loop
    while (1) {
        // Update GPS data (non-blocking)
        bool updated = gps_driver_update(gps);
        
        if (updated) {
            // Get position data
            const gps_position_t *pos = gps_driver_get_position(gps);
            
            if (pos->valid) {
                // Use GPS position
                float lat = pos->lat;
                float lon = pos->lon;
                float speed = pos->speed;
                // ...
            }
        }
        
        // Delay or wait for next update
        os_delay(100);  // 100ms delay
    }
    
    // Cleanup
    gps_driver_destroy(gps);
}
```

## Pin Configuration Notes

If you need to use different UART pins, modify these definitions in `gps_driver.c`:

```c
#define GPS_UART_TX_PIN         P3_1  // Change to your TX pin
#define GPS_UART_RX_PIN         P3_0  // Change to your RX pin
```

And update the pinmux configuration in `serial_open()`:

```c
Pinmux_Config(GPS_UART_TX_PIN, UART0_TX);
Pinmux_Config(GPS_UART_RX_PIN, UART0_RX);
```

## Memory Requirements

- **Static RAM**: 
  - Circular buffer: 256 bytes
  - Message queue: ~16 bytes
  - Total: ~272 bytes

- **Dynamic RAM** (per GPS driver instance):
  - gps_driver_t structure: ~1KB
  - Includes position data, satellite info, parser state

## Thread Safety

The implementation is thread-safe for single-reader scenarios:
- Interrupt handler writes to circular buffer
- Application task reads from circular buffer
- No mutex required due to single writer/reader pattern

For multiple readers, add mutex protection around `serial_read_data()`.

## Testing

1. Connect GPS module to UART0 (P3_0=RX, P3_1=TX)
2. Ensure GPS module outputs NMEA sentences at 9600 baud
3. Call `gps_driver_update()` periodically (e.g., every 100ms)
4. Check `gps_driver_has_fix()` for valid GPS fix
5. Read position data with `gps_driver_get_position()`

## Troubleshooting

### No data received
- Check pin connections (TX/RX may be swapped)
- Verify baudrate matches GPS module (common: 9600 or 115200)
- Check GPS module has power and antenna

### Checksum errors
- Check `gps_driver_get_error_count()` for parse errors
- May indicate noise or incorrect baudrate

### Buffer overflow
- Increase GPS_RX_BUFFER_SIZE if needed
- Call `gps_driver_update()` more frequently

## Reference
Based on: `uart_demo.c` from Realtek Bumblebee SDK
- Path: `C:\Users\triton_yu\Documents\BB2P\HoneyComb\sdk\src\sample\io_demo\uart\interrupt\uart_demo.c`
