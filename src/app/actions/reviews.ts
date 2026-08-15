'use server';

import { prisma } from '@/lib/prisma';
import { requireTenant } from '@/lib/auth-helpers';
import { revalidatePath } from 'next/cache';
import { replyToGoogleReview } from '@/lib/google';

export async function generateAiResponse(
  reviewerName: string,
  rating: number,
  comment?: string | null,
  tone: 'formal' | 'empathic' | 'short' = 'formal'
) {
  const commentLower = (comment || '').toLowerCase();

  // Extract mentioned staff
  const staff = ['lucas', 'ana', 'edvan', 'juliana', 'sarah'].find((name) =>
    commentLower.includes(name)
  );
  const capitalizedStaff = staff ? staff.charAt(0).toUpperCase() + staff.slice(1) : null;

  // 1★ Critical / Delay / Problem
  if (rating <= 2) {
    if (tone === 'short') {
      return `Prezado(a) ${reviewerName}, lamentamos o transtorno. Por favor, envie seu número de protocolo para sac@7risp.com.br ou ligue (11) 3218-0527 para solucionarmos imediatamente.`;
    }
    if (tone === 'empathic') {
      return `Prezado(a) ${reviewerName}, compreendemos perfeitamente a sua frustração e pedimos sinceras desculpas pelo atraso em sua demanda. Já encaminhamos seu caso à nossa gestão de atendimento. Por favor, entre em contato com nossa equipe em sac@7risp.com.br ou pelo telefone (11) 3218-0527 informando o número da prenotação/protocolo para que possamos priorizar e resolver com a máxima agilidade.`;
    }
    // Formal (default)
    return `Prezado(a) ${reviewerName}, lamentamos formalmente a insatisfação relatada quanto ao prazo de atendimento. Informamos que o 7º Cartório de Registro de Imóveis de SP preza pela estrita observância aos prazos legais e à qualidade dos serviços. Para tratativa direta e verificação de seu protocolo, solicitamos contato via sac@7risp.com.br ou (11) 3218-0527 (site: www.7risp.com.br).`;
  }

  // 3★ Attention / Queue / Wait Time
  if (rating === 3) {
    if (commentLower.includes('fila') || commentLower.includes('espera') || commentLower.includes('demora')) {
      if (tone === 'short') {
        return `Prezado(a) ${reviewerName}, agradecemos pelo feedback. Pedimos desculpas pelo tempo de espera e já estamos reestruturando nossa recepção.`;
      }
      if (tone === 'empathic') {
        return `Prezado(a) ${reviewerName}, agradecemos sinceramente por nos alertar sobre o tempo de espera. Sabemos o quanto seu tempo é valioso e pedimos desculpas por essa fila inconveniente. Estamos implementando melhorias de triagem na recepção para tornar o atendimento mais ágil.`;
      }
      return `Prezado(a) ${reviewerName}, registramos suas observações relativas ao tempo de permanência em nossa recepção. Esclarecemos que estamos reavaliando o fluxo presencial para otimizar os tempos médios de fila. Agradecemos sua contribuição.`;
    }

    if (tone === 'short') {
      return `Prezado(a) ${reviewerName}, agradecemos sua avaliação de 3 estrelas e continuaremos aprimorando nossos serviços.`;
    }
    return `Prezado(a) ${reviewerName}, agradecemos sua avaliação. Buscamos continuamente a excelência e levaremos seu comentário em consideração nas nossas reuniões de alinhamento de equipe.`;
  }

  // 4★ and 5★ Positive
  if (capitalizedStaff) {
    if (tone === 'short') {
      return `Muito obrigado, ${reviewerName}! Ficamos felizes que o atendimento do(a) colaborador(a) ${capitalizedStaff} atendeu suas expectativas!`;
    }
    if (tone === 'empathic') {
      return `Olá, ${reviewerName}! Ficamos imensamente felizes com seu carinho! Já repassamos seu elogio diretamente ao(à) ${capitalizedStaff}, que ficou radiante com o reconhecimento. Conte sempre conosco no 7º RI SP!`;
    }
    return `Prezado(a) ${reviewerName}, muito obrigado por registrar sua avaliação positiva. Repassaremos seus elogios ao(à) escrevente ${capitalizedStaff} e a toda a equipe do 7º Cartório de Registro de Imóveis de São Paulo. Estamos sempre à disposição.`;
  }

  if (tone === 'short') {
    return `Muito obrigado pela excelente avaliação, ${reviewerName}! Estamos sempre à disposição no 7º RI SP.`;
  }
  if (tone === 'empathic') {
    return `Olá, ${reviewerName}! Que alegria receber sua nota 5 estrelas! Toda a equipe do 7º Cartório de Imóveis agradece a confiança em nosso trabalho. Um excelente dia!`;
  }
  return `Prezado(a) ${reviewerName}, agradecemos imensamente por sua avaliação 5 estrelas! Ficamos honrados em oferecer um atendimento ágil e de qualidade no 7º Cartório de Registro de Imóveis de São Paulo. Conte sempre conosco.`;
}

export async function sendReviewResponse(reviewId: string, content: string) {
  const user = await requireTenant();

  const review = await prisma.review.findFirst({
    where: { id: reviewId, tenantId: user.tenantId },
    select: { googleId: true },
  });
  if (!review?.googleId) throw new Error('Avaliação sem identificação do Google.');

  // Only mark it locally after Google accepts the reply.
  await replyToGoogleReview(user.tenantId, review.googleId, content);

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

  revalidatePath('/avaliacoes');
  revalidatePath('/dashboard');
}

export async function getPendingCount() {
  try {
    const user = await requireTenant();

    return prisma.review.count({
      where: {
        tenantId: user.tenantId,
        status: 'PENDING',
        deletedFromGoogle: false,
      }
    });
  } catch {
    return 0;
  }
}

