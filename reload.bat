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

REM Compilar frontend PRIMERO (antes de matar el servidor)
echo [1/5] Compilando frontend...
cd /d "%ROOT%frontend"
call npm install >nul 2>&1
call npm run build
if errorlevel 1 (
    echo.
    echo ERROR: Fallo la compilacion del frontend
    echo El servidor anterior sigue corriendo - no se interrumpio el servicio
    echo.
    cd /d "%ROOT%"
    pause
    exit /b 1
)

REM Solo matar el servidor DESPUES de compilar exitosamente
echo [2/5] Deteniendo servidor anterior...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul

REM Limpiar dist viejo y copiar el nuevo build
echo [3/5] Actualizando archivos...
echo   - Frontend compilado correctamente

REM Verificar dependencias del backend
echo [4/5] Verificando dependencias del backend...
cd /d "%ROOT%backend"
call npm install >nul 2>&1

REM Ejecutar configuración de base de datos
echo [5/6] Configurando base de datos...
node setup-db.js
if errorlevel 1 (
    echo.
    echo ADVERTENCIA: Hubo errores en la configuración de la base de datos
    echo El servidor se iniciará de todas formas
    echo.
)

REM Iniciar servidor
echo [6/6] Iniciando servidor...
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