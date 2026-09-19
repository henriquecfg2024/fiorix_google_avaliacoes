import { describe, it, expect } from 'vitest';
import { removeEmojis, cleanMarkdownForSpeech } from '@/lib/agent/speech';

describe('FIORIX-IA Emoji Sanitization', () => {
  it('removes greeting and emotion emojis completely', () => {
    const raw = 'Olá, Colaborador! 👋 Sou o FIORIX, seu copiloto de IA. Posso tirar dúvidas sobre qualquer tela, gerar atualizações de procedimentos ou orientar seu dia a dia! ☺️';
    const cleaned = removeEmojis(raw);
    expect(cleaned).toBe('Olá, Colaborador! Sou o FIORIX, seu copiloto de IA. Posso tirar dúvidas sobre qualquer tela, gerar atualizações de procedimentos ou orientar seu dia a dia!');
    expect(cleaned).not.toContain('👋');
    expect(cleaned).not.toContain('☺️');
  });

  it('removes rocket and action emojis from role announcements', () => {
    const raw = 'Olá, Henrique! Como Administrador Master, você tem acesso completo a todos os recursos e módulos do FIORIX. 🚀';
    const cleaned = removeEmojis(raw);
    expect(cleaned).toBe('Olá, Henrique! Como Administrador Master, você tem acesso completo a todos os recursos e módulos do FIORIX.');
    expect(cleaned).not.toContain('🚀');
  });

  it('removes emojis adjacent to links and markdown buttons', () => {
    const raw = 'Na tela de **Holerites** você pode consultar demonstrativos.\n\n👉 [Ir para Meus Holerites](/pessoas/holerites) 📄✨';
    const cleaned = removeEmojis(raw);
    expect(cleaned).toBe('Na tela de **Holerites** você pode consultar demonstrativos.\n\n[Ir para Meus Holerites](/pessoas/holerites)');
    expect(cleaned).not.toContain('👉');
    expect(cleaned).not.toContain('📄');
    expect(cleaned).not.toContain('✨');
  });

  it('removes warning and microphone emojis from alerts and placeholders', () => {
    const warning = '⚠️ Atenção LGPD: Evite inserir CPF de clientes ou dados sigilosos no chat.';
    expect(removeEmojis(warning)).toBe('Atenção LGPD: Evite inserir CPF de clientes ou dados sigilosos no chat.');

    const placeholder = '🎙️ Ouvindo... Fale agora';
    expect(removeEmojis(placeholder)).toBe('Ouvindo... Fale agora');
  });

  it('removes celebration and checkmark emojis', () => {
    const success = '🎉 Sua proposta foi enviada com sucesso! ✅';
    expect(removeEmojis(success)).toBe('Sua proposta foi enviada com sucesso!');
  });

  it('preserves portuguese accents, punctuation, and markdown formatting', () => {
    const text = '**Atenção**: Esta é a versão 1.2 da Instrução de Trabalho nº 45, com ciência e conformidade legal.';
    expect(removeEmojis(text)).toBe(text);
  });

  it('ensures cleanMarkdownForSpeech strips emojis before synthesizing voice', () => {
    const raw = 'Olá, Henrique! 🚀 Acesse agora [Minha IT](/minha-it) ✨';
    const spoken = cleanMarkdownForSpeech(raw);
    expect(spoken).not.toContain('🚀');
    expect(spoken).not.toContain('✨');
    expect(spoken).toBe('Olá, Henrique! Acesse agora Minha IT');
  });
});
