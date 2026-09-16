import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { requireAuth } from '@/lib/auth-helpers';

// ─── Rate limiting em memória (15 gerações/hora por usuário) ────
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 15;
const RATE_WINDOW = 60 * 60 * 1000; // 1 hora

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  if (rateLimitMap.size > 200) {
    for (const [id, entry] of rateLimitMap.entries()) {
      if (now > entry.resetAt) rateLimitMap.delete(id);
    }
  }

  const entry = rateLimitMap.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(userId, { count: 1, resetAt: now + RATE_WINDOW });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

// ─── Sanitizador DLP (Data Loss Prevention) ─────────────────────
function sanitizeDlp(text: string): string {
  if (!text) return '';
  return text
    // Mascara CPFs (formatados ou apenas números)
    .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[CPF PROTEGIDO]')
    // Mascara possíveis cartões ou contas bancárias
    .replace(/\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b/g, '[DADO BANCÁRIO PROTEGIDO]')
    // Limita tamanho para evitar buffer overflow
    .slice(0, 4000);
}

const SYSTEM_PROMPT = `Você é o Redator Técnico e Especialista em Instruções de Trabalho (IT) do 7º Oficial de Registro de Imóveis de São Paulo (7º RISP).
Seu objetivo é atualizar ou redigir a Instrução de Trabalho com máxima clareza técnica, linguagem formal, concisa e aderente ao Provimento CNJ nº 213/2026 e Normas da CGJ/SP.

DIRETRIZES FUNDAMENTAIS:
1. Jamais invente artigos de lei, leis fictícias ou valores de custas/emolumentos.
2. A IT deve ser organizada estritamente na seguinte estrutura Markdown:
   # [TÍTULO DA IT EM MAIÚSCULAS]
   ## 1. OBJETIVO
   (Explicação clara da finalidade e escopo desta rotina)

   ## 2. BASE LEGAL E CONFORMIDADE
   (Menção ao Provimento CNJ 213/2026 e integridade registral)

   ## 3. PASSO A PASSO OPERACIONAL
   (Etapas sequenciais e numeradas, claras para qualquer escrevente ou auxiliar)

   ## 4. CASOS PRÁTICOS E EXCEÇÕES
   (Situações atípicas e como agir)

   ## 5. ERROS COMUNS A EVITAR
   (Pontos de atenção para prevenir retrabalho ou falhas de segurança)

3. O texto deve incorporar harmonicamente a alteração descrita pelo usuário.
4. Responda ESTRITAMENTE em formato JSON com o seguinte schema:
{
  "novoTexto": "Texto completo em Markdown formatado conforme a estrutura acima",
  "resumoMudancas": "Resumo de 1 a 2 frases das mudanças implementadas",
  "topicosAlterados": ["Tópico 1", "Tópico 2"]
}`;

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    if (!user) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
    }

    if (!checkRateLimit(user.id)) {
      return NextResponse.json(
        { error: 'Limite de gerações atingido para esta hora (máx. 15). Aguarde antes de tentar novamente.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { rotinaAlterada, textoAtual, itTitulo, itCodigo, itVersao } = body;

    if (!rotinaAlterada || typeof rotinaAlterada !== 'string' || rotinaAlterada.trim().length < 5) {
      return NextResponse.json(
        { error: 'Descreva detalhadamente o que mudou na sua rotina (mínimo 5 caracteres).' },
        { status: 400 }
      );
    }

    const sanitizedMudanca = sanitizeDlp(rotinaAlterada);
    const sanitizedAtual = sanitizeDlp(textoAtual || '');

    const userPrompt = `
INFORMAÇÕES DA IT:
- Código: ${itCodigo || 'IT-PADRAO'}
- Título: ${itTitulo || 'Instrução de Trabalho'}
- Versão Vigente: v${itVersao || '1.0'}

TEXTO ATUAL DA IT (BASE):
${sanitizedAtual || 'Nenhum texto anterior fornecido. Criar estrutura base inicial.'}

O QUE O COLABORADOR MUDOU NA ROTINA:
"${sanitizedMudanca}"

Gere a versão atualizada da IT incorporando esta mudança na rotina, seguindo estritamente a estrutura definida e retorne em JSON.`;

    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    let novoTexto = '';
    let resumoMudancas = '';
    let topicosAlterados: string[] = [];

    if (apiKey) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const modelNames = ['gemini-2.5-flash', 'gemini-1.5-flash'];

        for (const modelName of modelNames) {
          try {
            const model = genAI.getGenerativeModel({
              model: modelName,
              systemInstruction: SYSTEM_PROMPT,
              generationConfig: {
                temperature: 0.2,
                topP: 0.9,
                responseMimeType: 'application/json',
              },
            });

            const timeoutPromise = new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('Timeout de geração IA (12s)')), 12000)
            );

            const resultPromise = model.generateContent(userPrompt);
            const result: any = await Promise.race([resultPromise, timeoutPromise]);
            const rawText = result.response.text();

            if (rawText) {
              const parsed = JSON.parse(rawText);
              novoTexto = parsed.novoTexto || '';
              resumoMudancas = parsed.resumoMudancas || '';
              topicosAlterados = parsed.topicosAlterados || [];
              if (novoTexto) break;
            }
          } catch (modelErr: any) {
            console.warn(`Tentativa com ${modelName} falhou:`, modelErr?.message || modelErr);
          }
        }
      } catch (genErr) {
        console.warn('Erro ao inicializar Gemini para IT Generator:', genErr);
      }
    }

    // Fallback estruturado caso a API esteja sem chave ou offline
    if (!novoTexto) {
      resumoMudancas = `Atualização de procedimento operacional: ${sanitizedMudanca.slice(0, 100)}...`;
      topicosAlterados = ['3. PASSO A PASSO OPERACIONAL', '4. CASOS PRÁTICOS'];
      novoTexto = `# ${itTitulo ? itTitulo.toUpperCase() : 'INSTRUÇÃO DE TRABALHO'}

## 1. OBJETIVO
Estabelecer o padrão operacional e os critérios de execução para esta atividade, garantindo a eficiência no atendimento e a conformidade registral do 7º RISP.

## 2. BASE LEGAL E CONFORMIDADE
- Provimento CNJ nº 213/2026 (Segurança da Informação e Trilha de Auditoria)
- Normas de Serviço da Corregedoria Geral da Justiça de São Paulo (NSCGJ/SP)

## 3. PASSO A PASSO OPERACIONAL
1. **Identificação e Triagem:** Verificar os requisitos iniciais da demanda e conferir a documentação apresentada.
2. **Atualização Operacional:** Incorporar a nova rotina: ${sanitizedMudanca}
3. **Registro e Arquivamento:** Lançar as informações no sistema interno e confirmar a conclusão dos atos.

## 4. CASOS PRÁTICOS E EXCEÇÕES
- Dúvidas em casos omissos devem ser encaminhadas ao Responsável Técnico da área ou ao Oficial Substituto.
- Situações de urgência devem observar as prioridades legais vigentes.

## 5. ERROS COMUNS A EVITAR
- Deixar de registrar o comprovante ou número de protocolo no sistema.
- Executar procedimentos sem confirmação das partes envolvidas.`;
    }

    return NextResponse.json({
      success: true,
      novoTexto,
      resumoMudancas,
      topicosAlterados,
      fonte: novoTexto ? 'gemini' : 'fallback',
    });
  } catch (error: any) {
    console.error('Erro no /api/fiorix-generate-it:', error?.message || error);
    return NextResponse.json(
      { error: error?.message || 'Erro inesperado ao gerar a atualização da IT.' },
      { status: 500 }
    );
  }
}
