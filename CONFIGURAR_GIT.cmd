@echo off
setlocal
if not "%~1"=="" (
  set "repositorioGit=%~1"
) else (
  set "repositorioGit=%~dp0mes-s7-piloto"
)
git -C "%repositorioGit%" rev-parse --show-toplevel >nul 2>&1
if errorlevel 1 (
  if not "%~1"=="" goto semrepositorio
  set "repositorioGit=%~dp0"
)
git -C "%repositorioGit%" rev-parse --show-toplevel >nul 2>&1
if errorlevel 1 goto semrepositorio
git -C "%repositorioGit%" config --local user.name "Nome"
if errorlevel 1 goto erro
git -C "%repositorioGit%" config --local user.email "email"
if errorlevel 1 goto erro
echo Identidade configurada neste repositorio:
git -C "%repositorioGit%" config --local --get user.name
git -C "%repositorioGit%" config --local --get user.email
pause
exit /b 0
:semrepositorio
echo Repositorio nao encontrado. Informe a pasta do repositorio como argumento.
pause
exit /b 1
:erro
echo Falha ao salvar a identidade Git.
pause
exit /b 1
