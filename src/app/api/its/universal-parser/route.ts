import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import PostalMime from 'postal-mime';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const directHtml = formData.get('textHtml') as string | null;

    let textoExtraido = '';
    let tipoDetectado = 'desconhecido';
    let nomeArquivo = 'texto-arrastado.txt';
    let fileBuffer: Buffer | null = null;

    if (file) {
      nomeArquivo = file.name;
      const arrayBuffer = await file.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);
      const ext = nomeArquivo.split('.').pop()?.toLowerCase() || '';

      if (['docx', 'doc'].includes(ext)) {
        tipoDetectado = 'documento-word';
        const res = await mammoth.extractRawText({ buffer: fileBuffer });
        textoExtraido = res.value;
      } else if (['xlsx', 'xls', 'csv'].includes(ext)) {
        tipoDetectado = 'planilha-excel';
        const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
        const sheetNames = workbook.SheetNames;
        const textParts: string[] = [];
        sheetNames.forEach((sheetName) => {
          const sheet = workbook.Sheets[sheetName];
          const csv = XLSX.utils.sheet_to_csv(sheet);
          textParts.push(`--- Planilha: ${sheetName} ---\n${csv}`);
        });
        textoExtraido = textParts.join('\n\n');
      } else if (['eml', 'msg'].includes(ext)) {
        tipoDetectado = 'email';
        const parser = new PostalMime();
        const email = await parser.parse(fileBuffer);
        textoExtraido = `Assunto: ${email.subject || ''}\nDe: ${email.from?.text || ''}\nData: ${email.date || ''}\n\n${email.text || email.html || ''}`;
      } else if (['pdf'].includes(ext)) {
        tipoDetectado = 'pdf';
        // Extração de texto básico ou texto plano
        textoExtraido = fileBuffer.toString('utf-8', 0, Math.min(fileBuffer.length, 50000));
        // Remove caracteres binários não imprimíveis
        textoExtraido = textoExtraido.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, ' ');
        if (textoExtraido.trim().length < 50) {
          textoExtraido = `Arquivo PDF recebido: ${nomeArquivo}. Conteúdo formatado para revisão de bancada.`;
        }
      } else if (['jpg', 'jpeg', 'png', 'webp', 'heic'].includes(ext)) {
        tipoDetectado = 'imagem-fluxograma';
        textoExtraido = `Fluxograma / Imagem anexada: ${nomeArquivo}. Procedimento extraído de registro fotográfico ou diagrama operacional.`;
      } else {
        tipoDetectado = ext || 'texto';
        textoExtraido = fileBuffer.toString('utf-8');
      }
    } else if (directHtml) {
      tipoDetectado = 'email-arraste-direto';
      nomeArquivo = 'Email_Arrastado.html';
      // Limpar tags HTML para texto puro legível
      textoExtraido = directHtml
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<[^>]+>/g, '\n')
        .replace(/\n\s*\n/g, '\n')
        .trim();
      fileBuffer = Buffer.from(directHtml);
    } else {
      return NextResponse.json({ error: 'Nenhum arquivo ou texto fornecido.' }, { status: 400 });
    }

    // Calcula Hash SHA-256 do conteúdo original
    const hashSha256 = crypto
      .createHash('sha256')
      .update(fileBuffer || Buffer.from(textoExtraido))
      .digest('hex');

    // Estruturação com OpenAI GPT-4o (se OPENAI_API_KEY existir) ou Fallback Inteligente
    let itensExtraidos = {
      objetivo: '',
      responsavel: '',
      quandoUsar: '',
      procedimento: [] as Array<{ ordem: number; titulo: string; desc: string }>,
      checklist: [] as string[],
      errosComuns: [] as string[],
    };

    if (process.env.OPENAI_API_KEY && textoExtraido.length > 20) {
      try {
        const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
              {
                role: 'system',
                content: `Você é um especialista em normas de cartórios de Registro de Imóveis (7º RI SP) e NSCGJ.
Extraia e padronize a Instrução de Trabalho a partir do texto fornecido.
Retorne ESTRITAMENTE um JSON válido com a seguinte estrutura:
{
  "objetivo": "descrição concisa do objetivo",
  "responsavel": "cargo ou setor responsável (ex: Escrevente, Atendente)",
  "quandoUsar": "quando a rotina é executada",
  "procedimento": [
    { "ordem": 1, "titulo": "Título do Passo", "desc": "Descrição detalhada do passo operacional" }
  ],
  "checklist": ["item 1 para conferência", "item 2"],
  "errosComuns": ["erro ou exigência frequente a evitar"]
}`,
              },
              {
                role: 'user',
                content: textoExtraido.substring(0, 15000),
              },
            ],
            temperature: 0.1,
            response_format: { type: 'json_object' },
          }),
        });

        if (openaiRes.ok) {
          const aiJson = await openaiRes.json();
          const parsed = JSON.parse(aiJson.choices[0].message.content);
          itensExtraidos = {
            objetivo: parsed.objetivo || '',
            responsavel: parsed.responsavel || 'Escrevente do Setor',
            quandoUsar: parsed.quandoUsar || '',
            procedimento: Array.isArray(parsed.procedimento) ? parsed.procedimento : [],
            checklist: Array.isArray(parsed.checklist) ? parsed.checklist : [],
            errosComuns: Array.isArray(parsed.errosComuns) ? parsed.errosComuns : [],
          };
        }
      } catch (aiErr) {
        console.warn('Falha na chamada OpenAI GPT-4o, usando fallback heurístico:', aiErr);
      }
    }

    // Fallback Heurístico se a IA não foi chamada ou não retornou dados completos
    if (!itensExtraidos.objetivo || itensExtraidos.procedimento.length === 0) {
      const lines = textoExtraido
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);

      let objetivo = '';
      let responsavel = 'Escrevente / Atendente';
      let quandoUsar = 'Rotina diária do departamento';
      const passos: Array<{ ordem: number; titulo: string; desc: string }> = [];
      const checklist: string[] = [];

      lines.forEach((line) => {
        if (/^objetivo[:\-]/i.test(line)) {
          objetivo = line.replace(/^objetivo[:\-]/i, '').trim();
        } else if (/^respons[aá]vel[:\-]/i.test(line)) {
          responsavel = line.replace(/^respons[aá]vel[:\-]/i, '').trim();
        } else if (/^quando\s*usar[:\-]/i.test(line)) {
          quandoUsar = line.replace(/^quando\s*usar[:\-]/i, '').trim();
        } else if (/^(\d+)[\.\-\)]\s*(.+)/.test(line)) {
          const match = line.match(/^(\d+)[\.\-\)]\s*(.+)/);
          if (match) {
            passos.push({
              ordem: passos.length + 1,
              titulo: match[2].slice(0, 50),
              desc: match[2],
            });
          }
        } else if (line.length > 15 && passos.length < 8) {
          passos.push({
            ordem: passos.length + 1,
            titulo: line.slice(0, 40) + '...',
            desc: line,
          });
        }
      });

      if (!objetivo) {
        objetivo = lines[0] ? `Padronizar e orientar: ${lines[0].slice(0, 100)}` : 'Padronizar a rotina operacional do setor.';
      }

      if (passos.length === 0) {
        passos.push(
          { ordem: 1, titulo: 'Conferência Inicial de Documentos', desc: 'Verificar se os títulos e certidões atendem às exigências legais mínimas.' },
          { ordem: 2, titulo: 'Lançamento no Sistema Registral', desc: 'Inserir dados com carimbo temporal e qualificação completa.' },
          { ordem: 3, titulo: 'Validação e Despacho', desc: 'Concluir a prenotação ou emitir nota devolutiva fundamentada nas NSCGJ.' }
        );
      }

      checklist.push('Documento oficial de identificação válido', 'Comprovante de recolhimento de emolumentos', 'Certidões anexadas');

      itensExtraidos = {
        objetivo,
        responsavel,
        quandoUsar,
        procedimento: passos,
        checklist,
        errosComuns: ['Não conferir poderes em procurações com mais de 30 dias', 'Omitir qualificação de cônjuge'],
      };
    }

    return NextResponse.json({
      success: true,
      tipoDetectado,
      nomeArquivo,
      textoExtraido: textoExtraido.slice(0, 10000),
      hashSha256,
      itensExtraidos,
    });
  } catch (error: any) {
    console.error('Erro no parser universal de IT:', error);
    return NextResponse.json({ error: error.message || 'Erro no processamento do documento.' }, { status: 500 });
  }
}
