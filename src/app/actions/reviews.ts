'use server';

import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { revalidatePath } from 'next/cache';
import { replyToGoogleReview } from '@/lib/google';
import { describeError } from '@/lib/errors';

export async function generateAiResponse(reviewerName: string, rating: number, comment?: string | null) {
  // Formal cartório response templates tailored by rating
  if (rating >= 4) {
    return `Prezado(a) ${reviewerName}, muito obrigado pela sua avaliação positiva! Ficamos extremamente felizes em oferecer um atendimento de excelência no 7º Cartório de Registro de Imóveis de São Paulo. Estamos sempre à disposição!`;
  } else if (rating === 3) {
    return `Prezado(a) ${reviewerName}, agradecemos o seu feedback. Lamento que sua experiência em nosso cartório não tenha sido 100% satisfatória. Estamos trabalhando continuamente na otimização de nossos processos e atendimento para reduzir o tempo de espera.`;
  } else {
    return `Prezado(a) ${reviewerName}, lamentamos profundamente o transtorno ocorrido em seu atendimento. Levaremos seus comentários à nossa gestão para correção imediata. Por favor, entre em contato diretamente com nossa Ouvidoria para que possamos auxiliar na sua demanda.`;
  }
}

export type SendReviewResponseResult = { success: true } | { success: false; error: string };

/**
 * Returns the failure reason instead of throwing: Next.js redacts Server Action
 * exceptions in production, which would hide the Google/database message.
 */
export async function sendReviewResponse(reviewId: string, content: string): Promise<SendReviewResponseResult> {
  const session = await auth();
  if (!session?.user?.tenantId) return { success: false, error: 'Não autorizado' };

  try {
    const review = await prisma.review.findFirst({
      where: { id: reviewId, tenantId: session.user.tenantId },
      select: { googleId: true },
    });
    if (!review?.googleId) return { success: false, error: 'Avaliação sem identificação do Google.' };

    // Only mark it locally after Google accepts the reply.
    await replyToGoogleReview(session.user.tenantId, review.googleId, content);

    await prisma.$transaction(async (tx) => {
      // 1. Create or update Response record
      await tx.response.upsert({
        where: { reviewId },
        update: { content, sentAt: new Date() },
        create: {
          reviewId,
          content,
          sentAt: new Date(),
          isAiDraft: false
        }
      });

      // 2. Mark review status as RESPONDED
      await tx.review.update({
        where: { id: reviewId },
        data: { status: 'RESPONDED' }
      });
    });
  } catch (error) {
    return {
      success: false,
      error: describeError('reviews:sendReviewResponse', error, 'Não foi possível publicar a resposta no Google.'),
    };
  }

  revalidatePath('/avaliacoes');
  revalidatePath('/dashboard');

  return { success: true };
}

export async function getPendingCount() {
  const session = await auth();
  if (!session?.user?.tenantId) return 0;

  return prisma.review.count({
    where: {
      tenantId: session.user.tenantId,
      status: 'PENDING'
    }
  });
}
