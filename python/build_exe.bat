@echo off
echo Installing requirements...
pip install -r requirements.txt

echo Building EXE...
pyinstaller --onefile --name WebChurchBot web_church_bot.py

echo Done! The EXE file is in the 'dist' folder.
pause
