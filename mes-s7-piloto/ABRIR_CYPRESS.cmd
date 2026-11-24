@echo off
cd /d "%~dp0"
call npm.cmd run abrir
if errorlevel 1 pause
