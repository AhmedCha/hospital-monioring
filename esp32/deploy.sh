#!/bin/bash

# Configuration
PORT="/dev/ttyUSB0"
BAUD="460800"
# FQBN (Fully Qualified Board Name)
FQBN="esp32:esp32:esp32da"
SKETCH_DIR="."

# Initialize flags
UPLOAD_CODE=false
UPLOAD_DATA=false
DEBUG_MODE=false

# Parse command-line arguments
for arg in "$@"; do
  case $arg in
  --code)
    UPLOAD_CODE=true
    ;;
  --data)
    UPLOAD_DATA=true
    ;;
  --debug)
    DEBUG_MODE=true
    ;;
  *)
    echo "Error: Unknown flag '$arg'"
    echo "Usage: $0 [--code] [--data] [--debug]"
    echo ""
    echo "  --code    Compile and upload firmware only"
    echo "  --data    Build and upload LittleFS image only"
    echo "  --debug   Enable full serial debug output (Firebase, config, sensors)"
    echo ""
    echo "  No flags: upload both firmware and data (release build, no serial output)"
    exit 1
    ;;
  esac
done

# If no upload flags are provided, default to uploading both
if [ "$UPLOAD_CODE" = false ] && [ "$UPLOAD_DATA" = false ]; then
  UPLOAD_CODE=true
  UPLOAD_DATA=true
fi

# Print build mode banner
if [ "$DEBUG_MODE" = true ]; then
  echo "============================================"
  echo "  BUILD MODE: DEBUG"
  echo "  Serial output: ENABLED"
  echo "  (Firebase auth, config, sensor readings)"
  echo "============================================"
else
  echo "============================================"
  echo "  BUILD MODE: RELEASE"
  echo "  Serial output: DISABLED"
  echo "============================================"
fi

# CODE (FIRMWARE) COMPILATION & UPLOAD
if [ "$UPLOAD_CODE" = true ]; then
  echo ""
  echo "--- Compiling the Arduino Sketch ---"

  # ESPAsyncWebServer 3.x + esp32 platform 3.x compatibility fix:
  # md5.h moved into the Hash library's src/ subfolder but WebAuthentication.cpp
  # still includes it as <md5.h>. Injecting the path here fixes it without
  # touching the library source.
  HASH_INCLUDE="-I${HOME}/.arduino15/packages/esp32/hardware/esp32/3.3.7/libraries/Hash/src"

  if [ "$DEBUG_MODE" = true ]; then
    arduino-cli compile --fqbn "$FQBN" \
      --build-property "compiler.cpp.extra_flags=${HASH_INCLUDE} -DDEBUG_MODE" \
      --build-property "compiler.c.extra_flags=${HASH_INCLUDE} -DDEBUG_MODE" \
      "$SKETCH_DIR"
  else
    arduino-cli compile --fqbn "$FQBN" \
      --build-property "compiler.cpp.extra_flags=${HASH_INCLUDE}" \
      --build-property "compiler.c.extra_flags=${HASH_INCLUDE}" \
      "$SKETCH_DIR"
  fi

  if [ $? -ne 0 ]; then
    echo "Compilation failed! Aborting."
    exit 1
  fi

  echo "--- Uploading the Sketch (Firmware) ---"
  arduino-cli upload -p "$PORT" --fqbn "$FQBN" "$SKETCH_DIR"

  if [ $? -ne 0 ]; then
    echo "Firmware upload failed! Aborting."
    exit 1
  fi
  echo "Firmware successfully updated!"
fi

# DATA (LITTLEFS) BUILD & UPLOAD
if [ "$UPLOAD_DATA" = true ]; then
  echo ""
  echo "--- Building LittleFS Image ---"

  # Locate mklittlefs dynamically in case the version folder changes
  MKLITTLEFS_BIN=$(ls ~/.arduino15/packages/esp32/tools/mklittlefs/4.*/mklittlefs | head -n 1)

  if [ -z "$MKLITTLEFS_BIN" ] || [ ! -x "$MKLITTLEFS_BIN" ]; then
    echo "Error: mklittlefs executable not found or not executable!"
    exit 1
  fi

  "$MKLITTLEFS_BIN" -c ./data -p 256 -b 4096 -s 1441792 /tmp/test_image.bin

  if [ $? -ne 0 ]; then
    echo "LittleFS image creation failed! Aborting."
    exit 1
  fi

  echo "--- Uploading LittleFS Image ---"
  esptool --no-stub --chip esp32 --port "$PORT" --baud "$BAUD" \
    write_flash 0x290000 /tmp/test_image.bin

  if [ $? -ne 0 ]; then
    echo "LittleFS upload failed! Aborting."
    exit 1
  fi
  echo "Web Data successfully updated!"
fi
