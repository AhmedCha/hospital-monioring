#!/bin/bash

# --- CONFIGURATION & DEFAULTS ---
BAUD=115200
PORT=""

# --- PARSE COMMAND LINE ARGUMENTS ---
# Use -b flag to change baud rate (e.g., ./monitor.sh -b 9600)
while getopts "b:" opt; do
  case $opt in
  b) BAUD=$OPTARG ;;
  *)
    echo "Usage: $0 [-b baud_rate]" >&2
    exit 1
    ;;
  esac
done

# --- SCAN FOR AVAILABLE PORTS ---
available_ports=()
for p in /dev/ttyUSB* /dev/ttyACM*; do
  if [ -c "$p" ]; then
    available_ports+=("$p")
  fi
done

# Check if any ports exist
if [ ${#available_ports[@]} -eq 0 ]; then
  echo "Error: No USB serial ports found!"
  exit 1
fi

# --- PORT SELECTION LOGIC ---
if [ ${#available_ports[@]} -eq 1 ]; then
  # Strategy 1: Only one port found, auto-select it
  PORT="${available_ports[0]}"
  echo "Auto-selected only available port: $PORT"
else
  # Strategy 2: Multiple ports found, show a GUI popup
  # Ensure zenity is installed: sudo apt install zenity
  PORT=$(zenity --list --title="ESP32 Port Selection" \
    --column="Available Ports" "${available_ports[@]}" \
    --height=300 --width=250 --text="Multiple devices detected. Pick one:")

  # If user cancels the popup
  if [ -z "$PORT" ]; then
    echo "No port selected. Exiting."
    exit 1
  fi
fi

# --- CONFIGURE AND READ ---
echo "----------------------------------------"
echo "Listening on $PORT at $BAUD baud..."
echo "Press Ctrl+C to stop."
echo "----------------------------------------"

# Set permissions (optional, helps if you get 'Permission Denied')
# sudo chmod 666 "$PORT"

# Configure serial port
stty -F "$PORT" "$BAUD" cs8 -cstopb -parenb raw -echo

# Read and print output
cat "$PORT"
