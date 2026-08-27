import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  const session = await auth();
  
  if (!session?.user?.tenantId) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const tenantId = session.user.tenantId as string;

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
