#!/bin/bash

echo "Starting Hytopia game server..."
echo "Press Ctrl+C to stop the server"
echo "------------------------------"

# Attempt to find the .env file and load it. If not found, throw an error
# if [ -f .env ]; then
#     source .env
# else
#     echo "Error: .env file not found"
#     exit 1
# fi

# Check if Bun is installed
if ! command -v bun &> /dev/null; then
    echo "Error: Bun is not installed or not in your PATH"
    echo "Please install Bun from https://bun.sh/"
    exit 1
fi

# Run the game with LOG_LEVEL set to DEBUG
LOG_LEVEL=DEBUG bun --watch index.ts 