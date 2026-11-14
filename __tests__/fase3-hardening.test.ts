import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AGENT_VERSION } from '../src/config/version';
import { initializeCheckpointSchema } from '../src/db/checkpoint';
import { initializeChunkSchema } from '../src/services/chunkRetry';
import { sanitizeLanFileServerUrl } from '../src/services/document-file-server';
import { HealthManager } from '../src/services/health';
import { computeBufferSha256, verifyBundleChecksum } from '../src/services/self-updater';

describe('Fase 3 Hardening — Healthcheck Completo, LAN URL, SQL Encrypt e Constant-Time Updater (LOW-02 & LOW-04)', () => {
  let db: DatabaseSync;
  const savedCvEnv = process.env.CARTORIO_VIRTUAL_SQL_ENABLED;

  beforeEach(() => {
    db = new DatabaseSync(':memory:');
    initializeCheckpointSchema(db);
    initializeChunkSchema(db);
    db.exec(`
      CREATE TABLE IF NOT EXISTS sync_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source TEXT NOT NULL,
        batch_id TEXT UNIQUE NOT NULL,
        generated_at TEXT NOT NULL,
        payload TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        attempts INTEGER NOT NULL DEFAULT 0,
        next_retry_at TEXT NOT NULL,
        last_error TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
  });

  afterEach(() => {
    vi.useRealTimers();
    if (savedCvEnv === undefined) delete process.env.CARTORIO_VIRTUAL_SQL_ENABLED;
    else process.env.CARTORIO_VIRTUAL_SQL_ENABLED = savedCvEnv;
  });

  it('atualiza AGENT_VERSION para v2.6.13', () => {
    expect(AGENT_VERSION).toBe('v2.6.13');
  });

  it('LOW-02: monitora staleness e falhas consecutivas de colaboradores_rh e cartorio_virtual_certidoes', () => {
    process.env.CARTORIO_VIRTUAL_SQL_ENABLED = 'true';
    const health = new HealthManager();

    expect(health.getHealth(db).sources.colaboradores_rh.staleThresholdSec).toBe(7200);
    expect(health.getHealth(db).sources.cartorio_virtual_certidoes.staleThresholdSec).toBe(900);

    // 1. Atraso em colaboradores_rh degrada o status global do conector
    health.setStaleThreshold('colaboradores_rh', 2);
    health.recordRunSuccess('colaboradores_rh', 20, 20, 100, 'rh-batch-1');
    vi.setSystemTime(new Date(Date.now() + 5_000));

    const degradedRh = health.getHealth(db);
    expect(degradedRh.sources.colaboradores_rh.isStale).toBe(true);
    expect(degradedRh.connectorStatus).toBe('degraded');
    vi.useRealTimers();

    // 2. 5 falhas consecutivas em cartorio_virtual_certidoes marcam o conector como unhealthy
    const healthCv = new HealthManager();
    for (let i = 0; i < 5; i++) {
      healthCv.recordRunFailure('cartorio_virtual_certidoes', 'SQL timeout', 150);
    }
    const unhealthyCv = healthCv.getHealth(db);
    expect(unhealthyCv.sources.cartorio_virtual_certidoes.consecutiveFailures).toBe(5);
    expect(unhealthyCv.connectorStatus).toBe('unhealthy');
  });

  it('LOW-02: não gera falso-positivo de staleness em cartorio_virtual_certidoes quando o módulo SQL opcional está inativo', () => {
    delete process.env.CARTORIO_VIRTUAL_SQL_ENABLED;
    const health = new HealthManager();
    health.setStaleThreshold('cartorio_virtual_certidoes', 1);
    // Mantém as 8 fontes obrigatórias frescas para isolar cartorio_virtual_certidoes
    const nowPlus = new Date(Date.now() + 5_000);
    for (const src of ['bi', 'produtividade', 'tarefas', 'metas', 'retornos', 'impressoes', 'safras', 'colaboradores_rh'] as const) {
      health.recordRunSuccess(src, 1, 1, 10, `b-${src}`, nowPlus);
    }
    vi.setSystemTime(nowPlus);

    const status = health.getHealth(db);
    expect(status.sources.cartorio_virtual_certidoes.isStale).toBe(false);
    expect(status.connectorStatus).toBe('healthy');
  });

  it('LOW-04: sanitizeLanFileServerUrl aceita apenas origens HTTP/HTTPS limpas sem credenciais', () => {
    expect(sanitizeLanFileServerUrl('http://192.168.1.50:8765/qualquer/caminho?x=1')).toBe(
      'http://192.168.1.50:8765'
    );
    expect(sanitizeLanFileServerUrl('https://files.cartorio.local:8765/')).toBe(
      'https://files.cartorio.local:8765'
    );
    expect(sanitizeLanFileServerUrl('javascript:alert(1)', 'http://localhost:8765')).toBe(
      'http://localhost:8765'
    );
    expect(sanitizeLanFileServerUrl('file:///C:/Windows/System32', 'http://localhost:8765')).toBe(
      'http://localhost:8765'
    );
    expect(
      sanitizeLanFileServerUrl('http://admin:secret@192.168.1.50:8765', 'http://localhost:8765')
    ).toBe('http://localhost:8765');
  });

  it('LOW-04: verifyBundleChecksum valida SHA-256 com crypto.timingSafeEqual e mssql parametriza SQL_SERVER_ENCRYPT', () => {
    const payload = crypto.randomBytes(2048);
    const digest = computeBufferSha256(payload);

    expect(verifyBundleChecksum(payload, digest)).toBe(true);
    expect(verifyBundleChecksum(payload, digest.toUpperCase())).toBe(true);
    expect(
      verifyBundleChecksum(
        payload,
        digest.slice(0, -2) + (digest.endsWith('00') ? 'ff' : '00')
      )
    ).toBe(false);

    const updaterSrc = fs.readFileSync(
      path.resolve(__dirname, '../src/services/self-updater.ts'),
      'utf8'
    );
    const mssqlSrc = fs.readFileSync(
      path.resolve(__dirname, '../src/db/mssql.ts'),
      'utf8'
    );
    const certidoesSrc = fs.readFileSync(
      path.resolve(__dirname, '../src/db/certidoes-readonly.ts'),
      'utf8'
    );

    expect(updaterSrc).toContain('crypto.timingSafeEqual');
    expect(mssqlSrc).toContain('SQL_SERVER_ENCRYPT');
    expect(certidoesSrc).toContain('SQL_SERVER_ENCRYPT');
  });
});

