#ifndef GLOBALS_H
#define GLOBALS_H

#include <Arduino.h>
#include <ESPAsyncWebServer.h>
#include <Preferences.h>

// ---------------------------------------------------------------------------
// Debug macros — controlled by passing -DDEBUG_MODE at compile time via:
//   arduino-cli compile --build-property "build.extra_flags=-DDEBUG_MODE"
// ---------------------------------------------------------------------------
#ifdef DEBUG_MODE
#define DBG_BEGIN(baud) Serial.begin(baud)
#define DBG_PRINT(x) Serial.print(x)
#define DBG_PRINTLN(x) Serial.println(x)
#define DBG_PRINTF(...) Serial.printf(__VA_ARGS__)
#else
#define DBG_BEGIN(baud)
#define DBG_PRINT(x)
#define DBG_PRINTLN(x)
#define DBG_PRINTF(...)
#endif

// Shared Objects
extern Preferences preferences;
extern AsyncWebServer server;

// Shared Configuration Variables
extern String currentSSID;
extern String currentWiFiPassword;
extern String currentAPSSID;
extern String currentAPPassword;
extern String wifiOptionsHTML;
extern String currentFbUrl;
extern String currentFbApiKey;
extern String currentFbEmail;
extern String currentFbPassword;
extern String currentRoomId;
extern String currentPatientId;

// Shared System Variables
extern bool shouldReboot;
extern unsigned long rebootTime;
extern unsigned long lastScanTime;

// Constants
const unsigned long WIFI_CHECK_INTERVAL = 10000;
const unsigned long SCAN_INTERVAL_MS = 10000;
const unsigned long DEBUG_INTERVAL_MS = 5000;
const unsigned long FIREBASE_INTERVAL_MS = 1000;

// Shared Sensor Variables
extern float currentTemp;
extern float currentHumidity;
extern float currentBPM;
extern float currentSpO2;

#endif
