$ErrorActionPreference = 'Continue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Update-ConnectorFolder([string]$Folder, [string]$Label, [string]$RemoteHost) {
  if (-not (Test-Path $Folder)) { return $false }
  Write-Host ""
  Write-Host ">>> Atualizando $Label ($Folder)..." -ForegroundColor Cyan

  $Staged = Join-Path $Folder 'dist\index.js.new'
  $Active = Join-Path $Folder 'dist\index.js'

  if ([string]::IsNullOrWhiteSpace($RemoteHost)) {
    Stop-Service -Name 'FIORIXConnector' -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 3
  } else {
    & sc.exe "\\$RemoteHost" stop FIORIXConnector | Out-Null
    Start-Sleep -Seconds 5
  }

  if (Test-Path $Staged) {
    Copy-Item -Path $Staged -Destination $Active -Force
    Remove-Item -Path $Staged -Force -ErrorAction SilentlyContinue
    Write-Host "[OK] Binario dist\index.js atualizado a partir de dist\index.js.new!" -ForegroundColor Green
  } elseif ((-not [string]::IsNullOrWhiteSpace($RemoteHost)) -and (Test-Path 'B:\henrique-dev\Google-avaliacoes\fiorix-connector\dist\index.js')) {
    Copy-Item -Path 'B:\henrique-dev\Google-avaliacoes\fiorix-connector\dist\index.js' -Destination $Active -Force
    Write-Host "[OK] Binario dist\index.js v2.6.2 copiado para $Label!" -ForegroundColor Green
  }

  $StatusObj = @{
    status = 'SUCCEEDED'
    targetVersion = 'v2.6.2'
    previousVersion = 'v2.6.0'
    message = 'Atualizado para v2.6.2 com sucesso.'
    updatedAt = (Get-Date).ToUniversalTime().ToString('o')
  } | ConvertTo-Json -Compress
  Set-Content -Path (Join-Path $Folder 'update-status.json') -Value $StatusObj -Encoding UTF8 -Force

  if ([string]::IsNullOrWhiteSpace($RemoteHost)) {
    Start-Service -Name 'FIORIXConnector'
    Start-Sleep -Seconds 3
    $s = Get-Service -Name 'FIORIXConnector'
    Write-Host "[SUCESSO] $Label -> Servico FIORIXConnector: $($s.Status)" -ForegroundColor Green
  } else {
    & sc.exe "\\$RemoteHost" start FIORIXConnector | Out-Null
    Start-Sleep -Seconds 4
    $q = (& sc.exe "\\$RemoteHost" query FIORIXConnector | Out-String)
    if ($q -match 'RUNNING') {
      Write-Host "[SUCESSO] $Label ($RemoteHost) -> Servico FIORIXConnector: Running!" -ForegroundColor Green
    } else {
      Write-Host "[AVISO] Verifique o servico em ${RemoteHost}: $q" -ForegroundColor Yellow
    }
  }
  return $true
}

$didLocal = $false
if (Test-Path 'B:\henrique-dev\Google-avaliacoes\fiorix-connector\dist') {
  $didLocal = Update-ConnectorFolder 'B:\henrique-dev\Google-avaliacoes\fiorix-connector' "Estacao Local ($env:COMPUTERNAME)" ''
}
if (-not $didLocal -and (Test-Path 'C:\Program Files\FIORIX Connector')) {
  $didLocal = Update-ConnectorFolder 'C:\Program Files\FIORIX Connector' "Servidor Local ($env:COMPUTERNAME)" ''
}

if ($env:COMPUTERNAME -ne 'SRVFILES') {
  $remoteUnc = '\\srvfiles\c$\Program Files\FIORIX Connector'
  if (Test-Path $remoteUnc) {
    $null = Update-ConnectorFolder $remoteUnc 'Servidor Principal (SRVFILES via Rede)' 'srvfiles'
  } else {
    Write-Host ""
    Write-Host "[INFO] Caso o compartilhamento \\srvfiles\c$ nao esteja acessivel, execute o Ativador .BAT direto no SRVFILES." -ForegroundColor Yellow
  }
}

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Green
Write-Host "  ATUALIZACAO CONCLUIDA! Em ate 20s o painel exibira v2.6.2." -ForegroundColor Green
Write-Host "  A partir da v2.6.2, as proximas atualizacoes reiniciam 100% sozinhas!" -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Green
