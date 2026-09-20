import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { prisma } from '@/lib/prisma';
import { getRequestIp } from '@/lib/security/requestIp';

export const dynamic = 'force-dynamic';

const MAX_DEVICES_PER_USER = 10;

// POST: Registra ou reativa uma Push Subscription
export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await req.json();

    const { endpoint, p256dh, auth: authKey, deviceName, userAgent } = body;

    if (!endpoint || !p256dh || !authKey) {
      return NextResponse.json(
        { error: 'Dados da inscrição incompletos (endpoint, p256dh, auth são obrigatórios).' },
        { status: 400 }
      );
    }

    const ipAddress = getRequestIp(req);

    // 1. Verifica se já existe essa subscription
    const existing = await prisma.pushSubscription.findUnique({
      where: { endpoint },
    });

    if (existing) {
      const updated = await prisma.pushSubscription.update({
        where: { id: existing.id },
        data: {
          usuarioId: user.id,
          tenantId: user.tenantId,
          p256dh,
          auth: authKey,
          deviceName: deviceName || existing.deviceName,
          userAgent: userAgent || req.headers.get('user-agent') || existing.userAgent,
          ipAddress,
          isActive: true,
          revokedAt: null,
          lastUsedAt: new Date(),
        },
      });

      return NextResponse.json({ success: true, subscriptionId: updated.id });
    }

    // 2. Verifica cota de dispositivos ativos do usuário
    const activeCount = await prisma.pushSubscription.count({
      where: { usuarioId: user.id, isActive: true },
    });

    if (activeCount >= MAX_DEVICES_PER_USER) {
      // Revoga automaticamente o dispositivo mais antigo
      const oldest = await prisma.pushSubscription.findFirst({
        where: { usuarioId: user.id, isActive: true },
        orderBy: { lastUsedAt: 'asc' },
      });

      if (oldest) {
        await prisma.pushSubscription.update({
          where: { id: oldest.id },
          data: { isActive: false, revokedAt: new Date() },
        });
      }
    }

    // 3. Cria a nova subscription
    const created = await prisma.pushSubscription.create({
      data: {
        tenantId: user.tenantId,
        usuarioId: user.id,
        endpoint,
        p256dh,
        auth: authKey,
        deviceName: deviceName || 'Navegador Web',
        userAgent: userAgent || req.headers.get('user-agent'),
        ipAddress,
        isActive: true,
      },
    });

    // 4. Auditoria imutável
    await prisma.messagingAuditLog.create({
      data: {
        tenantId: user.tenantId,
        actorUserId: user.id,
        action: 'REGISTER_DEVICE_PUSH',
        targetType: 'DEVICE',
        targetId: created.id,
        metadata: { deviceName: created.deviceName },
        ipAddress,
        userAgent: created.userAgent,
      },
    });

    return NextResponse.json({ success: true, subscriptionId: created.id }, { status: 201 });
  } catch (error: any) {
    console.error('[API /push/subscribe POST] Erro:', error);
    return NextResponse.json(
      { error: error?.message || 'Falha ao registrar subscription' },
      { status: error?.message?.includes('Não autorizado') ? 401 : 500 }
    );
  }
}

// DELETE: Revoga uma Push Subscription
export async function DELETE(req: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await req.json();
    const { endpoint, subscriptionId } = body;

    if (!endpoint && !subscriptionId) {
      return NextResponse.json(
        { error: 'Informe endpoint ou subscriptionId para revogação.' },
        { status: 400 }
      );
    }

    const sub = await prisma.pushSubscription.findFirst({
      where: {
        ...(subscriptionId ? { id: subscriptionId } : { endpoint }),
        usuarioId: user.id,
        tenantId: user.tenantId,
      },
    });

    if (!sub) {
      return NextResponse.json(
        { error: 'Dispositivo ou inscrição não encontrada.' },
        { status: 404 }
      );
    }

    await prisma.pushSubscription.update({
      where: { id: sub.id },
      data: {
        isActive: false,
        revokedAt: new Date(),
      },
    });

    const ipAddress = getRequestIp(req);
    await prisma.messagingAuditLog.create({
      data: {
        tenantId: user.tenantId,
        actorUserId: user.id,
        action: 'REVOKE_DEVICE_PUSH',
        targetType: 'DEVICE',
        targetId: sub.id,
        metadata: { deviceName: sub.deviceName },
        ipAddress,
        userAgent: req.headers.get('user-agent'),
      },
    });

    return NextResponse.json({ success: true, message: 'Inscrição de notificações revogada com sucesso.' });
  } catch (error: any) {
    console.error('[API /push/subscribe DELETE] Erro:', error);
    return NextResponse.json(
      { error: error?.message || 'Falha ao revogar subscription' },
      { status: 500 }
    );
  }
}

// GET: Lista dispositivos conectados do próprio usuário
export async function GET() {
  try {
    const user = await requireAuth();

    const devices = await prisma.pushSubscription.findMany({
      where: {
        usuarioId: user.id,
        tenantId: user.tenantId,
      },
      select: {
        id: true,
        deviceName: true,
        userAgent: true,
        isActive: true,
        createdAt: true,
        lastUsedAt: true,
        revokedAt: true,
      },
      orderBy: { lastUsedAt: 'desc' },
    });

    return NextResponse.json({ devices });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Não autorizado' },
      { status: 401 }
    );
  }
}
