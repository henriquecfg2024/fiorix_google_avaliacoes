'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Mic, Square, Send, X, Loader2, Pause, Play } from 'lucide-react';
import { SerializedMessage } from '@/app/actions/mensagens';

interface VoiceRecorderProps {
  conversationId: string;
  onSent: (message: SerializedMessage) => void;
  onCancel: () => void;
}

type RecorderState = 'idle' | 'recording' | 'paused' | 'preview' | 'sending';

const MAX_DURATION_SEC = 120; // 2 minutos

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function VoiceRecorder({ conversationId, onSent, onCancel }: VoiceRecorderProps) {
  const [state, setState] = useState<RecorderState>('recording');
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [waveform, setWaveform] = useState<number[]>(Array.from({ length: 32 }, () => 8));

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Inicia a gravação imediatamente ao montar
  useEffect(() => {
    startRecording();
    return () => {
      stopTimer();
      stopAnimation();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const stopAnimation = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
  };

  const startRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Analisador de amplitude para waveform
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      const animate = () => {
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        const bars = Array.from(data).slice(0, 32).map((v) => Math.max(3, (v / 255) * 32));
        setWaveform(bars);
        animFrameRef.current = requestAnimationFrame(animate);
      };
      animate();

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        blobRef.current = blob;
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        setState('preview');
        stream.getTracks().forEach((t) => t.stop());
        stopTimer();
        stopAnimation();
      };

      recorder.start(250);
      setState('recording');

      // Timer
      setElapsed(0);
      timerRef.current = setInterval(() => {
        setElapsed((prev) => {
          if (prev + 1 >= MAX_DURATION_SEC) {
            handleStop();
            return MAX_DURATION_SEC;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err: any) {
      setError(
        err?.name === 'NotAllowedError'
          ? 'Permissão de microfone negada. Verifique as configurações do navegador.'
          : 'Não foi possível acessar o microfone.'
      );
      setState('idle');
    }
  };

  const handleStop = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    stopTimer();
    stopAnimation();
  }, []);

  const handleSend = async () => {
    if (!blobRef.current || state === 'sending') return;
    setState('sending');

    try {
      const formData = new FormData();
      const ext = blobRef.current.type.includes('webm') ? 'webm' : 'ogg';
      const filename = `voice_${Date.now()}.${ext}`;
      formData.append('file', blobRef.current, filename);
      formData.append('conversationId', conversationId);
      formData.append('tipo', 'VOICE');

      const resp = await fetch('/api/mensagens/upload', { method: 'POST', body: formData });
      const data = await resp.json();

      if (!resp.ok || !data.success) {
        setError(data.error || 'Falha no envio do áudio.');
        setState('preview');
        return;
      }

      const { sendMessage } = await import('@/app/actions/mensagens');
      const res = await sendMessage({
        conversationId,
        conteudo: `[Mensagem de voz — ${formatDuration(elapsed)}]`,
        attachmentData: {
          nomeArquivo: filename,
          tamanhoBytes: blobRef.current.size,
          mimeType: blobRef.current.type,
          storagePath: data.storagePath,
        },
      });

      if (res.success && res.message) {
        onSent(res.message);
        onCancel();
      } else {
        setError(res.error || 'Falha ao enviar.');
        setState('preview');
      }
    } catch (err) {
      setError('Erro inesperado. Tente novamente.');
      setState('preview');
    }
  };

  const handlePlayPreview = () => {
    if (audioRef.current) {
      if (state === 'paused') {
        audioRef.current.play();
        setState('preview');
      } else {
        audioRef.current.pause();
        setState('paused');
      }
    }
  };

  return (
    <div className="flex items-center gap-3 bg-slate-900/80 border border-emerald-500/30 rounded-xl px-3 py-2.5">
      {/* Cancelar */}
      <button
        onClick={() => { handleStop(); onCancel(); }}
        className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 transition shrink-0"
        title="Cancelar"
      >
        <X className="w-4 h-4" />
      </button>

      {/* Waveform */}
      <div className="flex-1 flex items-center gap-0.5 h-8 overflow-hidden">
        {waveform.map((h, i) => (
          <div
            key={i}
            className={`w-1 rounded-full transition-all duration-100 ${
              state === 'recording' ? 'bg-emerald-400' : 'bg-emerald-400/40'
            }`}
            style={{ height: `${h}px`, opacity: state === 'recording' ? 1 : 0.6 }}
          />
        ))}
      </div>

      {/* Timer */}
      <span
        className={`text-xs font-mono shrink-0 tabular-nums ${
          state === 'recording' ? 'text-rose-400' : 'text-slate-400'
        }`}
      >
        {formatDuration(elapsed)}
      </span>

      {/* Controles */}
      {state === 'recording' ? (
        <button
          onClick={handleStop}
          className="w-8 h-8 rounded-full bg-rose-500 hover:bg-rose-400 text-white flex items-center justify-center transition shrink-0"
          title="Parar"
        >
          <Square className="w-3.5 h-3.5 fill-white" />
        </button>
      ) : (state === 'preview' || state === 'paused') ? (
        <>
          <button
            onClick={handlePlayPreview}
            className="w-7 h-7 rounded-full bg-emerald-600/30 border border-emerald-500/40 text-emerald-400 flex items-center justify-center transition hover:bg-emerald-600/50"
          >
            {state === 'paused' ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
          </button>
          <button
            onClick={handleSend}
            className="w-8 h-8 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center transition disabled:opacity-50 shrink-0"
            title="Enviar"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </>
      ) : state === ('sending' as RecorderState) ? (
        <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
      ) : null}

      {/* Audio hidden para preview */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onEnded={() => setState('preview')}
          className="hidden"
        />
      )}

      {/* Erro inline */}
      {error && (
        <p className="absolute bottom-full mb-2 left-4 text-[10px] text-rose-400 bg-slate-900 px-2 py-1 rounded-lg border border-rose-500/30">
          {error}
        </p>
      )}
    </div>
  );
}
