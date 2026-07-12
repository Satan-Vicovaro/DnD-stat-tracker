@echo off
:: build.bat - Windows build script

echo Installing packaging dependencies...
:: Ensure setuptools is installed (often missing in newer venvs, causing pkg_resources errors)
pip install setuptools pyinstaller eel

echo Building GieraKajzera for Windows...
:: Note: eel automatically bundles the 'web' folder.
:: We manually bundle the 'config' folder using PyInstaller's --add-data flag.
:: Windows uses semicolon (;) as the separator for --add-data
python -m eel main.py web --onefile --noconsole --name "GieraKajzera" --add-data "config/shop;config/shop"

echo Build complete. Check the 'dist' folder for your executable.
pause
