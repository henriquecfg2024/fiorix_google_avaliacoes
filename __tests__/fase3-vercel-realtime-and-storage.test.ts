import fs from 'node:fs';
import axios from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { uploadBinaryToSignedUrl } from '../src/services/api.js';
import {
  RealtimeWakeupClient,
  sanitizeRealtimeLogText,
  type MinimalWebSocket,
} from '../src/services/realtime-wakeup-client.js';
import { runtimeDirective, type RealtimeWakeupDirective } from '../src/services/runtime-directive.js';

class FakeWebSocket implements MinimalWebSocket {
  public readyState = 0;
  public binaryType = 'blob';
  public readonly sent: string[] = [];
  public closedWith: { code?: number; reason?: string } | null = null;
  public onopen: ((ev: unknown) => void) | null = null;
  public onmessage: ((ev: { data: unknown }) => void) | null = null;
  public onerror: ((ev: unknown) => void) | null = null;
  public onclose: ((ev: unknown) => void) | null = null;

  public send(data: string): void {
    this.sent.push(data);
  }

  public close(code?: number, reason?: string): void {
    this.readyState = 3;
    this.closedWith = { code, reason };
    this.onclose?.({});
  }

  public emitOpen(): void {
    this.readyState = 1;
    this.onopen?.({});
  }

  public emitMessage(data: unknown): void {
    this.onmessage?.({ data });
  }
}

describe('Fase 3 Vercel — Realtime Wakeup & Direct Signed Storage Upload', () => {
  const sampleCfg: RealtimeWakeupDirective = {
    enabled: true,
    supabaseUrl: 'https://demo-proj.supabase.co/',
    supabaseAnonKey: 'anon-public-key-xyz',
    channelTopic: 'connector_doc_wake_1234567890abcdef',
    event: 'job_queued',
  };

  beforeEach(() => {
    runtimeDirective.resetForTests();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('1. RealtimeWakeupClient conecta via wss, envia phx_join, heartbeat e reage a broadcast JSON e binário (kind=4)', () => {
    vi.useFakeTimers();
    const sockets: Array<{ url: string; ws: FakeWebSocket }> = [];
    const onWakeup = vi.fn();

    const client = new RealtimeWakeupClient({
      onWakeup,
      heartbeatMs: 25_000,
      wsFactory: (url) => {
        const ws = new FakeWebSocket();
        sockets.push({ url, ws });
        return ws;
      },
    });

    client.configure(sampleCfg);
    expect(sockets).toHaveLength(1);
    expect(sockets[0].url).toBe(
      'wss://demo-proj.supabase.co/realtime/v1/websocket?apikey=anon-public-key-xyz&vsn=2.0.0',
    );

    const ws = sockets[0].ws;
    ws.emitOpen();
    expect(ws.binaryType).toBe('arraybuffer');
    expect(ws.sent).toHaveLength(1);
    const joinFrame = JSON.parse(ws.sent[0]) as unknown[];
    expect(joinFrame[2]).toBe(`realtime:${sampleCfg.channelTopic}`);
    expect(joinFrame[3]).toBe('phx_join');

    expect(client.isConnected()).toBe(false);
    ws.emitMessage(
      JSON.stringify(['1', '1', `realtime:${sampleCfg.channelTopic}`, 'phx_reply', { status: 'ok' }]),
    );
    expect(client.isConnected()).toBe(true);

    // Heartbeat a cada 25s
    vi.advanceTimersByTime(25_000);
    expect(ws.sent.length).toBeGreaterThanOrEqual(2);
    const hbFrame = JSON.parse(ws.sent[1]) as unknown[];
    expect(hbFrame[2]).toBe('phoenix');
    expect(hbFrame[3]).toBe('heartbeat');

    // Broadcast JSON dispara wakeup; evento diferente e ignorado
    ws.emitMessage(
      JSON.stringify(['1', null, `realtime:${sampleCfg.channelTopic}`, 'broadcast', { event: 'other_evt' }]),
    );
    expect(onWakeup).toHaveBeenCalledTimes(0);

    ws.emitMessage(
      JSON.stringify(['1', null, `realtime:${sampleCfg.channelTopic}`, 'broadcast', { event: 'job_queued' }]),
    );
    expect(onWakeup).toHaveBeenCalledTimes(1);

    // Broadcast binario Phoenix v2 kind=4
    const topicBytes = Buffer.from(sampleCfg.channelTopic, 'utf8');
    const eventBytes = Buffer.from('job_queued', 'utf8');
    const payloadBytes = Buffer.from('{"ts":1}', 'utf8');
    const header = Buffer.from([4, topicBytes.length, eventBytes.length, 0, 1]);
    const binaryFrame = Buffer.concat([header, topicBytes, eventBytes, payloadBytes]);
    ws.emitMessage(binaryFrame.buffer.slice(binaryFrame.byteOffset, binaryFrame.byteOffset + binaryFrame.byteLength));
    expect(onWakeup).toHaveBeenCalledTimes(2);

    client.stop();
    expect(client.isConnected()).toBe(false);
    expect(ws.closedWith).not.toBeNull();
  });

  it('2. sanitizeRealtimeLogText remove apikey e token de URLs e mensagens', () => {
    const cleaned = sanitizeRealtimeLogText(
      'wss://abc.supabase.co/realtime/v1/websocket?apikey=super-secret-anon&vsn=2.0.0 failed token=xyz123',
    );
    expect(cleaned).not.toContain('super-secret-anon');
    expect(cleaned).not.toContain('xyz123');
    expect(cleaned).toContain('[redacted]');
  });

  it('3. RuntimeDirectiveManager mantém realtimeWakeup estritamente em RAM e nunca grava supabaseAnonKey no cache em disco', () => {
    const prevNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const writeSpy = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => undefined);

    try {
      runtimeDirective.applyDirective({
        operationalState: 'ACTIVE',
        role: 'PRIMARY',
        shouldRunSqlSync: true,
        shouldRunDocumentWorker: true,
        configVersion: 77,
        remoteConfig: { lanUrl: 'http://srvfiles:8765' },
        realtimeWakeup: {
          enabled: true,
          supabaseUrl: 'https://demo-proj.supabase.co/',
          supabaseAnonKey: 'ram-only-anon-key-secret',
          channelTopic: 'connector_doc_wake_abcdef',
          event: 'job_queued',
        },
      });

      expect(runtimeDirective.getRealtimeWakeup()).toEqual({
        enabled: true,
        supabaseUrl: 'https://demo-proj.supabase.co',
        supabaseAnonKey: 'ram-only-anon-key-secret',
        channelTopic: 'connector_doc_wake_abcdef',
        event: 'job_queued',
      });

      expect(writeSpy).toHaveBeenCalledTimes(1);
      const writtenJson = String(writeSpy.mock.calls[0]?.[1] || '');
      expect(writtenJson).toContain('http://srvfiles:8765');
      expect(writtenJson).not.toContain('ram-only-anon-key-secret');
      expect(writtenJson).not.toContain('realtimeWakeup');

      runtimeDirective.applyDirective({
        operationalState: 'STANDBY',
        role: 'SECONDARY',
        shouldRunSqlSync: false,
        shouldRunDocumentWorker: false,
        configVersion: 77,
      });
      expect(runtimeDirective.getRealtimeWakeup()).toBeNull();
    } finally {
      process.env.NODE_ENV = prevNodeEnv;
    }
  });

  it('4. uploadBinaryToSignedUrl envia PUT binario sem Authorization do Connector e sanitiza token em erros', async () => {
    const putSpy = vi.spyOn(axios, 'put').mockResolvedValue({ status: 200 } as never);
    const signedUrl = 'https://demo-proj.supabase.co/storage/v1/upload/sign/bucket/obj.pdf?token=signed-jwt-123';
    const payload = Buffer.from('%PDF-1.7 sample');

    await uploadBinaryToSignedUrl(signedUrl, payload, 'application/pdf');

    expect(putSpy).toHaveBeenCalledTimes(1);
    const [calledUrl, calledBody, calledCfg] = putSpy.mock.calls[0]!;
    expect(calledUrl).toBe(signedUrl);
    expect(Buffer.isBuffer(calledBody)).toBe(true);
    const headers = (calledCfg?.headers ?? {}) as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/pdf');
    expect(headers['x-upsert']).toBe('true');
    expect(headers['Authorization']).toBeUndefined();
    expect(headers['authorization']).toBeUndefined();
    expect(headers['x-connector-id']).toBeUndefined();

    putSpy.mockRejectedValueOnce(new Error(`Request failed on ${signedUrl}`));
    await expect(uploadBinaryToSignedUrl(signedUrl, payload, 'application/pdf')).rejects.toThrow(
      /\[redacted\]/,
    );
  });
});

