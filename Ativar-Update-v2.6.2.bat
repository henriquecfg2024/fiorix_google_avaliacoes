@echo off
chcp 65001 >nul
title Ativar FIORIX Connector v2.6.2 (HCFG-001 + SRVFILES)
net session >nul 2>&1
if %errorLevel% neq 0 (
  echo Solicitando permissao de Administrador para reiniciar o servico FIORIXConnector...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

echo ============================================================================
echo   FIORIX CONNECTOR - ATIVADOR UNICO v2.6.0 -^> v2.6.2 (HCFG-001 + SRVFILES)
echo ============================================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\ativar-v262.ps1"
echo.
pause
