#!/bin/bash

echo "Starting Hytopia game server..."
echo "Press Ctrl+C to stop the server"
echo "------------------------------"

# Check if Bun is installed
if ! command -v bun &> /dev/null; then
    echo "Error: Bun is not installed or not in your PATH"
    echo "Please install Bun from https://bun.sh/"
    exit 1
fi

# Run the game
bun --watch index.ts 