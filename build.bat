@echo off
:: build.bat - Windows build script

echo Installing packaging dependencies...
pip install pyinstaller eel

echo Building GieraKajzera for Windows...
:: We use pyinstaller directly instead of python -m eel to avoid the pkg_resources bug in eel.
:: We bundle only the 'web' folder, NOT the config folder.
python -m PyInstaller main.py --onefile --name "GieraKajzera" ^
  --add-data "web;web"

echo Copying config folder to dist...
xcopy config dist\config /E /I /Y

echo Build complete. Your executable and config folder are in 'dist/'.
pause
