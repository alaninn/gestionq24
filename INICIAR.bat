@echo off
chcp 65001 >nul
title GESTION Q24 - SERVIDOR

echo.
echo ========================================
echo   GESTION Q24 - INICIAR SERVIDOR
echo ========================================
echo.

REM Guardar ruta raiz
set ROOT=%~dp0

REM Verificar si ya esta corriendo
tasklist | find /i "node.exe" >nul 2>&1
if %errorlevel% equ 0 (
    echo ⚠️  El servidor ya esta corriendo!
    echo Abriendo navegador...
    timeout /t 1 /nobreak >nul
    start http://localhost:3001
    exit /b 0
)

REM Verificar PostgreSQL
echo [1/6] Verificando base de datos...
sc query postgresql-x64-16 | find "RUNNING" >nul 2>&1
if %errorlevel% neq 0 (
    echo   - Iniciando PostgreSQL...
    net start postgresql-x64-16 >nul 2>&1
    timeout /t 3 /nobreak >nul
)

echo [2/6] Actualizando dependencias...
cd /d "%ROOT%backend"
call npm install --silent >nul 2>&1

echo [3/6] Verificando base de datos...
node setup-db.js >nul 2>&1

echo [4/6] Compilando frontend...
cd /d "%ROOT%frontend"
call npm run build --silent >nul 2>&1

echo [5/6] Limpiando procesos anteriores...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 1 /nobreak >nul

echo [6/6] Iniciando servidor...
echo.
echo ========================================
echo   ✅ SISTEMA ONLINE Y FUNCIONANDO
echo ========================================
echo.
echo   Local:   http://localhost:3001
echo   Red:     http://192.168.1.58:3001
echo   Externo: http://gestionq24.ddns.net:3001
echo.
echo   Esta ventana puede quedar minimizada
echo   Para cerrar ejecutar DETENER.bat
echo ========================================
echo.

REM Abrir navegador automaticamente
start http://localhost:3001

REM INICIAR SERVIDOR CON PM2 - NUNCA SE CIERRA, FUNCIONA EN SEGUNDO PLANO
cd /d "%ROOT%backend"
pm2 start server.js --name gestionq24 --log "..\servidor.log"
pm2 save

timeout /t 2 /nobreak >nul
exit
