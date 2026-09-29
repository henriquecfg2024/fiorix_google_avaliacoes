import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { prisma } from '@/lib/prisma';
import { sendWebPushNotification, isWebPushAvailable } from '@/lib/webpush';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const user = await requireAuth();

    const vapidOk = isWebPushAvailable();

    const activeSubs = await prisma.pushSubscription.findMany({
      where: {
        usuarioId: user.id,
        tenantId: user.tenantId,
        isActive: true,
      },
    });

    if (!vapidOk) {
      return NextResponse.json(
        {
          error: 'VAPID keys não configuradas no servidor. Notificações Web Push estão desabilitadas.',
          diagnostic: { vapidAvailable: false, subscriptions: activeSubs.length },
        },
        { status: 500 }
      );
    }

    if (activeSubs.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum dispositivo com Web Push ativo encontrado para este usuário. Ative as notificações no navegador primeiro.' },
        { status: 400 }
      );
    }

    const results: {
      id: string;
      deviceName: string | null;
      endpoint: string;
      isApple: boolean;
      success: boolean;
      error?: string;
    }[] = [];

    for (const sub of activeSubs) {
      const isApple = sub.endpoint.includes('web.push.apple.com');
      const result = await sendWebPushNotification(sub, {
        title: 'FIORIX — Teste de Notificação',
        body: 'Seu dispositivo está configurado e pronto para receber mensagens corporativas em tempo real!',
        icon: '/icon-192.svg',
        tag: 'push_test',
        data: {
          url: '/minha-conta',
          timestamp: Date.now(),
        },
      });

      results.push({
        id: sub.id,
        deviceName: sub.deviceName,
        endpoint: `${sub.endpoint.substring(0, 60)}...`,
        isApple,
        success: result.success,
        error: result.error,
      });
    }

    const successCount = results.filter((r) => r.success).length;
    const failedCount = results.filter((r) => !r.success).length;

    return NextResponse.json({
      success: successCount > 0,
      sent: successCount,
      failed: failedCount,
      total: activeSubs.length,
      vapidAvailable: true,
      details: results,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Erro ao enviar notificação de teste' },
      { status: 500 }
    );
  }
}
