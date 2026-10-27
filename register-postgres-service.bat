@echo off
title Register PostgreSQL Windows Service
echo ============================================================
echo   Fresh Vegetables - Register PostgreSQL Service
echo ============================================================
echo.
powershell -Command "Start-Process 'c:\Fresh vegitables\database\pgsql\pgsql\bin\pg_ctl.exe' -ArgumentList 'register -N fresh_vegetables_postgres -D \"\"c:\Fresh vegitables\database\pgdata\"\" -S auto' -Verb runAs"
echo.
echo Service registration triggered with Administrator elevation.
pause
