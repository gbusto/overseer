#!/bin/bash

# Exit immediately if a command exits with a non-zero status.
set -e

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# Activate the virtual environment (relative to the script directory)
ACTIVATE_PATH="$SCRIPT_DIR/.venv/bin/activate"
if [ -f "$ACTIVATE_PATH" ]; then
  echo "Activating virtual environment..."
  source "$ACTIVATE_PATH"
else
  echo "Error: Virtual environment activation script not found at $ACTIVATE_PATH"
  exit 1
fi

# Load environment variables from the .env file in the parent directory
ENV_FILE="$SCRIPT_DIR/.env"
if [ -f "$ENV_FILE" ]; then
  echo "Loading environment variables from $ENV_FILE..."
  # Use set -a to export all variables defined in the .env file
  # Use set +a to stop exporting variables afterwards
  # Filter out comments and empty lines
  set -a
  eval "$(grep -vE '^#|^\s*$' "$ENV_FILE")"
  set +a
else
  echo "Warning: Environment file not found at $ENV_FILE. Proceeding without it."
fi

# Change to the script directory to ensure main.py is found correctly
cd "$SCRIPT_DIR"

# Run the Python application
echo "Starting Python server (main.py)..."
python main.py

echo "Server stopped." 