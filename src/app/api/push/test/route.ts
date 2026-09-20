import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-helpers';
import { prisma } from '@/lib/prisma';
import { sendWebPushNotification } from '@/lib/webpush';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const user = await requireAuth();

    const activeSubs = await prisma.pushSubscription.findMany({
      where: {
        usuarioId: user.id,
        tenantId: user.tenantId,
        isActive: true,
      },
    });

    if (activeSubs.length === 0) {
      return NextResponse.json(
        { error: 'Nenhum dispositivo com Web Push ativo encontrado para este usuário. Ative as notificações no navegador primeiro.' },
        { status: 400 }
      );
    }

    let successCount = 0;
    let failedCount = 0;

    for (const sub of activeSubs) {
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

      if (result.success) {
        successCount++;
      } else {
        failedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      sent: successCount,
      failed: failedCount,
      total: activeSubs.length,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Erro ao enviar notificação de teste' },
      { status: 500 }
    );
  }
}
