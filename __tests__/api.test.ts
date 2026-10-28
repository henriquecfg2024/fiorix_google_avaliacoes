import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import { sendSyncBatch } from '../src/services/api.js';

const { mockPost } = vi.hoisted(() => {
  return { mockPost: vi.fn() };
});

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      post: mockPost
    }))
  }
}));

describe('API Sync Client', () => {
  beforeEach(() => {
    mockPost.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('1. API 200 - Sucesso', async () => {
    mockPost.mockResolvedValueOnce({ status: 200, data: { success: true, alreadyProcessed: false, recordsReceived: 2, status: 'completed' } });
    
    const result = await sendSyncBatch({ batchId: 'b1', generatedAt: new Date().toISOString(), source: 'bi', records: [{}, {}] });
    expect(result).toEqual({ status: 200, alreadyProcessed: false, recordsReceived: 2, batchStatus: 'completed' });
    expect(mockPost).toHaveBeenCalledWith('', expect.objectContaining({ batch_id: 'b1', chunk_index: 0, chunk_count: 1 }));
  });

  it('2. API 401 - Erro de Autenticação (Rejeita Credencial)', async () => {
    mockPost.mockRejectedValueOnce({
      response: { status: 401, data: {} }
    });

    await expect(sendSyncBatch({ batchId: 'b2', generatedAt: new Date().toISOString(), source: 'bi', records: [] }))
      .rejects.toThrowError('AUTH_ERROR_401');
  });

  it('3. API 403 - Tenant Incorreto', async () => {
    mockPost.mockRejectedValueOnce({
      response: { status: 403, data: {} }
    });

    await expect(sendSyncBatch({ batchId: 'b3', generatedAt: new Date().toISOString(), source: 'bi', records: [] }))
      .rejects.toThrowError('AUTH_ERROR_403');
  });

  it('4. API 500 - FIORIX Indisponível temporariamente', async () => {
    mockPost.mockRejectedValueOnce({
      response: { status: 500, data: {} }
    });

    await expect(sendSyncBatch({ batchId: 'b4', generatedAt: new Date().toISOString(), source: 'bi', records: [] }))
      .rejects.toBeDefined(); // Deve lançar o erro original para o queue manager tratar
  });

  it('5. Offline - Sem internet', async () => {
    mockPost.mockRejectedValueOnce({
      code: 'ECONNABORTED',
      message: 'Network Error'
    });

    await expect(sendSyncBatch({ batchId: 'b5', generatedAt: new Date().toISOString(), source: 'bi', records: [] }))
      .rejects.toBeDefined();
  });

  it('6. alreadyProcessed=true confirma o chunk idempotente', async () => {
    mockPost.mockResolvedValueOnce({ status: 200, data: { success: true, alreadyProcessed: true, recordsReceived: 500, status: 'partial' } });
    const result = await sendSyncBatch({ batch_id: 'b6', generated_at: new Date().toISOString(), source: 'produtividade', records: [{}], chunk_index: 0, chunk_count: 17 });
    expect(result.alreadyProcessed).toBe(true);
    expect(result.status).toBe(200);
  });
});
