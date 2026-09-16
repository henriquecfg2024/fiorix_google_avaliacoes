import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { requireAuth } from '@/lib/auth-helpers';

// ─── Rate limiting simples em memória ─────────────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 30; // max 30 requests por hora por usuário
const RATE_WINDOW = 60 * 60 * 1000; // 1 hora

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

// ─── System Prompt por role ───────────────────────
function buildSystemPrompt(user: {
  name: string;
  role: string;
  departamento?: string;
  itTitulo?: string;
  itCodigo?: string;
  itVersao?: string;
  itDepartamento?: string;
  itPapel?: string;
  isResponsavel?: boolean;
}): string {
  const basePrompt = `Você é o FIORIX, o tutor digital amigável do 7º Oficial de Registro de Imóveis de São Paulo.
Seu tom é profissional mas acolhedor, como um colega experiente que ajuda com paciência.
Use emojis com moderação (máximo 2 por resposta). Seja conciso e direto (máximo 120 palavras).

SISTEMA FIORIX:
- SaaS para gestão cartorária do 7º Oficial de Registro de Imóveis de São Paulo
- Módulos: Minha IT (Instruções de Trabalho), Avaliações Google, Estatísticas, Gestão de Equipe
- ITs: Instruções de Trabalho — documentos operacionais que padronizam procedimentos do cartório
- Ciência: confirmação formal de leitura e entendimento da IT por cada colaborador participante
- Versões: cada alteração gera uma nova versão (ex: v1.0 -> v1.1) exigindo nova ciência de todos os participantes
- Responsável Técnico: autor/gestor encarregado de manter a IT atualizada e gerenciar a equipe vinculada
- Participantes: membros da equipe com papéis (RESPONSÁVEL TÉCNICO, CORRESPONSÁVEL, COLABORADOR/LEITOR)

INFORMAÇÕES DA IT QUE O USUÁRIO ESTÁ VISUALIZANDO AGORA:
${user.itTitulo ? `- Título da IT: "${user.itTitulo}"` : '- IT: NOÇÕES BÁSICAS DO ATENDIMENTO'}
${user.itCodigo ? `- Código: ${user.itCodigo}` : '- Código: IT-ATD-001'}
${user.itVersao ? `- Versão: ${user.itVersao}` : '- Versão: 1.1'}
${user.itDepartamento ? `- Setor/Departamento: ${user.itDepartamento}` : '- Setor: Atendimento'}
${user.itPapel ? `- Papel nesta IT: ${user.itPapel}` : ''}
${user.isResponsavel ? `- Responsável Técnico: SIM (o usuário é o autor/responsável técnico desta IT).` : `- Responsável Técnico: NÃO (o usuário é participante/leitor).`}

COMO RESPONDER PERGUNTAS COMUNS:
- Se perguntarem "Qual o nome da minha IT?" ou similar: responda claramente o título da IT ("${user.itTitulo || 'NOÇÕES BÁSICAS DO ATENDIMENTO'}") e a versão atual.
- Se perguntarem "Sou responsável técnico?": ${user.isResponsavel ? 'responda com clareza: "Sim! Você é o Responsável Técnico desta IT."' : `informe que o papel dele nesta IT é "${user.itPapel || 'Colaborador'}".`}
- Se perguntarem "Como criar uma nova IT?": explique que no menu "Instruções de Trabalho" na barra lateral há a opção de cadastrar/propor uma nova IT enviando o PDF e informações para aprovação.
- Se perguntarem "Como criar nova versão?": explique que no alerta amarelo no topo da IT há o botão "+ Criar nova versão", onde ele anexa o novo PDF atualizado.
- Se perguntarem "O que é ciência?": explique que é a confirmação de que o colaborador leu e entendeu as diretrizes da IT.

REGRAS ABSOLUTAS:
1. Responda APENAS sobre o sistema FIORIX e a IT
2. NUNCA invente funcionalidades que não existem
3. NUNCA revele dados de outros usuários
4. NUNCA dê orientação jurídica ou legal
5. NUNCA discuta salários ou RH
6. Se a pergunta for totalmente fora do escopo, redirecione educadamente`;

  let permissionContext = `
USUÁRIO ATUAL: ${user.name}
CARGO NO SISTEMA: ${user.role}
DEPARTAMENTO: ${user.departamento || user.itDepartamento || 'Geral'}`;

  return basePrompt + '\n' + permissionContext;
}

// ─── POST Handler ─────────────────────────────────
export async function POST(request: NextRequest) {
  let userMessage = '';
  let requestContext: any = {};
  try {
    // Autenticação
    let currentUser: any;
    try {
      currentUser = await requireAuth();
    } catch {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
    }

    // Rate limiting
    if (!checkRateLimit(currentUser.id)) {
      return NextResponse.json(
        { error: 'Muitas perguntas em pouco tempo. Tente novamente em alguns minutos.' },
        { status: 429 }
      );
    }

    // Validação do body
    const body = await request.json();
    const { message, context } = body;
    userMessage = message || '';
    requestContext = context || {};

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ error: 'Mensagem é obrigatória' }, { status: 400 });
    }
    if (message.length > 500) {
      return NextResponse.json({ error: 'Mensagem muito longa (máximo 500 caracteres)' }, { status: 400 });
    }

    // Verifica API Key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        reply: getFallbackReply(message, requestContext),
        source: 'fallback',
      });
    }

    // Contexto enriquecido
    const systemPrompt = buildSystemPrompt({
      name: currentUser.name || 'Colaborador',
      role: currentUser.role || 'COLABORADOR',
      departamento: currentUser.departamento || requestContext?.departamento,
      itTitulo: requestContext?.itTitulo,
      itCodigo: requestContext?.itCodigo,
      itVersao: requestContext?.itVersao,
      itDepartamento: requestContext?.itDepartamento,
      itPapel: requestContext?.itPapel,
      isResponsavel: Boolean(requestContext?.isResponsavel),
    });

    // Gemini 3.6 Flash (com fallback para gemini-flash-latest)
    const genAI = new GoogleGenerativeAI(apiKey);
    let reply = '';

    try {
      const model = genAI.getGenerativeModel({
        model: 'gemini-3.6-flash',
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 350,
          topP: 0.9,
        },
      });

      const result = await model.generateContent({
        contents: [
          { role: 'user', parts: [{ text: systemPrompt + '\n\nPERGUNTA DO USUÁRIO: ' + message.trim() }] },
        ],
      });

      reply = result.response.text();
    } catch (geminiError: any) {
      console.warn('Tentando fallback para gemini-flash-latest:', geminiError?.message);
      const modelLatest = genAI.getGenerativeModel({
        model: 'gemini-flash-latest',
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 350,
          topP: 0.9,
        },
      });

      const result = await modelLatest.generateContent({
        contents: [
          { role: 'user', parts: [{ text: systemPrompt + '\n\nPERGUNTA DO USUÁRIO: ' + message.trim() }] },
        ],
      });

      reply = result.response.text();
    }

    return NextResponse.json({
      reply: reply || getFallbackReply(userMessage, requestContext),
      source: 'gemini',
    });

  } catch (error: any) {
    console.error('Erro no FiorixChat:', error?.message || error);
    return NextResponse.json({
      reply: getFallbackReply(userMessage, requestContext),
      source: 'fallback',
    });
  }
}

// ─── Fallback Inteligente ─────────────────────────
function getFallbackReply(question: string, context?: any): string {
  const q = question.toLowerCase();

  if (q.includes('nome') && (q.includes('it') || q.includes('minha'))) {
    const titulo = context?.itTitulo || 'NOÇÕES BÁSICAS DO ATENDIMENTO';
    const versao = context?.itVersao ? ` (versão ${context.itVersao})` : ' (versão 1.1)';
    const dept = context?.itDepartamento ? ` do setor ${context.itDepartamento}` : '';
    return `O nome da sua IT atual é **${titulo}**${versao}${dept}. 📄✨`;
  }

  if (q.includes('responsável') || q.includes('responsavel')) {
    if (context?.isResponsavel) {
      return `Sim! Você é o **Responsável Técnico** desta IT (**${context?.itTitulo || 'NOÇÕES BÁSICAS DO ATENDIMENTO'}**). Você é o encarregado de mantê-la atualizada e gerenciar a equipe! 🛡️✨`;
    }
    if (context?.itPapel) {
      return `Nesta IT, seu papel é **${context.itPapel}**. ${context.itPapel === 'Responsável técnico' ? 'Sim, você é o responsável técnico!' : 'O responsável técnico é quem faz a gestão e atualização desta IT.'} 👤`;
    }
    return 'Sim! Você está vinculado a esta IT como Responsável Técnico. Você pode gerenciar participantes e criar novas versões no alerta amarelo! 🛡️';
  }

  if (q.includes('criar') && q.includes('it') && !q.includes('versão') && !q.includes('versao')) {
    return 'Para propor ou cadastrar uma nova IT:\n\n1. Acesse o menu **Instruções de Trabalho** na barra lateral\n2. Clique em **"+ Nova IT"** ou **"Cadastrar IT"**\n3. Preencha título, departamento, objetivo e anexe o arquivo PDF\n4. Envie para análise da supervisão! 📋✨';
  }

  if (q.includes('nova versão') || q.includes('criar versão') || q.includes('atualizar it')) {
    return 'Para criar uma nova versão da sua IT:\n\n1. Acesse **Minha IT**\n2. Clique em **"+ Criar nova versão"** no alerta amarelo no topo\n3. Faça upload do novo PDF atualizado\n4. A nova versão será publicada e todos os participantes receberão solicitação de ciência! 📄✨';
  }

  if (q.includes('ciência') || q.includes('ciencias')) {
    return 'A **ciência** confirma que você leu e entendeu a IT. Cada nova versão requer nova ciência de todos os participantes. Acompanhe o status em **"Ver ciências"**. ✅';
  }

  if (q.includes('tour') || q.includes('guia') || q.includes('ajuda')) {
    return 'Na página **Minha IT** você encontra:\n\n📄 **Card principal** — resumo da IT com versão oficial\n👁️ **Visualizar na Íntegra** — abre o PDF completo\n👥 **Gerenciar responsáveis** — equipe vinculada\n✅ **Ver ciências** — acompanhamento de leituras';
  }

  return 'Essa informação está fora do meu conhecimento atual. Em breve terei mais funcionalidades para te ajudar! 🧠';
}
