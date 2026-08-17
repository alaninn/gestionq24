@echo off
chcp 65001 >nul
title Escaner de Seguridad
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   No se encontro Node.js en este equipo.
  echo   Instalalo desde https://nodejs.org y volve a abrir este archivo.
  echo.
  pause
  exit /b 1
)

echo.
echo   Iniciando el Escaner de Seguridad...
echo   Se va a abrir solo en tu navegador.
echo   Para cerrarlo, cerra esta ventana negra.
echo.

node "escaner-seguridad\escaner.js"

echo.
echo   El escaner se detuvo.
pause
