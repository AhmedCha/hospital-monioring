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

String currentSSID = "TUNISIETELECOM-2.4G-6aZF";
String currentWiFiPassword = "RXW7XezR";
String currentAPSSID = "ESP32_001";
String currentAPPassword = "men0lel1";
String wifiOptionsHTML = "";
String currentFbUrl = "";
String currentFbApiKey = "";
String currentFbEmail = "";
String currentFbPassword = "";
String currentRoomId = "room_001";
String currentPatientId = "patient_001";

bool shouldReboot = false;
unsigned long rebootTime = 0;
unsigned long lastScanTime = 0 - 10000;
unsigned long lastDebugPrint = 0;

// Initialize Firebase Objects
WiFiClientSecure ssl_client;
AsyncClientClass aClient(ssl_client);
FirebaseApp app;
RealtimeDatabase Database;
TaskHandle_t FirebaseTask;

void setup() {
  Serial.begin(115200);

  // Initialize LittleFS
  if (!LittleFS.begin(true)) {
    Serial.println("An Error has occurred while mounting LittleFS");
    return;
  }
  Serial.println("LittleFS mounted successfully");

  // Load preferences
  preferences.begin("settings", true);
  currentSSID = preferences.getString("ssid", "");
  currentWiFiPassword = preferences.getString("wifi_password", "");
  currentAPSSID = preferences.getString("apssid", "ESP32_001");
  currentAPPassword = preferences.getString("ap_password", "men0lel1");
  currentFbUrl = preferences.getString("fb_url", "");
  currentFbApiKey = preferences.getString("fb_api_key", "");
  currentFbEmail = preferences.getString("fb_email", "");
  currentFbPassword = preferences.getString("fb_password", "");
  currentRoomId = preferences.getString("room_id", "room_001");
  currentPatientId = preferences.getString("patient_id", "patient_001");
  preferences.end();

  // Display Loaded Configurations 
Serial.println("==================================");
Serial.println("     CURRENT CONFIGURATIONS       ");
Serial.println("==================================");
Serial.println("WiFi SSID:      " + currentSSID);
Serial.println("AP SSID:        " + currentAPSSID);
Serial.println("Room ID:        " + currentRoomId);
Serial.println("Patient ID:     " + currentPatientId);
Serial.println("FB URL:         " + currentFbUrl);
Serial.println("FB API Key:     " + currentFbApiKey);
Serial.println("FB Email:       " + currentFbEmail);
Serial.println("FB Pass len:    " + String(currentFbPassword.length()) + " chars");
Serial.println("==================================\n");

  // Initialize Hardware Sensors
  initSensors();

  WiFi.mode(WIFI_AP_STA);

  // Connect to Wi-Fi
  WiFi.begin(currentSSID.c_str(), currentWiFiPassword.c_str());
  int attempts = 0;
  Serial.println("\nTrying to connect to Wifi...");
  while (WiFi.status() != WL_CONNECTED && attempts < WIFI_ATTEMPTS) {
    delay(WIFI_DELAY_MS);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nConnected to WiFi");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\nFailed to connect to WiFi");
    WiFi.disconnect();
  }

  // Configure Access Point
  WiFi.softAP(currentAPSSID.c_str(), currentAPPassword.c_str());
  Serial.println("==================================\n");
  Serial.print("AP IP Address: ");
  Serial.println(WiFi.softAPIP());
  Serial.println("==================================\n");

  // Set up routes and start the server
  setupSettingsRoutes();
  server.begin();
  Serial.println("HTTP server started");
  Serial.println("==================================\n");

  // Start the Firebase upload loop on Core 0 (Network Core)
  xTaskCreatePinnedToCore(
      firebaseUploadTask,   // Function to run
      "FirebaseTask",       // Name of the task
      8192,                 // Stack size
      NULL,                 // Parameters
      1,                    // Priority
      &FirebaseTask,        // Task handle
      0                     // Pin to Core 0
  );
}

void loop() {
  updateSensors(); // Runs completely uninterrupted on Core 1!

  if (millis() - lastDebugPrint > DEBUG_INTERVAL_MS) {
    lastDebugPrint = millis();
    Serial.print("[DEBUG] Temp: "); Serial.print(currentTemp);
    Serial.print(" °C | Hum: "); Serial.print(currentHumidity);
    Serial.print(" % | BPM: "); Serial.print(currentBPM);
    Serial.print(" | SpO2: "); Serial.println(currentSpO2);
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
