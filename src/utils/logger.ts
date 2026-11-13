import winston from 'winston';
import 'winston-daily-rotate-file';
import { connectorEnv } from '../config/env.js';

// Evita vazar segredos e credenciais nos logs
const SECRET_FIELDS = [
  'password', 'secret', 'token', 'credential', 'authorization', 'bearer',
  'api_key', 'apikey', 'private_key', 'access_token', 'refresh_token',
  // Termos em português (dados do MSSQL do cliente podem usar esses nomes)
  'senha', 'credencial', 'chave', 'cpf', 'contrato',
];

export function redactLogString(input: string): string {
  return input
    .replace(/\b(Bearer\s+)[A-Za-z0-9._~+/=-]{6,}/gi, '$1***MASKED***')
    .replace(
      /((?:https?|postgres(?:ql)?|mssql|amqp):\/\/[^:\s/@]+:)([^@\s/]+)@/gi,
      '$1***MASKED***@',
    );
}

export const maskSecrets = winston.format((info) => {
  const seen = new WeakSet<object>();

  const sanitize = (obj: Record<string, unknown> | unknown[]) => {
    if (!obj || typeof obj !== 'object') return;
    if (seen.has(obj)) return;
    seen.add(obj);

    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        const val = obj[i];
        if (typeof val === 'string') {
          obj[i] = redactLogString(val);
        } else if (val && typeof val === 'object') {
          sanitize(val as Record<string, unknown>);
        }
      }
      return;
    }

    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (SECRET_FIELDS.some((s) => key.toLowerCase().includes(s))) {
        obj[key] = '***MASKED***';
      } else if (typeof val === 'string') {
        obj[key] = redactLogString(val);
      } else if (val && typeof val === 'object') {
        sanitize(val as Record<string, unknown>);
      }
    }
  };

  sanitize(info as unknown as Record<string, unknown>);
  return info;
});

const transport = new winston.transports.DailyRotateFile({
  filename: `logs/connector-${connectorEnv}-%DATE%.log`,
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: '20m',
  maxFiles: '14d',
});

export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    maskSecrets(),
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    transport,
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});
