@echo off
REM Auto-start PostgreSQL for Fresh Vegetables Platform
"c:\Fresh vegitables\database\pgsql\pgsql\bin\pg_ctl.exe" -D "c:\Fresh vegitables\database\pgdata" -l "c:\Fresh vegitables\database\pgsql.log" start
