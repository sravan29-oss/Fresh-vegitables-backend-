@echo off
REM Stop PostgreSQL for Fresh Vegetables Platform
"c:\Fresh vegitables\database\pgsql\pgsql\bin\pg_ctl.exe" -D "c:\Fresh vegitables\database\pgdata" stop -m fast
