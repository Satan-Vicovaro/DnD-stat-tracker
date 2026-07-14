#!/bin/bash
# build.sh - Linux build script

echo "Installing packaging dependencies..."
pip install pyinstaller eel

echo "Building GieraKajzera for Linux..."
# We use pyinstaller directly instead of python3 -m eel to avoid the pkg_resources bug in eel.
# We bundle only the 'web' folder, NOT the config folder.
python3 -m PyInstaller main.py --onefile --name "GieraKajzera" \
  --add-data "web:web"

echo "Copying config folder to dist..."
rm -rf dist/config
cp -r config dist/

echo "Build complete. Your executable and config folder are in 'dist/'."
