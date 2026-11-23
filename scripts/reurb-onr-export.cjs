/* Runner somente leitura: combina SRVSQL\WEBRI (protocolos/atos/imóveis) com
   SRVSIPLANIA\SiplanIA (OCR completo das matrículas) e executa sql/reurb_onr_importar_em_lote.sql,
   gravando na pasta de saída:
     1) reurb_importacao_onr.json  (SOMENTE o JSON de importação do ONR, validado)
     2) reurb_alertas.csv          (alertas de revisão/bloqueio + matrículas excluídas)
     3) reurb_rascunho.csv         (regularizações pendentes com sugestões)
     4) reurb_origens.csv          (mapeamento campo a campo com fonte e trecho OCR)

   Uso:
     node scripts/reurb-onr-export.cjs <pasta_saida> [opções]
   Opções:
     --prenotacao=N                 filtra uma prenotação
     --prenotacoes=N1,N2,...        lista de prenotações separadas por vírgula
     --registro-de=yyyy-mm-dd|all   data mínima de registro (padrão SQL: 2017-07-11; histórico ONR: 2009-03-25)
     --registro-ate=yyyy-mm-dd      data máxima de registro
     --prenotacao-de=yyyy-mm-dd     data mínima de prenotação
     --prenotacao-ate=yyyy-mm-dd    data máxima de prenotação
     --sem-filiacao                 desabilita consulta a tblWRIRealFiliacao
     --sem-ocr                      executa sem consultar o SRVSIPLANIA
     --sem-616                      exclui condomínios negócio 616 sem ato 947
     --incluir-art69                habilita casos art. 69 (código 3) no JSON
     --incluir-apm-derivadas        inclui APMs/vias/áreas públicas na lista derivadas[]
     --incluir-apm-unidades         soma APMs/vias/áreas públicas em quantidadeUnidades
     --permitir-abreviacao-bairro   abrevia bairros > 30 chars (desligado por padrão)
     --manual=arquivo.json          injeta registros manuais em #Manual

   100% somente leitura: WEBRI (READ UNCOMMITTED + NOLOCK), SiplanIA (default_transaction_read_only = on).
   Credenciais vêm do .env / .env.production do conector (nunca impressas). */

const path = require('path');
const fs = require('fs');
const root = path.resolve(__dirname, '..');
const dotenv = require('dotenv');
if (fs.existsSync(path.join(root, '.env'))) dotenv.config({ path: path.join(root, '.env'), quiet: true });
if (fs.existsSync(path.join(root, '.env.production'))) dotenv.config({ path: path.join(root, '.env.production'), override: true, quiet: true });
const sql = require('mssql');
const { Client } = require('pg');

const argv = process.argv.slice(2);
const positionalOut = argv.find(a => !a.startsWith('--'));
const outDir = path.resolve(positionalOut || '.');

const getArg = (prefix) => {
  const hit = argv.find(a => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
};

const semFiliacao = argv.includes('--sem-filiacao');
const semOcr = argv.includes('--sem-ocr');
const sem616 = argv.includes('--sem-616');
const incluirArt69 = argv.includes('--incluir-art69');
const incluirApmDerivadas = argv.includes('--incluir-apm-derivadas');
const incluirApmUnidades = argv.includes('--incluir-apm-unidades');
const permitirAbrevBairro = argv.includes('--permitir-abreviacao-bairro');
const manualPath = getArg('--manual=');

const prenSingle = getArg('--prenotacao=');
const prenListArg = getArg('--prenotacoes=');
const prenList = [];
if (prenSingle) {
  const n = parseInt(prenSingle, 10);
  if (!Number.isInteger(n) || n <= 0) throw new Error(`prenotação inválida: ${prenSingle}`);
  prenList.push(n);
}
if (prenListArg) {
  for (const part of prenListArg.split(',')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const n = parseInt(trimmed, 10);
    if (!Number.isInteger(n) || n <= 0) throw new Error(`prenotação inválida em --prenotacoes: ${trimmed}`);
    if (!prenList.includes(n)) prenList.push(n);
  }
}

function parseDateFlag(flag, allowAll = false) {
  const raw = getArg(flag);
  if (raw === null) return { specified: false, value: null };
  if (allowAll && (raw.toLowerCase() === 'all' || raw.toLowerCase() === 'null' || raw === '')) {
    return { specified: true, value: null };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new Error(`data inválida em ${flag} (use yyyy-mm-dd${allowAll ? ' ou all' : ''})`);
  }
  return { specified: true, value: raw };
}

const regDeFlag = parseDateFlag('--registro-de=', true);
const regAteFlag = parseDateFlag('--registro-ate=');
const prenDeFlag = parseDateFlag('--prenotacao-de=');
const prenAteFlag = parseDateFlag('--prenotacao-ate=');

const effectiveRegDe = regDeFlag.specified ? regDeFlag.value : '2017-07-11';
const effectiveRegAte = regAteFlag.specified ? regAteFlag.value : null;
const effectivePrenDe = prenDeFlag.specified ? prenDeFlag.value : null;
const effectivePrenAte = prenAteFlag.specified ? prenAteFlag.value : null;

function sqlStr(val, maxLen = 380) {
  if (val === null || val === undefined) return 'NULL';
  const clean = String(val).replace(/[\u0000-\u001F\u007F]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, maxLen);
  if (!clean) return 'NULL';
  return `N'${clean.replace(/'/g, "''")}'`;
}

function sqlInt(val) {
  return Number.isInteger(val) ? String(val) : 'NULL';
}

function sqlBit(val) {
  return val ? '1' : '0';
}

function csv(rows) {
  if (!rows || !rows.length) return '';
  const cols = Object.keys(rows[0]);
  const esc = v => (v === null || v === undefined)
    ? ''
    : `"${String(v instanceof Date ? v.toISOString().slice(0, 10) : v).replace(/[\r\n]+/g, ' ').replace(/"/g, '""')}"`;
  return '\uFEFF' + cols.join(';') + '\n' + rows.map(r => cols.map(c => esc(r[c])).join(';')).join('\n') + '\n';
}

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function parseBrDotInt(raw) {
  const n = parseInt(String(raw).replace(/\./g, ''), 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function buildPrenPattern(pren) {
  const s = String(pren);
  return s.length >= 4 ? `${s.slice(0, s.length - 3)}[\\.\\s]?${s.slice(-3)}` : s;
}

/**
 * Remove cabeçalhos/rodapés de quebra de ficha inseridos pelo OCR no meio de frases.
 */
function stripOcrPageHeaders(text) {
  if (!text) return '';
  return String(text)
    .replace(/\(\s*cont[ií]nua\s+n[ao]\s+(?:ficha\s+\d+|verso)\s*\)[\s\S]{0,280}?(?:20\d{2}|verso\.?)/gi, ' ')
    .replace(/-\s*matr[ií]cula\s*-?\s*ficha[\s\S]{0,220}?(?:verso\.?|CNM:\s*[0-9\.\-]+)/gi, ' ')
    .replace(/[LM]?[IÍ]VRO\s+N\.?[º°o]?\s*2\s*-\s*REGISTRO\s+GERAL[\s\S]{0,220}?CNS\s*[-–]?\s*12459[-–]?4(?:\s+\d{1,3}\.\d{3})?(?:\s+\d{2})?(?:\s+CNM:\s*[0-9\.\-]+)?(?:\s+S[aã]o\s+Paulo,?(?:\s+\d{1,2}\s+de\s+[a-zç]+\s+de\s+\d{4})?)?/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Isola o bloco de atos da prenotação dentro do OCR da matrícula.
 * Captura do primeiro registro/averbação referente à prenotação alvo até antes
 * da próxima prenotação distinta (ou limite de janela), preservando CRF + R. + Av. de abertura.
 */
function extractPrenContext(texto, pren) {
  if (!texto) return '';
  const pPat = buildPrenPattern(pren);
  const re = new RegExp(`PRENOTA[CÇ][AÃ]O\\s*n?[º°o\\.]*\\s*${pPat}(?!\\d)`, 'gi');
  const matches = [...texto.matchAll(re)];
  if (!matches.length) return '';

  const firstIdx = matches[0].index;
  const lastIdx = matches[matches.length - 1].index;
  const start = Math.max(0, firstIdx - 140);
  const afterLast = texto.slice(lastIdx + 20);
  const nextDiffPren = afterLast.match(new RegExp(`PRENOTA[CÇ][AÃ]O\\s*n?[º°o\\.]*\\s*(?!${pPat}(?!\\d))[0-9\\.\\s]{4,9}`, 'i'));
  const end = nextDiffPren
    ? Math.min(texto.length, lastIdx + 20 + nextDiffPren.index)
    : Math.min(texto.length, lastIdx + 3800);
  return stripOcrPageHeaders(texto.slice(start, end));
}

function extractSnippet(text, regex, radius = 140) {
  if (!text) return '';
  const m = text.match(regex);
  if (!m) return text.slice(0, 240);
  const idx = m.index || 0;
  return text.slice(Math.max(0, idx - 60), Math.min(text.length, idx + m[0].length + radius)).replace(/\s+/g, ' ').trim();
}

function normalizeKnownPublicAgent(raw) {
  const s = String(raw || '').replace(/\s+/g, ' ').trim();
  if (!s) return { agente: null, tipoAgente: null };
  if (/MUNICIPALIDADE\s+DE\s+S[AÃ]O\s+PAULO/i.test(s)) {
    return { agente: 'MUNICIPALIDADE DE SÃO PAULO', tipoAgente: 1 };
  }
  if (/SECRETARIA\s+MUNICIPAL\s+D[EA]\s+HABITA[CÇ][AÃ]O.*S[AÃ]O\s+PAULO|SEHAB/i.test(s)) {
    return { agente: 'SECRETARIA MUNICIPAL DA HABITAÇÃO DA PREFEITURA DE SÃO PAULO - SEHAB', tipoAgente: 1 };
  }
  if (/PREFEITURA\s+(?:DO\s+MUNIC[IÍ]PIO\s+)?DE\s+S[AÃ]O\s+PAULO|MUNIC[IÍ]PIO\s+DE\s+S[AÃ]O\s+PAULO/i.test(s)) {
    return { agente: 'PREFEITURA DO MUNICÍPIO DE SÃO PAULO', tipoAgente: 1 };
  }
  if (/CDHU|COMPANHIA\s+DE\s+DESENVOLVIMENTO\s+HABITACIONAL/i.test(s)) {
    return { agente: 'COMPANHIA DE DESENVOLVIMENTO HABITACIONAL E URBANO DO ESTADO DE SÃO PAULO - CDHU', tipoAgente: 1 };
  }
  if (/COHAB|COMPANHIA\s+METROPOLITANA\s+DE\s+HABITA/i.test(s)) {
    return { agente: 'COMPANHIA METROPOLITANA DE HABITAÇÃO DE SÃO PAULO - COHAB/SP', tipoAgente: 1 };
  }
  if (/PREFEITURA|MUNICIPALIDADE|MUNIC[IÍ]PIO\s+DE|SECRETARIA|GOVERNO\s+DO\s+ESTADO|FAZENDA\s+DO\s+ESTADO|UNI[AÃ]O\s+FEDERAL|PODER\s+P[UÚ]BLICO|C[AÂ]MARA\s+MUNICIPAL/i.test(s)) {
    return { agente: s.slice(0, 100), tipoAgente: 1 };
  }
  return { agente: s, tipoAgente: null };
}

function extractAgentFromOcr(prenText) {
  if (!prenText) return { agente: null, tipoAgente: null, trecho: null };

  const patterns = [
    /firmad[oa]s?\s+pel[oa]s?\.?\s+([^;]{4,220})/i,
    /(?:Certid[aã]o\s+de\s+Regulariza[cç][aã]o\s+Fundi[aá]ria|\bCRF\b)[^;]{0,140}?expedid[oa]\s+(?:em\s+[0-9\/\.\s]+\s*,?\s*)?pel[oa]\.?\s+([^;]{4,220})/i,
    /expedid[oa]s?\s+(?:em\s+[0-9\/\.\s]+\s*,?\s*)?pel[oa]\.?\s+((?:Coordenadoria|Secretaria|Prefeitura|Municipalidade|Munic[ií]pio)[^;]{4,220})/i,
  ];

  for (const re of patterns) {
    const m = prenText.match(re);
    if (!m) continue;
    const rawClause = m[1]
      .split(/\s*,?\s*(?:fa[cç]o\s+constar|j[aá]\s+qualificad|inscrit[oa]|com\s+sede|atrav[eé]s|por\s+sua|por\s+meio|acompanhad[oa]|resultante\s+da|Processo\s+n)/i)[0]
      .replace(/^\.+/, '')
      .trim();
    const norm = normalizeKnownPublicAgent(rawClause);
    if (norm.agente) {
      return { agente: norm.agente, tipoAgente: norm.tipoAgente, trecho: extractSnippet(prenText, re, 110) };
    }
  }

  const fallbackPublic = prenText.match(/(MUNICIPALIDADE\s+DE\s+S[AÃ]O\s+PAULO|PREFEITURA\s+(?:DO\s+MUNIC[IÍ]PIO\s+)?DE\s+S[AÃ]O\s+PAULO|SECRETARIA\s+MUNICIPAL\s+D[EA]\s+HABITA[CÇ][AÃ]O[^,.;]{0,70}|COMPANHIA\s+DE\s+DESENVOLVIMENTO\s+HABITACIONAL[^,.;]{0,70}|COMPANHIA\s+METROPOLITANA\s+DE\s+HABITA[CÇ][AÃ]O[^,.;]{0,70})/i);
  if (fallbackPublic) {
    const norm = normalizeKnownPublicAgent(fallbackPublic[1]);
    return { agente: norm.agente, tipoAgente: norm.tipoAgente, trecho: extractSnippet(prenText, new RegExp(fallbackPublic[1].replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), 100) };
  }

  return { agente: null, tipoAgente: null, trecho: null };
}

function extractBairroFromOcr(texto, prenText) {
  const head = (texto || '').slice(0, 1800).replace(/\s+/g, ' ');
  const imovelMatch = head.match(/[IV]M[OÓ]VEL\s*:\s*([\s\S]*?)(?:com\s+a\s+se[gq]uinte\s+descri|partindo[\s-]se|inicia[\s-]se|tem\s+in[ií]cio|confrontando|mede\s+)/i);
  const clause = imovelMatch ? imovelMatch[1] : head.slice(0, 450);

  // Bairro expresso somente quando explicitamente rotulado como "bairro ..."
  const explicit = `${clause} ${prenText || ''}`.match(/(?:\bno\s+|,\s*)bairro\s+(?:d[eao]\s+)?["“]?([A-Za-zÀ-ÿ0-9\s\.\-\/]{3,60}?)(?:["”]|,|\.|;|\s+n[oa]\s+distrito|\s+em\s+Guaianazes|\s+desta)/i);
  const bairroExpresso = explicit ? explicit[1].trim() : null;

  // Sugestão de revisão a partir de loteamento/núcleo/conjunto do cabeçalho IMÓVEL
  const sugMatch = clause.match(/(?:N[úu]cleo(?:\s+Urbano(?:\s+Informal)?)?|Conjunto\s+Habitacional|loteamento)\s+(?:denominad[oa]\s+)?["“]?([^,"”;\.]{3,70})["”]?/i);
  const bairroSugestao = sugMatch
    ? sugMatch[0].replace(/\bdenominad[oa]\s+/i, '').replace(/["“”]/g, '').replace(/\s+em\s+[A-ZÀ-Ÿ\s]+$/i, '').replace(/\s+/g, ' ').trim()
    : null;

  return {
    bairroExpresso,
    bairroSugestao,
    trechoBairro: clause.slice(0, 260).trim() || null,
  };
}

function extractEmpreendimentoFromOcr(texto, prenText) {
  const scope = `${prenText || ''} ${(texto || '').slice(0, 2200)}`.replace(/\s+/g, ' ');
  const patterns = [
    /(?:n[úu]cleo\s+urbano\s+informal(?:\s+consolidado)?|conjunto\s+habitacional|condom[ií]nio(?:\s+edil[ií]cio|\s+residencial)?|loteamento|parcelamento)\s+(?:denominad[oa]\s+|conhecid[oa]\s+como\s+)["“']?([A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9\s\.\-\/']{2,90}?)["”']?(?:[,;.\)]|\s+(?:com|situad|localizad|matriculad|no\s+distrito|neste|desta))/i,
    /(?:denominad[oa]|conhecid[oa]\s+como)\s+["“']([A-Za-zÀ-ÿ0-9][^"”']{2,90})["”']/i,
  ];
  for (const re of patterns) {
    const m = scope.match(re);
    if (m && m[1]) {
      const nome = m[1].replace(/\s+/g, ' ').trim().slice(0, 180);
      if (nome.length >= 3) {
        return {
          empreendimentoOcr: nome,
          trechoEmpreendimento: extractSnippet(scope, re, 110),
        };
      }
    }
  }
  return { empreendimentoOcr: null, trechoEmpreendimento: null };
}

function extractInterestFromOcr(prenText, fallbackText) {
  const scope = prenText || '';
  const hasArt69 = /art(?:igo|\.)?\s*69\b.{0,50}13\.?465|13\.?465.{0,80}art(?:igo|\.)?\s*69|\bREURB-I\b|\bREURB\s+INOMINAD|(?:implantad[oa]|anterior)\s+(?:antes\s+de|a|à)\s+19[\/\s]+(?:12|dezembro)[\/\s]+(?:de\s+)?1979/i.test(scope);
  if (hasArt69) {
    return {
      temArt69: true,
      tipoInteresseOcr: 3,
      trecho: extractSnippet(scope, /art(?:igo|\.)?\s*69\b|REURB-I|REURB\s+INOMINAD|19[\/\s]+(?:12|dezembro)[\/\s]+(?:de\s+)?1979/i, 120),
    };
  }
  const source = scope || (fallbackText || '');
  const isS = /\bREURB[\s-]*["“]?S["”]?\b|Interesse\s+Social/i.test(source);
  const isE = /\bREURB[\s-]*["“]?E["”]?\b|Interesse\s+Espec[ií]fico/i.test(source);
  if (isS && !isE) return { temArt69: false, tipoInteresseOcr: 1, trecho: null };
  if (isE && !isS) return { temArt69: false, tipoInteresseOcr: 2, trecho: null };
  return { temArt69: false, tipoInteresseOcr: null, trecho: null };
}

function extractOpenedRangesFromOcr(prenText, allowedDerivadasSet) {
  if (!prenText) return [];
  const linked = new Map();
  // Foca nos trechos após "FORAM ABERTAS" ou "Foram abertas"
  const abRe = /(?:FORAM\s+ABERTAS|Foram\s+abertas)[^;]{0,900}?(?:selo:|escrevente|$)/gi;
  for (const m of prenText.matchAll(abRe)) {
    const seg = m[0];
    for (const rm of seg.matchAll(/([0-9]{2,3}\.[0-9]{3})\s+(?:a|à)\s+([0-9]{2,3}\.[0-9]{3})/gi)) {
      const start = parseBrDotInt(rm[1]);
      const end = parseBrDotInt(rm[2]);
      if (start && end && end >= start && end - start <= 5000) {
        const snippet = seg.slice(0, 260).replace(/\s+/g, ' ').trim();
        for (let num = start; num <= end; num++) {
          if (allowedDerivadasSet.has(num) && !linked.has(num)) {
            linked.set(num, snippet);
          }
        }
      }
    }
    for (const pm of seg.matchAll(/([0-9]{2,3}\.[0-9]{3})\s+e\s+([0-9]{2,3}\.[0-9]{3})/gi)) {
      const snippet = seg.slice(0, 260).replace(/\s+/g, ' ').trim();
      for (const raw of [pm[1], pm[2]]) {
        const num = parseBrDotInt(raw);
        if (num && allowedDerivadasSet.has(num) && !linked.has(num)) {
          linked.set(num, snippet);
        }
      }
    }
  }
  return [...linked.entries()].map(([matriculaDerivada, trecho]) => ({ matriculaDerivada, trecho }));
}

function classifyMatrixOcr(row, texto, originInfo = null) {
  const prenText = extractPrenContext(texto, row.Prenotacao);
  const interest = extractInterestFromOcr(prenText, texto);
  const agent = extractAgentFromOcr(prenText);
  const bairro = extractBairroFromOcr(texto, prenText);
  const empreend = extractEmpreendimentoFromOcr(texto, prenText);
  const docRef = `SiplanIA.matricula ${row.Matricula}`;

  if (row.NegId === 947) {
    if (!texto) {
      const fallbackInd = row.Tem71 > 0 && row.QtdSeq0 === 0;
      if (originInfo && originInfo.texto && !fallbackInd) {
        const origBairro = extractBairroFromOcr(originInfo.texto, '');
        const origEmpreend = extractEmpreendimentoFromOcr(originInfo.texto, '');
        const origAgentRaw = extractAgentFromOcr(originInfo.texto);
        const origAgent = origAgentRaw.tipoAgente === 1
          ? origAgentRaw
          : { agente: null, tipoAgente: null, trecho: null };
        return {
          Prenotacao: row.Prenotacao,
          Matricula: row.Matricula,
          NegId: 947,
          Classificacao: 'MATRIZ_947',
          TemReurb: false,
          TemCrf: false,
          TemArt69: false,
          TipoInteresseOcr: null,
          AgenteOcr: origAgent.agente,
          TipoAgenteOcr: origAgent.tipoAgente,
          BairroExpressoOcr: origBairro.bairroExpresso,
          BairroSugestaoOcr: origBairro.bairroSugestao,
          MotivoClassificacao: `Matriz ainda sem OCR no SiplanIA; metadados complementados pelo OCR da matrícula de origem ${originInfo.matricula} vinculada à mesma prenotação`,
          DocumentoOcr: `SiplanIA.matricula ${originInfo.matricula} (origem na prot. ${row.Prenotacao})`,
          TrechoAgente: origAgent.trecho,
          TrechoBairro: origBairro.trechoBairro,
          TrechoClassificacao: `Sem OCR próprio na matrícula ${row.Matricula}; origem consultada: SiplanIA.matricula ${originInfo.matricula}`,
          EmpreendimentoOcr: origEmpreend.empreendimentoOcr,
          TrechoEmpreendimento: origEmpreend.trechoEmpreendimento,
        };
      }
      return {
        Prenotacao: row.Prenotacao,
        Matricula: row.Matricula,
        NegId: 947,
        Classificacao: fallbackInd ? 'TITULACAO_INDIVIDUAL_947' : 'MATRIZ_947',
        TemReurb: false,
        TemCrf: false,
        TemArt69: false,
        TipoInteresseOcr: null,
        AgenteOcr: null,
        TipoAgenteOcr: null,
        BairroExpressoOcr: null,
        BairroSugestaoOcr: null,
        MotivoClassificacao: 'Matrícula sem OCR no SiplanIA; classificação baseada no WEBRI',
        DocumentoOcr: docRef,
        TrechoAgente: null,
        TrechoBairro: null,
        TrechoClassificacao: 'Sem texto OCR no SiplanIA',
        EmpreendimentoOcr: null,
        TrechoEmpreendimento: null,
      };
    }

    const scope = prenText || stripOcrPageHeaders(texto.slice(-3200));
    const hasAbertura = /FORAM\s+ABERTAS|abertas,?\s*nesta\s+data|receberam\s+os\s+n['º°o]/i.test(scope);
    const hasProjeto = /Projeto\s+de\s+Regulariza[cç][aã]o\s+Fundi[aá]ria|subdividindo\s+a\s+[aá]rea\s+em/i.test(scope);
    const hasLegit = /TITULA[CÇG][AÃ]O\s+por|LEGITIM[A-Z]{1,6}[CÇ][AÃ]O\s+FUNDI[AÁ]R|[IL1]istagem\s+de\s+Benefici[aá]r|\bart\.?\s*23\b.{0,40}13\.?465/i.test(scope);
    const temReurb = /\bREURB(?:-[SEI])?\b|Regulariza[cç][aã]o\s+Fundi[aá]ria|13\.?465/i.test(scope);
    const temCrf = /Certid[aã]o\s+de\s+Regulariza[cç][aã]o\s+Fundi[aá]ria|\bCRF\b/i.test(scope);

    let classificacao = 'MATRIZ_947';
    let motivo = 'Matriz com registro de Projeto de Regularização Fundiária / CRF';
    if ((hasLegit && !hasAbertura && !hasProjeto) || (!hasAbertura && !hasProjeto && row.Tem71 > 0 && row.QtdSeq0 === 0)) {
      classificacao = 'TITULACAO_INDIVIDUAL_947';
      motivo = 'Ato 947 é titulação individual por legitimação fundiária (art. 23 Lei 13.465/2017)';
    }

    const trechoClass = extractSnippet(
      scope,
      classificacao === 'TITULACAO_INDIVIDUAL_947'
        ? /TITULA[CÇG][AÃ]O|LEGITIM[A-Z]{1,6}[CÇ][AÃ]O\s+FUNDI[AÁ]R|[IL1]istagem\s+de\s+Benefici[aá]r/i
        : /Regulariza[cç][aã]o\s+Fundi[aá]ria|Certid[aã]o\s+de\s+Regulariza[cç][aã]o|FORAM\s+ABERTAS/i,
      160
    );

    return {
      Prenotacao: row.Prenotacao,
      Matricula: row.Matricula,
      NegId: 947,
      Classificacao: classificacao,
      TemReurb: temReurb,
      TemCrf: temCrf,
      TemArt69: interest.temArt69,
      TipoInteresseOcr: interest.tipoInteresseOcr,
      AgenteOcr: agent.agente,
      TipoAgenteOcr: agent.tipoAgente,
      BairroExpressoOcr: bairro.bairroExpresso,
      BairroSugestaoOcr: bairro.bairroSugestao,
      MotivoClassificacao: motivo,
      DocumentoOcr: docRef,
      TrechoAgente: agent.trecho,
      TrechoBairro: bairro.trechoBairro,
      TrechoClassificacao: interest.trecho || trechoClass,
      EmpreendimentoOcr: empreend.empreendimentoOcr,
      TrechoEmpreendimento: empreend.trechoEmpreendimento,
    };
  }

  // NegId = 616 (Especificação de Condomínio)
  if (!texto) {
    return {
      Prenotacao: row.Prenotacao,
      Matricula: row.Matricula,
      NegId: 616,
      Classificacao: 'CONDOMINIO_616_INCONCLUSIVO',
      TemReurb: false,
      TemCrf: false,
      TemArt69: false,
      TipoInteresseOcr: null,
      AgenteOcr: null,
      TipoAgenteOcr: null,
      BairroExpressoOcr: null,
      BairroSugestaoOcr: null,
      MotivoClassificacao: 'Condomínio 616 sem OCR disponível no SiplanIA para confirmar REURB',
      DocumentoOcr: docRef,
      TrechoAgente: null,
      TrechoBairro: null,
      TrechoClassificacao: 'Sem texto OCR no SiplanIA',
      EmpreendimentoOcr: null,
      TrechoEmpreendimento: null,
    };
  }

  const prenHasReurb = /\bREURB(?:-[SEI])?\b|Certid[aã]o\s+de\s+Regulariza[cç][aã]o\s+Fundi[aá]ria|\bCRF\b|Lei\s+(?:Federal\s+)?n[º°o\.]*\s*13\.?465/i.test(prenText);
  const prenHasCrf = /Certid[aã]o\s+de\s+Regulariza[cç][aã]o\s+Fundi[aá]ria|\bCRF\b/i.test(prenText);
  const docHasReurb13465 = /\bREURB(?:-[SEI])?\b|Regulariza[cç][aã]o\s+Fundi[aá]ria.{0,120}(?:REURB|13\.?465)/i.test(texto);
  const docHas11977 = /11\.?977\/?2009/i.test(texto);
  const docHasRegularizacao = /regulariza[cç][aã]o/i.test(texto);

  let classificacao = 'CONDOMINIO_616_NAO_REURB';
  let motivo = 'Especificação de condomínio (616) sem menção a REURB/CRF no OCR';
  let trechoClass = prenText ? prenText.slice(0, 260) : texto.slice(-300);

  if (prenHasReurb || (docHasReurb13465 && prenText)) {
    classificacao = 'CONDOMINIO_616_REURB';
    motivo = prenHasCrf
      ? 'Condomínio 616 vinculado à REURB com CRF confirmada no OCR da prenotação'
      : 'Condomínio 616 vinculado à REURB (Lei 13.465/2017) confirmada no OCR da matrícula';
    trechoClass = extractSnippet(
      prenHasReurb ? prenText : texto,
      /Certid[aã]o\s+de\s+Regulariza[cç][aã]o\s+Fundi[aá]ria|\bREURB(?:-[SEI])?\b|13\.?465/i,
      160
    );
  } else if (docHasReurb13465 || docHas11977 || docHasRegularizacao) {
    classificacao = 'CONDOMINIO_616_INCONCLUSIVO';
    motivo = docHas11977 && !docHasReurb13465
      ? 'Matrícula cita Lei 11.977/2009 sem menção clara a REURB/CRF na prenotação — encaminhado para revisão'
      : 'Menção a regularização fora do trecho da prenotação — encaminhado para revisão';
    trechoClass = extractSnippet(texto, /regulariza[cç][aã]o|11\.?977|13\.?465|REURB/i, 160);
  }

  // Se o agente não apareceu no bloco da prenotação, tenta na abertura REURB da própria matrícula
  let agentFinal = agent;
  if (!agentFinal.agente && classificacao === 'CONDOMINIO_616_REURB') {
    const abReurb = extractSnippet(texto, /REURB|Regulariza[cç][aã]o\s+Fundi[aá]ria/i, 220);
    const ag2 = extractAgentFromOcr(abReurb);
    if (ag2.agente) agentFinal = ag2;
  }

  return {
    Prenotacao: row.Prenotacao,
    Matricula: row.Matricula,
    NegId: 616,
    Classificacao: classificacao,
    TemReurb: prenHasReurb || docHasReurb13465,
    TemCrf: prenHasCrf || /Certid[aã]o\s+de\s+Regulariza[cç][aã]o\s+Fundi[aá]ria|\bCRF\b/i.test(texto),
    TemArt69: interest.temArt69,
    TipoInteresseOcr: interest.tipoInteresseOcr,
    AgenteOcr: agentFinal.agente,
    TipoAgenteOcr: agentFinal.tipoAgente,
    BairroExpressoOcr: bairro.bairroExpresso,
    BairroSugestaoOcr: bairro.bairroSugestao,
    MotivoClassificacao: motivo,
    DocumentoOcr: docRef,
    TrechoAgente: agentFinal.trecho,
    TrechoBairro: bairro.trechoBairro,
    TrechoClassificacao: interest.trecho || trechoClass,
    EmpreendimentoOcr: empreend.empreendimentoOcr,
    TrechoEmpreendimento: empreend.trechoEmpreendimento,
  };
}

function classifyDerivadaHeader(mat, headTexto) {
  const norm = (headTexto || '').replace(/\s+/g, ' ').trim();
  const docRef = `SiplanIA.matricula ${mat}`;
  if (!norm) {
    return {
      Matricula: mat,
      Categoria: 'UNIDADE',
      EhAreaPublica: false,
      MotivoExclusao: null,
      DocumentoOcr: docRef,
      TrechoOcr: 'Sem texto OCR no SiplanIA',
    };
  }
  const imovelIdx = norm.search(/[IV]M[OÓ]VEL\s*:/i);
  const body = imovelIdx >= 0 ? norm.slice(imovelIdx) : norm;
  // Usa SOMENTE o cabeçalho de identificação do imóvel antes do memorial perimetral/confrontações
  const clause = body.split(/com\s+a\s+se[gq]uinte\s+descri|partindo[\s-]se|inicia[\s-]se|tem\s+in[ií]cio|confrontando|mede\s+/i)[0].trim();

  const checks = [
    {
      cat: 'APM',
      re: /\bAPM[\s-]?\d*\b|\b[AÁ]REA\s+P[UÚ]BLICA\b/i,
      motivo: 'Área Pública Municipal (APM) excluída da lista de unidades habitacionais',
    },
    {
      cat: 'VIA_PUBLICA',
      re: /\bleito\s+d[aeo]s?\b|\bsistema\s+vi[aá]rio\b|\bvia\s+p[uú]blica\b|\bleito\s+vi[aá]rio\b|\bviela\b|\bpra[cç]a\b|\bbal[aã]o\s+de\s+retorno\b/i,
      motivo: 'Via pública / sistema viário excluído da lista de unidades habitacionais',
    },
    {
      cat: 'AREA_INSTITUCIONAL',
      re: /\b[AÁ]REA\s+INSTITUCIONAL\b|\bEQUIPAMENTO\s+COMUNIT[AÁ]RIO\b/i,
      motivo: 'Área institucional excluída da lista de unidades habitacionais',
    },
    {
      cat: 'AREA_VERDE',
      re: /\b[AÁ]REA\s+VERDE\b|\bESPA[CÇ]O\s+LIVRE\b/i,
      motivo: 'Área verde / espaço livre excluído da lista de unidades habitacionais',
    },
    {
      cat: 'AREA_REMANESCENTE',
      re: /\b[AÁ]REA\s+REMANESCENTE\b/i,
      motivo: 'Área remanescente excluída da lista de unidades habitacionais',
    },
  ];

  for (const chk of checks) {
    if (chk.re.test(clause)) {
      return {
        Matricula: mat,
        Categoria: chk.cat,
        EhAreaPublica: true,
        MotivoExclusao: chk.motivo,
        DocumentoOcr: docRef,
        TrechoOcr: clause.slice(0, 260),
      };
    }
  }

  return {
    Matricula: mat,
    Categoria: 'UNIDADE',
    EhAreaPublica: false,
    MotivoExclusao: null,
    DocumentoOcr: docRef,
    TrechoOcr: clause.slice(0, 180),
  };
}

function validateOnrJson(parsed, options) {
  const errors = [];
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    errors.push('Raiz do JSON deve ser um objeto');
    return errors;
  }
  const keys = Object.keys(parsed);
  if (keys.length !== 1 || keys[0] !== 'regularizacoes' || !Array.isArray(parsed.regularizacoes)) {
    errors.push('Raiz do JSON deve conter apenas a chave "regularizacoes" (array)');
    return errors;
  }
  const isoDateRe = /^\d{4}-\d{2}-\d{2}$/;
  for (let i = 0; i < parsed.regularizacoes.length; i++) {
    const r = parsed.regularizacoes[i];
    const pfx = `regularizacoes[${i}] (mat=${r?.matricula})`;
    if (!Number.isInteger(r.matricula) || r.matricula <= 0) errors.push(`${pfx}: matricula deve ser inteiro > 0`);
    for (const [f, max] of [['municipio', 100], ['distrito', 30], ['bairro', 30], ['agente', 100]]) {
      if (typeof r[f] !== 'string' || !r[f].trim()) errors.push(`${pfx}: ${f} obrigatório não vazio`);
      else if (r[f].length > max) errors.push(`${pfx}: ${f} excede ${max} caracteres (${r[f].length})`);
    }
    if (r.subdistrito !== undefined && (typeof r.subdistrito !== 'string' || r.subdistrito.length > 30 || !r.subdistrito.trim())) {
      errors.push(`${pfx}: subdistrito opcional inválido`);
    }
    if (r.tipoLocalizacao !== 'U' && r.tipoLocalizacao !== 'R') errors.push(`${pfx}: tipoLocalizacao deve ser 'U' ou 'R'`);
    if (!Number.isInteger(r.quantidadeUnidades) || r.quantidadeUnidades <= 0) errors.push(`${pfx}: quantidadeUnidades deve ser inteiro > 0`);
    if (typeof r.dataRegistro !== 'string' || !isoDateRe.test(r.dataRegistro)) errors.push(`${pfx}: dataRegistro inválida (${r.dataRegistro})`);
    if (typeof r.dataPrenotacao !== 'string' || !isoDateRe.test(r.dataPrenotacao)) errors.push(`${pfx}: dataPrenotacao inválida (${r.dataPrenotacao})`);
    if (![1, 2, 3].includes(r.tipoInteresse)) errors.push(`${pfx}: tipoInteresse inválido (${r.tipoInteresse})`);
    if (r.tipoInteresse === 3 && !options.incluirArt69) errors.push(`${pfx}: tipoInteresse=3 bloqueado sem --incluir-art69`);
    if (![1, 2].includes(r.tipoAgente)) errors.push(`${pfx}: tipoAgente inválido (${r.tipoAgente})`);
    if (!Array.isArray(r.derivadas) || r.derivadas.length === 0) {
      errors.push(`${pfx}: derivadas deve ter ao menos 1 item`);
    } else {
      const seenDer = new Set();
      for (let j = 0; j < r.derivadas.length; j++) {
        const d = r.derivadas[j];
        const dpfx = `${pfx}.derivadas[${j}] (mat=${d?.matricula})`;
        if (!Number.isInteger(d.matricula) || d.matricula <= 0) errors.push(`${dpfx}: matricula deve ser inteiro > 0`);
        if (seenDer.has(d.matricula)) errors.push(`${dpfx}: matrícula derivada duplicada`);
        seenDer.add(d.matricula);
        if (d.dataAbertura !== null && d.dataAbertura !== undefined && (typeof d.dataAbertura !== 'string' || !isoDateRe.test(d.dataAbertura))) {
          errors.push(`${dpfx}: dataAbertura deve ser yyyy-mm-dd ou null (${d.dataAbertura})`);
        }
        if (d.dataRegistro !== null && d.dataRegistro !== undefined && (typeof d.dataRegistro !== 'string' || !isoDateRe.test(d.dataRegistro))) {
          errors.push(`${dpfx}: dataRegistro deve ser yyyy-mm-dd ou null (${d.dataRegistro})`);
        }
        if (![1, 2, 3].includes(d.tipoInteresse)) errors.push(`${dpfx}: tipoInteresse inválido (${d.tipoInteresse})`);
      }
    }
  }
  return errors;
}

(async () => {
  let script = fs.readFileSync(path.join(root, 'sql', 'reurb_onr_importar_em_lote.sql'), 'utf8').replace(/^\uFEFF/, '');

  if (semFiliacao) script = script.replace('DECLARE @UsarFiliacao                     BIT          = 1;', 'DECLARE @UsarFiliacao                     BIT          = 0;');
  if (sem616) script = script.replace('DECLARE @IncluirCondominio616             BIT          = 1;', 'DECLARE @IncluirCondominio616             BIT          = 0;');
  if (incluirArt69) script = script.replace('DECLARE @IncluirArt69                     BIT          = 0;', 'DECLARE @IncluirArt69                     BIT          = 1;');
  if (incluirApmDerivadas) script = script.replace('DECLARE @IncluirAreasPublicasEmDerivadas  BIT          = 0;', 'DECLARE @IncluirAreasPublicasEmDerivadas  BIT          = 1;');
  if (incluirApmUnidades) script = script.replace('DECLARE @IncluirAreasPublicasEmQtdUnidades BIT         = 0;', 'DECLARE @IncluirAreasPublicasEmQtdUnidades BIT         = 1;');
  if (permitirAbrevBairro) script = script.replace('DECLARE @PermitirAbreviacaoBairro         BIT          = 0;', 'DECLARE @PermitirAbreviacaoBairro         BIT          = 1;');

  if (prenList.length === 1) {
    script = script
      .replace('DECLARE @PrenotacaoDe                     INT          = NULL;', `DECLARE @PrenotacaoDe                     INT          = ${prenList[0]};`)
      .replace('DECLARE @PrenotacaoAte                    INT          = NULL;', `DECLARE @PrenotacaoAte                    INT          = ${prenList[0]};`);
  } else if (prenList.length > 1) {
    script = script.replace(
      'DECLARE @PrenotacoesLista                 VARCHAR(MAX) = NULL;',
      `DECLARE @PrenotacoesLista                 VARCHAR(MAX) = '${prenList.join(',')}';`
    );
  }

  if (regDeFlag.specified) {
    script = script.replace(
      "DECLARE @DataRegistroDe                   DATE         = '2017-07-11';",
      `DECLARE @DataRegistroDe                   DATE         = ${regDeFlag.value ? `'${regDeFlag.value}'` : 'NULL'};`
    );
  }
  if (effectiveRegAte) {
    script = script.replace(
      'DECLARE @DataRegistroAte                  DATE         = NULL;',
      `DECLARE @DataRegistroAte                  DATE         = '${effectiveRegAte}';`
    );
  }
  if (effectivePrenDe) {
    script = script.replace(
      'DECLARE @DataPrenotacaoDe                 DATE         = NULL;',
      `DECLARE @DataPrenotacaoDe                 DATE         = '${effectivePrenDe}';`
    );
  }
  if (effectivePrenAte) {
    script = script.replace(
      'DECLARE @DataPrenotacaoAte                DATE         = NULL;',
      `DECLARE @DataPrenotacaoAte                DATE         = '${effectivePrenAte}';`
    );
  }

  if (manualPath) {
    const manualRows = JSON.parse(fs.readFileSync(path.resolve(manualPath), 'utf8'));
    if (!Array.isArray(manualRows)) throw new Error('--manual deve apontar para um array JSON');
    const manualSql = manualRows.map(m =>
      `INSERT #Manual VALUES (${sqlInt(m.prenotacao)}, ${sqlInt(m.matricula)}, ${sqlStr(m.bairro, 100)}, ${sqlStr(m.agente, 150)}, ${sqlInt(m.tipoAgente)}, ${sqlStr(m.distrito, 60)}, ${sqlStr(m.municipio, 100)}, ${sqlStr(m.fonteDocumento, 200)});`
    ).join('\n');
    script = script.replace('-- INSERT #Manual VALUES (572013, 188228, N\'NOME DO BAIRRO\', N\'MUNICIPALIDADE DE SÃO PAULO\', 1, NULL, NULL, N\'CRF de 17/09/2024\');', manualSql);
  }

  const pool = await sql.connect({
    server: process.env.SQL_SERVER_HOST,
    port: 1433,
    database: 'WEBRI',
    user: process.env.SQL_SERVER_USER,
    password: process.env.SQL_SERVER_PASSWORD,
    options: { encrypt: false, trustServerCertificate: true },
    requestTimeout: 180000,
  });

  if (!semOcr) {
    const req = pool.request();
    req.input('regDe', sql.Date, effectiveRegDe);
    req.input('regAte', sql.Date, effectiveRegAte);
    req.input('prenDe', sql.Date, effectivePrenDe);
    req.input('prenAte', sql.Date, effectivePrenAte);
    req.input('prenLista', sql.VarChar(sql.MAX), prenList.length ? prenList.join(',') : null);

    const candMatRs = await req.query(`
      SET NOCOUNT ON;
      SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
      SET LOCK_TIMEOUT 2000;

      DECLARE @Pf TABLE (Pren INT PRIMARY KEY);
      IF @prenLista IS NOT NULL
      BEGIN
        DECLARE @x XML = CAST('<x>' + REPLACE(@prenLista, ',', '</x><x>') + '</x>' AS XML);
        INSERT INTO @Pf (Pren)
        SELECT DISTINCT TRY_CAST(n.value('.', 'VARCHAR(20)') AS INT)
        FROM @x.nodes('/x') AS t(n)
        WHERE TRY_CAST(n.value('.', 'VARCHAR(20)') AS INT) IS NOT NULL;
      END;
      DECLARE @TemPf BIT = CASE WHEN EXISTS (SELECT 1 FROM @Pf) THEN 1 ELSE 0 END;

      ;WITH base AS (
        SELECT
          rc.PK_FlagRecepcao AS Flag,
          rc.PK_Recepcao AS Prenotacao,
          r.PK_Num_Livro AS Matricula,
          an.FK_tblWRINegocios_Id AS NegId,
          MIN(a.DataAto) AS DataRegistro,
          MAX(rc.DtPrenotacao) AS DtPrenotacao,
          MIN(an.PK_ID) AS AtoNegId
        FROM dbo.tblWRIAtos a WITH (NOLOCK)
        JOIN dbo.tblWRIAtosNegocios an WITH (NOLOCK) ON an.FK_tblWRIAtos_Id = a.PK_Id AND an.FK_tblWRINegocios_Id IN (947, 616)
        JOIN dbo.tblWRIReal r WITH (NOLOCK)          ON r.PK_Id = a.FK_tblWRIReal_Id AND r.FK_tblWRILivro_Id = 2
        JOIN dbo.tblWRIAtosTitulos at WITH (NOLOCK)  ON at.FK_tblWRIAtos_Id = a.PK_Id
        JOIN dbo.tblWRIRecepcao rc WITH (NOLOCK)     ON rc.PK_FlagRecepcao = at.FK_tblWRIRecepcaoFlagRecepcao AND rc.PK_Recepcao = at.FK_tblWRIRecepcaoRecepcao
        WHERE rc.TipoPrenotacao IN (13, 27)
          AND (@TemPf = 0 OR EXISTS (SELECT 1 FROM @Pf pf WHERE pf.Pren = rc.PK_Recepcao))
          AND (@prenDe IS NULL OR rc.DtPrenotacao >= @prenDe)
          AND (@prenAte IS NULL OR rc.DtPrenotacao < DATEADD(DAY, 1, @prenAte))
        GROUP BY rc.PK_FlagRecepcao, rc.PK_Recepcao, r.PK_Num_Livro, an.FK_tblWRINegocios_Id
      )
      SELECT
        b.Flag,
        b.Prenotacao,
        b.Matricula,
        b.NegId,
        (SELECT COUNT(*) FROM dbo.tblWRIAtosParticipantes p WITH (NOLOCK) WHERE p.FK_tblWRIAtosNegocios_Id = b.AtoNegId AND p.FK_tblWRITpParticipacao_Id = 71) AS Tem71,
        (SELECT COUNT(DISTINCT ab.FK_tblWRIReal_Id) FROM dbo.tblWRIAtosTitulos at0 WITH (NOLOCK) JOIN dbo.tblWRIAtos ab WITH (NOLOCK) ON ab.PK_Id = at0.FK_tblWRIAtos_Id AND ab.PK_SeqAto = 0 JOIN dbo.tblWRIReal rd WITH (NOLOCK) ON rd.PK_Id = ab.FK_tblWRIReal_Id AND rd.FK_tblWRILivro_Id = 2 WHERE at0.FK_tblWRIRecepcaoFlagRecepcao = b.Flag AND at0.FK_tblWRIRecepcaoRecepcao = b.Prenotacao) AS QtdSeq0
      FROM base b
      WHERE (@regDe IS NULL OR (b.DataRegistro IS NOT NULL AND CONVERT(date, b.DataRegistro) >= @regDe) OR (b.DataRegistro IS NULL AND CONVERT(date, b.DtPrenotacao) >= @regDe))
        AND (@regAte IS NULL OR (b.DataRegistro IS NOT NULL AND CONVERT(date, b.DataRegistro) <= @regAte) OR (b.DataRegistro IS NULL AND CONVERT(date, b.DtPrenotacao) <= @regAte));
    `);

    const candMatrizes = candMatRs.recordset;
    const prenDoFiltro = [...new Set(candMatrizes.map(r => r.Prenotacao))];

    let candDerivadas = [];
    if (prenDoFiltro.length) {
      const reqDer = pool.request();
      reqDer.input('prenLista', sql.VarChar(sql.MAX), prenDoFiltro.join(','));
      const candDerRs = await reqDer.query(`
        SET NOCOUNT ON;
        SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
        SET LOCK_TIMEOUT 2000;

        DECLARE @Pf TABLE (Pren INT PRIMARY KEY);
        DECLARE @x XML = CAST('<x>' + REPLACE(@prenLista, ',', '</x><x>') + '</x>' AS XML);
        INSERT INTO @Pf (Pren)
        SELECT DISTINCT TRY_CAST(n.value('.', 'VARCHAR(20)') AS INT)
        FROM @x.nodes('/x') AS t(n)
        WHERE TRY_CAST(n.value('.', 'VARCHAR(20)') AS INT) IS NOT NULL;

        SELECT DISTINCT rc.PK_Recepcao AS Prenotacao, rd.PK_Num_Livro AS Matricula
        FROM @Pf pf
        JOIN dbo.tblWRIRecepcao rc WITH (NOLOCK)    ON rc.PK_Recepcao = pf.Pren AND rc.TipoPrenotacao IN (13, 27)
        JOIN dbo.tblWRIAtosTitulos at WITH (NOLOCK) ON at.FK_tblWRIRecepcaoFlagRecepcao = rc.PK_FlagRecepcao AND at.FK_tblWRIRecepcaoRecepcao = rc.PK_Recepcao
        JOIN dbo.tblWRIAtos ab WITH (NOLOCK)        ON ab.PK_Id = at.FK_tblWRIAtos_Id AND ab.PK_SeqAto = 0
        JOIN dbo.tblWRIReal rd WITH (NOLOCK)        ON rd.PK_Id = ab.FK_tblWRIReal_Id AND rd.FK_tblWRILivro_Id = 2;
      `);
      candDerivadas = candDerRs.recordset;
    }

    const pg = new Client({
      host: process.env.SIPLANIA_HOST || '10.0.0.6',
      port: Number(process.env.SIPLANIA_POSTGRES_PORT || 5432),
      database: process.env.SIPLANIA_POSTGRES_DB || 'SiplanIA',
      user: process.env.SIPLANIA_POSTGRES_USER || 'fiorix_reader',
      password: process.env.SIPLANIA_POSTGRES_PASSWORD,
      statement_timeout: 120000,
    });
    await pg.connect();
    await pg.query('SET default_transaction_read_only = on');

    // 1) OCR completo das matrizes candidatas (indexado por numero)
    const matNums = [...new Set(candMatrizes.map(r => r.Matricula))];
    const matrixTextMap = new Map();
    for (const batch of chunkArray(matNums, 500)) {
      const r = await pg.query('SELECT numero::int AS mat, texto FROM matricula WHERE numero = ANY($1::bigint[])', [batch]);
      for (const row of r.rows) matrixTextMap.set(row.mat, row.texto || '');
    }

    const missingOcrMats = candMatrizes.filter(r => r.NegId === 947 && !matrixTextMap.get(r.Matricula));
    const originInfoByKey = new Map();
    if (missingOcrMats.length > 0) {
      const missingPrens = [...new Set(missingOcrMats.map(r => r.Prenotacao))];
      let originCandidates = [];
      for (const pBatch of chunkArray(missingPrens, 500)) {
        const reqOrig = pool.request();
        reqOrig.input('prenLista', sql.VarChar(sql.MAX), pBatch.join(','));
        const origRs = await reqOrig.query(`
          SET NOCOUNT ON;
          SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;
          SET LOCK_TIMEOUT 2000;

          DECLARE @Pf TABLE (Pren INT PRIMARY KEY);
          DECLARE @x XML = CAST('<x>' + REPLACE(@prenLista, ',', '</x><x>') + '</x>' AS XML);
          INSERT INTO @Pf (Pren)
          SELECT DISTINCT TRY_CAST(n.value('.', 'VARCHAR(20)') AS INT)
          FROM @x.nodes('/x') AS t(n)
          WHERE TRY_CAST(n.value('.', 'VARCHAR(20)') AS INT) IS NOT NULL;

          SELECT
            rc.PK_Recepcao AS Prenotacao,
            r.PK_Num_Livro AS MatriculaOrigem,
            MIN(CASE WHEN an.FK_tblWRINegocios_Id = 50 THEN 1 WHEN an.FK_tblWRINegocios_Id = 946 THEN 2 ELSE 3 END) AS Prioridade
          FROM @Pf pf
          JOIN dbo.tblWRIRecepcao rc WITH (NOLOCK)   ON rc.PK_Recepcao = pf.Pren AND rc.TipoPrenotacao IN (13, 27)
          JOIN dbo.tblWRIAtosTitulos at WITH (NOLOCK) ON at.FK_tblWRIRecepcaoFlagRecepcao = rc.PK_FlagRecepcao AND at.FK_tblWRIRecepcaoRecepcao = rc.PK_Recepcao
          JOIN dbo.tblWRIAtos a WITH (NOLOCK)        ON a.PK_Id = at.FK_tblWRIAtos_Id AND a.PK_SeqAto > 0
          JOIN dbo.tblWRIReal r WITH (NOLOCK)        ON r.PK_Id = a.FK_tblWRIReal_Id AND r.FK_tblWRILivro_Id = 2
          LEFT JOIN dbo.tblWRIAtosNegocios an WITH (NOLOCK) ON an.FK_tblWRIAtos_Id = a.PK_Id
          WHERE an.FK_tblWRINegocios_Id IN (50, 946, 614, 947)
          GROUP BY rc.PK_Recepcao, r.PK_Num_Livro
          ORDER BY rc.PK_Recepcao, Prioridade ASC, r.PK_Num_Livro ASC;
        `);
        originCandidates = originCandidates.concat(origRs.recordset || []);
      }

      const origByPren = new Map();
      const allOrigNums = new Set();
      for (const oc of originCandidates) {
        const pren = Number(oc.Prenotacao);
        const matOrig = Number(oc.MatriculaOrigem);
        if (!Number.isInteger(pren) || !Number.isInteger(matOrig) || matOrig <= 0) continue;
        if (!origByPren.has(pren)) origByPren.set(pren, []);
        origByPren.get(pren).push({ matricula: matOrig, prioridade: Number(oc.Prioridade || 3) });
        allOrigNums.add(matOrig);
      }

      const origTextMap = new Map();
      for (const batch of chunkArray([...allOrigNums], 200)) {
        const r = await pg.query('SELECT numero::int AS mat, texto FROM matricula WHERE numero = ANY($1::bigint[])', [batch]);
        for (const row of r.rows) {
          if (row.texto) origTextMap.set(row.mat, String(row.texto));
        }
      }

      for (const row of missingOcrMats) {
        const cands = (origByPren.get(row.Prenotacao) || [])
          .filter(c => c.matricula < row.Matricula)
          .sort((a, b) => a.prioridade - b.prioridade || a.matricula - b.matricula);
        const hit = cands.find(c => Boolean(origTextMap.get(c.matricula)));
        if (hit) {
          originInfoByKey.set(`${row.Prenotacao}|${row.Matricula}`, {
            matricula: hit.matricula,
            texto: origTextMap.get(hit.matricula),
          });
        }
      }
    }

    const derByPren = new Map();
    for (const d of candDerivadas) {
      if (!derByPren.has(d.Prenotacao)) derByPren.set(d.Prenotacao, new Set());
      derByPren.get(d.Prenotacao).add(d.Matricula);
    }

    const ocrMatrizRows = [];
    for (const row of candMatrizes) {
      const texto = matrixTextMap.get(row.Matricula) || '';
      const originInfo = originInfoByKey.get(`${row.Prenotacao}|${row.Matricula}`) || null;
      ocrMatrizRows.push(classifyMatrixOcr(row, texto, originInfo));
    }

    const validMatricesByPren = new Map();
    for (const r of ocrMatrizRows) {
      if (r.Classificacao === 'TITULACAO_INDIVIDUAL_947' || r.Classificacao === 'CONDOMINIO_616_NAO_REURB') continue;
      if (!validMatricesByPren.has(r.Prenotacao)) validMatricesByPren.set(r.Prenotacao, new Set());
      validMatricesByPren.get(r.Prenotacao).add(r.Matricula);
    }
    const multiMatrixPrens = new Set(
      [...validMatricesByPren.entries()].filter(([, set]) => set.size > 1).map(([pren]) => pren)
    );

    const ocrOrigemRows = [];
    const seenOrigemKeys = new Set();
    const avCovered = new Set();
    const pushOrigem = (item) => {
      const key = `${item.Prenotacao}|${item.MatriculaDerivada}|${item.MatriculaMatriz}|${item.Metodo}`;
      if (seenOrigemKeys.has(key)) return;
      seenOrigemKeys.add(key);
      ocrOrigemRows.push(item);
    };

    for (const info of ocrMatrizRows) {
      if (!multiMatrixPrens.has(info.Prenotacao)) continue;
      const texto = matrixTextMap.get(info.Matricula) || '';
      if (!texto) continue;
      const prenText = extractPrenContext(texto, info.Prenotacao);
      const allowedDer = derByPren.get(info.Prenotacao) || new Set();
      const ranges = extractOpenedRangesFromOcr(prenText, allowedDer);
      for (const rg of ranges) {
        if (rg.matriculaDerivada === info.Matricula) continue;
        avCovered.add(`${info.Prenotacao}|${rg.matriculaDerivada}`);
        pushOrigem({
          Prenotacao: info.Prenotacao,
          MatriculaDerivada: rg.matriculaDerivada,
          MatriculaMatriz: info.Matricula,
          Metodo: 'AV_FAIXA_MATRIZ',
          DocumentoOcr: info.DocumentoOcr,
          TrechoOcr: null,
        });
      }
    }

    // 2) OCR cabeçalho das derivadas candidatas (indexado por numero)
    const derNums = [...new Set(candDerivadas.map(d => d.Matricula))];
    const derHeadMap = new Map();
    for (const batch of chunkArray(derNums, 2000)) {
      const r = await pg.query('SELECT numero::int AS mat, left(texto, 1600) AS head FROM matricula WHERE numero = ANY($1::bigint[])', [batch]);
      for (const row of r.rows) derHeadMap.set(row.mat, row.head || '');
    }

    const ocrDerivadaRows = [];
    for (const mat of derNums) {
      const classified = classifyDerivadaHeader(mat, derHeadMap.get(mat) || '');
      if (classified.EhAreaPublica) ocrDerivadaRows.push(classified);
    }

    // Para prenotações multimatrícula, busca REGISTRO ANTERIOR apenas das derivadas ainda não cobertas por AV_FAIXA_MATRIZ
    const uncoveredMultiDer = candDerivadas.filter(d =>
      multiMatrixPrens.has(d.Prenotacao) && !avCovered.has(`${d.Prenotacao}|${d.Matricula}`)
    );
    const uncoveredDerNums = [...new Set(uncoveredMultiDer.map(d => d.Matricula))];
    const derOrigMap = new Map();
    for (const batch of chunkArray(uncoveredDerNums, 1000)) {
      const r = await pg.query(`
        SELECT numero::int AS mat,
               substring(left(texto, 7000) from '(?i)(?:matr[ií]cula\\s+de\\s+origem.{0,80}|REGISTROS?\\s+ANTERIOR(?:ES)?\\s*:.{0,250}.{0,250}.{0,200})') AS orig_trecho
        FROM matricula
        WHERE numero = ANY($1::bigint[])
      `, [batch]);
      for (const row of r.rows) derOrigMap.set(row.mat, row.orig_trecho || '');
    }
    await pg.end();

    for (const d of uncoveredMultiDer) {
      const origTrecho = derOrigMap.get(d.Matricula);
      if (!origTrecho) continue;
      const t = origTrecho.split(/\bselo\b|\bAv\.\s*0?1\b/i)[0];
      const matsInPren = validMatricesByPren.get(d.Prenotacao) || new Set();
      const cited = new Set();
      for (const mm of t.matchAll(/matr[ií]culas?\s*n?\S{0,4}\s*([0-9]{1,3}(?:\.[0-9]{3})+|[0-9]{3,7})/gi)) {
        const n = parseBrDotInt(mm[1]);
        if (n && n !== d.Matricula && matsInPren.has(n)) cited.add(n);
      }
      for (const mm of t.matchAll(/origem\s+(?:de\s+)?n\S{0,2}\s*([0-9]{1,3}(?:\.[0-9]{3})+|[0-9]{3,7})/gi)) {
        const n = parseBrDotInt(mm[1]);
        if (n && n !== d.Matricula && matsInPren.has(n)) cited.add(n);
      }
      for (const matOrigem of cited) {
        pushOrigem({
          Prenotacao: d.Prenotacao,
          MatriculaDerivada: d.Matricula,
          MatriculaMatriz: matOrigem,
          Metodo: 'OCR_MATRICULA_ORIGEM',
          DocumentoOcr: `SiplanIA.matricula ${d.Matricula}`,
          TrechoOcr: null,
        });
      }
    }

    // Monta blocos INSERT para #OcrMatriz, #OcrOrigem, #OcrDerivada (compactos p/ SQL Server 2012)
    let insMatriz = '';
    for (const batch of chunkArray(ocrMatrizRows, 200)) {
      insMatriz += 'INSERT INTO #OcrMatriz VALUES\n' + batch.map(r =>
        `(${sqlInt(r.Prenotacao)},${sqlInt(r.Matricula)},${sqlInt(r.NegId)},${sqlStr(r.Classificacao, 40)},${sqlBit(r.TemReurb)},${sqlBit(r.TemCrf)},${sqlBit(r.TemArt69)},${sqlInt(r.TipoInteresseOcr)},${sqlStr(r.AgenteOcr, 200)},${sqlInt(r.TipoAgenteOcr)},${sqlStr(r.BairroExpressoOcr, 200)},${sqlStr(r.BairroSugestaoOcr, 200)},${sqlStr(r.MotivoClassificacao, 300)},${sqlStr(r.DocumentoOcr, 120)},${sqlStr(r.TrechoAgente, 390)},${sqlStr(r.TrechoBairro, 390)},${sqlStr(r.TrechoClassificacao, 390)},${sqlStr(r.EmpreendimentoOcr, 180)},${sqlStr(r.TrechoEmpreendimento, 390)})`
      ).join(',\n') + ';\n';
    }

    let insOrigem = '';
    for (const batch of chunkArray(ocrOrigemRows, 400)) {
      insOrigem += 'INSERT INTO #OcrOrigem VALUES\n' + batch.map(r =>
        `(${sqlInt(r.Prenotacao)},${sqlInt(r.MatriculaDerivada)},${sqlInt(r.MatriculaMatriz)},${sqlStr(r.Metodo, 40)},${sqlStr(r.DocumentoOcr, 120)},${sqlStr(r.TrechoOcr, 290)})`
      ).join(',\n') + ';\n';
    }

    let insDerivada = '';
    for (const batch of chunkArray(ocrDerivadaRows, 300)) {
      insDerivada += 'INSERT INTO #OcrDerivada VALUES\n' + batch.map(r =>
        `(${sqlInt(r.Matricula)},${sqlStr(r.Categoria, 30)},${sqlBit(r.EhAreaPublica)},${sqlStr(r.MotivoExclusao, 200)},${sqlStr(r.DocumentoOcr, 120)},${sqlStr(r.TrechoOcr, 290)})`
      ).join(',\n') + ';\n';
    }

    script = script
      .replace('-- @@OCR_MATRIZ@@', insMatriz)
      .replace('-- @@OCR_ORIGEM@@', insOrigem)
      .replace('-- @@OCR_DERIVADA@@', insDerivada);

    console.error(`OCR: ${matNums.length} matrizes candidatas (${matrixTextMap.size} com OCR), ${derNums.length} derivadas candidatas (${derHeadMap.size} com OCR, ${ocrDerivadaRows.length} áreas públicas/não-habitacionais), ${ocrOrigemRows.length} vínculos OCR (${multiMatrixPrens.size} prenotações multimatrícula)`);
  }

  const res = await pool.request().query(script);
  await pool.close();

  const [jsonRs, alertas, rascunho, resumoRs, origens] = res.recordsets;
  const jsonText = (jsonRs && jsonRs[0] && jsonRs[0].json_importacao) ? jsonRs[0].json_importacao : '{"regularizacoes":[]}';
  const parsed = JSON.parse(jsonText);

  const schemaErrors = validateOnrJson(parsed, {
    incluirArt69,
    incluirApmDerivadas,
    incluirApmUnidades,
  });
  if (schemaErrors.length) {
    throw new Error(`Validação ONR JSON falhou (${schemaErrors.length} erro(s)):\n - ${schemaErrors.slice(0, 15).join('\n - ')}`);
  }

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'reurb_importacao_onr.json'), JSON.stringify(parsed, null, 2), 'utf8');
  fs.writeFileSync(path.join(outDir, 'reurb_alertas.csv'), csv(alertas), 'utf8');
  fs.writeFileSync(path.join(outDir, 'reurb_rascunho.csv'), csv(rascunho), 'utf8');
  fs.writeFileSync(path.join(outDir, 'reurb_origens.csv'), csv(origens), 'utf8');

  const nDerJson = parsed.regularizacoes.reduce((s, r) => s + r.derivadas.length, 0);
  const porSev = alertas.reduce((m, a) => {
    m[a.Severidade] = (m[a.Severidade] || 0) + 1;
    return m;
  }, {});

  console.log(JSON.stringify({
    validacaoSchemaOnr: 'OK',
    aptasJson: parsed.regularizacoes.length,
    derivadasNoJson: nDerJson,
    rascunho: rascunho.length,
    alertas: alertas.length,
    porSeveridade: porSev,
    resumo: resumoRs && resumoRs[0] ? resumoRs[0] : null,
  }, null, 2));
})().catch(e => {
  console.error('ERRO:', e.message);
  process.exit(1);
});
