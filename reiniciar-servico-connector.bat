@echo off
setlocal
title Reiniciar FIORIX Connector

:: Verifica se ja esta rodando como Administrador
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [INFO] Solicitando elevacao de Administrador (UAC)...
    powershell -Command "Start-Process cmd -ArgumentList '/c \"\"%~f0\"\"' -Verb RunAs"
    exit /b
)

cd /d "B:\henrique-dev\Google-avaliacoes\fiorix-connector"

echo ============================================================
echo   Reiniciando servico FIORIXConnector...
echo ============================================================
echo.
echo Parando o servico...
net stop FIORIXConnector
echo.
echo Iniciando o servico...
net start FIORIXConnector
echo.
echo ============================================================
echo   Servico reiniciado com sucesso!
echo ============================================================
echo.
pause
