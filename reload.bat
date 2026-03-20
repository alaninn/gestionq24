@echo off
REM Script para actualizar y recargar el sistema completo
REM Uso: reload.bat

echo.
echo ========================================
echo   GESTION Q24 - RELOAD COMPLETO
echo ========================================
echo.

REM Detener procesos anteriores
echo [1/5] Deteniendo procesos anteriores...
taskkill /F /IM node.exe >nul 2>&1

REM Limpiar cache del frontend
echo [2/5] Limpiando cache del frontend...
cd frontend
if exist dist (
    rmdir /s /q dist
    echo   - Carpeta dist eliminada
)
echo   - Cache limpiado

REM Instalar dependencias (por si hay cambios en package.json)
echo [3/5] Verificando dependencias...
call npm install >nul 2>&1

REM Compilar frontend
echo [4/5] Compilando frontend...
call npm run build
if errorlevel 1 (
    echo.
    echo ERROR: Fallo la compilacion del frontend
    echo.
    pause
    exit /b 1
)
cd ..

REM Iniciar servidor
echo [5/5] Iniciando servidor...
echo.
echo ========================================
echo   SISTEMA ACTUALIZADO Y ONLINE
echo ========================================
echo.
echo   Local:  http://192.168.1.58:3001
echo   Online: https://gestionq24.ddns.net:3001
echo.
echo   Presiona Ctrl+C para detener el servidor
echo ========================================
echo.

cd backend
npm start

pause
