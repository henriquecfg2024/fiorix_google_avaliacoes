@echo off
chcp 65001 >nul
title Restaurar e Ativar FIORIX Connector Local (HCFG-001 v2.6.2)
net session >nul 2>&1
if %errorLevel% neq 0 (
  echo Solicitando permissao de Administrador para restaurar o FIORIXConnector da estacao HCFG-001...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

echo ============================================================================
echo   RESTAURANDO / ATIVANDO FIORIX CONNECTOR DA ESTACAO HCFG-001 (v2.6.2)
echo ============================================================================

set "NSSM=B:\henrique-dev\Google-avaliacoes\fiorix-connector\tools\nssm\nssm.exe"
set "APPDIR=B:\henrique-dev\Google-avaliacoes\fiorix-connector"

powershell -NoProfile -ExecutionPolicy Bypass -Command "Stop-Service -Name 'FIORIXConnector' -Force -ErrorAction SilentlyContinue; Start-Sleep -Seconds 2"

"%NSSM%" set FIORIXConnector Application "B:\Program Files\nodejs\node.exe"
"%NSSM%" set FIORIXConnector AppParameters "B:\henrique-dev\Google-avaliacoes\fiorix-connector\dist\index.js"
"%NSSM%" set FIORIXConnector AppDirectory "%APPDIR%"
"%NSSM%" set FIORIXConnector DisplayName "FIORIXConnector"
"%NSSM%" set FIORIXConnector AppStdout "%APPDIR%\logs\connector-out.log"
"%NSSM%" set FIORIXConnector AppStderr "%APPDIR%\logs\connector-error.log"
"%NSSM%" set FIORIXConnector AppEnvironmentExtra "FIORIX_CONNECTOR_ENV=production"

powershell -NoProfile -ExecutionPolicy Bypass -File "%APPDIR%\tools\ativar-v262.ps1"

echo.
pause
