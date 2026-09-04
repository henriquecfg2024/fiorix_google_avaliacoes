import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from './prisma';

/**
 * Gera um novo secret em texto plano para o Connector.
 * O secret retornado deverá ser exibido apenas uma vez para o usuário.
 */
export function generateConnectorSecret(): string {
  // Exemplo: fiorix_conn_9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08
  const randomBytes = crypto.randomBytes(32).toString('hex');
  return `fiorix_conn_${randomBytes}`;
}

/**
 * Cria o hash bcrypt do secret para salvar no banco de dados.
 */
export async function hashConnectorSecret(secret: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(secret, salt);
}

/**
 * Verifica se um secret recebido via Authorization header (Bearer)
 * bate com o hash armazenado no banco de dados.
 */
export async function verifyConnectorSecret(secret: string, hash: string): Promise<boolean> {
  return bcrypt.compare(secret, hash);
}

/**
 * Autentica o Connector baseado no Authorization Header e connectorId.
 */
export async function authenticateConnector(connectorId: string, secret: string) {
  if (!connectorId || !secret) {
    return { success: false, error: 'Missing credentials' };
  }

  // This identifier was used by old placeholder configurations and must
  // never be allowed to create telemetry or synchronization batches.
  if (connectorId === 'substituir_pelo_id_fornecido') {
    return { success: false, error: 'Connector placeholder is disabled' };
  }

  const connector = await prisma.connector.findUnique({
    where: { id: connectorId },
    include: { tenant: true }
  });

  if (!connector) {
    return { success: false, error: 'Connector not found' };
  }

  if (!connector.enabled) {
    return { success: false, error: 'Connector is disabled' };
  }

  const isValid = await verifyConnectorSecret(secret, connector.credentialIdentifier);
  if (!isValid) {
    return { success: false, error: 'Invalid credentials' };
  }

  return { success: true, connector, tenant: connector.tenant };
}
