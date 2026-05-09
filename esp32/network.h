#ifndef NETWORK_H
#define NETWORK_H

#include <Arduino.h>
#include <WiFi.h>

#define ENABLE_USER_AUTH
#define ENABLE_DATABASE

#include "globals.h"
#include <FirebaseClient.h>
#include <FirebaseJson.h>
#include <WiFiClientSecure.h>

#define WIFI_ATTEMPTS 10
#define WIFI_DELAY_MS 1000

// Firebase Objects
extern WiFiClientSecure ssl_client;
extern AsyncClientClass aClient;
extern FirebaseApp app;
extern RealtimeDatabase Database;
extern TaskHandle_t FirebaseTask;
extern UserAuth *userAuth;

// Function Declarations
void initFirebase();
void firebaseUploadTask(void *pvParameters);

#endif
