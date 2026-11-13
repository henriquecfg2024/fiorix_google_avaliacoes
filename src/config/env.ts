import { z } from 'zod';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';

// 1. Carrega previamente o .env base para capturar FIORIX_CONNECTOR_ENV se não estiver exportado no SO
const rootDir = process.cwd();
const envDefaultFile = path.join(rootDir, '.env');
if (fs.existsSync(envDefaultFile)) {
  dotenv.config({ path: envDefaultFile });
}

// 2. Detecta o ambiente selecionado (Prioridade: FIORIX_CONNECTOR_ENV > NODE_ENV > fallback 'homolog')
const rawEnv = (process.env.FIORIX_CONNECTOR_ENV || process.env.NODE_ENV || 'homolog').toLowerCase().trim();

let activeEnvironment: 'homolog' | 'production' = 'homolog';
if (rawEnv === 'production' || rawEnv === 'prod') {
  activeEnvironment = 'production';
} else if (rawEnv === 'homolog' || rawEnv === 'homologacao' || rawEnv === 'test' || rawEnv === 'development') {
  activeEnvironment = 'homolog';
} else {
  console.warn(`⚠️ FIORIX_CONNECTOR_ENV="${rawEnv}" não reconhecido. Aplicando fail-safe: 'homolog'.`);
  activeEnvironment = 'homolog';
}

// 3. Sobrescreve com o arquivo específico de ambiente se existir
const envSpecificFile = path.join(rootDir, `.env.${activeEnvironment}`);
if (fs.existsSync(envSpecificFile)) {
  dotenv.config({ path: envSpecificFile, override: true });
}

const envSchema = z.object({
  FIORIX_CONNECTOR_ENV: z.enum(['homolog', 'production']).default(activeEnvironment),
  FIORIX_API_URL: z.string().url(),
  CONNECTOR_ID: z.string().min(1),
  CONNECTOR_SECRET: z.string().min(1),
  SQL_SERVER_HOST: z.string().min(1),
  SQL_SERVER_DATABASE: z.string().min(1),
  SQL_SERVER_USER: z.string().min(1),
  SQL_SERVER_PASSWORD: z.string().min(1),
  SQL_SERVER_ENCRYPT: z.enum(['true', 'false']).transform((val) => val === 'true').default('false'),
  SQL_SERVER_TRUST_CERT: z.enum(['true', 'false']).transform((val) => val === 'true').default('true'),
  SYNC_INTERVAL_SECONDS: z.coerce.number().default(60),
  SHADOW_MODE: z.enum(['true', 'false']).transform((val) => val === 'true'),
  SCHEDULER_ENABLED: z.enum(['true', 'false']).transform((val) => val === 'true').default('false'),
  AUTO_SYNC_ENABLED: z.enum(['true', 'false']).transform((val) => val === 'true').default('false'),
  BI_AUTO_SYNC_ENABLED: z.enum(['true', 'false']).transform((val) => val === 'true').default('false'),
  PRODUTIVIDADE_AUTO_SYNC_ENABLED: z.enum(['true', 'false']).transform((val) => val === 'true').default('false'),
  TAREFAS_AUTO_SYNC_ENABLED: z.enum(['true', 'false']).transform((val) => val === 'true').default('false'),
  METAS_AUTO_SYNC_ENABLED: z.enum(['true', 'false']).transform((val) => val === 'true').default('false'),
  METAS_RECONCILIATION_ENABLED: z.enum(['true', 'false']).transform((val) => val === 'true').default('false'),
  RETORNOS_AUTO_SYNC_ENABLED: z.enum(['true', 'false']).transform((val) => val === 'true').default('false'),
  IMPRESSOES_AUTO_SYNC_ENABLED: z.enum(['true', 'false']).transform((val) => val === 'true').default('false'),
  BI_SYNC_INTERVAL_SECONDS: z.coerce.number().int().positive().default(60),
  PRODUTIVIDADE_SYNC_INTERVAL_SECONDS: z.coerce.number().int().positive().default(60),
  TAREFAS_SYNC_INTERVAL_SECONDS: z.coerce.number().int().positive().default(60),
  METAS_SYNC_INTERVAL_SECONDS: z.coerce.number().int().positive().default(60),
  RETORNOS_SYNC_INTERVAL_SECONDS: z.coerce.number().int().positive().default(3600),
  IMPRESSOES_SYNC_INTERVAL_SECONDS: z.coerce.number().int().positive().default(3600),
  METAS_RECONCILIATION_INTERVAL_MINUTES: z.coerce.number().int().positive().default(15),
  RECONCILIATION_INTERVAL_HOURS: z.coerce.number().int().positive().default(24),
  BI_OFFSET_SECONDS: z.coerce.number().int().nonnegative().default(0),
  PRODUTIVIDADE_OFFSET_SECONDS: z.coerce.number().int().nonnegative().default(20),
  TAREFAS_OFFSET_SECONDS: z.coerce.number().int().nonnegative().default(40),
  METAS_OFFSET_SECONDS: z.coerce.number().int().nonnegative().default(10),
  RETORNOS_OFFSET_SECONDS: z.coerce.number().int().nonnegative().default(30),
  IMPRESSOES_OFFSET_SECONDS: z.coerce.number().int().nonnegative().default(50),
  PROXY_ENABLED: z.enum(['true', 'false']).transform((val) => val === 'true').default('false'),
  PROXY_HOST: z.string().optional().default(''),
  PROXY_PORT: z.coerce.number().int().positive().default(3128),
  PROXY_USERNAME: z.string().optional().default(''),
  PROXY_PASSWORD: z.string().optional().default(''),
  CHUNK_SIZE_RECORDS: z.coerce.number().int().positive().default(500),
  INCREMENTAL_OVERLAP_MINUTES: z.coerce.number().int().nonnegative().default(5),
  RECONCILIATION_LOOKBACK_DAYS: z.coerce.number().int().positive().default(7),
});

const parsedEnv = envSchema.safeParse({
  ...process.env,
  FIORIX_CONNECTOR_ENV: activeEnvironment,
});

if (!parsedEnv.success) {
  console.error(`❌ Erro na configuração do ambiente [${activeEnvironment}] (verifique .env.${activeEnvironment} ou .env):`, parsedEnv.error.format());
  process.exit(1);
}

export const env = parsedEnv.data;
export const connectorEnv = activeEnvironment;
