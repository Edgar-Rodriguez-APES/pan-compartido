@echo off
echo ========================================
echo    PAN COMPARTIDO - INICIADOR
echo ========================================
echo.

echo Instalando dependencias...
call npm install

echo.
echo Iniciando servidor de desarrollo...
call npm start

pause