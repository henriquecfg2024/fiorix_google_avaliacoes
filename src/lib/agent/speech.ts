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

/**
 * Fala um texto utilizando SpeechSynthesis do navegador
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
    window.speechSynthesis.cancel(); // Cancela falas anteriores pendentes

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.05; // Levemente mais ágil e natural
    utterance.pitch = 1.0;

    // Tentar selecionar voz brasileira de qualidade se disponível
    const voices = window.speechSynthesis.getVoices();
    const ptVoice = voices.find(
      (v) => v.lang === 'pt-BR' && (v.name.includes('Google') || v.name.includes('Luciana') || v.name.includes('Natural'))
    ) || voices.find((v) => v.lang.startsWith('pt'));

    if (ptVoice) {
      utterance.voice = ptVoice;
    }

    if (options?.onStart) utterance.onstart = options.onStart;
    if (options?.onEnd) utterance.onend = options.onEnd;
    if (options?.onError) utterance.onerror = options.onError;

    window.speechSynthesis.speak(utterance);
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
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
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
