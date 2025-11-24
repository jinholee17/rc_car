#ifndef BOARD_CONFIG_H
#define BOARD_CONFIG_H

//
// WARNING!!! PSRAM IC required for UXGA resolution and high JPEG quality
//            Ensure 'AI Thinker ESP32-CAM' is selected from the board menu.
//            Select a partition scheme with at least 3MB APP space.
//

// =====================
// Select camera model
// =====================
//#define CAMERA_MODEL_WROVER_KIT
//#define CAMERA_MODEL_ESP_EYE
//#define CAMERA_MODEL_ESP32S3_EYE
//#define CAMERA_MODEL_M5STACK_PSRAM
//#define CAMERA_MODEL_M5STACK_V2_PSRAM
//#define CAMERA_MODEL_M5STACK_WIDE
//#define CAMERA_MODEL_M5STACK_ESP32CAM
//#define CAMERA_MODEL_M5STACK_UNITCAM
//#define CAMERA_MODEL_M5STACK_CAMS3_UNIT
#define CAMERA_MODEL_AI_THINKER   // <-- THIS IS THE RIGHT ONE
//#define CAMERA_MODEL_TTGO_T_JOURNAL
//#define CAMERA_MODEL_XIAO_ESP32S3
//#define CAMERA_MODEL_ESP32_CAM_BOARD
//#define CAMERA_MODEL_ESP32S2_CAM_BOARD
//#define CAMERA_MODEL_ESP32S3_CAM_LCD
//#define CAMERA_MODEL_DFRobot_FireBeetle2_ESP32S3
//#define CAMERA_MODEL_DFRobot_Romeo_ESP32S3

#include "camera_pins.h"

#endif  // BOARD_CONFIG_H
