@echo off
rem Tunel inverso: el puerto 18765 de Contabo (solo localhost) llega a la voz local de este PC.
rem Si se corta, reintenta solo. Cierra esta ventana para desconectar.
title MetaPulse - Tunel a Contabo
set "SERVIDOR=root@37.60.235.111"
set "PUERTO=18765"
:reintentar
echo [%time%] Conectando tunel a Contabo...
ssh -N -o ServerAliveInterval=20 -o ServerAliveCountMax=3 -o ExitOnForwardFailure=yes -o BatchMode=yes -R 127.0.0.1:%PUERTO%:127.0.0.1:%PUERTO% %SERVIDOR%
echo [%time%] Tunel caido, reintentando en 8 segundos...
timeout /t 8 /nobreak >nul
goto reintentar
