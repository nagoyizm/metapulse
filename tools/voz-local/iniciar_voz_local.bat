@echo off
rem Inicia la voz clonada local (Chatterbox) y el tunel hacia Contabo. Deja las dos ventanas abiertas.
title MetaPulse - Voz local (Chatterbox)
set "BASE=F:\voces-test"
set "VOZ_LOCAL_VOCES=%BASE%\voces"
set "VOZ_LOCAL_PUERTO=18765"
set "PYTHONIOENCODING=utf-8"

if not exist "%BASE%\venv\Scripts\python.exe" (
  echo No encuentro %BASE%\venv. Revisa la ruta BASE en este archivo.
  pause
  exit /b 1
)

start "MetaPulse - Tunel a Contabo" "%~dp0tunel_contabo.bat"
"%BASE%\venv\Scripts\python.exe" "%~dp0servidor_voz.py"
echo.
echo El servidor de voz se detuvo.
pause
