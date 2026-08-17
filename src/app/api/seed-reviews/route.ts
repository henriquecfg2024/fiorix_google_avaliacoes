import { NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth-helpers';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  // Restringir a ambiente de desenvolvimento apenas
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'Esta rota está disponível apenas em ambiente de desenvolvimento.' },
      { status: 403 }
    );
  }

  const user = await requireRole('MASTER');
  const tenantId = user.tenantId;

  const sampleReviews = [
    {
      reviewerName: 'Walquiron Alves',
      rating: 5,
      comment: 'Excelente atendimento, Sr. Lucas esclareceu as dúvidas, só tenho a agradecer!!!',
      publishedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      status: 'RESPONDED' as const,
    },
    {
      reviewerName: 'Glória Gomes',
      rating: 5,
      comment: 'Gostaria de registrar meu agradecimento pelo excelente atendimento prestado pela Ana.',
      publishedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
      status: 'RESPONDED' as const,
    },
    {
      reviewerName: 'Maria Santos',
      rating: 3,
      comment: 'Atendimento ok mas a fila estava absurda. Esperei 1h20min para ser chamado.',
      publishedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
      status: 'PENDING' as const,
    },
    {
      reviewerName: 'Carlos Mendonça',
      rating: 5,
      comment: 'Muito rápido e eficiente. Atendimento nota 10!',
      publishedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      status: 'RESPONDED' as const,
    },
    {
      reviewerName: 'Fernanda Lima',
      rating: 1,
      comment: 'Demora excessiva para retirar certidão e sistema fora do ar.',
      publishedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      status: 'PENDING' as const,
    }
  ];

  for (const item of sampleReviews) {
    await prisma.review.create({
      data: {
        tenantId,
        reviewerName: item.reviewerName,
        rating: item.rating,
        comment: item.comment,
        publishedAt: item.publishedAt,
        status: item.status,
      }
    });
  }

  return NextResponse.redirect(new URL('/dashboard?synced=5', request.url));
}
