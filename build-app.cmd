@echo off
REM === Build GwentCards release exe ===
REM Thin ASCII wrapper: all logic lives in build-app.ps1 (cmd.exe breaks UTF-8 batch files).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0build-app.ps1"
exit /b %ERRORLEVEL%
