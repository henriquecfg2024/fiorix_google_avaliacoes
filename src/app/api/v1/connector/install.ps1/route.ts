import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function resolveOrigin(req: NextRequest): string {
  const envUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (envUrl && envUrl.startsWith('http')) {
    return envUrl.replace(/\/+$/, '');
  }
  const forwardedHost = req.headers.get('x-forwarded-host') || req.headers.get('host');
  const forwardedProto = req.headers.get('x-forwarded-proto') || 'https';
  if (forwardedHost) {
    const proto =
      forwardedHost.includes('localhost') || forwardedHost.startsWith('127.0.0.1')
        ? 'http'
        : forwardedProto;
    return `${proto}://${forwardedHost}`.replace(/\/+$/, '');
  }
  return 'https://fiorix.app';
}

function buildBatchLauncher(origin: string, token: string): string {
  const safeToken = token.replace(/[^a-zA-Z0-9_-]/g, '');
  const psUrl = `${origin}/api/v1/connector/install.ps1`;
  const lines = [
    '@echo off',
    'chcp 65001 >nul',
    'title Instalador Portatil FIORIX Connector SaaS',
    'net session >nul 2>&1',
    'if %errorLevel% neq 0 (',
    '  echo Solicitando permissao de Administrador para registrar o Servico Windows...',
    '  powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath \'%~f0\' -Verb RunAs"',
    '  exit /b',
    ')',
    'echo ============================================================================',
    'echo   FIORIX CONNECTOR SaaS - INSTALADOR PORTATIL WINDOWS SERVER',
    'echo ============================================================================',
    `powershell -NoProfile -ExecutionPolicy Bypass -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; $script = Invoke-RestMethod -Uri '${psUrl}' -UseBasicParsing; Invoke-Expression $script; Install-FiorixConnector -Token '${safeToken}' -ApiBaseUrl '${origin}'"`,
    'echo.',
    'pause',
  ];
  return lines.join('\r\n');
}

function buildPowerShellInstaller(defaultOrigin: string): string {
  return `#Requires -Version 5.1
# ==============================================================================
# FIORIX CONNECTOR SaaS - Instalador Portatil Multi-Tenant (Windows Server / 10 / 11)
# ==============================================================================

function Install-FiorixConnector {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory = $true)]
    [string]$Token,

    [string]$ApiBaseUrl = "${defaultOrigin}",

    [string]$InstallDir = "C:\\Program Files\\FIORIX Connector",

    [string]$SqlHost = "",
    [string]$SqlDatabase = "",
    [string]$SqlUser = "",
    [string]$SqlPassword = "",
    [string]$LanUrl = "",
    [string]$ProxyUrl = "",
    [switch]$SkipSqlTest
  )

  $ErrorActionPreference = 'Stop'
  $ProgressPreference = 'SilentlyContinue'
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

  Write-Host ""
  Write-Host "======================================================================" -ForegroundColor Cyan
  Write-Host "  FIORIX CONNECTOR SaaS - Provisionamento Portatil Multi-Tenant" -ForegroundColor Cyan
  Write-Host "======================================================================" -ForegroundColor Cyan
  Write-Host ""

  # 1. Validacao de privilegio Administrativo
  $currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
  if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "[ERRO] Execute o PowerShell como Administrador (Botao direito -> Executar como Administrador)." -ForegroundColor Red
    return
  }

  $CleanOrigin = $ApiBaseUrl.Trim().TrimEnd('/')
  $MachineHostname = $env:COMPUTERNAME
  $OsCaption = [Environment]::OSVersion.VersionString
  try {
    $CimOs = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue
    if ($null -ne $CimOs -and $CimOs.Caption) {
      $OsCaption = [string]$CimOs.Caption
    }
  } catch {
  }

  if ([string]::IsNullOrWhiteSpace($LanUrl)) {
    $DefaultLan = "http://$($MachineHostname.ToLower()):8765"
    $InputLan = Read-Host "URL deste servidor na rede local LAN para PDFs rapidos [Padrao: $DefaultLan]"
    $LanUrl = if ([string]::IsNullOrWhiteSpace($InputLan)) { $DefaultLan } else { $InputLan.Trim().TrimEnd('/') }
  }

  if ([string]::IsNullOrWhiteSpace($ProxyUrl)) {
    $InputProxy = Read-Host "Servidor Proxy HTTP da rede (Pressione ENTER caso nao utilize proxy)"
    if (-not [string]::IsNullOrWhiteSpace($InputProxy)) {
      $ProxyUrl = $InputProxy.Trim()
    }
  }

  # 2. Coleta local segura das credenciais SQL Server (NUNCA enviadas para a nuvem!)
  Write-Host ""
  Write-Host "--- Credenciais Locais do SQL Server (Gravadas exclusivamente neste servidor) ---" -ForegroundColor Yellow

  if ([string]::IsNullOrWhiteSpace($SqlHost)) {
    $InputHost = Read-Host "Host / Instancia do SQL Server [Padrao: localhost]"
    $SqlHost = if ([string]::IsNullOrWhiteSpace($InputHost)) { "localhost" } else { $InputHost.Trim() }
  }

  if ([string]::IsNullOrWhiteSpace($SqlDatabase)) {
    $InputDb = Read-Host "Nome do Banco SQL Server [Padrao: WEBRI]"
    $SqlDatabase = if ([string]::IsNullOrWhiteSpace($InputDb)) { "WEBRI" } else { $InputDb.Trim() }
  }

  while ([string]::IsNullOrWhiteSpace($SqlUser)) {
    $SqlUser = (Read-Host "Usuario SQL Server (somente leitura recomendado)").Trim()
  }

  $PlainSqlPassword = $SqlPassword
  while ([string]::IsNullOrWhiteSpace($PlainSqlPassword)) {
    $SecPass = Read-Host "Senha do Usuario SQL Server" -AsSecureString
    $Bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecPass)
    try {
      $PlainSqlPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($Bstr)
    } finally {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($Bstr)
    }
  }

  if (-not $SkipSqlTest) {
    $SqlOk = $false
    while (-not $SqlOk) {
      Write-Host "Testando conexao local com SQL Server ($SqlHost / $SqlDatabase)..." -ForegroundColor Gray
      try {
        $Builder = New-Object System.Data.SqlClient.SqlConnectionStringBuilder
        $Builder["Data Source"] = $SqlHost
        $Builder["Initial Catalog"] = $SqlDatabase
        $Builder["User ID"] = $SqlUser
        $Builder["Password"] = $PlainSqlPassword
        $Builder["TrustServerCertificate"] = $true
        $Builder["Connect Timeout"] = 8

        $Conn = New-Object System.Data.SqlClient.SqlConnection($Builder.ConnectionString)
        $Conn.Open()
        $Cmd = $Conn.CreateCommand()
        $Cmd.CommandText = "SELECT 1"
        $null = $Cmd.ExecuteScalar()
        $Conn.Close()
        Write-Host "[OK] Conexao com SQL Server validada com sucesso!" -ForegroundColor Green
        $SqlOk = $true
      } catch {
        Write-Host "[AVISO] Falha ao conectar no SQL Server: $($_.Exception.Message)" -ForegroundColor Yellow
        $RetryChoice = Read-Host "Deseja corrigir os dados de SQL (S) ou continuar mesmo assim (C)? [S/C]"
        if ($RetryChoice -match '^[Cc]') {
          $SqlOk = $true
        } else {
          $InputHost = Read-Host "Host SQL Server [$SqlHost]"
          if (-not [string]::IsNullOrWhiteSpace($InputHost)) { $SqlHost = $InputHost.Trim() }
          $InputDb = Read-Host "Banco SQL Server [$SqlDatabase]"
          if (-not [string]::IsNullOrWhiteSpace($InputDb)) { $SqlDatabase = $InputDb.Trim() }
          $InputUser = Read-Host "Usuario SQL Server [$SqlUser]"
          if (-not [string]::IsNullOrWhiteSpace($InputUser)) { $SqlUser = $InputUser.Trim() }
          $SecPass = Read-Host "Senha SQL Server" -AsSecureString
          $Bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecPass)
          try { $PlainSqlPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($Bstr) }
          finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($Bstr) }
        }
      }
    }
  }

  # 3. Preparacao dos diretorios locais isolados
  Write-Host ""
  Write-Host "Preparando estrutura em '$InstallDir'..." -ForegroundColor Cyan
  $Dirs = @($InstallDir, "$InstallDir\\runtime", "$InstallDir\\dist", "$InstallDir\\tools", "$InstallDir\\bin", "$InstallDir\\logs", "$InstallDir\\data")
  foreach ($d in $Dirs) {
    if (-not (Test-Path $d)) {
      New-Item -ItemType Directory -Path $d -Force | Out-Null
    }
  }

  # Se ja existir servico anterior em execucao neste servidor, para antes de atualizar binarios
  $ExistingSvc = Get-Service -Name "FIORIXConnector" -ErrorAction SilentlyContinue
  if ($null -ne $ExistingSvc -and $ExistingSvc.Status -ne 'Stopped') {
    Write-Host "Parando servico FIORIXConnector existente para atualizacao limpa..." -ForegroundColor Gray
    Stop-Service -Name "FIORIXConnector" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
  }

  # 4. Runtime Node.js v22 LTS Portatil (zero exigencia de Node/NPM/Git global no servidor)
  $NodeExe = "$InstallDir\\runtime\\node.exe"
  if (-not (Test-Path $NodeExe)) {
    $NodeVersion = "v22.14.0"
    $NodeZipUrl = "https://nodejs.org/dist/$NodeVersion/node-$NodeVersion-win-x64.zip"
    $TempZip = Join-Path $env:TEMP "fiorix-node-$NodeVersion.zip"
    $TempExtract = Join-Path $env:TEMP "fiorix-node-extract-$PID"

    Write-Host "Baixando runtime portatil oficial Node.js LTS ($NodeVersion)..." -ForegroundColor Cyan
    $IwrParams = @{ Uri = $NodeZipUrl; OutFile = $TempZip; UseBasicParsing = $true }
    if (-not [string]::IsNullOrWhiteSpace($ProxyUrl)) { $IwrParams["Proxy"] = $ProxyUrl }
    Invoke-WebRequest @IwrParams

    if (Test-Path $TempExtract) { Remove-Item -Path $TempExtract -Recurse -Force }
    Expand-Archive -Path $TempZip -DestinationPath $TempExtract -Force
    Copy-Item -Path "$TempExtract\\node-$NodeVersion-win-x64\\node.exe" -Destination $NodeExe -Force
    Remove-Item -Path $TempZip -Force -ErrorAction SilentlyContinue
    Remove-Item -Path $TempExtract -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "[OK] Runtime portatil isolado instalado em $NodeExe" -ForegroundColor Green
  } else {
    Write-Host "[OK] Runtime portatil Node.js ja presente em $NodeExe" -ForegroundColor Green
  }

  # 5. Pareamento criptografico de uso unico com o FIORIX SaaS
  Write-Host "Realizando pareamento seguro com $CleanOrigin..." -ForegroundColor Cyan
  $EnrollBody = @{
    token = $Token.Trim()
    hostname = $MachineHostname
    osVersion = [string]$OsCaption
    installedPath = $InstallDir
    lanUrl = $LanUrl
    version = "v2.6.0"
  } | ConvertTo-Json -Compress

  $EnrollParams = @{
    Uri = "$CleanOrigin/api/v1/connector/enroll"
    Method = "POST"
    ContentType = "application/json; charset=utf-8"
    Body = [System.Text.Encoding]::UTF8.GetBytes($EnrollBody)
    UseBasicParsing = $true
  }
  if (-not [string]::IsNullOrWhiteSpace($ProxyUrl)) { $EnrollParams["Proxy"] = $ProxyUrl }

  $EnrollResp = Invoke-RestMethod @EnrollParams
  if (-not $EnrollResp.ok -or -not $EnrollResp.connectorId -or -not $EnrollResp.connectorSecret) {
    throw "Resposta inesperada no pareamento com FIORIX SaaS."
  }

  $ConnectorId = [string]$EnrollResp.connectorId
  $ConnectorSecret = [string]$EnrollResp.connectorSecret
  $OperationalState = [string]$EnrollResp.operationalState
  $ConnectorRole = [string]$EnrollResp.role
  $TenantName = [string]$EnrollResp.tenantName
  $ReleaseBaseUrl = [string]$EnrollResp.releaseUrl

  Write-Host "[OK] Servidor autenticado no cartorio '$TenantName' como $($EnrollResp.connectorName) ($ConnectorRole / $OperationalState)" -ForegroundColor Green

  # 6. Download autenticado dos artefatos compilados + verificacao SHA-256
  $AuthHeaders = @{
    "Authorization" = "Bearer $ConnectorSecret"
    "X-Connector-Id" = $ConnectorId
  }

  $ManifestParams = @{ Uri = "$($ReleaseBaseUrl)?asset=manifest"; Headers = $AuthHeaders; UseBasicParsing = $true }
  if (-not [string]::IsNullOrWhiteSpace($ProxyUrl)) { $ManifestParams["Proxy"] = $ProxyUrl }
  $Manifest = Invoke-RestMethod @ManifestParams

  function Download-VerifiedAsset([string]$AssetName, [string]$OutPath, [string]$ExpectedHash) {
    Write-Host "Baixando componente '$AssetName'..." -ForegroundColor Gray
    $DlParams = @{
      Uri = "$($ReleaseBaseUrl)?asset=$AssetName"
      Headers = $AuthHeaders
      OutFile = $OutPath
      UseBasicParsing = $true
    }
    if (-not [string]::IsNullOrWhiteSpace($ProxyUrl)) { $DlParams["Proxy"] = $ProxyUrl }
    Invoke-WebRequest @DlParams

    if (-not [string]::IsNullOrWhiteSpace($ExpectedHash)) {
      $ActualHash = (Get-FileHash -Path $OutPath -Algorithm SHA256).Hash.ToLower()
      if ($ActualHash -ne $ExpectedHash.ToLower()) {
        Remove-Item -Path $OutPath -Force -ErrorAction SilentlyContinue
        throw "Falha de integridade SHA-256 em $AssetName (esperado $ExpectedHash, obtido $ActualHash)."
      }
    }
  }

  Download-VerifiedAsset "bundle" "$InstallDir\\dist\\index.js" ([string]$Manifest.bundle.sha256)
  if ($null -ne $Manifest.nssm) {
    Download-VerifiedAsset "nssm" "$InstallDir\\tools\\nssm.exe" ([string]$Manifest.nssm.sha256)
  }
  if ($null -ne $Manifest.rustCli) {
    Download-VerifiedAsset "rust-cli" "$InstallDir\\bin\\fiorix-gd-cli.exe" ([string]$Manifest.rustCli.sha256)
  }
  Write-Host "[OK] Binarios oficiais $($Manifest.version) verificados com SHA-256!" -ForegroundColor Green

  # 7. Gravacao de package.json ESM minimo e .env.production blindado por ACL Windows
  $PkgJson = '{"name":"fiorix-connector-runtime","private":true,"type":"module"}'
  Set-Content -Path "$InstallDir\\package.json" -Value $PkgJson -Encoding UTF8 -Force

  function Escape-EnvVal([string]$v) {
    if ($null -eq $v) { return "" }
    return ($v.Replace('\\', '\\\\').Replace('"', '\\"'))
  }

  $ProxyEnabledVal = if ([string]::IsNullOrWhiteSpace($ProxyUrl)) { "false" } else { "true" }
  $ProxyHostUrl = if ([string]::IsNullOrWhiteSpace($ProxyUrl)) { "http://127.0.0.1:3128" } else { $ProxyUrl }

  $CliFullPath = Join-Path $InstallDir "bin\\fiorix-gd-cli.exe"

  $EnvLines = @(
    "# FIORIX Connector SaaS - Gerado automaticamente em $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')",
    "SQL_SERVER_HOST=""$(Escape-EnvVal $SqlHost)""",
    "SQL_SERVER_PORT=""1433""",
    "SQL_SERVER_DATABASE=""$(Escape-EnvVal $SqlDatabase)""",
    "SQL_SERVER_USER=""$(Escape-EnvVal $SqlUser)""",
    "SQL_SERVER_PASSWORD=""$(Escape-EnvVal $PlainSqlPassword)""",
    "SQL_SERVER_ENCRYPT=""false""",
    "SQL_SERVER_TRUST_CERT=""true""",
    "FIORIX_API_URL=""$(Escape-EnvVal $EnrollResp.syncUrl)""",
    "DOCUMENTAL_API_URL=""$(Escape-EnvVal $EnrollResp.documentalUrl)""",
    "CONNECTOR_ID=""$(Escape-EnvVal $ConnectorId)""",
    "CONNECTOR_SECRET=""$(Escape-EnvVal $ConnectorSecret)""",
    "CONNECTOR_INITIAL_STATE=""$(Escape-EnvVal $OperationalState)""",
    "WINDOWS_SERVICE_NAME=""FIORIXConnector""",
    "DOCUMENTAL_ENABLED=""true""",
    "DOCUMENTAL_FILE_SERVER_PORT=""8765""",
    "DOCUMENTAL_FILE_SERVER_PUBLIC_URL=""$(Escape-EnvVal $LanUrl)""",
    "DOCUMENTAL_CLI_PATH=""$(Escape-EnvVal $CliFullPath)""",
    "CONNECTOR_PROXY_ENABLED=""$ProxyEnabledVal""",
    "CONNECTOR_PROXY_URL=""$(Escape-EnvVal $ProxyHostUrl)""",
    "SCHEDULER_ENABLED=""true""",
    "AUTO_SYNC_ENABLED=""true""",
    "BI_AUTO_SYNC_ENABLED=""true""",
    "PRODUTIVIDADE_AUTO_SYNC_ENABLED=""true""",
    "TAREFAS_AUTO_SYNC_ENABLED=""true""",
    "METAS_AUTO_SYNC_ENABLED=""true""",
    "RETORNOS_AUTO_SYNC_ENABLED=""true""",
    "IMPRESSOES_AUTO_SYNC_ENABLED=""true""",
    "SAFRAS_AUTO_SYNC_ENABLED=""true""",
    "SHADOW_MODE=""false""",
    "LOG_LEVEL=""info"""
  )

  $EnvFile = "$InstallDir\\.env.production"
  $Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllLines($EnvFile, $EnvLines, $Utf8NoBom)
  $PlainSqlPassword = $null

  # Restringe leitura do .env.production exclusivamente a SYSTEM (*S-1-5-18) e Administradores (*S-1-5-32-544)
  & icacls $EnvFile /inheritance:r /grant:r "*S-1-5-18:(F)" "*S-1-5-32-544:(F)" | Out-Null
  Write-Host "[OK] Arquivo .env.production protegido com ACL restrita (SYSTEM + Administradores)." -ForegroundColor Green

  # 8. Regra de Firewall Windows para streaming rapido de PDFs via LAN (TCP 8765 apenas Domain/Private)
  try {
    $FwName = "FIORIX Connector PDF LAN (8765)"
    $ExistingFw = Get-NetFirewallRule -DisplayName $FwName -ErrorAction SilentlyContinue
    if ($null -eq $ExistingFw) {
      New-NetFirewallRule -DisplayName $FwName -Direction Inbound -Protocol TCP -LocalPort 8765 -Profile Domain,Private -Action Allow | Out-Null
      Write-Host "[OK] Regra de Firewall Windows liberada na porta TCP 8765 (Rede Corporativa/Privada)." -ForegroundColor Green
    }
  } catch {
    Write-Host "[AVISO] Nao foi possivel registrar regra automatica de firewall (porta 8765): $($_.Exception.Message)" -ForegroundColor Yellow
  }

  # 9. Registro e inicializacao do Servico Windows (FIORIXConnector) via NSSM
  $NssmExe = "$InstallDir\\tools\\nssm.exe"
  $SvcCheck = Get-Service -Name "FIORIXConnector" -ErrorAction SilentlyContinue
  if ($null -eq $SvcCheck) {
    & $NssmExe install FIORIXConnector $NodeExe "dist/index.js" | Out-Null
  } else {
    & $NssmExe set FIORIXConnector Application $NodeExe | Out-Null
    & $NssmExe set FIORIXConnector AppParameters "dist/index.js" | Out-Null
  }

  & $NssmExe set FIORIXConnector AppDirectory $InstallDir | Out-Null
  & $NssmExe set FIORIXConnector DisplayName "FIORIX Connector SaaS ($($EnrollResp.connectorName))" | Out-Null
  & $NssmExe set FIORIXConnector Description "Agente de Sincronizacao SQL e Gestao Documental 24/7 FIORIX SaaS" | Out-Null
  & $NssmExe set FIORIXConnector Start SERVICE_AUTO_START | Out-Null
  & $NssmExe set FIORIXConnector AppEnvironmentExtra "FIORIX_CONNECTOR_ENV=production" | Out-Null
  & $NssmExe set FIORIXConnector AppStdout "$InstallDir\\logs\\service-stdout.log" | Out-Null
  & $NssmExe set FIORIXConnector AppStderr "$InstallDir\\logs\\service-stderr.log" | Out-Null
  & $NssmExe set FIORIXConnector AppRotateFiles 1 | Out-Null
  & $NssmExe set FIORIXConnector AppRotateBytes 10485760 | Out-Null

  Start-Service -Name "FIORIXConnector"
  Start-Sleep -Seconds 3
  $FinalSvc = Get-Service -Name "FIORIXConnector"

  Write-Host ""
  Write-Host "======================================================================" -ForegroundColor Green
  Write-Host "  FIORIX CONNECTOR INSTALADO E EM EXECUCAO COM SUCESSO!" -ForegroundColor Green
  Write-Host "======================================================================" -ForegroundColor Green
  Write-Host "  Cartorio         : $TenantName"
  Write-Host "  Servidor         : $($EnrollResp.connectorName) ($MachineHostname)"
  Write-Host "  Connector ID     : $ConnectorId"
  Write-Host "  Modo Inicial     : $OperationalState ($ConnectorRole)"
  Write-Host "  Servico Windows  : $($FinalSvc.Name) [$($FinalSvc.Status)]"
  Write-Host "  URL LAN PDFs     : $LanUrl"
  Write-Host "======================================================================" -ForegroundColor Green
  Write-Host "Gerencie chaveamento Ativo/Standby, pastas SMB e atualizacoes em:" -ForegroundColor Cyan
  Write-Host "  $CleanOrigin/sistema/operacoes" -ForegroundColor White
  Write-Host ""
}
`;
}

export async function GET(req: NextRequest) {
  const origin = resolveOrigin(req);
  const format = (req.nextUrl.searchParams.get('format') || 'ps1').toLowerCase();
  const token = (req.nextUrl.searchParams.get('token') || '').trim();

  if (format === 'bat') {
    if (!token.startsWith('fx_enroll_')) {
      return NextResponse.json(
        { error: 'Informe um token de pareamento válido para gerar o instalador .bat.' },
        { status: 400 },
      );
    }
    const batContent = buildBatchLauncher(origin, token);
    return new NextResponse(batContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream; charset=utf-8',
        'Content-Disposition': 'attachment; filename="Instalar-FIORIX-Connector.bat"',
        'Cache-Control': 'private, no-store',
      },
    });
  }

  const psScript = buildPowerShellInstaller(origin);
  return new NextResponse(psScript, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'private, no-store',
    },
  });
}
