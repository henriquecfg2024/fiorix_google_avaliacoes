import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock, authMock, replyToGoogleReview, revalidatePath } = vi.hoisted(() => ({
  prismaMock: {
    review: { findFirst: vi.fn(), count: vi.fn(), update: vi.fn() },
    response: { upsert: vi.fn() },
    $transaction: vi.fn(),
  },
  authMock: vi.fn(),
  replyToGoogleReview: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/auth', () => ({ auth: authMock }));
vi.mock('@/lib/google', () => ({ replyToGoogleReview }));
vi.mock('next/cache', () => ({ revalidatePath }));

import { generateAiResponse, getPendingCount, sendReviewResponse } from './reviews';

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockResolvedValue({ user: { tenantId: 't1' } });
  prismaMock.$transaction.mockImplementation(async (callback: any) => callback(prismaMock));
});

describe('generateAiResponse', () => {
  it.each([5, 4])('thanks the reviewer for a %i star review', async (rating) => {
    const text = await generateAiResponse('Ana', rating);
    expect(text).toContain('Prezado(a) Ana');
    expect(text).toContain('avaliação positiva');
  });

  it('acknowledges a neutral review', async () => {
    const text = await generateAiResponse('Ana', 3);
    expect(text).toContain('não tenha sido 100% satisfatória');
  });

  it.each([1, 2])('apologises for a %i star review', async (rating) => {
    const text = await generateAiResponse('Ana', rating);
    expect(text).toContain('lamentamos profundamente');
    expect(text).toContain('Ouvidoria');
  });
});

describe('sendReviewResponse', () => {
  it('requires a tenant scoped session', async () => {
    authMock.mockResolvedValue(null);
    await expect(sendReviewResponse('r1', 'texto')).rejects.toThrow('Não autorizado');
  });

  it('refuses reviews that are not linked to Google', async () => {
    prismaMock.review.findFirst.mockResolvedValue({ googleId: null });
    await expect(sendReviewResponse('r1', 'texto')).rejects.toThrow('Avaliação sem identificação do Google.');
  });

  it('only records the reply locally after Google accepts it', async () => {
    prismaMock.review.findFirst.mockResolvedValue({ googleId: 'g1' });
    replyToGoogleReview.mockRejectedValueOnce(new Error('Google recusou'));

    await expect(sendReviewResponse('r1', 'texto')).rejects.toThrow('Google recusou');
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });

  it('publishes to Google, upserts the response and marks the review as responded', async () => {
    prismaMock.review.findFirst.mockResolvedValue({ googleId: 'g1' });

    await sendReviewResponse('r1', 'Obrigado!');

    expect(prismaMock.review.findFirst).toHaveBeenCalledWith({
      where: { id: 'r1', tenantId: 't1' },
      select: { googleId: true },
    });
    expect(replyToGoogleReview).toHaveBeenCalledWith('t1', 'g1', 'Obrigado!');
    expect(prismaMock.response.upsert).toHaveBeenCalledWith({
      where: { reviewId: 'r1' },
      update: { content: 'Obrigado!', sentAt: expect.any(Date) },
      create: { reviewId: 'r1', content: 'Obrigado!', sentAt: expect.any(Date), isAiDraft: false },
    });
    expect(prismaMock.review.update).toHaveBeenCalledWith({ where: { id: 'r1' }, data: { status: 'RESPONDED' } });
    expect(revalidatePath).toHaveBeenCalledWith('/avaliacoes');
    expect(revalidatePath).toHaveBeenCalledWith('/dashboard');
  });
});

describe('getPendingCount', () => {
  it('returns zero without a tenant', async () => {
    authMock.mockResolvedValue({ user: {} });
    await expect(getPendingCount()).resolves.toBe(0);
    expect(prismaMock.review.count).not.toHaveBeenCalled();
  });

  it('counts only the pending reviews of the tenant', async () => {
    prismaMock.review.count.mockResolvedValue(4);
    await expect(getPendingCount()).resolves.toBe(4);
    expect(prismaMock.review.count).toHaveBeenCalledWith({ where: { tenantId: 't1', status: 'PENDING' } });
  });
});
