#include "settings.h"
#include "globals.h"

#include <LittleFS.h>
#include <Preferences.h>
#include <WiFi.h>

bool isAPConnected(AsyncWebServerRequest *request) {
  if (request->client()->localIP() == WiFi.softAPIP()) {
    return true;
  } else {
    request->redirect("/");
    return false;
  }
}

void handleSettings(AsyncWebServerRequest *request) {
  if (!isAPConnected(request))
    return;
  request->send(LittleFS, "/index.html", "text/html");
}

void handleGetSettingsData(AsyncWebServerRequest *request) {
  if (!isAPConnected(request))
    return;

  String json = "{";
  json += "\"wifiOptions\": \"" + wifiOptionsHTML + "\",";
  json += "\"fb_url\": \"" + currentFbUrl + "\",";
  json += "\"fb_api_key\": \"" + currentFbApiKey + "\",";
  json += "\"fb_email\": \"" + currentFbEmail + "\",";
  json += "\"room_id\": \"" + currentRoomId + "\",";
  json += "\"patient_id\": \"" + currentPatientId + "\"";
  json += "}";

  request->send(200, "application/json", json);
}

void handleUpdateSettings(AsyncWebServerRequest *request) {
  bool isUpdated = false;

  if (!isAPConnected(request))
    return;

  if (request->method() == HTTP_POST) {
    preferences.begin("settings", false);
    DBG_PRINTLN("\n--- Processing Settings Update ---");

    // Handle WiFi connection
    if (request->hasParam("ssid", true) &&
        request->hasParam("wifi_password", true)) {
      String newSSID = request->getParam("ssid", true)->value();
      String newWiFiPassword =
          request->getParam("wifi_password", true)->value();

      if (newSSID.length() != 0 && newWiFiPassword.length() != 0 &&
          newSSID != "Null") {
        currentSSID = newSSID;
        currentWiFiPassword = newWiFiPassword;
        preferences.putString("ssid", currentSSID);
        preferences.putString("wifi_password", currentWiFiPassword);
        isUpdated = true;
        DBG_PRINTLN("[SAVED] WiFi SSID:     " + currentSSID);
        DBG_PRINTLN("[SAVED] WiFi Password: " + currentWiFiPassword);
      }
    }

    // Handle AP config
    if (request->hasParam("apssid", true) &&
        request->hasParam("ap_password", true)) {
      String newAPSSID = request->getParam("apssid", true)->value();
      String newAPPassword = request->getParam("ap_password", true)->value();

      if (newAPSSID.length() > 0 && newAPPassword.length() >= 8) {
        preferences.putString("apssid", newAPSSID);
        preferences.putString("ap_password", newAPPassword);
        isUpdated = true;
        DBG_PRINTLN("[SAVED] AP SSID:     " + newAPSSID);
        DBG_PRINTLN("[SAVED] AP Password: " + newAPPassword);
      }
    } else if (request->hasParam("apssid", true)) {
      String newAPSSID = request->getParam("apssid", true)->value();
      if (newAPSSID.length() > 0) {
        preferences.putString("apssid", newAPSSID);
        isUpdated = true;
        DBG_PRINTLN("[SAVED] AP SSID: " + newAPSSID);
      }
    } else if (request->hasParam("ap_password", true)) {
      String newAPPassword = request->getParam("ap_password", true)->value();
      if (newAPPassword.length() >= 8) {
        preferences.putString("ap_password", newAPPassword);
        isUpdated = true;
        DBG_PRINTLN("[SAVED] AP Password: " + newAPPassword);
      }
    }

    // Handle Firebase URL
    if (request->hasParam("fb_url", true)) {
      String newFbUrl = request->getParam("fb_url", true)->value();
      newFbUrl.trim();
      if (newFbUrl != currentFbUrl && newFbUrl.length() > 0) {
        currentFbUrl = newFbUrl;
        preferences.putString("fb_url", currentFbUrl);
        isUpdated = true;
        DBG_PRINTLN("[SAVED] Firebase URL: " + currentFbUrl);
      }
    }

    // Handle Firebase API key
    if (request->hasParam("fb_api_key", true)) {
      String newFbApiKey = request->getParam("fb_api_key", true)->value();
      newFbApiKey.trim();
      if (newFbApiKey != currentFbApiKey && newFbApiKey.length() > 0) {
        currentFbApiKey = newFbApiKey;
        preferences.putString("fb_api_key", currentFbApiKey);
        isUpdated = true;
        DBG_PRINTLN("[SAVED] Firebase API Key: " + currentFbApiKey);
      }
    }

    // Handle Firebase email
    if (request->hasParam("fb_email", true)) {
      String newFbEmail = request->getParam("fb_email", true)->value();
      newFbEmail.trim();
      if (newFbEmail != currentFbEmail && newFbEmail.length() > 0) {
        currentFbEmail = newFbEmail;
        preferences.putString("fb_email", currentFbEmail);
        isUpdated = true;
        DBG_PRINTLN("[SAVED] Firebase Email: " + currentFbEmail);
      }
    }

    // Handle Firebase password
    if (request->hasParam("fb_password", true)) {
      String newFbPassword = request->getParam("fb_password", true)->value();
      newFbPassword.trim();
      if (newFbPassword.length() > 0 && newFbPassword != currentFbPassword) {
        currentFbPassword = newFbPassword;
        preferences.putString("fb_password", currentFbPassword);
        isUpdated = true;
        DBG_PRINTLN("[SAVED] Firebase Password: (updated)");
      }
    }

    // Handle Room ID
    if (request->hasParam("room_id", true)) {
      String newRoomId = request->getParam("room_id", true)->value();
      if (newRoomId != currentRoomId && newRoomId.length() > 0) {
        currentRoomId = newRoomId;
        preferences.putString("room_id", currentRoomId);
        isUpdated = true;
        DBG_PRINTLN("[SAVED] Room ID: " + currentRoomId);
      }
    }

    // Handle Patient ID
    if (request->hasParam("patient_id", true)) {
      String newPatientId = request->getParam("patient_id", true)->value();
      if (newPatientId != currentPatientId && newPatientId.length() > 0) {
        currentPatientId = newPatientId;
        preferences.putString("patient_id", currentPatientId);
        isUpdated = true;
        DBG_PRINTLN("[SAVED] Patient ID: " + currentPatientId);
      }
    }

    preferences.end();
    DBG_PRINTLN("-----------------------------------\n");

    if (isUpdated) {
      String html = "<html><head><meta name=\"viewport\" "
                    "content=\"width=device-width, initial-scale=1\">";
      html += "<link rel=\"stylesheet\" href=\"style.css\"></head><body><div "
              "class=\"container\">";
      html +=
          "<h2>Settings Saved!</h2><p>Applying changes and rebooting...</p>";
      html += "<p>Please wait while the device restarts. Reconnect to your "
              "designated Wi-Fi network.</p>";
      html += "</div></body></html>";

      request->send(200, "text/html", html);
      shouldReboot = true;
      rebootTime = millis();
    } else {
      request->redirect("/?error=1");
    }

  } else {
    request->send(405, "text/plain", "Method Not Allowed");
  }
}

void setupSettingsRoutes() {
  server.on("/", HTTP_GET, [](AsyncWebServerRequest *request) {
    if (!isAPConnected(request))
      return;
    handleSettings(request);
  });
  server.on("/style.css", HTTP_GET, [](AsyncWebServerRequest *request) {
    if (!isAPConnected(request))
      return;
    request->send(LittleFS, "/style.css", "text/css");
  });
  server.on("/api/get_settings", HTTP_GET, [](AsyncWebServerRequest *request) {
    if (!isAPConnected(request))
      return;
    handleGetSettingsData(request);
  });
  server.on("/update_settings", HTTP_POST, [](AsyncWebServerRequest *request) {
    if (!isAPConnected(request))
      return;
    handleUpdateSettings(request);
  });
}
