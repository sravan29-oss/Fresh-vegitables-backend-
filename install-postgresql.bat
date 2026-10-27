@echo off
title Fresh Vegetables - PostgreSQL Installer
echo ============================================================
echo   Fresh Vegetables - PostgreSQL Automated Setup
echo ============================================================
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process powershell -Verb runAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File \"\"%~dp0install-postgresql.ps1\"\"'"
pause
