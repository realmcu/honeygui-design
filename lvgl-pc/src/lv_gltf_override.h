#ifndef LV_GLTF_OVERRIDE_H
#define LV_GLTF_OVERRIDE_H

#include "lvgl.h"

#ifdef __cplusplus
extern "C" {
#endif

typedef enum {
    LV_GLTF_AA_MODE_OFF = 0,
    LV_GLTF_AA_MODE_ON = 1,
    LV_GLTF_AA_MODE_DYNAMIC = 2,
} lv_gltf_aa_mode_t;

typedef enum {
    LV_GLTF_BG_MODE_SOLID = 0,
    LV_GLTF_BG_MODE_ENVIRONMENT = 1,
} lv_gltf_bg_mode_t;

lv_obj_t * lv_gltf_create(lv_obj_t * parent);
lv_gltf_model_t * lv_gltf_load_model_from_file(lv_obj_t * obj, const char * path);

void lv_gltf_set_fov(lv_obj_t * obj, float value);
float lv_gltf_get_fov(const lv_obj_t * obj);

void lv_gltf_set_distance(lv_obj_t * obj, float value);
float lv_gltf_get_distance(const lv_obj_t * obj);

void lv_gltf_set_background_mode(lv_obj_t * obj, lv_gltf_bg_mode_t value);
lv_gltf_bg_mode_t lv_gltf_get_background_mode(const lv_obj_t * obj);

void lv_gltf_set_antialiasing_mode(lv_obj_t * obj, lv_gltf_aa_mode_t value);
lv_gltf_aa_mode_t lv_gltf_get_antialiasing_mode(const lv_obj_t * obj);

void lv_gltf_set_bg_mode(lv_obj_t * obj, lv_gltf_bg_mode_t value);
lv_gltf_bg_mode_t lv_gltf_get_bg_mode(const lv_obj_t * obj);
void lv_gltf_set_aa_mode(lv_obj_t * obj, lv_gltf_aa_mode_t value);
lv_gltf_aa_mode_t lv_gltf_get_aa_mode(const lv_obj_t * obj);

#ifdef __cplusplus
}
#endif

#endif
