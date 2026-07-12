#!/bin/bash
# build.sh - Linux build script

echo "Installing packaging dependencies..."
# Ensure setuptools is installed (often missing in newer venvs, causing pkg_resources errors)
pip install setuptools pyinstaller eel

echo "Building GieraKajzera for Linux..."
# Note: eel automatically bundles the 'web' folder.
# We manually bundle the 'config' folder using PyInstaller's --add-data flag.
# Linux uses colon (:) as the separator for --add-data
python3 -m eel main.py web --onefile --noconsole --name "GieraKajzera" --add-data "config/shop:config/shop"

echo "Build complete. Check the 'dist' folder for your executable."
