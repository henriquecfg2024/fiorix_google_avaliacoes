import { NextResponse } from 'next/server';
import { authenticateConnector } from '@/lib/connectorAuth';
import { z } from 'zod';

const statusPayloadSchema = z.object({
  connectorId: z.string().min(1),
  version: z.string().optional(),
  timestamp: z.string().optional(),
  status: z.string().optional(),
  uptimeSeconds: z.number().optional(),
  shadowMode: z.boolean().optional(),
  queuePending: z.number().optional(),
  queueFailed: z.number().optional(),
  schedulerEnabled: z.boolean().optional(),
  sources: z.record(z.any()).optional(),
});

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing or invalid Authorization header' }, { status: 401 });
    }

    const secret = authHeader.replace('Bearer ', '').trim();

    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 });
    }

    const parsed = statusPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid payload schema', details: parsed.error.errors }, { status: 400 });
    }

    const { connectorId } = parsed.data;

    // Authenticate connector and derive tenant from database authority
    const authResult = await authenticateConnector(connectorId, secret);
    if (!authResult.success || !authResult.connector || !authResult.tenant) {
      return NextResponse.json({ error: 'Unauthorized: Invalid credentials or connector' }, { status: 401 });
    }

    return NextResponse.json({
      ok: true,
      receivedAt: new Date().toISOString(),
      connectorId: authResult.connector.id,
      tenantId: authResult.tenant.id,
    }, { status: 200 });
  } catch (err: any) {
    return NextResponse.json({ error: 'Internal server error', message: err.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method Not Allowed' }, { status: 405 });
}
