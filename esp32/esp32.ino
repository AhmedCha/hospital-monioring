#include <WiFi.h>
#include <ESPAsyncWebServer.h>
#include <Preferences.h>
#include <LittleFS.h>

// Modular Includes
#include "globals.h"
#include "network.h"
#include "settings.h"
#include "sensors.h"

// Initialize Shared Objects & Variables
Preferences preferences;
AsyncWebServer server(80);

String currentSSID         = "";
String currentWiFiPassword = "";
String currentAPSSID       = "ESP32_001";
String currentAPPassword   = "men0lel1";
String wifiOptionsHTML     = "";
String currentFbUrl        = "";
String currentFbApiKey     = "";
String currentFbEmail      = "";
String currentFbPassword   = "";
String currentRoomId       = "room_001";
String currentPatientId    = "patient_001";

bool shouldReboot = false;
unsigned long rebootTime      = 0;
unsigned long lastScanTime    = 0 - 10000;
unsigned long lastDebugPrint  = 0;

// Firebase Objects (used by network.h/cpp via extern)
WiFiClientSecure  ssl_client;
AsyncClientClass  aClient(ssl_client);
FirebaseApp       app;
RealtimeDatabase  Database;
TaskHandle_t      FirebaseTask;

void setup() {
  DBG_BEGIN(115200);

  // Initialize LittleFS
  if (!LittleFS.begin(true)) {
    DBG_PRINTLN("An Error has occurred while mounting LittleFS");
    return;
  }
  DBG_PRINTLN("LittleFS mounted successfully");

  // Load preferences
  preferences.begin("settings", true);
  currentSSID         = preferences.getString("ssid",         "");
  currentWiFiPassword = preferences.getString("wifi_password","");
  currentAPSSID       = preferences.getString("apssid",       "ESP32_001");
  currentAPPassword   = preferences.getString("ap_password",  "men0lel1");
  currentFbUrl        = preferences.getString("fb_url",       "");
  currentFbApiKey     = preferences.getString("fb_api_key",   "");
  currentFbEmail      = preferences.getString("fb_email",     "");
  currentFbPassword   = preferences.getString("fb_password",  "");
  currentRoomId       = preferences.getString("room_id",      "room_001");
  currentPatientId    = preferences.getString("patient_id",   "patient_001");
  preferences.end();

  DBG_PRINTLN("==================================");
  DBG_PRINTLN("     CURRENT CONFIGURATIONS       ");
  DBG_PRINTLN("==================================");
  DBG_PRINTLN("WiFi SSID:      " + currentSSID);
  DBG_PRINTLN("AP SSID:        " + currentAPSSID);
  DBG_PRINTLN("Room ID:        " + currentRoomId);
  DBG_PRINTLN("Patient ID:     " + currentPatientId);
  DBG_PRINTLN("FB URL:         " + currentFbUrl);
  DBG_PRINTLN("FB API Key:     " + currentFbApiKey);
  DBG_PRINTLN("FB Email:       " + currentFbEmail);
  DBG_PRINTLN("FB Pass len:    " + String(currentFbPassword.length()) + " chars");
  DBG_PRINTLN("==================================\n");

  // Initialize Hardware Sensors
  initSensors();

  WiFi.mode(WIFI_AP_STA);

  // Attempt initial WiFi connection (the Firebase task will keep retrying if this fails)
  WiFi.begin(currentSSID.c_str(), currentWiFiPassword.c_str());
  int attempts = 0;
  DBG_PRINTLN("\nTrying to connect to WiFi...");
  while (WiFi.status() != WL_CONNECTED && attempts < WIFI_ATTEMPTS) {
    delay(WIFI_DELAY_MS);
    DBG_PRINT(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    DBG_PRINTLN("\nConnected to WiFi");
    DBG_PRINTLN(WiFi.localIP());
  } else {
    DBG_PRINTLN("\nFailed to connect to WiFi — Firebase task will keep retrying.");
    WiFi.disconnect();
  }

  // Configure Access Point
  WiFi.softAP(currentAPSSID.c_str(), currentAPPassword.c_str());
  DBG_PRINTLN("==================================");
  DBG_PRINT("AP IP Address: ");
  DBG_PRINTLN(WiFi.softAPIP());
  DBG_PRINTLN("==================================\n");

  // Set up routes and start the web server
  setupSettingsRoutes();
  server.begin();
  DBG_PRINTLN("HTTP server started");
  DBG_PRINTLN("==================================\n");

  // Start the Firebase upload loop on Core 0 (Network Core)
  xTaskCreatePinnedToCore(
      firebaseUploadTask,
      "FirebaseTask",
      8192,
      NULL,
      1,
      &FirebaseTask,
      0
  );
}

void loop() {
  updateSensors(); // Runs completely uninterrupted on Core 1

  // Periodic sensor/state debug dump — compiled away entirely without DEBUG_MODE
  if (millis() - lastDebugPrint > DEBUG_INTERVAL_MS) {
    lastDebugPrint = millis();
    DBG_PRINT("[DEBUG] Temp: ");   DBG_PRINT(currentTemp);
    DBG_PRINT(" °C | Hum: ");     DBG_PRINT(currentHumidity);
    DBG_PRINT(" % | BPM: ");      DBG_PRINT(currentBPM);
    DBG_PRINT(" | SpO2: ");       DBG_PRINTLN(currentSpO2);
  }

  unsigned long currentTime = millis();
  if (lastScanTime == 0 || currentTime - lastScanTime >= SCAN_INTERVAL_MS) {
    lastScanTime = (currentTime == 0) ? 1 : currentTime;
    WiFi.scanNetworks(true);
  }

  if (shouldReboot) {
    if (millis() - rebootTime > 2000) {
      ESP.restart();
    }
  }

  delay(10);
}
