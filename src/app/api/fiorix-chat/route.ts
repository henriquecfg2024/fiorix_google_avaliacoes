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
}): string {
  const basePrompt = `Você é o FIORIX, o tutor digital amigável do 7º Oficial de Registro de Imóveis de São Paulo.
Seu tom é profissional mas acolhedor, como um colega experiente que ajuda com paciência.
Use emojis com moderação (máximo 2 por resposta). Seja conciso (máximo 150 palavras).

SISTEMA FIORIX:
- SaaS para gestão cartorária
- Módulos: Minha IT (Instruções de Trabalho), Avaliações Google, Estatísticas, Gestão de Equipe
- ITs: documentos que padronizam procedimentos operacionais do cartório
- Ciência: confirmação de que o colaborador leu e entendeu a IT
- Versões: cada IT pode ter múltiplas versões; colaboradores precisam dar ciência a cada nova versão
- Responsável Técnico: pessoa que cria e mantém a IT atualizada
- Participantes: colaboradores vinculados a uma IT (LEITOR, CORRESPONSAVEL, RESPONSAVEL_PRINCIPAL)

REGRAS ABSOLUTAS:
1. Responda APENAS sobre o sistema FIORIX e seus módulos
2. NUNCA invente funcionalidades que não existem
3. NUNCA revele dados de outros usuários
4. NUNCA dê orientação jurídica ou legal
5. NUNCA discuta salários, dados pessoais ou questões de RH
6. Se não souber, diga "Essa informação está fora do meu conhecimento atual"
7. Se a pergunta for fora do escopo, redirecione educadamente para o sistema`;

  // Contexto por permissão
  let permissionContext = '';

  switch (user.role) {
    case 'COLABORADOR':
      permissionContext = `
USUÁRIO ATUAL: ${user.name}
CARGO: Colaborador
DEPARTAMENTO: ${user.departamento || 'Não informado'}
${user.itTitulo ? `IT VINCULADA: ${user.itTitulo}` : ''}
PERMISSÕES: Pode ver apenas suas próprias ITs, dar ciência, visualizar PDFs.
NÃO PODE: gerenciar equipe, ver estatísticas gerais, acessar configurações administrativas.
FOCO DAS RESPOSTAS: ajudar com suas ITs, ciências pendentes e navegação básica.`;
      break;

    case 'SUBSTITUTO':
      permissionContext = `
USUÁRIO ATUAL: ${user.name}
CARGO: Oficial Substituto
DEPARTAMENTO: ${user.departamento || 'Todos'}
PERMISSÕES: Acesso amplo ao sistema, gerenciamento de equipe, visualização de estatísticas, aprovação de ITs.
FOCO DAS RESPOSTAS: gestão de equipe, análise de ITs, estatísticas e relatórios.`;
      break;

    case 'ADMIN':
    case 'MASTER':
      permissionContext = `
USUÁRIO ATUAL: ${user.name}
CARGO: ${user.role === 'MASTER' ? 'Master (Acesso Total)' : 'Administrador'}
PERMISSÕES: Acesso total ao sistema, incluindo configurações, gestão de usuários, todas as ITs e estatísticas.
FOCO DAS RESPOSTAS: administração completa, relatórios avançados, configurações do sistema.`;
      break;

    default:
      permissionContext = `
USUÁRIO ATUAL: ${user.name}
CARGO: ${user.role}
DEPARTAMENTO: ${user.departamento || 'Não informado'}
PERMISSÕES: Acesso padrão ao sistema.
FOCO DAS RESPOSTAS: navegação e funcionalidades básicas.`;
  }

  return basePrompt + '\n' + permissionContext;
}

// ─── POST Handler ─────────────────────────────────
export async function POST(request: NextRequest) {
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

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return NextResponse.json({ error: 'Mensagem é obrigatória' }, { status: 400 });
    }
    if (message.length > 500) {
      return NextResponse.json({ error: 'Mensagem muito longa (máximo 500 caracteres)' }, { status: 400 });
    }

    // Verifica API Key
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      // Fallback: resposta pré-definida
      return NextResponse.json({
        reply: getFallbackReply(message),
        source: 'fallback',
      });
    }

    // Gemini
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 400,
        topP: 0.9,
      },
    });

    const systemPrompt = buildSystemPrompt({
      name: currentUser.name || 'Colaborador',
      role: currentUser.role || 'COLABORADOR',
      departamento: currentUser.departamento || context?.departamento,
      itTitulo: context?.itTitulo,
    });

    const result = await model.generateContent({
      contents: [
        { role: 'user', parts: [{ text: systemPrompt + '\n\nPERGUNTA DO USUÁRIO: ' + message.trim() }] },
      ],
    });

    const reply = result.response.text();

    return NextResponse.json({
      reply: reply || 'Desculpe, não consegui processar sua pergunta. Tente novamente.',
      source: 'gemini',
    });

  } catch (error: any) {
    console.error('Erro no FiorixChat:', error?.message || error);
    // Fallback gracioso: retorna resposta pré-definida ao invés de erro
    const body = await request.clone().json().catch(() => ({ message: '' }));
    return NextResponse.json({
      reply: getFallbackReply(body.message || ''),
      source: 'fallback',
    });
  }
}

// ─── Fallback sem API Key ─────────────────────────
function getFallbackReply(question: string): string {
  const q = question.toLowerCase();
  if (q.includes('nova versão') || q.includes('criar versão')) {
    return 'Para criar uma nova versão da sua IT:\n\n1. Acesse **Minha IT**\n2. Clique em **"Criar nova versão"** no alerta amarelo\n3. Faça upload do novo PDF\n4. A versão será atualizada para todos os participantes! 📄';
  }
  if (q.includes('ciência') || q.includes('ciencias')) {
    return 'A **ciência** confirma que você leu e entendeu a IT. Cada nova versão requer nova ciência de todos os participantes. Acompanhe em **"Ver ciências"**. ✅';
  }
  if (q.includes('tour') || q.includes('guia') || q.includes('ajuda')) {
    return 'Na página **Minha IT** você encontra:\n\n📄 **Card principal** — resumo da IT\n👁️ **Visualizar na Íntegra** — PDF completo\n👥 **Gerenciar responsáveis** — equipe\n✅ **Ver ciências** — acompanhamento';
  }
  return 'Essa informação está fora do meu conhecimento atual. Em breve terei mais funcionalidades para te ajudar! 🧠';
}
