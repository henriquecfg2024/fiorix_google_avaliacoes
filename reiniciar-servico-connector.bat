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
echo   Compilando e reiniciando servico FIORIXConnector...
echo ============================================================
echo.
echo [1/3] Compilando codigo atualizado (npm run build)...
call npm run build
if %errorLevel% neq 0 (
    echo [AVISO] Falha ao compilar com npm run build. Prosseguindo com reinicio...
)
echo.
echo [2/3] Parando o servico...
net stop FIORIXConnector
echo.
echo [3/3] Iniciando o servico...
net start FIORIXConnector
echo.
echo ============================================================
echo   Servico atualizado e reiniciado com sucesso!
echo ============================================================
echo.
pause
