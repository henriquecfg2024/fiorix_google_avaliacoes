import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { AGENT_VERSION } from '../config/version.js';
import type { PendingUpdateDirective } from './runtime-directive.js';
import { downloadReleaseBundle } from './api.js';
import { logger } from '../utils/logger.js';

export type UpdateLifecycleStatus =
  | 'IDLE'
  | 'DOWNLOADING'
  | 'VERIFYING'
  | 'APPLYING'
  | 'SUCCEEDED'
  | 'ROLLED_BACK'
  | 'FAILED';

export interface PersistedUpdateStatus {
  status: UpdateLifecycleStatus;
  targetVersion: string | null;
  previousVersion: string | null;
  message: string | null;
  updatedAt: string;
}

export function computeBufferSha256(buf: Buffer): string {
  return crypto.createHash('sha256').update(buf).digest('hex').toLowerCase();
}

export function verifyBundleChecksum(buf: Buffer, expectedSha256: string): boolean {
  if (!buf || buf.length < 1024) return false;
  const normalizedExpected = (expectedSha256 || '').trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalizedExpected)) return false;
  const computedHex = computeBufferSha256(buf);
  const a = Buffer.from(computedHex, 'hex');
  const b = Buffer.from(normalizedExpected, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function buildWindowsUpdatePowerShellScript(params: {
  serviceName: string;
  rootDir: string;
  stagedBundlePath: string;
  activeBundlePath: string;
  rollbackBundlePath: string;
  statusFilePath: string;
  targetVersion: string;
  previousVersion: string;
}): string {
  const esc = (p: string) => p.replace(/'/g, "''");
  return `$ErrorActionPreference = 'Stop'
$ServiceName = '${esc(params.serviceName)}'
$RootDir = '${esc(params.rootDir)}'
$StagedFile = '${esc(params.stagedBundlePath)}'
$ActiveFile = '${esc(params.activeBundlePath)}'
$RollbackFile = '${esc(params.rollbackBundlePath)}'
$StatusFile = '${esc(params.statusFilePath)}'
$TargetVersion = '${esc(params.targetVersion)}'
$PreviousVersion = '${esc(params.previousVersion)}'

function Write-UpdateState([string]$Status, [string]$Message) {
  $obj = @{
    status = $Status
    targetVersion = $TargetVersion
    previousVersion = $PreviousVersion
    message = $Message
    updatedAt = (Get-Date).ToUniversalTime().ToString('o')
  } | ConvertTo-Json -Compress
  Set-Content -Path $StatusFile -Value $obj -Encoding UTF8 -Force
}

Start-Sleep -Seconds 2

try {
  $svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
  if ($null -ne $svc) {
    Stop-Service -Name $ServiceName -Force -ErrorAction SilentlyContinue
    $deadline = (Get-Date).AddSeconds(25)
    while (((Get-Service -Name $ServiceName).Status -ne 'Stopped') -and ((Get-Date) -lt $deadline)) {
      Start-Sleep -Milliseconds 500
    }
  }

  $rollbackDir = Split-Path -Parent $RollbackFile
  if (-not (Test-Path $rollbackDir)) {
    New-Item -ItemType Directory -Path $rollbackDir -Force | Out-Null
  }

  if (Test-Path $ActiveFile) {
    Copy-Item -Path $ActiveFile -Destination $RollbackFile -Force
  }

  Copy-Item -Path $StagedFile -Destination $ActiveFile -Force
  Remove-Item -Path $StagedFile -Force -ErrorAction SilentlyContinue

  Write-UpdateState 'APPLYING' "Binário $TargetVersion aplicado. Validando inicialização do serviço..."

  if ($null -ne $svc) {
    Start-Service -Name $ServiceName
    Start-Sleep -Seconds 12
    $afterSvc = Get-Service -Name $ServiceName
    if ($afterSvc.Status -ne 'Running') {
      throw "Serviço $ServiceName não permaneceu em estado Running após atualização (status: $($afterSvc.Status))."
    }
  }

  Write-UpdateState 'SUCCEEDED' "Atualizado automaticamente de $PreviousVersion para $TargetVersion com sucesso."
} catch {
  $errMsg = $_.Exception.Message
  try {
    if (Test-Path $RollbackFile) {
      Copy-Item -Path $RollbackFile -Destination $ActiveFile -Force
    }
    $svcRetry = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
    if ($null -ne $svcRetry) {
      Start-Service -Name $ServiceName -ErrorAction SilentlyContinue
    }
    Write-UpdateState 'ROLLED_BACK' "Falha ao ativar $TargetVersion ($errMsg). Rollback automático para $PreviousVersion concluído."
  } catch {
    Write-UpdateState 'FAILED' "Erro crítico no rollback ($errMsg)."
  }
}
`;
}

class SelfUpdaterService {
  private inProgress = false;
  private lastAttemptedVersion: string | null = null;
  private lastAttemptAtMs = 0;
  private currentState: PersistedUpdateStatus;
  private statusFilePath: string;

  constructor() {
    this.statusFilePath = path.join(process.cwd(), 'update-status.json');
    this.currentState = {
      status: 'IDLE',
      targetVersion: null,
      previousVersion: null,
      message: null,
      updatedAt: new Date().toISOString(),
    };

    if (process.env.NODE_ENV !== 'test') {
      this.reconcileBootUpdateState();
    }
  }

  private reconcileBootUpdateState() {
    try {
      if (!fs.existsSync(this.statusFilePath)) return;
      const parsed = JSON.parse(fs.readFileSync(this.statusFilePath, 'utf8')) as Partial<PersistedUpdateStatus>;
      if (!parsed || typeof parsed !== 'object') return;

      if (parsed.status === 'APPLYING' && parsed.targetVersion === AGENT_VERSION) {
        this.currentState = {
          status: 'SUCCEEDED',
          targetVersion: AGENT_VERSION,
          previousVersion: parsed.previousVersion ?? null,
          message: `Atualizado com sucesso para ${AGENT_VERSION}.`,
          updatedAt: new Date().toISOString(),
        };
        fs.writeFileSync(this.statusFilePath, JSON.stringify(this.currentState, null, 2), 'utf8');
      } else if (parsed.status) {
        this.currentState = {
          status: parsed.status,
          targetVersion: parsed.targetVersion ?? null,
          previousVersion: parsed.previousVersion ?? null,
          message: parsed.message ?? null,
          updatedAt: parsed.updatedAt || new Date().toISOString(),
        };
      }
    } catch {
      // Ignora arquivo ausente/inválido
    }
  }

  private persistState(status: UpdateLifecycleStatus, targetVersion: string | null, message: string | null) {
    this.currentState = {
      status,
      targetVersion,
      previousVersion: AGENT_VERSION,
      message,
      updatedAt: new Date().toISOString(),
    };
    if (process.env.NODE_ENV !== 'test') {
      try {
        fs.writeFileSync(this.statusFilePath, JSON.stringify(this.currentState, null, 2), 'utf8');
      } catch {
        // Não-fatal
      }
    }
  }

  public getStatusSnapshot(): PersistedUpdateStatus {
    if (process.env.NODE_ENV !== 'test') {
      this.reconcileBootUpdateState();
    }
    return { ...this.currentState };
  }

  public async handlePendingUpdate(directive: PendingUpdateDirective): Promise<boolean> {
    if (!directive?.version || !directive?.sha256) return false;
    if (directive.version === AGENT_VERSION) {
      if (this.currentState.status !== 'SUCCEEDED' || this.currentState.targetVersion !== AGENT_VERSION) {
        this.persistState('SUCCEEDED', AGENT_VERSION, `Versão ${AGENT_VERSION} em execução.`);
      }
      return false;
    }

    if (this.inProgress) return false;

    // Cooldown de 3 minutos entre tentativas da mesma versão para evitar loop em falha de rede
    const now = Date.now();
    if (this.lastAttemptedVersion === directive.version && now - this.lastAttemptAtMs < 180_000) {
      return false;
    }

    this.inProgress = true;
    this.lastAttemptedVersion = directive.version;
    this.lastAttemptAtMs = now;

    const rootDir = process.cwd();
    const distDir = path.join(rootDir, 'dist');
    const toolsDir = path.join(rootDir, 'tools');
    const stagedBundlePath = path.join(distDir, 'index.js.new');
    const activeBundlePath = path.join(distDir, 'index.js');
    const rollbackBundlePath = path.join(rootDir, 'dist.rollback', 'index.js');
    const helperScriptPath = path.join(toolsDir, 'apply-connector-update.ps1');

    try {
      logger.info(`[SELF_UPDATE] Iniciando download da versão ${directive.version} (atual: ${AGENT_VERSION})...`);
      this.persistState('DOWNLOADING', directive.version, `Baixando pacote ${directive.version} do FIORIX SaaS...`);

      const bundleBuffer = await downloadReleaseBundle(directive.bundleUrl);

      this.persistState('VERIFYING', directive.version, `Verificando assinatura SHA-256 do pacote ${directive.version}...`);
      if (!verifyBundleChecksum(bundleBuffer, directive.sha256)) {
        const actualHash = computeBufferSha256(bundleBuffer);
        const msg = `Assinatura SHA-256 inválida para ${directive.version} (esperado: ${directive.sha256.slice(0, 12)}..., obtido: ${actualHash.slice(0, 12)}...). Atualização abortada.`;
        logger.error(`[SELF_UPDATE] ${msg}`);
        this.persistState('FAILED', directive.version, msg);
        return false;
      }

      fs.mkdirSync(distDir, { recursive: true });
      fs.mkdirSync(toolsDir, { recursive: true });
      fs.writeFileSync(stagedBundlePath, bundleBuffer);

      if (process.platform !== 'win32' || process.env.NODE_ENV === 'test') {
        this.persistState('APPLYING', directive.version, `Pacote ${directive.version} validado e pronto para aplicação.`);
        return true;
      }

      const serviceName = process.env.FIORIX_WINDOWS_SERVICE_NAME || 'FIORIXConnector';
      const psScript = buildWindowsUpdatePowerShellScript({
        serviceName,
        rootDir,
        stagedBundlePath,
        activeBundlePath,
        rollbackBundlePath,
        statusFilePath: this.statusFilePath,
        targetVersion: directive.version,
        previousVersion: AGENT_VERSION,
      });

      // UTF-8 com BOM garante que o Windows PowerShell 5.1 interprete acentos sem erro de codificação
      fs.writeFileSync(helperScriptPath, '\uFEFF' + psScript, 'utf8');
      this.persistState('APPLYING', directive.version, `Reiniciando serviço Windows (${serviceName}) para ativar ${directive.version}...`);
      logger.info(`[SELF_UPDATE] Pacote ${directive.version} validado (SHA-256 OK). Acionando script de troca atômica com rollback...`);

      // IMPORTANTE (Windows + NSSM + libuv):
      // 1) Em Node.js no Windows, combinar detached:true com windowsHide:true falha em CreateProcessW.
      // 2) Quando o NSSM para o serviço (Stop-Service), ele encerra a árvore de processos filha do node.exe.
      // Por isso disparamos o script via Win32_Process.Create (WMI / WmiPrvSE.exe), totalmente fora da árvore do NSSM!
      const psExe = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
      const wmiCmdLine = `"${psExe}" -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "${helperScriptPath}"`;
      const wmiBootstrap = `Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = '${wmiCmdLine.replace(/'/g, "''")}' } | Out-Null`;

      const child = spawn(
        psExe,
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', wmiBootstrap],
        {
          cwd: rootDir,
          windowsHide: true,
          stdio: 'ignore',
        },
      );
      child.on('error', (spawnErr) => {
        logger.error(`[SELF_UPDATE] Erro ao iniciar processo auxiliar de atualização: ${spawnErr.message}`);
      });
      child.unref();
      return true;
    } catch (err: any) {
      const msg = `Falha ao baixar/preparar atualização ${directive.version}: ${err?.message || err}`;
      logger.error(`[SELF_UPDATE] ${msg}`);
      this.persistState('FAILED', directive.version, msg);
      return false;
    } finally {
      this.inProgress = false;
    }
  }
}

export const selfUpdater = new SelfUpdaterService();

