#ifndef CLAW_MQTT_CLIENT_H
#define CLAW_MQTT_CLIENT_H

#include <stddef.h>

#ifdef _WIN32
  #ifdef CLAW_MQTT_BUILD_DLL
    #define CLAW_MQTT_API __declspec(dllexport)
  #else
    #define CLAW_MQTT_API __declspec(dllimport)
  #endif
#else
  #define CLAW_MQTT_API
#endif

#ifdef __cplusplus
extern "C" {
#endif

typedef struct claw_client claw_client_t;

typedef enum claw_status {
  CLAW_STATUS_OK = 0,
  CLAW_STATUS_INVALID_ARGUMENT = 1,
  CLAW_STATUS_NO_MEMORY = 2,
  CLAW_STATUS_MQTT_ERROR = 3,
  CLAW_STATUS_TIMEOUT = 4,
  CLAW_STATUS_NOT_CONNECTED = 5,
  CLAW_STATUS_JSON_ERROR = 6,
  CLAW_STATUS_INTERNAL_ERROR = 7
} claw_status_t;

typedef enum claw_log_level {
  CLAW_LOG_DEBUG = 10,
  CLAW_LOG_INFO = 20,
  CLAW_LOG_WARN = 30,
  CLAW_LOG_ERROR = 40
} claw_log_level_t;

typedef void (*claw_message_callback_t)(
    const char* topic,
    const char* sender_id,
    const char* text,
    const char* kind,
    const char* correlation_id,
    void* user_data);

typedef void (*claw_log_callback_t)(
    int level,
    const char* message,
    void* user_data);

CLAW_MQTT_API claw_client_t* claw_client_create(void);
CLAW_MQTT_API void claw_client_destroy(claw_client_t* client);

CLAW_MQTT_API int claw_client_configure(
    claw_client_t* client,
    const char* broker_url,
    const char* inbound_topic,
    const char* outbound_topic,
    const char* sender_id,
    const char* client_id,
    const char* username,
    const char* password,
    int qos);

CLAW_MQTT_API void claw_client_set_message_callback(
    claw_client_t* client,
    claw_message_callback_t callback,
    void* user_data);

CLAW_MQTT_API void claw_client_set_log_callback(
    claw_client_t* client,
    claw_log_callback_t callback,
    void* user_data);

CLAW_MQTT_API int claw_client_connect(claw_client_t* client, int timeout_ms);
CLAW_MQTT_API int claw_client_disconnect(claw_client_t* client, int timeout_ms);
CLAW_MQTT_API int claw_client_is_connected(const claw_client_t* client);

CLAW_MQTT_API int claw_client_send_text(
    claw_client_t* client,
    const char* text,
    const char* correlation_id,
    char* out_correlation_id,
    size_t out_correlation_id_size);

CLAW_MQTT_API const char* claw_status_string(int code);

#ifdef __cplusplus
}
#endif

#endif
