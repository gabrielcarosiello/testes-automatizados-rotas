@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Instale o Node.js 22 ou superior neste computador.
  pause
  exit /b 1
)
node -e "if(Number(process.versions.node.split('.')[0])<22){console.error('Use Node.js 22 ou superior.');process.exit(1)}"
if errorlevel 1 (
  pause
  exit /b 1
)
echo Iniciando Monitor S7. Mantenha esta janela aberta. Use Ctrl+C para encerrar.
node server.mjs
pause
