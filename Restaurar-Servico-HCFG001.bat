@echo off
chcp 65001 >nul
title Restaurar FIORIX Connector Local (HCFG-001 v2.6.0)
net session >nul 2>&1
if %errorLevel% neq 0 (
  echo Solicitando permissao de Administrador para restaurar o FIORIXConnector da estacao HCFG-001...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath '%~f0' -Verb RunAs"
  exit /b
)

echo ============================================================================
echo   RESTAURANDO FIORIX CONNECTOR DA ESTACAO HCFG-001 (v2.6.0)
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

powershell -NoProfile -ExecutionPolicy Bypass -Command "if (Test-Path 'C:\Program Files\FIORIX Connector') { Remove-Item -Path 'C:\Program Files\FIORIX Connector' -Recurse -Force -ErrorAction SilentlyContinue }; Start-Service -Name 'FIORIXConnector'; Start-Sleep -Seconds 3; $s = Get-Service -Name 'FIORIXConnector'; Write-Host ''; Write-Host ('[OK] Servico ' + $s.Name + ' restaurado em HCFG-001 (v2.6.0) - Status: ' + $s.Status) -ForegroundColor Green; $line = Get-Content 'B:\henrique-dev\Google-avaliacoes\fiorix-connector\.env.production' | Where-Object { $_ -match '^SQL_SERVER_PASSWORD=' } | Select-Object -First 1; if ($line) { $pwdVal = ($line -replace '^SQL_SERVER_PASSWORD=', '').Trim('\"', \"'\"); Set-Clipboard -Value $pwdVal; Write-Host '[DICA] A senha real do SQL (fiorix_connector) foi copiada para sua Area de Transferencia (Ctrl+V) para facilitar no SRVFILES!' -ForegroundColor Cyan }"

echo.
pause

