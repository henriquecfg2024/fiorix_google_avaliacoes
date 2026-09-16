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
  pathname?: string;
  itTitulo?: string;
  itCodigo?: string;
  itVersao?: string;
  itDepartamento?: string;
  itPapel?: string;
  isResponsavel?: boolean;
}): string {
  const isGestao = ['SUBSTITUTO', 'ADMIN', 'MASTER'].includes(String(user.role || '').toUpperCase());

  const basePrompt = `Você é o FIORIX, a inteligência artificial e assistente amigável do 7º Oficial de Registro de Imóveis de São Paulo (7º RISP).
Seu tom é profissional, ágil e acolhedor. Seu papel é orientar e ajudar o usuário a usar QUALQUER tela e módulo do sistema FIORIX.
Use emojis com moderação (máximo 2 por resposta). Seja conciso, claro e direto (máximo 120 palavras).

ROTA / TELA ATUAL DO USUÁRIO NO MOMENTO:
${user.pathname ? `- Tela atual: ${user.pathname}` : '- Painel FIORIX'}

MÓDULOS E TELAS DO SISTEMA FIORIX (VOCÊ DEVE AJUDAR COM TODOS ELES):
1. MEUS HOLERITES (/pessoas/holerites):
   - O colaborador pode consultar e baixar seus comprovantes de rendimento e holerites mensais protegidos pela LGPD.
   - Como usar: Seleciona o ano no topo da tabela (ex: 2026) e clica no botão para visualizar ou baixar o PDF.
2. MINHAS FÉRIAS (/pessoas/ferias):
   - O colaborador consulta o saldo de dias de férias disponíveis, o período aquisitivo vigente e histórico de solicitações.
3. COMUNICADOS (/pessoas/comunicados):
   - Mural de notícias, comunicados e avisos oficiais do 7º RISP emitidos para a equipe.
4. MINHA IT (/minha-it):
   - Exibe as Instruções de Trabalho do colaborador. Permite registrar ciência formal obrigatória, visualizar o PDF na íntegra e, caso seja Responsável Técnico, gerenciar participantes e criar nova versão (+ Criar nova versão).
   - NOTA: Para colaboradores, a tela oficial de ITs é Minha IT (/minha-it).
${isGestao ? `5. GOVERNANÇA DE ITS (/administracao/its):
   - Painel de supervisão e catálogo geral de ITs de todos os setores do cartório (exclusivo para cargos de gestão/substitutos).` : ''}
6. AVALIAÇÕES GOOGLE (/avaliacoes):
   - Gestão das avaliações do Google Reviews do 7º RISP. Permite monitorar nota média e responder clientes.
7. DASHBOARD (/dashboard):
   - Painel principal de controle com atalhos rápidos e indicadores gerais.
8. GESTÃO E RH (/sistema/pessoas):
   - Quadro de colaboradores, férias e holerites da equipe (para gestão/RH).
9. MINHA CONTA (/minha-conta):
   - Configurações do perfil, preferências e segurança.

${user.itTitulo ? `INFORMAÇÕES DA IT QUE O USUÁRIO PARTICIPA:
- Título da IT: "${user.itTitulo}"
- Código: ${user.itCodigo || 'IT-ATD-001'}
- Versão: ${user.itVersao || '1.1'}
- Setor/Departamento: ${user.itDepartamento || 'Atendimento'}
- Papel nesta IT: ${user.itPapel || 'Colaborador'}
- Responsável Técnico: ${user.isResponsavel ? 'SIM (o usuário é o autor/responsável técnico desta IT).' : 'NÃO (o usuário é participante/leitor).'}` : ''}

COMO RESPONDER PERGUNTAS COMUNS:
- Se perguntarem sobre holerite: explique que basta selecionar o ano no topo da tabela e clicar na ação para abrir ou baixar o PDF.
- Se perguntarem sobre férias: explique que a tela mostra o saldo de dias disponíveis e o período aquisitivo.
- Se perguntarem sobre comunicados: explique que ficam reunidos no mural de comunicados.
- Se perguntarem sobre avaliações: explique como acompanhar a nota e responder no Google Reviews.
- Se perguntarem "Qual o nome da minha IT?": responda "${user.itTitulo || 'NOÇÕES BÁSICAS DO ATENDIMENTO'}" e a versão atual.
- Se perguntarem "Sou responsável técnico?": ${user.isResponsavel ? 'responda com clareza: "Sim! Você é o Responsável Técnico desta IT."' : `informe que o papel dele nesta IT é "${user.itPapel || 'Colaborador'}".`}
- Se perguntarem "Como criar nova versão?": se for responsável técnico, oriente que no alerta amarelo há o botão "+ Criar nova versão". Se for colaborador comum, informe que apenas o responsável técnico ou a gestão podem criar novas versões.
- Se perguntarem "O que é ciência?": explique que é a confirmação de que o colaborador leu e entendeu as diretrizes da IT.

INSTRUÇÃO CRÍTICA — LINKS CLICÁVEIS DE NAVEGAÇÃO:
Sempre que indicar ou mencionar uma tela, página ou módulo do sistema ao usuário, você DEVE fornecer o link clicável em formato Markdown para o usuário clicar e ser redirecionado imediatamente!
Links válidos do FIORIX:
- Meus Holerites: [Acessar Meus Holerites](/pessoas/holerites)
- Minhas Férias: [Acessar Minhas Férias](/pessoas/ferias)
- Comunicados: [Ver Comunicados](/pessoas/comunicados)
- Minha IT: [Ir para Minha IT](/minha-it)
${isGestao ? '- Governança de ITs: [Governança de ITs](/administracao/its)' : ''}
- Avaliações Google: [Ir para Avaliações](/avaliacoes)
- Dashboard: [Ir para o Dashboard](/dashboard)
- Minha Conta: [Acessar Minha Conta](/minha-conta)

Se o usuário perguntar "Onde encontro...", "Como vou para..." ou tiver dúvidas de navegação:
Explique rapidamente e sempre inclua o link clicável correspondente!

REGRAS:
1. Responda sobre telas e funcionalidades reais do FIORIX com naturalidade e clareza.
2. Ajude o usuário a navegar, sempre sugerindo o link clicável da tela relevante.
3. NUNCA envie links para telas que o usuário não tem permissão (ex: colaborador não acessa administração).
4. NUNCA revele dados sensíveis de outros colaboradores.`;

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
      pathname: requestContext?.pathname,
      itTitulo: requestContext?.itTitulo,
      itCodigo: requestContext?.itCodigo,
      itVersao: requestContext?.itVersao,
      itDepartamento: requestContext?.itDepartamento,
      itPapel: requestContext?.itPapel,
      isResponsavel: Boolean(requestContext?.isResponsavel),
    });

    // Gemini Cascade (3.5-flash-lite -> 3.1-flash-lite -> 3.6-flash)
    const genAI = new GoogleGenerativeAI(apiKey);
    let reply = '';

    const modelsToTry = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-3.6-flash'];

    for (const modelName of modelsToTry) {
      try {
        const isThinkingModel = modelName.includes('3.6');
        const generationConfig: any = {
          temperature: 0.7,
          maxOutputTokens: 600,
          topP: 0.9,
        };
        if (isThinkingModel) {
          generationConfig.thinkingConfig = { thinkingBudget: 0 };
        }

        const model = genAI.getGenerativeModel({
          model: modelName,
          generationConfig,
        });

        const result = await model.generateContent({
          contents: [
            { role: 'user', parts: [{ text: systemPrompt + '\n\nPERGUNTA DO USUÁRIO: ' + message.trim() }] },
          ],
        });

        reply = result.response.text();
        if (reply && reply.trim().length > 0) break;
      } catch (err: any) {
        console.warn(`Tentativa com ${modelName} falhou (${err?.status || err?.message}), tentando próximo modelo...`);
      }
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

// ─── Fallback Inteligente para Todos os Módulos ───
function getFallbackReply(question: string, context?: any): string {
  const q = question.toLowerCase();

  // Holerites
  if (q.includes('holerite') || q.includes('comprovante') || q.includes('rendimento') || q.includes('pagamento') || q.includes('salario') || q.includes('salário')) {
    return 'Na tela de **Holerites** você pode consultar e emitir seus demonstrativos com proteção LGPD. Basta selecionar o ano desejado na tabela e clicar para visualizar ou baixar o PDF!\n\n👉 [Ir para Meus Holerites](/pessoas/holerites) 📄✨';
  }

  // Férias
  if (q.includes('férias') || q.includes('ferias') || q.includes('saldo')) {
    return 'Na tela de **Férias** você pode acompanhar seu saldo de dias disponíveis, verificar seu período aquisitivo vigente e conferir o histórico das suas solicitações.\n\n👉 [Ir para Minhas Férias](/pessoas/ferias) 🏖️✨';
  }

  // Comunicados
  if (q.includes('comunicado') || q.includes('comunicados') || q.includes('aviso')) {
    return 'Na tela de **Comunicados** você confere todos os avisos oficiais, novidades e comunicados emitidos pela gestão do 7º RISP.\n\n👉 [Ver Comunicados](/pessoas/comunicados) 📢';
  }

  // Avaliações
  if (q.includes('avaliaç') || q.includes('avaliac') || q.includes('google') || q.includes('reviews')) {
    return 'No módulo de **Avaliações**, você acompanha as notas do Google Reviews do cartório, lê comentários e pode enviar respostas oficiais com auxílio de IA.\n\n👉 [Ir para Avaliações do Google](/avaliacoes) ⭐';
  }

  // Minha IT
  if (q.includes('nome') && (q.includes('it') || q.includes('minha'))) {
    const titulo = context?.itTitulo || 'NOÇÕES BÁSICAS DO ATENDIMENTO';
    const versao = context?.itVersao ? ` (versão ${context.itVersao})` : ' (versão 1.1)';
    const dept = context?.itDepartamento ? ` do setor ${context.itDepartamento}` : '';
    return `O nome da sua IT atual é **${titulo}**${versao}${dept}.\n\n👉 [Ir para Minha IT](/minha-it) 📄✨`;
  }

  if (q.includes('responsável') || q.includes('responsavel')) {
    if (context?.isResponsavel) {
      return `Sim! Você é o **Responsável Técnico** desta IT (**${context?.itTitulo || 'NOÇÕES BÁSICAS DO ATENDIMENTO'}**). Você é o encarregado de mantê-la atualizada e gerenciar a equipe!\n\n👉 [Gerenciar Minha IT](/minha-it) 🛡️✨`;
    }
    if (context?.itPapel) {
      return `Nesta IT, seu papel é **${context.itPapel}**. ${context.itPapel === 'Responsável técnico' ? 'Sim, você é o responsável técnico!' : 'O responsável técnico é quem faz a gestão desta IT.'}\n\n👉 [Acessar Minha IT](/minha-it) 👤`;
    }
    return 'Sim! Você está vinculado a esta IT como Responsável Técnico. Você pode gerenciar participantes e criar novas versões no alerta amarelo!\n\n👉 [Acessar Minha IT](/minha-it) 🛡️';
  }

  if (q.includes('criar') && q.includes('it') && !q.includes('versão') && !q.includes('versao')) {
    return 'Para propor ou cadastrar uma nova IT:\n\n1. Acesse o menu **Instruções de Trabalho**\n2. Clique em **"+ Nova IT"** ou **"Cadastrar IT"**\n3. Preencha título, departamento, objetivo e anexe o arquivo PDF\n4. Envie para análise da supervisão!\n\n👉 [Ir para Instruções de Trabalho](/instrucoes-trabalho) 📋✨';
  }

  if (q.includes('nova versão') || q.includes('criar versão') || q.includes('atualizar it')) {
    return 'Para criar uma nova versão da sua IT:\n\n1. Acesse **Minha IT**\n2. Clique em **"+ Criar nova versão"** no alerta amarelo no topo\n3. Faça upload do novo PDF atualizado\n4. A nova versão será publicada e todos os participantes receberão solicitação de ciência!\n\n👉 [Ir para Minha IT](/minha-it) 📄✨';
  }

  if (q.includes('ciência') || q.includes('ciencias')) {
    return 'A **ciência** confirma que você leu e entendeu a IT. Cada nova versão requer nova ciência de todos os participantes. Acompanhe o status em **"Ver ciências"**.\n\n👉 [Ir para Minha IT](/minha-it) ✅';
  }

  if (q.includes('tour') || q.includes('guia') || q.includes('ajuda') || q.includes('navegar') || q.includes('sistema')) {
    return 'O FIORIX possui vários módulos para o seu dia a dia:\n\n📄 [Minha IT](/minha-it) — suas instruções e ciências\n📋 [Instruções de Trabalho](/instrucoes-trabalho) — catálogo geral\n💵 [Holerites](/pessoas/holerites) — comprovantes com LGPD\n🏖️ [Férias](/pessoas/ferias) — saldo e períodos\n📢 [Comunicados](/pessoas/comunicados) — avisos internos\n⭐ [Avaliações](/avaliacoes) — Google Reviews';
  }

  return 'Como inteligência artificial do FIORIX, posso tirar qualquer dúvida e te levar direto para qualquer tela do sistema:\n\n• [Minha IT](/minha-it)\n• [Holerites](/pessoas/holerites)\n• [Férias](/pessoas/ferias)\n• [Comunicados](/pessoas/comunicados)\n• [Avaliações](/avaliacoes)\n• [Dashboard](/dashboard)\n\nComo posso te ajudar hoje? 😊';
}
