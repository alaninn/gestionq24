@echo off
REM Script para actualizar y recargar el sistema completo
REM Uso: reload.bat

echo.
echo ========================================
echo   GESTION Q24 - RELOAD COMPLETO
echo ========================================
echo.

REM Guardar la ruta raiz del proyecto
set ROOT=%~dp0

REM Matar el servidor PRIMERO antes de compilar
echo [1/5] Deteniendo servidor anterior...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul

REM Compilar frontend con node libre
echo [2/5] Compilando frontend...
cd /d "%ROOT%frontend"
call npm run build
if errorlevel 1 (
    echo.
    echo ERROR: Fallo la compilacion del frontend
    echo.
    cd /d "%ROOT%"
    pause
    exit /b 1
)
echo   - Frontend compilado correctamente

REM Verificar dependencias del backend
echo [3/5] Verificando dependencias del backend...
cd /d "%ROOT%backend"
call npm install >nul 2>&1

REM Ejecutar configuracion de base de datos
echo [4/5] Configurando base de datos...
node setup-db.js
if errorlevel 1 (
    echo.
    echo ADVERTENCIA: Hubo errores en la configuracion de la base de datos
    echo El servidor se iniciara de todas formas
    echo.
)

REM Iniciar servidor
echo [5/5] Iniciando servidor...
echo.
echo ========================================
echo   SISTEMA ACTUALIZADO Y ONLINE
echo ========================================
echo.
echo   Local:  http://192.168.1.58:3001
echo   Online: http://gestionq24.ddns.net:3001
echo.
echo   Presiona Ctrl+C para detener el servidor
echo ========================================
echo.

cd /d "%ROOT%backend"
npm start

pause