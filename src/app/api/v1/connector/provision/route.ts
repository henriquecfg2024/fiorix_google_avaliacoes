import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    // Provisão segura administrativa: busca o tenant da Serventia
    const tenant = await prisma.tenant.findFirst();
    if (!tenant) {
      return NextResponse.json({ error: 'Tenant não encontrado' }, { status: 404 });
    }

    const secretPlain = `fiorix_conn_${crypto.randomBytes(32).toString('hex')}`;
    const hash = await bcrypt.hash(secretPlain, 10);
    const connectorId = `conn_${crypto.randomBytes(12).toString('hex')}`;

    // Cria o conector diretamente no banco pelo contexto serverless do Next.js
    const connector = await prisma.connector.create({
      data: {
        id: connectorId,
        name: 'Connector 7º RI SP - Produção',
        enabled: true,
        tenantId: tenant.id,
        credentialIdentifier: hash,
      },
    });

    return NextResponse.json({
      success: true,
      connectorId: connector.id,
      connectorSecret: secretPlain,
      tenantName: tenant.name,
      tenantId: tenant.id,
    });
  } catch (error: any) {
    console.error('Erro no provisionamento do connector:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
