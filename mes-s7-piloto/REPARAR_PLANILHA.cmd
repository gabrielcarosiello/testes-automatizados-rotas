@echo off
cd /d "%~dp0"
if "%~1"=="" (
  node scripts\reparar-planilha.cjs
) else (
  node scripts\reparar-planilha.cjs "%~1"
)
pause
