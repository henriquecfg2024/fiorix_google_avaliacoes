import winston from 'winston';
import 'winston-daily-rotate-file';
import { connectorEnv } from '../config/env.js';

// Evita vazar segredos e credenciais nos logs
const maskSecrets = winston.format((info) => {
  const secretFields = [
    'password', 'secret', 'token', 'credential', 'authorization', 'bearer',
    'api_key', 'apikey', 'private_key', 'access_token', 'refresh_token',
    // Termos em português (dados do MSSQL do cliente podem usar esses nomes)
    'senha', 'credencial', 'chave', 'cpf', 'contrato',
  ];
  
  const sanitize = (obj: any) => {
    if (!obj || typeof obj !== 'object') return;
    for (const key of Object.keys(obj)) {
      if (secretFields.some(s => key.toLowerCase().includes(s))) {
        obj[key] = '***MASKED***';
      } else if (typeof obj[key] === 'object') {
        sanitize(obj[key]);
      }
    }
  };

  sanitize(info);
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
