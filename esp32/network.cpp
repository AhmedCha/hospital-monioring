#include "network.h"

UserAuth *userAuth = nullptr;
static AsyncResult authResult;

// Set true only after initializeApp() completes without error.
static bool firebaseInitialized = false;

// Print every auth event
void processAuthResult(AsyncResult &aResult) {
  if (!aResult.isResult())
    return;

  if (aResult.isEvent())
    Serial.printf(">> [AUTH] Event: %s | code: %d\n",
                  aResult.eventLog().message().c_str(),
                  aResult.eventLog().code());

  if (aResult.isDebug())
    Serial.printf(">> [AUTH] Debug: %s\n", aResult.debug().c_str());

  if (aResult.isError())
    Serial.printf(">> [AUTH ERROR] %s | code: %d\n",
                  aResult.error().message().c_str(), aResult.error().code());

  if (aResult.available())
    Serial.printf(">> [AUTH] Payload: %s\n", aResult.c_str());
}

void initFirebase() {
  if (currentFbUrl.length() == 0 || currentFbApiKey.length() == 0 ||
      currentFbEmail.length() == 0 || currentFbPassword.length() == 0) {
    Serial.println(">> [FIREBASE] Credentials incomplete — skipping init.");
    Serial.println(">> Configure via the AP settings page and reboot.");
    firebaseInitialized = false;
    return;
  }

  if (userAuth != nullptr) {
    delete userAuth;
    userAuth = nullptr;
  }

  ssl_client.setInsecure();
  ssl_client.setConnectionTimeout(1000);
  ssl_client.setHandshakeTimeout(5);

  userAuth = new UserAuth(currentFbApiKey, currentFbEmail, currentFbPassword);

  Serial.println(">> [FIREBASE] Initializing with Email/Password Auth...");
  initializeApp(aClient, app, getAuth(*userAuth), processAuthResult,
                "authTask");
  app.getApp<RealtimeDatabase>(Database);
  Database.url(currentFbUrl);

  firebaseInitialized = true;
  Serial.println(
      ">> [FIREBASE] App initialized. Auth events will appear below:");
}

static void wifiConnect() {
  if (currentSSID.length() == 0) {
    Serial.println(">> [NETWORK] No SSID configured. Configure via AP page.");
    return;
  }
  Serial.println(">> [NETWORK] Connecting to: " + currentSSID);
  WiFi.disconnect();
  WiFi.begin(currentSSID.c_str(), currentWiFiPassword.c_str());
}

// firebaseUploadTask — pinned to Core 0.
void firebaseUploadTask(void *pvParameters) {
  Serial.println(">> [FIREBASE TASK] Waiting for WiFi before initializing...");
  {
    unsigned long lastReconnect = 0;
    while (WiFi.status() != WL_CONNECTED) {
      if (millis() - lastReconnect >= 10000) {
        lastReconnect = millis();
        wifiConnect();
      }
      vTaskDelay(1000 / portTICK_PERIOD_MS);
    }
    Serial.println(">> [NETWORK] WiFi ready. Proceeding with Firebase init.");
  }

  initFirebase();

  unsigned long lastTaskPush = 0;
  unsigned long lastWiFiReconnect = 0;

  AsyncResult roomResult;
  AsyncResult patientResult;

  String roomPath = "/rooms/" + currentRoomId;
  String patientPath = "/patients/" + currentPatientId;

  float lastSentTemp = -999.0;
  float lastSentHum = -999.0;
  float lastSentBPM = -999.0;
  float lastSentSpO2 = -999.0;

  for (;;) {
    if (!firebaseInitialized) {
      vTaskDelay(5000 / portTICK_PERIOD_MS);
      continue;
    }

    app.loop();

    // Delivery Status Checkers
    if (roomResult.isError()) {
      Serial.printf(">> [SAVE FAILED] Room: %s\n",
                    roomResult.error().message().c_str());
      roomResult.clear();
    }
    if (patientResult.isError()) {
      Serial.printf(">> [SAVE FAILED] Patient: %s\n",
                    patientResult.error().message().c_str());
      patientResult.clear();
    }

    // --- WI-FI CONNECTED ---
    if (WiFi.status() == WL_CONNECTED) {
      if (app.ready()) {
        if (millis() - lastTaskPush >= FIREBASE_INTERVAL_MS) {
          lastTaskPush = millis();

          if (abs(currentTemp - lastSentTemp) > 0.3 ||
              abs(currentHumidity - lastSentHum) > 0.5) {
            String roomJson = "{\"temperature\":" + String(currentTemp) +
                              ",\"humidity\":" + String(currentHumidity) +
                              ",\"timestamp\":{\".sv\":\"timestamp\"}}";
            Serial.println(">> Q-Room...");
            Database.push<object_t>(aClient, roomPath, object_t(roomJson),
                                    roomResult);
            lastSentTemp = currentTemp;
            lastSentHum = currentHumidity;
          }

          if (currentBPM != lastSentBPM ||
              abs(currentSpO2 - lastSentSpO2) > 2) {
            String patientJson = "{\"heartRate\":" + String(currentBPM) +
                                 ",\"spO2\":" + String(currentSpO2) +
                                 ",\"timestamp\":{\".sv\":\"timestamp\"}}";
            Serial.println(">> Q-Patient...");
            Database.push<object_t>(aClient, patientPath, object_t(patientJson),
                                    patientResult);
            lastSentBPM = currentBPM;
            lastSentSpO2 = currentSpO2;
          }
        }
      } else {
        if (millis() - lastTaskPush >= 5000) {
          lastTaskPush = millis();
          Serial.println(">> [FIREBASE] Waiting for auth token...");
        }
      }
    }
    // --- WI-FI DISCONNECTED ---
    else {
      // Use wifiConnect() here too — same reason as the pre-init loop.
      if (millis() - lastWiFiReconnect >= 10000) {
        lastWiFiReconnect = millis();
        Serial.println(">> [NETWORK] Wi-Fi lost. Attempting to reconnect...");
        wifiConnect();
      }

      int n = WiFi.scanComplete();
      if (n >= 0) {
        String options = "";
        if (n == 0) {
          options = "<option value='Null'>No Networks Found</option>";
        } else {
          for (int i = 0; i < n; i++) {
            options += "<option value='" + WiFi.SSID(i) + "'>" + WiFi.SSID(i) +
                       " (" + String(WiFi.RSSI(i)) + "dB)</option>";
          }
        }
        wifiOptionsHTML = options;
        WiFi.scanDelete();
      } else if (n == -2) {
        lastScanTime = 0;
      }
    }

    vTaskDelay(10 / portTICK_PERIOD_MS);
  }
}
