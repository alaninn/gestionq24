@echo off
chcp 65001 >nul
title GESTION Q24 - DETENER SERVIDOR

echo.
echo ========================================
echo   GESTION Q24 - DETENER SERVIDOR
echo ========================================
echo.

echo ⚠️  Deteniendo servidor PM2...
pm2 stop gestionq24
pm2 delete gestionq24

echo ✅ Servidor detenido correctamente
echo.
echo El sistema ya no esta corriendo
echo.

timeout /t 2 /nobreak >nul
exit
