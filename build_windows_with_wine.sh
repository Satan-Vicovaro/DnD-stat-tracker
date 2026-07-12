#!/bin/bash
# build_windows_with_wine.sh - Automates building the Windows .exe on Linux

# Use a local, isolated Wine environment so we don't pollute your default ~/.wine folder
export WINEPREFIX="$PWD/.wine-env"
export WINEARCH="win64"

# Python 3.11 is extremely stable under Wine
PYTHON_VERSION="3.11.9"
PYTHON_INSTALLER="python-${PYTHON_VERSION}-amd64.exe"
PYTHON_URL="https://www.python.org/ftp/python/${PYTHON_VERSION}/${PYTHON_INSTALLER}"

echo "=== Checking Requirements ==="
if ! command -v wine &> /dev/null; then
    echo "Error: wine is not installed."
    exit 1
fi

echo "=== Initializing Wine Environment ==="
# Suppress annoying Wine debug messages in the console
export WINEDEBUG=-all
wineboot -u

if [ ! -f "$PYTHON_INSTALLER" ]; then
    echo "=== Downloading Windows Python ${PYTHON_VERSION} ==="
    wget --show-progress "$PYTHON_URL"
fi

echo "=== Installing Python inside Wine (Silently) ==="
# This installs it for the current Wine prefix and adds it to the Wine PATH
wine "$PYTHON_INSTALLER" /quiet InstallAllUsers=0 PrependPath=1 Include_test=0

# Give Wine a few seconds to flush registry and file changes
sleep 5

echo "=== Installing Python Dependencies ==="
wine python -m pip install --upgrade pip
wine python -m pip install pyinstaller eel

echo "=== Packaging Game for Windows ==="
# Clean previous Windows build artifacts to avoid issues
rm -f dist/GieraKajzera.exe

# Notice the semicolon (;) used for Windows paths
wine python -m PyInstaller main.py --onefile --noconsole --name "GieraKajzera" --add-data "web;web"

echo "=== Finalizing ==="
cp -r config dist/config

echo "✅ Build complete! You can find 'GieraKajzera.exe' and your 'config' folder in the 'dist/' directory."
