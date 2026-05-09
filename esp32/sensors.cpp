#include "sensors.h"
#include "globals.h"

#include "MAX30105.h"
#include "heartRate.h"
#include "spo2_algorithm.h"
#include <DHT.h>
#include <Wire.h>

// Officially define the global sensor variables here
float currentBPM = 0.0;
float currentSpO2 = 0.0;
float currentTemp = 0.0;
float currentHumidity = 0.0;

// Internal Sensor Objects & Variables (only visible to this file)
DHT dht(DHT_PIN, DHT_TYPE);
MAX30105 particleSensor;

unsigned long lastDHTRead = 0;
const unsigned long DHT_INTERVAL = 2000;

// Health Sensor Buffers
const byte RATE_SIZE = 4;
byte rates[RATE_SIZE];
byte rateSpot = 0;
long lastBeat = 0;
bool fingerPresent = false;

uint32_t irBuffer[100];
uint32_t redBuffer[100];
int32_t bufferLength = 100;
int32_t spo2_raw;
int8_t validSPO2;
int32_t dummyHR;
int8_t dummyValidHR;
byte bufferIndex = 0;

void initSensors() {
  DBG_PRINTLN("Initializing Sensors...");

  dht.begin();

  Wire.begin();

  if (!particleSensor.begin(Wire, I2C_SPEED_FAST)) {
    DBG_PRINTLN("MAX30102 not found. Check wiring.");
  } else {
    particleSensor.setup();
    DBG_PRINTLN("MAX30102 Initialized.");
  }
}

void updateSensors() {
  // Update DHT22
  if (millis() - lastDHTRead >= DHT_INTERVAL) {
    lastDHTRead = millis();
    float t = dht.readTemperature();
    float h = dht.readHumidity();

    if (!isnan(t) && !isnan(h)) {
      currentTemp = t;
      currentHumidity = h;
    }
  }

  // Update MAX30102 (Continuous)
  particleSensor.check();

  while (particleSensor.available()) {
    long irValue = particleSensor.getFIFOIR();
    long redValue = particleSensor.getFIFORed();
    particleSensor.nextSample();

    if (irValue < 50000) {
      if (fingerPresent) {
        fingerPresent = false;
        currentBPM = 0.0;
        currentSpO2 = 0.0;
      }
      for (byte i = 0; i < RATE_SIZE; i++)
        rates[i] = 0;
      rateSpot = 0;
      bufferIndex = 0;
    } else {
      if (!fingerPresent)
        fingerPresent = true;

      // Heart Rate
      if (checkForBeat(irValue) == true) {
        long delta = millis() - lastBeat;
        if (delta > 300) {
          lastBeat = millis();
          float beatsPerMinute = 60 / (delta / 1000.0);
          if (beatsPerMinute < 150 && beatsPerMinute > 30) {
            rates[rateSpot++] = (byte)beatsPerMinute;
            rateSpot %= RATE_SIZE;
            int beatAvg = 0;
            byte validRates = 0;
            for (byte x = 0; x < RATE_SIZE; x++) {
              if (rates[x] > 0) {
                beatAvg += rates[x];
                validRates++;
              }
            }
            if (validRates > 0)
              currentBPM = (float)(beatAvg / validRates);
          }
        }
      }

      // SpO2
      irBuffer[bufferIndex] = irValue;
      redBuffer[bufferIndex] = redValue;
      bufferIndex++;

      if (bufferIndex == 100) {
        maxim_heart_rate_and_oxygen_saturation(irBuffer, bufferLength,
                                               redBuffer, &spo2_raw, &validSPO2,
                                               &dummyHR, &dummyValidHR);
        if (validSPO2 == 1 && spo2_raw > 80 && spo2_raw <= 100)
          currentSpO2 = (float)spo2_raw;

        // Shift buffer — drop oldest 25 samples
        for (byte i = 25; i < 100; i++) {
          redBuffer[i - 25] = redBuffer[i];
          irBuffer[i - 25] = irBuffer[i];
        }
        bufferIndex = 75;
      }
    }
  }
}
