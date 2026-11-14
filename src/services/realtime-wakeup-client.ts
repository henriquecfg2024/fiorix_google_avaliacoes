import { logger } from '../utils/logger.js';
import type { RealtimeWakeupDirective } from './runtime-directive.js';

export interface MinimalWebSocket {
  readyState: number;
  binaryType?: string;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  addEventListener?(type: string, listener: (event: any) => void): void;
  removeEventListener?(type: string, listener: (event: any) => void): void;
  onopen?: ((event: any) => void) | null;
  onmessage?: ((event: any) => void) | null;
  onerror?: ((event: any) => void) | null;
  onclose?: ((event: any) => void) | null;
}

export type WebSocketFactory = (url: string) => MinimalWebSocket;

export interface RealtimeWakeupClientOptions {
  onWakeup: () => void;
  wsFactory?: WebSocketFactory;
  heartbeatMs?: number;
}

const RECONNECT_DELAYS_MS = [1000, 2000, 5000, 15000, 30000] as const;
const DEFAULT_HEARTBEAT_MS = 25_000;
const WS_CONNECTING = 0;
const WS_OPEN = 1;

function defaultWebSocketFactory(url: string): MinimalWebSocket {
  const Ctor = (globalThis as unknown as { WebSocket?: new (targetUrl: string) => MinimalWebSocket }).WebSocket;
  if (typeof Ctor !== 'function') {
    throw new Error('Global WebSocket indisponivel no runtime Node atual.');
  }
  return new Ctor(url);
}

export function sanitizeRealtimeLogText(input: string): string {
  return String(input || '')
    .replace(/(\b(?:apikey|token|access_token|secret)=)[^&\s"']+/gi, '$1[redacted]')
    .replace(/(wss?:\/\/[^\s?]+)\?[^\s"']+/gi, '$1?[redacted]');
}

function buildRealtimeWebSocketUrl(cfg: RealtimeWakeupDirective): string {
  const cleanBase = cfg.supabaseUrl.trim().replace(/\/+$/, '').replace(/^http/i, 'ws');
  return `${cleanBase}/realtime/v1/websocket?apikey=${encodeURIComponent(cfg.supabaseAnonKey)}&vsn=2.0.0`;
}

function toBuffer(raw: unknown): Buffer | null {
  if (raw === null || raw === undefined) return null;
  if (Buffer.isBuffer(raw)) return raw;
  if (raw instanceof ArrayBuffer) return Buffer.from(raw);
  if (ArrayBuffer.isView(raw)) {
    return Buffer.from(raw.buffer, raw.byteOffset, raw.byteLength);
  }
  return null;
}

function sameWakeupConfig(a: RealtimeWakeupDirective | null, b: RealtimeWakeupDirective | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.enabled === b.enabled &&
    a.supabaseUrl === b.supabaseUrl &&
    a.supabaseAnonKey === b.supabaseAnonKey &&
    a.channelTopic === b.channelTopic &&
    a.event === b.event
  );
}

export class RealtimeWakeupClient {
  private readonly onWakeup: () => void;
  private readonly wsFactory: WebSocketFactory;
  private readonly heartbeatMs: number;

  private currentConfig: RealtimeWakeupDirective | null = null;
  private ws: MinimalWebSocket | null = null;
  private connected = false;
  private stopped = false;
  private reconnectAttempt = 0;
  private refCounter = 1;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: RealtimeWakeupClientOptions) {
    this.onWakeup = options.onWakeup;
    this.wsFactory = options.wsFactory ?? defaultWebSocketFactory;
    this.heartbeatMs = options.heartbeatMs ?? DEFAULT_HEARTBEAT_MS;
  }

  public isConnected(): boolean {
    return this.connected;
  }

  public configure(cfg: RealtimeWakeupDirective | null): void {
    if (this.stopped) return;
    const normalized =
      cfg &&
      cfg.enabled &&
      cfg.supabaseUrl.trim() &&
      cfg.supabaseAnonKey.trim() &&
      cfg.channelTopic.trim() &&
      cfg.event.trim()
        ? {
            enabled: true,
            supabaseUrl: cfg.supabaseUrl.trim().replace(/\/+$/, ''),
            supabaseAnonKey: cfg.supabaseAnonKey.trim(),
            channelTopic: cfg.channelTopic.trim(),
            event: cfg.event.trim(),
          }
        : null;

    if (
      sameWakeupConfig(this.currentConfig, normalized) &&
      (normalized === null || (this.ws && (this.ws.readyState === WS_CONNECTING || this.ws.readyState === WS_OPEN)))
    ) {
      return;
    }

    this.teardownSocket();
    this.clearReconnectTimer();
    this.reconnectAttempt = 0;
    this.currentConfig = normalized;

    if (normalized) {
      this.connect(normalized);
    }
  }

  public stop(): void {
    this.stopped = true;
    this.currentConfig = null;
    this.clearReconnectTimer();
    this.teardownSocket();
  }

  private clearHeartbeatTimer(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private teardownSocket(): void {
    this.clearHeartbeatTimer();
    this.connected = false;
    const socket = this.ws;
    this.ws = null;
    if (socket) {
      try {
        socket.onopen = null;
        socket.onmessage = null;
        socket.onerror = null;
        socket.onclose = null;
        socket.close(1000, 'shutdown');
      } catch {
        // Ignora erro ao fechar socket já encerrado
      }
    }
  }

  private scheduleReconnect(cfg: RealtimeWakeupDirective): void {
    if (this.stopped || !sameWakeupConfig(this.currentConfig, cfg)) return;
    this.clearReconnectTimer();
    const delayMs = RECONNECT_DELAYS_MS[Math.min(this.reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)];
    this.reconnectAttempt++;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.stopped && this.currentConfig && sameWakeupConfig(this.currentConfig, cfg)) {
        this.connect(this.currentConfig);
      }
    }, delayMs);
    this.reconnectTimer.unref?.();
  }

  private connect(cfg: RealtimeWakeupDirective): void {
    if (this.stopped) return;
    let socket: MinimalWebSocket;
    try {
      socket = this.wsFactory(buildRealtimeWebSocketUrl(cfg));
    } catch (err: any) {
      logger.warn(`[REALTIME_WAKEUP] Falha ao abrir WebSocket (${sanitizeRealtimeLogText(err?.message || err)}).`);
      this.scheduleReconnect(cfg);
      return;
    }

    this.ws = socket;

    const handleOpen = () => {
      if (this.stopped || this.ws !== socket) return;
      try {
        socket.binaryType = 'arraybuffer';
      } catch {
        // Ignora se implementacao mockada nao suporta setter
      }
      const joinRef = String(this.refCounter++);
      try {
        socket.send(
          JSON.stringify([
            '1',
            joinRef,
            `realtime:${cfg.channelTopic}`,
            'phx_join',
            {
              config: {
                broadcast: { ack: false, self: false },
                presence: { key: '' },
                private: false,
              },
            },
          ]),
        );
      } catch (sendErr: any) {
        logger.warn(`[REALTIME_WAKEUP] Erro no phx_join (${sanitizeRealtimeLogText(sendErr?.message || sendErr)}).`);
      }

      this.clearHeartbeatTimer();
      this.heartbeatTimer = setInterval(() => {
        if (this.stopped || this.ws !== socket || socket.readyState !== WS_OPEN) return;
        try {
          socket.send(JSON.stringify([null, String(this.refCounter++), 'phoenix', 'heartbeat', {}]));
        } catch {
          // Sera tratado por onerror/onclose
        }
      }, this.heartbeatMs);
      this.heartbeatTimer.unref?.();
    };

    const handleMessage = (ev: any) => {
      if (this.stopped || this.ws !== socket) return;
      const rawData = ev && typeof ev === 'object' && 'data' in ev ? ev.data : ev;
      if (typeof rawData === 'string') {
        this.handleTextFrame(cfg, rawData);
        return;
      }
      const buf = toBuffer(rawData);
      if (buf) {
        this.handleBinaryFrame(cfg, buf);
      }
    };

    const handleError = (ev: any) => {
      if (this.stopped || this.ws !== socket) return;
      const rawMsg = ev?.message || ev?.error?.message || ev?.error || 'erro de WebSocket';
      logger.warn(`[REALTIME_WAKEUP] Erro na conexão WebSocket: ${sanitizeRealtimeLogText(String(rawMsg))}`);
    };

    const handleClose = () => {
      if (this.ws !== socket) return;
      this.clearHeartbeatTimer();
      this.connected = false;
      this.ws = null;
      if (!this.stopped && this.currentConfig && sameWakeupConfig(this.currentConfig, cfg)) {
        this.scheduleReconnect(cfg);
      }
    };

    if (typeof socket.addEventListener === 'function') {
      socket.addEventListener('open', handleOpen);
      socket.addEventListener('message', handleMessage);
      socket.addEventListener('error', handleError);
      socket.addEventListener('close', handleClose);
    } else {
      socket.onopen = handleOpen;
      socket.onmessage = handleMessage;
      socket.onerror = handleError;
      socket.onclose = handleClose;
    }
  }

  private handleTextFrame(cfg: RealtimeWakeupDirective, rawText: string): void {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      return;
    }

    let topic: unknown;
    let event: unknown;
    let payload: any;

    if (Array.isArray(parsed) && parsed.length >= 5) {
      topic = parsed[2];
      event = parsed[3];
      payload = parsed[4];
    } else if (parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>;
      topic = obj.topic;
      event = obj.event;
      payload = obj.payload;
    } else {
      return;
    }

    const expectedTopic = `realtime:${cfg.channelTopic}`;
    if (event === 'phx_reply' && topic === expectedTopic && payload?.status === 'ok') {
      this.connected = true;
      this.reconnectAttempt = 0;
      return;
    }

    if (event === 'broadcast' && (!topic || topic === expectedTopic || topic === cfg.channelTopic)) {
      const evName = payload?.event ?? payload?.data?.event;
      if (evName === cfg.event) {
        this.safeInvokeWakeup();
      }
    }
  }

  private handleBinaryFrame(cfg: RealtimeWakeupDirective, buf: Buffer): void {
    // Frame binario Phoenix v2 Broadcast Push: byte[0]=4, [1]=topicLen, [2]=userEventLen, [3]=metaLen, [4]=encoding
    if (buf.length < 5 || buf[0] !== 4) return;
    const topicLen = buf[1];
    const userEventLen = buf[2];
    const metaLen = buf[3];
    if (5 + topicLen + userEventLen + metaLen > buf.length) return;
    const userEvent = buf.subarray(5 + topicLen, 5 + topicLen + userEventLen).toString('utf8');
    if (userEvent === cfg.event) {
      this.safeInvokeWakeup();
    }
  }

  private safeInvokeWakeup(): void {
    try {
      this.onWakeup();
    } catch (err: any) {
      logger.warn(`[REALTIME_WAKEUP] Erro no callback de wakeup: ${sanitizeRealtimeLogText(String(err?.message || err))}`);
    }
  }
}
