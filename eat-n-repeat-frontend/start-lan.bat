@echo off
REM ──────────────────────────────────────────────────────────────────
REM  Eat n RepEat — LAN / Local Mode Launcher
REM  Double-click this file or run from command prompt.
REM  Usage:  start-lan.bat              (auto-detect IP)
REM          start-lan.bat 192.168.1.5  (manual IP)
REM ──────────────────────────────────────────────────────────────────

cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "%~dp0start-lan.ps1" %*
pause
