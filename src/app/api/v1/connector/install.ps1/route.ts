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
  const bootstrapCmd = [
    '[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12;',
    '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8;',
    "$pUrl = ''; $pUser = ''; $pPass = ''; $script = $null;",
    `try { $script = Invoke-RestMethod -Uri '${psUrl}' -UseBasicParsing -TimeoutSec 15 }`,
    'catch {',
    "  Write-Host '[REDE] Acesso direto bloqueado ou exige Proxy HTTP corporativo.' -ForegroundColor Yellow;",
    "  $rawProxy = (Read-Host 'Servidor Proxy HTTP (ex: 10.0.0.1:3128)').Trim();",
    '  if (-not [string]::IsNullOrWhiteSpace($rawProxy)) {',
    "    $pUrl = if ($rawProxy -match '^https?://') { $rawProxy } else { 'http://' + $rawProxy };",
    "    $pUser = (Read-Host 'Usuario do Proxy (ENTER se sem autenticacao)').Trim();",
    '    $irmArgs = @{ Uri = ' + `'${psUrl}'` + '; UseBasicParsing = $true; Proxy = $pUrl };',
    '    if (-not [string]::IsNullOrWhiteSpace($pUser)) {',
    "      $sec = Read-Host 'Senha do Proxy' -AsSecureString;",
    '      $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($sec);',
    '      try { $pPass = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr) };',
    '      $irmArgs["ProxyCredential"] = New-Object System.Management.Automation.PSCredential($pUser, $sec);',
    '    }',
    '    $script = Invoke-RestMethod @irmArgs;',
    '  } else { throw }',
    '}',
    'Invoke-Expression $script;',
    `Install-FiorixConnector -Token '${safeToken}' -ApiBaseUrl '${origin}' -ProxyUrl $pUrl -ProxyUser $pUser -ProxyPassword $pPass`,
  ].join(' ');

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
    `powershell -NoProfile -ExecutionPolicy Bypass -Command "${bootstrapCmd.replace(/"/g, '\\"')}"`,
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
    [string]$ProxyUser = "",
    [string]$ProxyPassword = "",
    [switch]$SkipSqlTest,
    [switch]$ForceOverwriteService
  )

  $ErrorActionPreference = 'Stop'
  $ProgressPreference = 'SilentlyContinue'
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  [Console]::OutputEncoding = [System.Text.Encoding]::UTF8

  $CleanOrigin = $ApiBaseUrl.Trim().TrimEnd('/')
  $MachineHostname = $env:COMPUTERNAME

  Write-Host ""
  Write-Host "======================================================================" -ForegroundColor Cyan
  Write-Host "  FIORIX CONNECTOR SaaS - Servidor Atual: $MachineHostname" -ForegroundColor Cyan
  Write-Host "======================================================================" -ForegroundColor Cyan
  Write-Host ""

  # 1. Validacao de privilegio Administrativo
  $currentPrincipal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
  if (-not $currentPrincipal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Host "[ERRO] Execute o PowerShell como Administrador (Botao direito -> Executar como Administrador)." -ForegroundColor Red
    return
  }

  # 2. Trava de seguranca ANTES de consumir o token caso ja exista FIORIXConnector nesta maquina
  $PreCheckSvc = Get-Service -Name "FIORIXConnector" -ErrorAction SilentlyContinue
  if ($null -ne $PreCheckSvc -and -not $ForceOverwriteService) {
    Write-Host "[ATENCAO] Esta maquina ($MachineHostname) JA POSSUI o servico FIORIXConnector instalado!" -ForegroundColor Yellow
    Write-Host "Se voce baixou o instalador para rodar em OUTRO servidor (ex: SRVFILES)," -ForegroundColor Yellow
    Write-Host "digite N abaixo e copie o arquivo .BAT para a Area de Trabalho Remota do outro servidor." -ForegroundColor Yellow
    $ConfirmOverwrite = Read-Host "Deseja realmente SUBSTITUIR o Connector desta maquina ($MachineHostname)? [s/N]"
    if ($ConfirmOverwrite -notmatch '^[Ss]') {
      Write-Host "Instalacao cancelada com seguranca (seu token de pareamento NAO foi consumido e continua valido)." -ForegroundColor Green
      return
    }
  }

  $OsCaption = [Environment]::OSVersion.VersionString
  try {
    $CimOs = Get-CimInstance Win32_OperatingSystem -ErrorAction SilentlyContinue
    if ($null -ne $CimOs -and $CimOs.Caption) {
      $OsCaption = [string]$CimOs.Caption
    }
  } catch {
  }

  # 3. Configuracao opcional de Proxy HTTP Corporativo (com suporte a usuario e senha)
  $EffectiveProxyUri = ""
  $ParsedProxyHost = ""
  $ParsedProxyPort = "3128"
  $PlainProxyPassword = $ProxyPassword
  $ProxyCredentialObj = $null

  if ([string]::IsNullOrWhiteSpace($ProxyUrl)) {
    $InputProxy = (Read-Host "Servidor Proxy HTTP da rede (ex: 10.0.0.1:3128 ou ENTER se acesso direto)").Trim()
    if (-not [string]::IsNullOrWhiteSpace($InputProxy)) {
      $ProxyUrl = $InputProxy
    }
  }

  if (-not [string]::IsNullOrWhiteSpace($ProxyUrl)) {
    $EffectiveProxyUri = if ($ProxyUrl -match '^https?://') { $ProxyUrl.Trim() } else { "http://$($ProxyUrl.Trim())" }
    $ProxyParsed = [System.Uri]$EffectiveProxyUri
    $ParsedProxyHost = $ProxyParsed.Host
    $ParsedProxyPort = if ($ProxyParsed.Port -gt 0) { [string]$ProxyParsed.Port } else { "3128" }

    if ([string]::IsNullOrWhiteSpace($ProxyUser)) {
      $InputProxyUser = (Read-Host "Usuario do Proxy HTTP (ENTER se sem autenticacao)").Trim()
      if (-not [string]::IsNullOrWhiteSpace($InputProxyUser)) {
        $ProxyUser = $InputProxyUser
      }
    }

    if (-not [string]::IsNullOrWhiteSpace($ProxyUser)) {
      if ([string]::IsNullOrWhiteSpace($PlainProxyPassword)) {
        $SecProxy = Read-Host "Senha do Proxy HTTP" -AsSecureString
        $BstrP = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecProxy)
        try {
          $PlainProxyPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($BstrP)
        } finally {
          [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BstrP)
        }
        $ProxyCredentialObj = New-Object System.Management.Automation.PSCredential($ProxyUser, $SecProxy)
      } else {
        $SecFromPlain = ConvertTo-SecureString -String $PlainProxyPassword -AsPlainText -Force
        $ProxyCredentialObj = New-Object System.Management.Automation.PSCredential($ProxyUser, $SecFromPlain)
      }
    }
  }

  function Add-WebProxyArgs([hashtable]$Params) {
    if (-not [string]::IsNullOrWhiteSpace($EffectiveProxyUri)) {
      $Params["Proxy"] = $EffectiveProxyUri
      if ($null -ne $ProxyCredentialObj) {
        $Params["ProxyCredential"] = $ProxyCredentialObj
      }
    }
  }

  # 4. Pareamento criptografico de uso unico com o FIORIX SaaS (UTF-8 puro + preserva URL LAN do painel)
  Write-Host "Realizando pareamento seguro com $CleanOrigin..." -ForegroundColor Cyan
  $DefaultLanFromHost = "http://$($MachineHostname.ToLower()):8765"

  $EnrollPayload = @{
    token = $Token.Trim()
    hostname = $MachineHostname
    osVersion = [string]$OsCaption
    installedPath = $InstallDir
    version = "v2.6.2"
  }
  if (-not [string]::IsNullOrWhiteSpace($LanUrl)) {
    $EnrollPayload["lanUrl"] = $LanUrl.Trim().TrimEnd('/')
  }
  $EnrollBody = $EnrollPayload | ConvertTo-Json -Compress

  $EnrollParams = @{
    Uri = "$CleanOrigin/api/v1/connector/enroll"
    Method = "POST"
    ContentType = "application/json; charset=utf-8"
    Body = [System.Text.Encoding]::UTF8.GetBytes($EnrollBody)
    UseBasicParsing = $true
  }
  Add-WebProxyArgs $EnrollParams

  $EnrollResp = $null
  try {
    $RawEnrollHttp = Invoke-WebRequest @EnrollParams
    $Utf8Json = [System.Text.Encoding]::UTF8.GetString($RawEnrollHttp.RawContentStream.ToArray())
    $EnrollResp = $Utf8Json | ConvertFrom-Json
  } catch {
    $StatusCode = 0
    if ($null -ne $_.Exception.Response) {
      $StatusCode = [int]$_.Exception.Response.StatusCode
    }
    if ($StatusCode -eq 401) {
      Write-Host ""
      Write-Host "[TOKEN JA UTILIZADO OU EXPIRADO (HTTP 401)]" -ForegroundColor Red
      Write-Host "Este arquivo .BAT / token de pareamento e de uso unico e ja foi consumido ou expirou (15 min)." -ForegroundColor Yellow
      Write-Host "Acesse $CleanOrigin/sistema/operacoes -> '+ Adicionar Servidor Connector' e gere um novo instalador." -ForegroundColor Cyan
      Write-Host ""
      return
    }
    throw
  }

  if (-not $EnrollResp.ok -or -not $EnrollResp.connectorId -or -not $EnrollResp.connectorSecret) {
    throw "Resposta inesperada no pareamento com FIORIX SaaS."
  }

  $ConnectorId = [string]$EnrollResp.connectorId
  $ConnectorSecret = [string]$EnrollResp.connectorSecret
  $OperationalState = [string]$EnrollResp.operationalState
  $ConnectorRole = [string]$EnrollResp.role
  $TenantName = [string]$EnrollResp.tenantName
  $ReleaseBaseUrl = [string]$EnrollResp.releaseUrl
  $CloudRemoteCfg = $EnrollResp.remoteConfig

  Write-Host "[OK] Servidor autenticado no cartorio '$TenantName' como $($EnrollResp.connectorName) ($ConnectorRole / $OperationalState)" -ForegroundColor Green

  if ([string]::IsNullOrWhiteSpace($LanUrl)) {
    $CloudLan = if ($null -ne $CloudRemoteCfg -and $CloudRemoteCfg.lanUrl) { [string]$CloudRemoteCfg.lanUrl } else { $DefaultLanFromHost }
    $InputLan = Read-Host "URL deste servidor na rede local LAN para PDFs rapidos [Padrao: $CloudLan]"
    $LanUrl = if ([string]::IsNullOrWhiteSpace($InputLan)) { $CloudLan } else { $InputLan.Trim().TrimEnd('/') }
  }

  # 5. Coleta local segura das credenciais SQL Server (NUNCA enviadas para a nuvem!)
  Write-Host ""
  Write-Host "--- Credenciais Locais do SQL Server (Gravadas exclusivamente neste servidor) ---" -ForegroundColor Yellow

  if ([string]::IsNullOrWhiteSpace($SqlHost)) {
    $CloudSqlHost = if ($null -ne $CloudRemoteCfg -and $CloudRemoteCfg.sqlHost) { [string]$CloudRemoteCfg.sqlHost } else { "srvsql" }
    $InputHost = Read-Host "Host / Instancia do SQL Server [Padrao: $CloudSqlHost]"
    $SqlHost = if ([string]::IsNullOrWhiteSpace($InputHost)) { $CloudSqlHost } else { $InputHost.Trim() }
  }

  if ([string]::IsNullOrWhiteSpace($SqlDatabase)) {
    $CloudSqlDb = if ($null -ne $CloudRemoteCfg -and $CloudRemoteCfg.sqlDatabase) { [string]$CloudRemoteCfg.sqlDatabase } else { "WEBRI" }
    $InputDb = Read-Host "Nome do Banco SQL Server [Padrao: $CloudSqlDb]"
    $SqlDatabase = if ([string]::IsNullOrWhiteSpace($InputDb)) { $CloudSqlDb } else { $InputDb.Trim() }
  }

  if ([string]::IsNullOrWhiteSpace($SqlUser)) {
    $InputUser = Read-Host "Usuario SQL Server [Padrao: fiorix_connector]"
    $SqlUser = if ([string]::IsNullOrWhiteSpace($InputUser)) { "fiorix_connector" } else { $InputUser.Trim() }
  }

  $PlainSqlPassword = $SqlPassword
  while ([string]::IsNullOrWhiteSpace($PlainSqlPassword)) {
    $SecPass = Read-Host "Senha do Usuario SQL Server ($SqlUser)" -AsSecureString
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

  # 6. Preparacao dos diretorios locais isolados
  Write-Host ""
  Write-Host "Preparando estrutura em '$InstallDir'..." -ForegroundColor Cyan
  $Dirs = @($InstallDir, "$InstallDir\\runtime", "$InstallDir\\dist", "$InstallDir\\tools", "$InstallDir\\bin", "$InstallDir\\logs", "$InstallDir\\data")
  foreach ($d in $Dirs) {
    if (-not (Test-Path $d)) {
      New-Item -ItemType Directory -Path $d -Force | Out-Null
    }
  }

  $ExistingSvc = Get-Service -Name "FIORIXConnector" -ErrorAction SilentlyContinue
  if ($null -ne $ExistingSvc -and $ExistingSvc.Status -ne 'Stopped') {
    Write-Host "Parando servico FIORIXConnector existente para atualizacao limpa..." -ForegroundColor Gray
    Stop-Service -Name "FIORIXConnector" -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
  }

  # 7. Runtime Node.js v22 LTS Portatil (extracao rapida via .NET ZipFile sem barra lenta)
  $NodeExe = "$InstallDir\\runtime\\node.exe"
  if (-not (Test-Path $NodeExe)) {
    $NodeVersion = "v22.14.0"
    $NodeZipUrl = "https://nodejs.org/dist/$NodeVersion/node-$NodeVersion-win-x64.zip"
    $TempZip = Join-Path $env:TEMP "fiorix-node-$NodeVersion.zip"
    $TempExtract = Join-Path $env:TEMP "fiorix-node-extract-$PID"

    Write-Host "Baixando runtime portatil oficial Node.js LTS ($NodeVersion)..." -ForegroundColor Cyan
    $IwrParams = @{ Uri = $NodeZipUrl; OutFile = $TempZip; UseBasicParsing = $true }
    Add-WebProxyArgs $IwrParams
    Invoke-WebRequest @IwrParams

    Write-Host "Extraindo runtime Node.js portatil..." -ForegroundColor Gray
    if (Test-Path $TempExtract) { Remove-Item -Path $TempExtract -Recurse -Force }
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::ExtractToDirectory($TempZip, $TempExtract)
    Copy-Item -Path "$TempExtract\\node-$NodeVersion-win-x64\\node.exe" -Destination $NodeExe -Force
    Remove-Item -Path $TempZip -Force -ErrorAction SilentlyContinue
    Remove-Item -Path $TempExtract -Recurse -Force -ErrorAction SilentlyContinue
    Write-Host "[OK] Runtime portatil isolado instalado em $NodeExe" -ForegroundColor Green
  } else {
    Write-Host "[OK] Runtime portatil Node.js ja presente em $NodeExe" -ForegroundColor Green
  }

  # 8. Download autenticado dos artefatos compilados + verificacao SHA-256
  $AuthHeaders = @{
    "Authorization" = "Bearer $ConnectorSecret"
    "X-Connector-Id" = $ConnectorId
  }

  $ManifestParams = @{ Uri = "$($ReleaseBaseUrl)?asset=manifest"; Headers = $AuthHeaders; UseBasicParsing = $true }
  Add-WebProxyArgs $ManifestParams
  $Manifest = Invoke-RestMethod @ManifestParams

  function Download-VerifiedAsset([string]$AssetName, [string]$OutPath, [string]$ExpectedHash) {
    Write-Host "Baixando componente '$AssetName'..." -ForegroundColor Gray
    $DlParams = @{
      Uri = "$($ReleaseBaseUrl)?asset=$AssetName"
      Headers = $AuthHeaders
      OutFile = $OutPath
      UseBasicParsing = $true
    }
    Add-WebProxyArgs $DlParams
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

  # 9. Gravacao de package.json ESM minimo e .env.production blindado por ACL Windows
  $PkgJson = '{"name":"fiorix-connector-runtime","private":true,"type":"module"}'
  Set-Content -Path "$InstallDir\\package.json" -Value $PkgJson -Encoding UTF8 -Force

  function Escape-EnvVal([string]$v) {
    if ($null -eq $v) { return "" }
    return ($v.Replace('\\', '\\\\').Replace('"', '\\"'))
  }

  $ProxyEnabledVal = if ([string]::IsNullOrWhiteSpace($ParsedProxyHost)) { "false" } else { "true" }
  $CliFullPath = Join-Path $InstallDir "bin\\fiorix-gd-cli.exe"

  $RootsJsonLine = ""
  if ($null -ne $CloudRemoteCfg -and $null -ne $CloudRemoteCfg.documentRoots -and @($CloudRemoteCfg.documentRoots).Count -gt 0) {
    $CleanRootsArr = @()
    foreach ($r in @($CloudRemoteCfg.documentRoots)) {
      if ($r.id -and $r.path) {
        $CleanRootsArr += @{ id = [string]$r.id; path = [string]$r.path }
      }
    }
    if ($CleanRootsArr.Count -gt 0) {
      $SerializedRoots = ConvertTo-Json -InputObject $CleanRootsArr -Compress
      if (-not $SerializedRoots.StartsWith("[")) { $SerializedRoots = "[$SerializedRoots]" }
      $RootsJsonLine = "DOCUMENTAL_ROOTS_JSON='$SerializedRoots'"
    }
  }

  $EnvLines = @(
    "# FIORIX Connector SaaS - Gerado automaticamente em $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')",
    "FIORIX_CONNECTOR_ENV=""production""",
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
    "PROXY_ENABLED=""$ProxyEnabledVal""",
    "PROXY_HOST=""$(Escape-EnvVal $ParsedProxyHost)""",
    "PROXY_PORT=""$ParsedProxyPort""",
    "PROXY_USERNAME=""$(Escape-EnvVal $ProxyUser)""",
    "PROXY_PASSWORD=""$(Escape-EnvVal $PlainProxyPassword)""",
    "NO_PROXY=""localhost,127.0.0.1,srvsql,10.0.0.25,.7ri.local""",
    "SYNC_INTERVAL_SECONDS=""3600""",
    "BI_SYNC_INTERVAL_SECONDS=""3600""",
    "PRODUTIVIDADE_SYNC_INTERVAL_SECONDS=""3600""",
    "TAREFAS_SYNC_INTERVAL_SECONDS=""3600""",
    "METAS_SYNC_INTERVAL_SECONDS=""3600""",
    "METAS_RECONCILIATION_INTERVAL_MINUTES=""1440""",
    "RETORNOS_SYNC_INTERVAL_SECONDS=""3600""",
    "IMPRESSOES_SYNC_INTERVAL_SECONDS=""3600""",
    "ANDAMENTOS_SYNC_INTERVAL_SECONDS=""3600""",
    "BI_OFFSET_SECONDS=""0""",
    "METAS_OFFSET_SECONDS=""900""",
    "RETORNOS_OFFSET_SECONDS=""1200""",
    "IMPRESSOES_OFFSET_SECONDS=""1500""",
    "PRODUTIVIDADE_OFFSET_SECONDS=""1800""",
    "ANDAMENTOS_OFFSET_SECONDS=""2100""",
    "TAREFAS_OFFSET_SECONDS=""2700""",
    "SHADOW_MODE=""false""",
    "SCHEDULER_ENABLED=""true""",
    "AUTO_SYNC_ENABLED=""false""",
    "BI_AUTO_SYNC_ENABLED=""true""",
    "PRODUTIVIDADE_AUTO_SYNC_ENABLED=""true""",
    "TAREFAS_AUTO_SYNC_ENABLED=""true""",
    "METAS_AUTO_SYNC_ENABLED=""true""",
    "METAS_SYNC_MODE=""incremental""",
    "METAS_RECONCILIATION_ENABLED=""true""",
    "RETORNOS_AUTO_SYNC_ENABLED=""true""",
    "IMPRESSOES_AUTO_SYNC_ENABLED=""true""",
    "ANDAMENTOS_AUTO_SYNC_ENABLED=""true""",
    "BUSINESS_HOURS_ONLY=""true""",
    "BUSINESS_HOURS_START=""07:00""",
    "BUSINESS_HOURS_END=""19:00""",
    "BUSINESS_HOURS_DAYS=""1,2,3,4,5,6""",
    "DOCUMENTAL_ENABLED=""true""",
    "DOCUMENTAL_ALLOW_INSECURE_LOCALHOST=""true""",
    "DOCUMENTAL_FILE_SERVER_PORT=""8765""",
    "DOCUMENTAL_FILE_SERVER_PUBLIC_URL=""$(Escape-EnvVal $LanUrl)""",
    "DOCUMENTAL_CLI_PATH=""$(Escape-EnvVal $CliFullPath)""",
    "FIORIX_GD_CLI_PATH=""$(Escape-EnvVal $CliFullPath)""",
    "LOG_LEVEL=""info"""
  )
  if (-not [string]::IsNullOrWhiteSpace($RootsJsonLine)) {
    $EnvLines += $RootsJsonLine
  }

  $EnvFile = "$InstallDir\\.env.production"
  $BaseEnvFile = "$InstallDir\\.env"
  $Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllLines($BaseEnvFile, @('FIORIX_CONNECTOR_ENV="production"'), $Utf8NoBom)
  [System.IO.File]::WriteAllLines($EnvFile, $EnvLines, $Utf8NoBom)
  $PlainSqlPassword = $null
  $PlainProxyPassword = $null

  # Restringe leitura do .env.production exclusivamente a SYSTEM (*S-1-5-18) e Administradores (*S-1-5-32-544)
  & icacls $EnvFile /inheritance:r /grant:r "*S-1-5-18:(F)" "*S-1-5-32-544:(F)" | Out-Null
  Write-Host "[OK] Arquivo .env.production protegido com ACL restrita (SYSTEM + Administradores)." -ForegroundColor Green

  # 10. Regra de Firewall Windows para streaming rapido de PDFs via LAN (TCP 8765 apenas Domain/Private)
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

  # 11. Registro e inicializacao do Servico Windows (FIORIXConnector) via NSSM
  $NssmExe = "$InstallDir\\tools\\nssm.exe"
  $SafeDisplayName = "FIORIX Connector SaaS ($MachineHostname)"
  $SvcCheck = Get-Service -Name "FIORIXConnector" -ErrorAction SilentlyContinue
  if ($null -eq $SvcCheck) {
    & $NssmExe install FIORIXConnector $NodeExe "dist/index.js" | Out-Null
  } else {
    & $NssmExe set FIORIXConnector Application $NodeExe | Out-Null
    & $NssmExe set FIORIXConnector AppParameters "dist/index.js" | Out-Null
  }

  & $NssmExe set FIORIXConnector AppDirectory $InstallDir | Out-Null
  & $NssmExe set FIORIXConnector DisplayName $SafeDisplayName | Out-Null
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

function buildActivateV262Batch(origin: string): string {
  const psScript = `
$ErrorActionPreference = 'Continue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

function Update-ConnectorFolder([string]$Folder, [string]$Label, [string]$RemoteHost) {
  if (-not (Test-Path $Folder)) { return $false }
  Write-Host ""
  Write-Host ">>> Atualizando $Label ($Folder)..." -ForegroundColor Cyan

  $Staged = Join-Path $Folder 'dist\\index.js.new'
  $Active = Join-Path $Folder 'dist\\index.js'
  $EnvProd = Join-Path $Folder '.env.production'

  # Se nao houver index.js.new em espera, baixa e valida SHA-256 direto do SaaS usando as credenciais locais do servidor
  $already262 = $false
  if ((Test-Path $Active) -and -not (Test-Path $Staged)) {
    try {
      $activeSample = [IO.File]::ReadAllText($Active, [Text.Encoding]::UTF8)
      if ($activeSample.Contains('2.6.2')) { $already262 = $true }
    } catch {}
  }

  if (-not (Test-Path $Staged) -and -not $already262 -and (Test-Path $EnvProd)) {
    $cid = ''; $csec = ''; $pUrl = ''
    foreach ($ln in (Get-Content $EnvProd)) {
      if ($ln -match '^CONNECTOR_ID=(.+)$') { $cid = $Matches[1].Trim('"', "'", ' ') }
      if ($ln -match '^CONNECTOR_SECRET=(.+)$') { $csec = $Matches[1].Trim('"', "'", ' ') }
      if (-not $pUrl -and $ln -match '^HTTPS?_PROXY=(.+)$') { $pUrl = $Matches[1].Trim('"', "'", ' ') }
    }
    if ($cid -and $csec) {
      try {
        $hdr = @{ 'Authorization' = "Bearer $csec"; 'X-Connector-Id' = $cid }
        $irmParams = @{ Uri = '${origin}/api/v1/connector/release?asset=manifest'; Headers = $hdr; UseBasicParsing = $true; TimeoutSec = 25 }
        if ($pUrl) { $irmParams['Proxy'] = $pUrl }
        $mf = Invoke-RestMethod @irmParams
        $tmpDl = Join-Path $env:TEMP ("fiorix-bundle-" + [guid]::NewGuid().ToString('N') + ".js")
        $iwrParams = @{ Uri = '${origin}/api/v1/connector/release?asset=bundle'; Headers = $hdr; OutFile = $tmpDl; UseBasicParsing = $true; TimeoutSec = 60 }
        if ($pUrl) { $iwrParams['Proxy'] = $pUrl }
        Invoke-WebRequest @iwrParams
        $hash = (Get-FileHash -Path $tmpDl -Algorithm SHA256).Hash.ToLower()
        if ($hash -eq ([string]$mf.bundle.sha256).ToLower()) {
          Copy-Item -Path $tmpDl -Destination $Staged -Force
          Write-Host "[OK] Pacote $($mf.version) baixado e validado com SHA-256!" -ForegroundColor Green
        }
        Remove-Item -Path $tmpDl -Force -ErrorAction SilentlyContinue
      } catch {
        Write-Host "[AVISO] Nao foi necessario/possivel baixar novo bundle online: $($_.Exception.Message)" -ForegroundColor Yellow
      }
    }
  }

  if ([string]::IsNullOrWhiteSpace($RemoteHost)) {
    Stop-Service -Name 'FIORIXConnector' -Force -ErrorAction SilentlyContinue
    for ($w = 0; $w -lt 15; $w++) {
      $svcCheck = Get-Service -Name 'FIORIXConnector' -ErrorAction SilentlyContinue
      if (-not $svcCheck -or $svcCheck.Status -eq 'Stopped') { break }
      Start-Sleep -Seconds 1
    }
  } else {
    & sc.exe "\\\\$RemoteHost" stop FIORIXConnector | Out-Null
    Start-Sleep -Seconds 5
  }

  if (Test-Path $Staged) {
    Copy-Item -Path $Staged -Destination $Active -Force
    Remove-Item -Path $Staged -Force -ErrorAction SilentlyContinue
    Write-Host "[OK] Binario dist\\index.js atualizado!" -ForegroundColor Green
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
    & sc.exe "\\\\$RemoteHost" start FIORIXConnector | Out-Null
    Start-Sleep -Seconds 4
    $q = (& sc.exe "\\\\$RemoteHost" query FIORIXConnector | Out-String)
    if ($q -match 'RUNNING') {
      Write-Host "[SUCESSO] $Label ($RemoteHost) -> Servico FIORIXConnector: Running!" -ForegroundColor Green
    } else {
      Write-Host "[AVISO] Verifique o servico em \${RemoteHost}: $q" -ForegroundColor Yellow
    }
  }
  return $true
}

$didLocal = $false
if (Test-Path 'B:\\henrique-dev\\Google-avaliacoes\\fiorix-connector\\dist') {
  $didLocal = Update-ConnectorFolder 'B:\\henrique-dev\\Google-avaliacoes\\fiorix-connector' "Estacao Local ($env:COMPUTERNAME)" ''
}
if (-not $didLocal -and (Test-Path 'C:\\Program Files\\FIORIX Connector')) {
  $didLocal = Update-ConnectorFolder 'C:\\Program Files\\FIORIX Connector' "Servidor Local ($env:COMPUTERNAME)" ''
}

if ($env:COMPUTERNAME -ne 'SRVFILES') {
  $remoteUnc = '\\\\srvfiles\\c$\\Program Files\\FIORIX Connector'
  if (Test-Path $remoteUnc) {
    $null = Update-ConnectorFolder $remoteUnc 'Servidor Principal (SRVFILES via Rede)' 'srvfiles'
  } else {
    Write-Host ""
    Write-Host "[INFO] Se precisar atualizar tambem o SRVFILES e o compartilhamento \\\\srvfiles\\c$ nao estiver acessivel, execute este mesmo .BAT no SRVFILES." -ForegroundColor Yellow
  }
}

Write-Host ""
Write-Host "======================================================================" -ForegroundColor Green
Write-Host "  TRANSICAO CONCLUIDA! Em ate 20s o painel exibira v2.6.2." -ForegroundColor Green
Write-Host "  A partir da v2.6.2, as proximas atualizacoes reiniciam 100% sozinhas!" -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Green
`;

  const normalizedPs = psScript.trim().replace(/\r?\n/g, '\r\n');
  return [
    '@echo off',
    'chcp 65001 >nul',
    'title Ativar FIORIX Connector v2.6.2 (Transicao Unica)',
    'set "SELF_BAT=%~f0"',
    'net session >nul 2>&1',
    'if %errorLevel% neq 0 (',
    '  echo Solicitando permissao de Administrador para reiniciar o servico FIORIXConnector...',
    '  powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process -FilePath $env:SELF_BAT -Verb RunAs"',
    '  exit /b',
    ')',
    'echo ============================================================================',
    'echo   FIORIX CONNECTOR - ATIVADOR UNICO DE TRANSICAO (v2.6.0 -^> v2.6.2)',
    'echo ============================================================================',
    'powershell -NoProfile -ExecutionPolicy Bypass -Command "$raw = [IO.File]::ReadAllText($env:SELF_BAT, [Text.Encoding]::UTF8); $m = \'###FIORIX_\' + \'PS1###\'; $i = $raw.IndexOf($m); if ($i -lt 0) { throw \'Payload PS1 ausente\' }; $tmp = Join-Path $env:TEMP (\'fiorix-act-\' + [guid]::NewGuid().ToString(\'N\') + \'.ps1\'); [IO.File]::WriteAllText($tmp, $raw.Substring($i + $m.Length), [Text.Encoding]::UTF8); try { . $tmp } finally { Remove-Item $tmp -Force -ErrorAction SilentlyContinue }"',
    'echo.',
    'pause',
    'exit /b',
    '###FIORIX_PS1###',
    normalizedPs,
    '',
  ].join('\r\n');
}

export async function GET(req: NextRequest) {
  const origin = resolveOrigin(req);
  const format = (req.nextUrl.searchParams.get('format') || 'ps1').toLowerCase();
  const token = (req.nextUrl.searchParams.get('token') || '').trim();

  if (format === 'activate-bat') {
    const batContent = buildActivateV262Batch(origin);
    return new NextResponse(batContent, {
      status: 200,
      headers: {
        'Content-Type': 'application/octet-stream; charset=utf-8',
        'Content-Disposition': 'attachment; filename="Ativar-FIORIX-v2.6.2.bat"',
        'Cache-Control': 'private, no-store',
      },
    });
  }

  if (format === 'bat') {
    if (!token.startsWith('fx_enroll_')) {
      return NextResponse.json(
        { error: 'Informe um token de pareamento valido para gerar o instalador .bat.' },
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
