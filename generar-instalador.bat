@echo off
echo ============================================
echo    Los Gallegos - Generar Instalador EXE
echo ============================================
echo.

:: Posicionarse en la carpeta del proyecto
cd /d "%~dp0"
echo Directorio: %cd%
echo.

:: Paso 1: Instalar dependencias (incluye electron-builder)
echo [1/4] Verificando dependencias...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Fallo la instalacion de dependencias
    pause
    exit /b 1
)
echo OK
echo.

:: Paso 2: Recompilar sqlite3 para Electron
echo [2/4] Recompilando sqlite3 para Electron...
call npx @electron/rebuild --version 38.3.0
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Fallo la recompilacion de sqlite3
    pause
    exit /b 1
)
echo OK
echo.

:: Paso 3: Limpiar cache de iconos de Windows
echo [3/4] Limpiando cache de iconos de Windows...
ie4uinit.exe -show >nul 2>&1
del /f /q "%LOCALAPPDATA%\IconCache.db" >nul 2>&1
del /f /q "%LOCALAPPDATA%\Microsoft\Windows\Explorer\iconcache*" >nul 2>&1
del /f /q "%LOCALAPPDATA%\Microsoft\Windows\Explorer\thumbcache*" >nul 2>&1
echo OK
echo.

:: Paso 4: Generar el instalador
echo [4/4] Generando instalador EXE...
set CSC_IDENTITY_AUTO_DISCOVERY=false
call npx electron-builder --win
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Fallo la generacion del instalador
    pause
    exit /b 1
)
echo.

:: Limpiar archivos temporales de la carpeta dist
del /f /q "dist\Los Gallegos Lubricentro Setup 1.0.0.exe.blockmap" >nul 2>&1
del /f /q "dist\builder-effective-config.yaml" >nul 2>&1

echo ============================================
echo    LISTO! Instalador generado en: dist\
echo ============================================
echo.
echo El archivo .exe se encuentra en la carpeta "dist"
echo del proyecto.
echo.
pause