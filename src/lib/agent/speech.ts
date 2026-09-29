/**
 * Utilitários para Web Speech API no FIORIX • IA
 * - Síntese de fala em português do Brasil com higienização de Markdown
 * - Reconhecimento de fala com timeout de segurança e cancelamento
 */

/**
 * Remove todos os emojis e símbolos figurativos/pictográficos de uma string
 */
export function removeEmojis(text: string): string {
  if (!text) return '';
  return text
    .replace(/[\p{Extended_Pictographic}\uFE0E\uFE0F\u200D\u20E3\u2600-\u27BF\u2B50\u2300-\u23FF\u2B00-\u2BFF]/gu, '')
    .replace(/^[ \t]+/gm, '')
    .replace(/[ \t]+$/gm, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Remove formatação Markdown, URLs, emojis em excesso e hashes técnicos
 * para que o sintetizador de voz leia com naturalidade humana em português.
 */
export function cleanMarkdownForSpeech(text: string): string {
  if (!text) return '';

  const cleaned = removeEmojis(text);

  return cleaned
    // Remove blocos de código
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#+\s+/gm, '')
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1')
    .replace(/^[\s*-]+(?=\S)/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    .replace(/^-{3,}$/gm, '')
    .replace(/<[^>]*>/g, '')
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
 * Nomes de vozes masculinas brasileiras e em português
 * com preferência para tons maduros, elegantes e articulados (estilo JARVIS).
 */
const JARVIS_MALE_NAMES = [
  'antonio', // Microsoft Antonio (Natural / Neural) - o tom ideal em pt-BR estilo JARVIS
  'fabio',   // Microsoft Fabio (Natural / Neural) - pt-BR
  'felipe',  // Apple Felipe (Siri pt-BR)
  'daniel',  // Microsoft / Apple Daniel (estilo britânico/mordomo)
  'cristiano',
  'helio',
  'hélio',
  'jorge',
  'julio',
  'júlio',
  'thiago',
  'ricardo',
  'gabriel',
  'carlos',
];

const FEMALE_VOICE_REGEX =
  /(luciana|francisca|leticia|letícia|yelda|maria|helena|brenda|thalita|fernanda|camila|vitoria|vitória|raquel|joana|ines|inês|catarina|female|mulher|feminina|zira|elza|victoria|alice)/i;

/**
 * Seleciona a melhor voz masculina em português disponível no sistema,
 * priorizando o tom refinado e inteligente do JARVIS (Homem de Ferro).
 */
export function getJarvisMaleVoice(): SpeechSynthesisVoice | undefined {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return undefined;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return undefined;

  // 1. Vozes masculinas neurais/online em pt-BR (ex: Microsoft Antonio Neural, Microsoft Fabio Neural, Apple Felipe)
  const premiumMalePtBr = voices.find(
    (v) =>
      /pt[-_]br/i.test(v.lang) &&
      !FEMALE_VOICE_REGEX.test(v.name) &&
      JARVIS_MALE_NAMES.some((name) => v.name.toLowerCase().includes(name)) &&
      /(natural|neural|premium|online)/i.test(v.name)
  );
  if (premiumMalePtBr) return premiumMalePtBr;

  // 2. Qualquer voz masculina brasileira conhecida (Antonio, Fabio, Felipe, Daniel, etc.)
  const anyMalePtBr = voices.find(
    (v) =>
      /pt[-_]br/i.test(v.lang) &&
      !FEMALE_VOICE_REGEX.test(v.name) &&
      JARVIS_MALE_NAMES.some((name) => v.name.toLowerCase().includes(name))
  );
  if (anyMalePtBr) return anyMalePtBr;

  // 3. Voz com tag explícita de "male" ou "masculin" em pt-BR
  const explicitMalePtBr = voices.find(
    (v) =>
      /pt[-_]br/i.test(v.lang) &&
      !FEMALE_VOICE_REGEX.test(v.name) &&
      /(male|masculin|homem)/i.test(v.name)
  );
  if (explicitMalePtBr) return explicitMalePtBr;

  // 4. Qualquer voz pt-BR que comprovadamente NÃO seja feminina
  const nonFemalePtBr = voices.find(
    (v) => /pt[-_]br/i.test(v.lang) && !FEMALE_VOICE_REGEX.test(v.name)
  );
  if (nonFemalePtBr) return nonFemalePtBr;

  // 5. Voz masculina em outra variante de português (ex: pt-PT Duarte, Cristiano)
  const anyMalePt = voices.find(
    (v) =>
      /^pt/i.test(v.lang) &&
      !FEMALE_VOICE_REGEX.test(v.name) &&
      JARVIS_MALE_NAMES.some((name) => v.name.toLowerCase().includes(name))
  );
  if (anyMalePt) return anyMalePt;

  // 6. Fallback seguro em pt-BR
  return voices.find((v) => /pt[-_]br/i.test(v.lang)) || voices.find((v) => /^pt/i.test(v.lang));
}

export const getBestPortugueseVoice = getJarvisMaleVoice;

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

export interface SpeakOptions {
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: any) => void;
  pitch?: number;
  rate?: number;
  volume?: number;
}

/**
 * Fala um texto utilizando SpeechSynthesis do navegador com voz masculina estilo JARVIS
 * e compatibilidade multiplataforma (Windows, macOS e iOS/iPhone).
 */
export function speakText(
  text: string,
  options?: SpeakOptions
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

    // ─── Modulação acústica estilo J.A.R.V.I.S. ─────────────────────────
    // pitch 0.88: timbre masculino mais grave, encorpado e sereno
    // rate 0.98: dicção calma, precisa e pausada
    let targetPitch = options?.pitch ?? 0.88;
    const targetRate = options?.rate ?? 0.98;
    const targetVolume = options?.volume ?? 1.0;

    const jarvisVoice = getJarvisMaleVoice();
    if (jarvisVoice) {
      utterance.voice = jarvisVoice;
      // Se a única voz disponível no sistema for feminina (sem pacote de voz masculina),
      // baixamos o pitch para 0.78 para simular o registro barítono masculino
      if (FEMALE_VOICE_REGEX.test(jarvisVoice.name)) {
        targetPitch = Math.min(targetPitch, 0.78);
      }
    }

    utterance.pitch = targetPitch;
    utterance.rate = targetRate;
    utterance.volume = targetVolume;

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
