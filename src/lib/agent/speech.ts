/**
 * Utilitários para Web Speech API no FIORIX • IA
 * - Síntese de fala em português do Brasil com higienização de Markdown
 * - Reconhecimento de fala com timeout de segurança e cancelamento
 */

/**
 * Remove formatação Markdown, URLs, emojis em excesso e hashes técnicos
 * para que o sintetizador de voz leia com naturalidade humana em português.
 */
export function cleanMarkdownForSpeech(text: string): string {
  if (!text) return '';

  return text
    // Remove blocos de código
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    // Remove links markdown [texto](url) -> texto
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    // Remove títulos markdown #, ##, etc.
    .replace(/^#+\s+/gm, '')
    // Remove negrito e itálico **, *, __, _
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1')
    // Remove listas com marcadores -, *, 1.
    .replace(/^[\s*-]+(?=\S)/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    // Remove separadores horizontais ---
    .replace(/^-{3,}$/gm, '')
    // Remove tags HTML
    .replace(/<[^>]*>/g, '')
    // Limpa pontuações repetidas e espaços excessivos
    .replace(/[#>/|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Referência global para evitar o bug de Garbage Collection no Safari/WebKit
let activeUtterance: SpeechSynthesisUtterance | null = null;
let globalAudioCtx: any = null;

/**
 * Pré-carrega vozes do navegador assim que disponíveis (especialmente no iOS/Safari)
 */
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  try {
    window.speechSynthesis.onvoiceschanged = () => {
      try {
        window.speechSynthesis.getVoices();
      } catch {}
    };
  } catch {}
}

/**
 * Seleciona a melhor voz em português disponível no sistema (Windows, Mac, Android, iOS)
 */
function getBestPortugueseVoice(): SpeechSynthesisVoice | undefined {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return undefined;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return undefined;

  // 1. Vozes brasileiras de destaque (Apple: Luciana, Felipe / Google / Microsoft: Francisca, Antonio / Natural)
  const premiumVoice = voices.find(
    (v) =>
      /pt[-_]br/i.test(v.lang) &&
      /(Luciana|Felipe|Leticia|Yelda|Google|Natural|Premium|Siri|Francisca|Antonio)/i.test(v.name)
  );
  if (premiumVoice) return premiumVoice;

  // 2. Qualquer voz pt-BR
  const anyPtBr = voices.find((v) => /pt[-_]br/i.test(v.lang));
  if (anyPtBr) return anyPtBr;

  // 3. Fallback para qualquer variação de português
  return voices.find((v) => /^pt/i.test(v.lang));
}

/**
 * Desbloqueia o subsistema de áudio no iOS (Safari / iPhone).
 * No iOS, o navegador exige ativação por gesto do usuário (click/touch) antes de tocar áudio,
 * e a Web Speech API é mapeada para o canal de som ambiente a menos que o AudioContext seja ativado.
 */
export function unlockAudioForIOS(): void {
  if (typeof window === 'undefined') return;

  // 1. Ativa AudioContext para elevar a sessão de áudio para modo de reprodução (Playback)
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      if (!globalAudioCtx || globalAudioCtx.state === 'closed') {
        globalAudioCtx = new AudioContextClass();
      }
      if (globalAudioCtx.state === 'suspended') {
        globalAudioCtx.resume();
      }
      // Toca um buffer silencioso de 1 amostra para registrar o toque físico no subsistema CoreAudio do iOS
      const buffer = globalAudioCtx.createBuffer(1, 1, 22050);
      const source = globalAudioCtx.createBufferSource();
      source.buffer = buffer;
      source.connect(globalAudioCtx.destination);
      source.start(0);
    }
  } catch {}

  // 2. Garante que o motor de síntese não está em pausa (bug clássico do WebKit)
  if ('speechSynthesis' in window) {
    try {
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    } catch {}
  }
}

/**
 * Fala um texto utilizando SpeechSynthesis do navegador com compatibilidade multiplataforma (Windows e iOS/iPhone)
 */
export function speakText(
  text: string,
  options?: {
    onStart?: () => void;
    onEnd?: () => void;
    onError?: (err: any) => void;
  }
): SpeechSynthesisUtterance | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    options?.onError?.(new Error('SpeechSynthesis não suportado'));
    return null;
  }

  const cleanText = cleanMarkdownForSpeech(text);
  if (!cleanText) return null;

  try {
    // Desbloqueia audio context preventivamente
    unlockAudioForIOS();

    // No iOS/WebKit, despausa o sintetizador se estiver travado
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }

    // Cancela falas anteriores pendentes
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.0;
    utterance.pitch = 1.0;

    const ptVoice = getBestPortugueseVoice();
    if (ptVoice) {
      utterance.voice = ptVoice;
    }

    utterance.onstart = () => {
      options?.onStart?.();
    };

    utterance.onend = () => {
      activeUtterance = null;
      if (typeof window !== 'undefined') (window as any)._fiorixActiveUtterance = null;
      options?.onEnd?.();
    };

    utterance.onerror = (err) => {
      activeUtterance = null;
      if (typeof window !== 'undefined') (window as any)._fiorixActiveUtterance = null;
      options?.onError?.(err);
    };

    // Previne que o Garbage Collector do Safari descarte a utterance no meio da fala
    activeUtterance = utterance;
    (window as any)._fiorixActiveUtterance = utterance;

    // No iOS, um micro-delay após o cancel() previne que o WebKit ignore o comando speak()
    setTimeout(() => {
      try {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        options?.onError?.(err);
      }
    }, 30);

    return utterance;
  } catch (err) {
    options?.onError?.(err);
    return null;
  }
}

/**
 * Cancela qualquer fala ativa no navegador
 */
export function stopSpeaking(): void {
  activeUtterance = null;
  if (typeof window !== 'undefined') {
    (window as any)._fiorixActiveUtterance = null;
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }
}

/**
 * Reconhecimento de voz do navegador (SpeechRecognition)
 */
export interface SpeechRecognitionController {
  start: () => void;
  stop: () => void;
  abort: () => void;
}

export function createSpeechRecognizer(callbacks: {
  onResult: (transcript: string, isFinal: boolean) => void;
  onError: (error: string) => void;
  onEnd: () => void;
  onStart?: () => void;
}): SpeechRecognitionController | null {
  if (typeof window === 'undefined') return null;

  // Suporte a prefixos webkit
  const SpeechRecognition =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  if (!SpeechRecognition) {
    return null;
  }

  try {
    const recognition = new SpeechRecognition();
    recognition.lang = 'pt-BR';
    recognition.continuous = false; // Para após uma sentença
    recognition.interimResults = true; // Mostra resultados em tempo real
    recognition.maxAlternatives = 1;

    let silenceTimer: NodeJS.Timeout | null = null;

    const resetSilenceTimer = () => {
      if (silenceTimer) clearTimeout(silenceTimer);
      silenceTimer = setTimeout(() => {
        try {
          recognition.stop();
        } catch {}
      }, 5000); // 5 segundos de silêncio para encerramento de segurança
    };

    recognition.onstart = () => {
      resetSilenceTimer();
      callbacks.onStart?.();
    };

    recognition.onresult = (event: any) => {
      resetSilenceTimer();
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }

      callbacks.onResult(final || interim, Boolean(final));
    };

    recognition.onerror = (event: any) => {
      if (silenceTimer) clearTimeout(silenceTimer);
      callbacks.onError(event.error || 'Erro no reconhecimento');
    };

    recognition.onend = () => {
      if (silenceTimer) clearTimeout(silenceTimer);
      callbacks.onEnd();
    };

    return {
      start: () => {
        try {
          recognition.start();
        } catch (e) {
          callbacks.onError('Microfone já ativo ou bloqueado.');
        }
      },
      stop: () => {
        if (silenceTimer) clearTimeout(silenceTimer);
        try {
          recognition.stop();
        } catch {}
      },
      abort: () => {
        if (silenceTimer) clearTimeout(silenceTimer);
        try {
          recognition.abort();
        } catch {}
      },
    };
  } catch (err) {
    return null;
  }
}
