import { createHash, verify as cryptoVerify, X509Certificate } from 'node:crypto';

export type StatusAuditoriaAssinatura =
  | 'NENHUMA_ASSINATURA_DETECTADA'
  | 'ASSINATURA_DETECTADA_VALIDACAO_PENDENTE'
  | 'VALIDACAO_INCONCLUSIVA'
  | 'ASSINATURA_VALIDA'
  | 'ASSINATURA_INVALIDA'
  | 'FALHA_ANALISE_ARQUIVO';

export type PapelCertificadoAuditado =
  | 'SIGNATARIO'
  | 'AUTORIDADE_CERTIFICADORA'
  | 'CARIMBO_TEMPO_TSA'
  | 'COMPONENTE_CADEIA';

export interface CertificadoAuditado {
  papel: PapelCertificadoAuditado;
  nome_exibicao: string;
  documento_mascarado: string | null;
  emissor_ac: string;
  organizacao: string;
  unidade_organizacional: string | null;
  numero_serie: string;
  validade_inicio: string;
  validade_fim: string;
  email: string | null;
  eh_autoridade_certificadora: boolean;
  eh_carimbo_tempo: boolean;
}

export interface ConferenciaExternaAssinatura {
  id: string;
  hash_sha256: string;
  resultado: 'VALIDA' | 'INVALIDA' | 'INCONCLUSIVA';
  responsavel_nome: string;
  responsavel_id?: string | null;
  data_conferencia: string;
  orgao_verificador: string;
  relatorio_conformidade: string;
  origem_registro: 'MANUAL_EXTERNO' | 'INTEGRACAO_VERIFICAVEL';
  hash_compativel_com_arquivo_atual: boolean;
}

export interface VerificacaoTecnicaExecutada {
  leitura_estrutura_pdf: boolean;
  calculo_hash_sha256_arquivo: boolean;
  extracao_dicionarios_byterange_contents: boolean;
  decodificacao_asn1_cms_pkcs7: boolean;
  leitura_certificados_x509: boolean;
  verificacao_alinhamento_byterange: boolean;
  verificacao_hash_message_digest: boolean;
  verificacao_assinatura_chave_publica_x509: boolean;
  consulta_revogacao_lcr_ocsp_online: boolean;
  validacao_cadeia_iti_online: boolean;
}

export interface DetalheAssinaturaPdf {
  signatario: string;
  documento_mascarado?: string | null;
  emissor: string;
  data_assinatura: string;
  subfilter: string;
  algoritmo_hash?: string;
  integridade: string;
  status_tecnico?:
    | 'VALIDA_CRIPTOGRAFICAMENTE'
    | 'ASSINATURA_CMS_INTEGRA_BYTERANGE_PARCIAL'
    | 'PENDENTE_VALIDACAO_EXTERNA'
    | 'INCONCLUSIVA'
    | 'INVALIDA';
  motivo_tecnico?: string | null;
  cobertura_byterange?:
    | 'INTEGRAL'
    | 'PARCIAL_INCREMENTAL'
    | 'DESALINHADO_PDF_MESCLADO'
    | 'INVALIDO_FORA_LIMITES'
    | 'NAO_APLICAVEL';
  numero_serie?: string | null;
  validade_certificado?: string | null;
  cpf_cnpj?: string | null;
  email?: string | null;
}

export interface AnaliseAssinaturaPdf {
  versao_motor: number;
  status_auditoria: StatusAuditoriaAssinatura;
  status_validade: string;
  possui_assinatura_criptografica: boolean;
  possui_indicio_visual_sem_criptografia: boolean;
  hash_sha256: string | null;
  tamanho_bytes: number | null;
  modificado_em: string | null;
  auditado_em: string;
  origem_resultado:
    | 'INSPECAO_TECNICA_AUTOMATICA_LOCAL'
    | 'CONFERENCIA_EXTERNA_MANUAL'
    | 'INTEGRACAO_VERIFICAVEL';
  origem_validacao: string;
  alcance_validacao: string;
  motivo_status: string;
  aviso_juridico: string;
  padrao_detectado: string;
  signatarios_detectados: string[];
  certificados_signatarios: CertificadoAuditado[];
  autoridades_certificadoras: CertificadoAuditado[];
  outros_componentes_cadeia: CertificadoAuditado[];
  detalhes_assinaturas: DetalheAssinaturaPdf[];
  verificacoes_executadas: VerificacaoTecnicaExecutada;
  conferencia_externa: ConferenciaExternaAssinatura | null;
  conferencia_externa_invalidada_por_alteracao?: boolean;
  titulo_exigencia: string;
  texto_nota_devolucao: string;
}

export const AVISO_JURIDICO_ASSINATURA =
  'A verificação técnica de assinatura digital afere apenas parâmetros criptográficos e estruturais do arquivo; não comprova a veracidade do conteúdo do documento nem determina, por si só, sua aceitação jurídica ou dispensa de qualificação registral.';

interface Asn1Node {
  tag: number;
  headerLen: number;
  len: number;
  raw: Buffer;
  value: Buffer;
}

function readAsn1(buf: Buffer, offset = 0): Asn1Node | null {
  if (offset < 0 || offset + 2 > buf.length) return null;
  const tag = buf[offset];
  const lenByte = buf[offset + 1];
  let len = 0;
  let headerLen = 2;
  if ((lenByte & 0x80) === 0) {
    len = lenByte;
  } else {
    const numBytes = lenByte & 0x7f;
    if (numBytes === 0 || numBytes > 4 || offset + 2 + numBytes > buf.length) return null;
    for (let i = 0; i < numBytes; i++) {
      len = (len << 8) | buf[offset + 2 + i];
    }
    headerLen = 2 + numBytes;
  }
  const start = offset + headerLen;
  const end = start + len;
  if (end > buf.length || len < 0) return null;
  return {
    tag,
    headerLen,
    len,
    raw: buf.subarray(offset, end),
    value: buf.subarray(start, end),
  };
}

function readAsn1Children(node: Asn1Node): Asn1Node[] {
  const out: Asn1Node[] = [];
  let p = 0;
  while (p < node.value.length) {
    const child = readAsn1(node.value, p);
    if (!child || child.raw.length === 0) break;
    out.push(child);
    p += child.raw.length;
  }
  return out;
}

function decodeOid(oidBytes: Buffer): string {
  if (oidBytes.length === 0) return '';
  const first = oidBytes[0];
  const parts: number[] = [Math.floor(first / 40), first % 40];
  let val = 0;
  for (let i = 1; i < oidBytes.length; i++) {
    const b = oidBytes[i];
    val = (val << 7) | (b & 0x7f);
    if ((b & 0x80) === 0) {
      parts.push(val);
      val = 0;
    }
  }
  return parts.join('.');
}

function mapDigestOidToNodeAlg(oid: string): { nodeAlg: string; label: string } | null {
  switch (oid) {
    case '2.16.840.1.101.3.4.2.1':
    case '1.2.840.113549.1.1.11':
    case '1.2.840.10045.4.3.2':
      return { nodeAlg: 'sha256', label: 'SHA-256' };
    case '2.16.840.1.101.3.4.2.2':
    case '1.2.840.113549.1.1.12':
    case '1.2.840.10045.4.3.3':
      return { nodeAlg: 'sha384', label: 'SHA-384' };
    case '2.16.840.1.101.3.4.2.3':
    case '1.2.840.113549.1.1.13':
    case '1.2.840.10045.4.3.4':
      return { nodeAlg: 'sha512', label: 'SHA-512' };
    case '1.3.14.3.2.26':
    case '1.2.840.113549.1.1.5':
    case '1.2.840.10045.4.1':
      return { nodeAlg: 'sha1', label: 'SHA-1' };
    default:
      return null;
  }
}

function parseAsn1TimeToDate(tag: number, rawBytes: Buffer): Date | null {
  const s = rawBytes.toString('ascii').trim();
  const digits = s.replace(/\D+.*/, '');
  if (tag === 0x17 && digits.length >= 10) {
    const yy = Number(digits.slice(0, 2));
    const yyyy = yy >= 50 ? 1900 + yy : 2000 + yy;
    const mm = Number(digits.slice(2, 4));
    const dd = Number(digits.slice(4, 6));
    const hh = Number(digits.slice(6, 8));
    const min = Number(digits.slice(8, 10));
    const ss = digits.length >= 12 ? Number(digits.slice(10, 12)) : 0;
    const d = new Date(Date.UTC(yyyy, mm - 1, dd, hh, min, ss));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (tag === 0x18 && digits.length >= 12) {
    const yyyy = Number(digits.slice(0, 4));
    const mm = Number(digits.slice(4, 6));
    const dd = Number(digits.slice(6, 8));
    const hh = Number(digits.slice(8, 10));
    const min = Number(digits.slice(10, 12));
    const ss = digits.length >= 14 ? Number(digits.slice(12, 14)) : 0;
    const d = new Date(Date.UTC(yyyy, mm - 1, dd, hh, min, ss));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function formatDatePtBr(date: Date | null): string | null {
  if (!date || Number.isNaN(date.getTime())) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getUTCDate())}/${pad(date.getUTCMonth() + 1)}/${date.getUTCFullYear()} às ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())} UTC`;
}

function parseCertDateString(raw: string | undefined): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

const NOMES_PDF_IGNORADOS = new Set([
  'not specified',
  'unspecified',
  'unknown',
  'none',
  'null',
  'undefined',
  'adobe.ppklite',
  'adbe.pkcs7.detached',
  'adbe.pkcs7.sha1',
  'etsi.cades.detached',
  'helv',
  'zadb',
  'tiro',
  'cour',
  'f1',
  'f2',
  'f3',
  'sig',
  'signature',
  'signature1',
  'assinatura',
]);

export function ehNomeRuidoPdf(valor: string): boolean {
  const limpo = valor.trim().toLowerCase();
  if (!limpo || limpo.length < 3) return true;
  if (NOMES_PDF_IGNORADOS.has(limpo)) return true;
  if (/^(font|obj|page|annot|form|sig|field)\d*$/i.test(limpo)) return true;
  return false;
}

export function ehNomeAutoridadeCertificadora(nome: string): boolean {
  const n = nome.trim().toLowerCase();
  return (
    n.startsWith('ac ') ||
    n.startsWith('ac-') ||
    n.startsWith('autoridade certificadora') ||
    n.startsWith('autoridade / emissor:') ||
    n.includes('certificadora raiz') ||
    n.includes('raiz brasileira') ||
    n === 'icp-brasil' ||
    n.startsWith('icp-brasil ') ||
    n.includes('secretaria da receita federal do brasil - rfb') ||
    (n.includes('rfb') && n.startsWith('ac'))
  );
}

export function ehNomeCarimboTempoOuServidor(nome: string, hasTsaOid = false): boolean {
  if (hasTsaOid) return true;
  const n = nome.trim().toLowerCase();
  return (
    n.includes('carimbo do tempo') ||
    n.includes('timestamp') ||
    n.includes('time stamping') ||
    n.startsWith('act ') ||
    n.startsWith('act-') ||
    n.includes('servidor seguro')
  );
}

export function extrairNomeEDocumentoMascarado(cnBruto: string): {
  nomeLimpo: string;
  documentoMascarado: string | null;
} {
  const partes = cnBruto.split(':');
  const nomeBase = partes[0].trim();
  const sufixo = partes.length > 1 ? partes.slice(1).join(':').replace(/\D+/g, '') : '';
  const digitosNoTexto = sufixo || (cnBruto.match(/\b(\d{11}|\d{14})\b/)?.[1] ?? '');

  let documentoMascarado: string | null = null;
  if (digitosNoTexto.length === 11) {
    documentoMascarado = `***.${digitosNoTexto.slice(3, 6)}.${digitosNoTexto.slice(6, 9)}-**`;
  } else if (digitosNoTexto.length === 14) {
    documentoMascarado = `${digitosNoTexto.slice(0, 2)}.${digitosNoTexto.slice(2, 5)}.${digitosNoTexto.slice(5, 8)}/${digitosNoTexto.slice(8, 12)}-${digitosNoTexto.slice(12, 14)}`;
  }

  return {
    nomeLimpo: nomeBase || cnBruto.trim(),
    documentoMascarado,
  };
}

function parseDistinguishedName(dn: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of dn.split('\n')) {
    const idx = line.indexOf('=');
    if (idx > 0) {
      const k = line.slice(0, idx).trim().toUpperCase();
      const v = line.slice(idx + 1).trim();
      if (v && !out[k]) out[k] = v;
    }
  }
  return out;
}

interface ParsedCmsSignature {
  digestAlgOid: string | null;
  digestAlgNode: string | null;
  digestAlgLabel: string;
  messageDigestAttr: Buffer | null;
  signingTimeDate: Date | null;
  signedAttrsDerWithSetTag: Buffer | null;
  signatureBytes: Buffer | null;
  signerSerialHex: string | null;
  certificates: Array<{
    x509: X509Certificate;
    rawDer: Buffer;
    hasTsaOid: boolean;
  }>;
  cmsParseValid: boolean;
}

const OID_SIGNED_DATA = '1.2.840.113549.1.7.2';
const OID_MESSAGE_DIGEST = '1.2.840.113549.1.9.4';
const OID_SIGNING_TIME = '1.2.840.113549.1.9.5';
const OID_TSA_EKU_BYTES = Buffer.from([0x06, 0x08, 0x2b, 0x06, 0x01, 0x05, 0x05, 0x07, 0x03, 0x08]);

function trimDerSequencePadding(der: Buffer): Buffer {
  const node = readAsn1(der, 0);
  if (node && node.tag === 0x30 && node.raw.length <= der.length) {
    return node.raw;
  }
  return der;
}

function extractX509CertificatesFallback(der: Buffer): Array<{
  x509: X509Certificate;
  rawDer: Buffer;
  hasTsaOid: boolean;
}> {
  const found: Array<{ x509: X509Certificate; rawDer: Buffer; hasTsaOid: boolean }> = [];
  const seenSerials = new Set<string>();
  for (let i = 0; i < der.length - 8; i++) {
    if (der[i] === 0x30 && (der[i + 1] === 0x82 || der[i + 1] === 0x81)) {
      const node = readAsn1(der, i);
      if (!node || node.raw.length < 128 || node.raw.length > 16384) continue;
      const firstChild = readAsn1(node.value, 0);
      if (!firstChild || firstChild.tag !== 0x30) continue;
      try {
        const x509 = new X509Certificate(node.raw);
        const key = `${x509.serialNumber}:${x509.subject}`;
        if (!seenSerials.has(key)) {
          seenSerials.add(key);
          found.push({
            x509,
            rawDer: node.raw,
            hasTsaOid: node.raw.includes(OID_TSA_EKU_BYTES),
          });
        }
        i += node.raw.length - 1;
      } catch {
        // Não é um certificado X.509 completo nesta posição
      }
    }
  }
  return found;
}

function parseCmsSignedData(rawHexDecoded: Buffer): ParsedCmsSignature {
  const der = trimDerSequencePadding(rawHexDecoded);
  const emptyResult: ParsedCmsSignature = {
    digestAlgOid: null,
    digestAlgNode: null,
    digestAlgLabel: 'Não identificado',
    messageDigestAttr: null,
    signingTimeDate: null,
    signedAttrsDerWithSetTag: null,
    signatureBytes: null,
    signerSerialHex: null,
    certificates: [],
    cmsParseValid: false,
  };

  const root = readAsn1(der, 0);
  if (!root || root.tag !== 0x30) {
    const fallbackCerts = extractX509CertificatesFallback(der);
    return { ...emptyResult, certificates: fallbackCerts };
  }

  const rootKids = readAsn1Children(root);
  if (rootKids.length < 2 || rootKids[0].tag !== 0x06) {
    const fallbackCerts = extractX509CertificatesFallback(der);
    return { ...emptyResult, certificates: fallbackCerts };
  }

  const contentTypeOid = decodeOid(rootKids[0].value);
  if (contentTypeOid !== OID_SIGNED_DATA) {
    const fallbackCerts = extractX509CertificatesFallback(der);
    return { ...emptyResult, certificates: fallbackCerts };
  }

  const explicit0Kids = readAsn1Children(rootKids[1]);
  const signedDataNode = explicit0Kids[0];
  if (!signedDataNode || signedDataNode.tag !== 0x30) {
    const fallbackCerts = extractX509CertificatesFallback(der);
    return { ...emptyResult, certificates: fallbackCerts };
  }

  const sdKids = readAsn1Children(signedDataNode);
  const certificates: Array<{ x509: X509Certificate; rawDer: Buffer; hasTsaOid: boolean }> = [];
  const seenCerts = new Set<string>();

  for (const kid of sdKids) {
    if (kid.tag === 0xa0) {
      for (const certNode of readAsn1Children(kid)) {
        if (certNode.tag === 0x30) {
          try {
            const x509 = new X509Certificate(certNode.raw);
            const k = `${x509.serialNumber}:${x509.subject}`;
            if (!seenCerts.has(k)) {
              seenCerts.add(k);
              certificates.push({
                x509,
                rawDer: certNode.raw,
                hasTsaOid: certNode.raw.includes(OID_TSA_EKU_BYTES),
              });
            }
          } catch {
            // Ignora entradas que não são X.509 padrão (ex: AttributeCertificates)
          }
        }
      }
    }
  }

  // Também varre se houver certificados em carimbo de tempo aninhado (unsignedAttrs)
  for (const extra of extractX509CertificatesFallback(der)) {
    const k = `${extra.x509.serialNumber}:${extra.x509.subject}`;
    if (!seenCerts.has(k)) {
      seenCerts.add(k);
      certificates.push(extra);
    }
  }

  const signerInfosSet = sdKids.filter((k) => k.tag === 0x31).pop();
  if (!signerInfosSet) {
    return {
      ...emptyResult,
      certificates,
      cmsParseValid: certificates.length > 0,
    };
  }

  const signerInfos = readAsn1Children(signerInfosSet);
  const primarySignerInfo = signerInfos[0];
  if (!primarySignerInfo || primarySignerInfo.tag !== 0x30) {
    return {
      ...emptyResult,
      certificates,
      cmsParseValid: certificates.length > 0,
    };
  }

  const siKids = readAsn1Children(primarySignerInfo);
  let signerSerialHex: string | null = null;
  let digestAlgOid: string | null = null;
  let signedAttrsNode: Asn1Node | null = null;
  let signatureBytes: Buffer | null = null;

  // sid (IssuerAndSerialNumber SEQUENCE 0x30)
  if (siKids[1] && siKids[1].tag === 0x30) {
    const sidKids = readAsn1Children(siKids[1]);
    const serialNode = sidKids.find((n) => n.tag === 0x02);
    if (serialNode) {
      signerSerialHex = serialNode.value.toString('hex').toUpperCase().replace(/^0+/, '') || '0';
    }
  }

  // digestAlgorithm (SEQUENCE 0x30)
  if (siKids[2] && siKids[2].tag === 0x30) {
    const algKids = readAsn1Children(siKids[2]);
    const oidNode = algKids.find((n) => n.tag === 0x06);
    if (oidNode) {
      digestAlgOid = decodeOid(oidNode.value);
    }
  }

  for (let idx = 3; idx < siKids.length; idx++) {
    const k = siKids[idx];
    if (k.tag === 0xa0 && !signedAttrsNode) {
      signedAttrsNode = k;
    } else if (k.tag === 0x04 && !signatureBytes) {
      signatureBytes = k.value;
    }
  }

  let messageDigestAttr: Buffer | null = null;
  let signingTimeDate: Date | null = null;
  let signedAttrsDerWithSetTag: Buffer | null = null;

  if (signedAttrsNode) {
    signedAttrsDerWithSetTag = Buffer.from(signedAttrsNode.raw);
    signedAttrsDerWithSetTag[0] = 0x31; // RFC 5652 Section 5.4: IMPLICIT [0] substituído por SET OF (0x31)

    for (const attr of readAsn1Children(signedAttrsNode)) {
      if (attr.tag !== 0x30) continue;
      const attrKids = readAsn1Children(attr);
      if (attrKids.length < 2 || attrKids[0].tag !== 0x06) continue;
      const attrOid = decodeOid(attrKids[0].value);
      const attrValues = attrKids[1].tag === 0x31 ? readAsn1Children(attrKids[1]) : [];
      if (attrOid === OID_MESSAGE_DIGEST && attrValues[0]?.tag === 0x04) {
        messageDigestAttr = attrValues[0].value;
      } else if (attrOid === OID_SIGNING_TIME && attrValues[0]) {
        signingTimeDate = parseAsn1TimeToDate(attrValues[0].tag, attrValues[0].value);
      }
    }
  }

  const mappedAlg = digestAlgOid ? mapDigestOidToNodeAlg(digestAlgOid) : null;

  return {
    digestAlgOid,
    digestAlgNode: mappedAlg?.nodeAlg ?? null,
    digestAlgLabel: mappedAlg?.label ?? (digestAlgOid || 'Não identificado'),
    messageDigestAttr,
    signingTimeDate,
    signedAttrsDerWithSetTag,
    signatureBytes,
    signerSerialHex,
    certificates,
    cmsParseValid: true,
  };
}

interface ExtractedSignatureDict {
  byteRange: [number, number, number, number] | null;
  contentsHex: string | null;
  contentsStartOffset: number | null;
  contentsEndOffset: number | null;
  subFilter: string | null;
  pdfSigningTimeM: string | null;
}

function formatPdfDateM(raw: string): string | null {
  const clean = raw.replace(/^[(\s]+|[)\s]+$/g, '').replace(/^D:/i, '').trim();
  const digits = clean.match(/^\d+/)?.[0] ?? '';
  if (digits.length >= 14) {
    return `${digits.slice(6, 8)}/${digits.slice(4, 6)}/${digits.slice(0, 4)} às ${digits.slice(8, 10)}:${digits.slice(10, 12)}:${digits.slice(12, 14)}`;
  }
  if (digits.length >= 8) {
    return `${digits.slice(6, 8)}/${digits.slice(4, 6)}/${digits.slice(0, 4)}`;
  }
  return null;
}

function extractPdfSignatureDictionaries(bytes: Buffer): ExtractedSignatureDict[] {
  const latin1 = bytes.toString('latin1');
  const contentsMatches = [...latin1.matchAll(/\/Contents\s*<([0-9A-Fa-f\s]+)>/g)];
  const byteRangeMatches = [
    ...latin1.matchAll(/\/ByteRange\s*\[\s*(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s*\]/g),
  ];

  if (contentsMatches.length === 0 && byteRangeMatches.length === 0) {
    return [];
  }

  const results: ExtractedSignatureDict[] = [];

  if (contentsMatches.length > 0) {
    for (let idx = 0; idx < contentsMatches.length; idx++) {
      const cm = contentsMatches[idx];
      const matchIndex = cm.index ?? 0;
      const ltOffset = matchIndex + cm[0].indexOf('<');
      const gtOffset = matchIndex + cm[0].lastIndexOf('>') + 1;

      // Janela local ao redor do dicionário /Sig para extrair /ByteRange, /SubFilter e /M correspondentes
      const windowStart = Math.max(0, matchIndex - 1500);
      const windowEnd = Math.min(latin1.length, gtOffset + 1500);
      const windowText = latin1.slice(windowStart, windowEnd);

      const brMatch = windowText.match(
        /\/ByteRange\s*\[\s*(-?\d+)\s+(-?\d+)\s+(-?\d+)\s+(-?\d+)\s*\]/,
      );
      const fallbackBr = byteRangeMatches[idx];
      const brNums = brMatch
        ? ([Number(brMatch[1]), Number(brMatch[2]), Number(brMatch[3]), Number(brMatch[4])] as [
            number,
            number,
            number,
            number,
          ])
        : fallbackBr
          ? ([
              Number(fallbackBr[1]),
              Number(fallbackBr[2]),
              Number(fallbackBr[3]),
              Number(fallbackBr[4]),
            ] as [number, number, number, number])
          : null;

      const subMatch = windowText.match(/\/SubFilter\s*\/([^\s/>[\]()]+)/);
      const mMatch = windowText.match(/\/M\s*\(([^)]+)\)/);

      results.push({
        byteRange: brNums,
        contentsHex: cm[1].replace(/\s+/g, ''),
        contentsStartOffset: ltOffset,
        contentsEndOffset: gtOffset,
        subFilter: subMatch ? subMatch[1].trim() : null,
        pdfSigningTimeM: mMatch ? formatPdfDateM(mMatch[1]) : null,
      });
    }
  } else {
    for (const br of byteRangeMatches) {
      const matchIndex = br.index ?? 0;
      const windowStart = Math.max(0, matchIndex - 1000);
      const windowEnd = Math.min(latin1.length, matchIndex + 1000);
      const windowText = latin1.slice(windowStart, windowEnd);
      const subMatch = windowText.match(/\/SubFilter\s*\/([^\s/>[\]()]+)/);
      const mMatch = windowText.match(/\/M\s*\(([^)]+)\)/);

      results.push({
        byteRange: [Number(br[1]), Number(br[2]), Number(br[3]), Number(br[4])],
        contentsHex: null,
        contentsStartOffset: null,
        contentsEndOffset: null,
        subFilter: subMatch ? subMatch[1].trim() : null,
        pdfSigningTimeM: mMatch ? formatPdfDateM(mMatch[1]) : null,
      });
    }
  }

  return results;
}

function detectVisualSignatureIndications(bytes: Buffer): boolean {
  const sampleLimit = Math.min(bytes.length, 2 * 1024 * 1024);
  const rawLower = bytes.subarray(0, sampleLimit).toString('latin1').toLowerCase();
  const markers = [
    'assinado digitalmente',
    'assinado eletronicamente',
    'validar.iti.gov.br',
    'verificador de conformidade',
    'codigo de verificacao',
    'código de verificação',
    'docusign',
    'clicksign',
    'zapsign',
    'd4sign',
    'autentique',
    'assinatura.e-notariado.org.br',
  ];
  return markers.some((m) => rawLower.includes(m));
}

function serialMatches(certSerial: string, targetSerial: string | null): boolean {
  if (!targetSerial) return false;
  const a = certSerial.replace(/[^0-9A-Fa-f]/g, '').toUpperCase().replace(/^0+/, '') || '0';
  const b = targetSerial.replace(/[^0-9A-Fa-f]/g, '').toUpperCase().replace(/^0+/, '') || '0';
  return a === b;
}

function buildCertificadoAuditado(
  x509: X509Certificate,
  hasTsaOid: boolean,
  isMatchedSigner: boolean,
): CertificadoAuditado {
  const subj = parseDistinguishedName(x509.subject);
  const iss = parseDistinguishedName(x509.issuer);

  const rawCn = subj.CN || subj.O || 'Titular não especificado no certificado';
  const { nomeLimpo, documentoMascarado } = extrairNomeEDocumentoMascarado(rawCn);
  const issuerCn = iss.CN || iss.O || 'Não informado no certificado';
  const org = subj.O || iss.O || 'Não informada no certificado';
  const ou = subj.OU || null;

  const isCa = Boolean(x509.ca) || ehNomeAutoridadeCertificadora(nomeLimpo);
  const isTsa = !isCa && !isMatchedSigner && ehNomeCarimboTempoOuServidor(nomeLimpo, hasTsaOid);

  let papel: PapelCertificadoAuditado = 'SIGNATARIO';
  if (isCa) {
    papel = 'AUTORIDADE_CERTIFICADORA';
  } else if (isTsa) {
    papel = 'CARIMBO_TEMPO_TSA';
  }

  const validFromDate = parseCertDateString(x509.validFrom);
  const validToDate = parseCertDateString(x509.validTo);

  const serialFormatted = x509.serialNumber
    ? x509.serialNumber.toUpperCase()
    : 'Não informado no certificado';

  let emailExtraido: string | null = null;
  if (x509.subjectAltName) {
    const emailMatch = x509.subjectAltName.match(/email:([^\s,]+)/i);
    if (emailMatch) emailExtraido = emailMatch[1].trim();
  }

  return {
    papel,
    nome_exibicao: nomeLimpo,
    documento_mascarado: documentoMascarado,
    emissor_ac: issuerCn,
    organizacao: org,
    unidade_organizacional: ou,
    numero_serie: serialFormatted,
    validade_inicio: formatDatePtBr(validFromDate) || 'Não informada no certificado',
    validade_fim: formatDatePtBr(validToDate) || 'Não informada no certificado',
    email: emailExtraido,
    eh_autoridade_certificadora: isCa,
    eh_carimbo_tempo: isTsa,
  };
}

export function createFailedSignatureAuditResult(
  motivo: string,
  options?: {
    tamanhoBytes?: number | null;
    modificadoEm?: string | null;
    hashSha256?: string | null;
  },
): AnaliseAssinaturaPdf {
  return {
    versao_motor: 2,
    status_auditoria: 'FALHA_ANALISE_ARQUIVO',
    status_validade: 'FALHA_ANALISE_ARQUIVO',
    possui_assinatura_criptografica: false,
    possui_indicio_visual_sem_criptografia: false,
    hash_sha256: options?.hashSha256 ?? null,
    tamanho_bytes: options?.tamanhoBytes ?? null,
    modificado_em: options?.modificadoEm ?? null,
    auditado_em: new Date().toISOString(),
    origem_resultado: 'INSPECAO_TECNICA_AUTOMATICA_LOCAL',
    origem_validacao: 'Inspeção técnica local interrompida por falha na leitura/estrutura do arquivo',
    alcance_validacao: 'Nenhuma verificação de assinatura pôde ser concluída porque o arquivo não pôde ser analisado.',
    motivo_status: motivo,
    aviso_juridico: AVISO_JURIDICO_ASSINATURA,
    padrao_detectado: 'Falha na leitura ou estrutura de arquivo inválida',
    signatarios_detectados: [],
    certificados_signatarios: [],
    autoridades_certificadoras: [],
    outros_componentes_cadeia: [],
    detalhes_assinaturas: [],
    verificacoes_executadas: {
      leitura_estrutura_pdf: false,
      calculo_hash_sha256_arquivo: Boolean(options?.hashSha256),
      extracao_dicionarios_byterange_contents: false,
      decodificacao_asn1_cms_pkcs7: false,
      leitura_certificados_x509: false,
      verificacao_alinhamento_byterange: false,
      verificacao_hash_message_digest: false,
      verificacao_assinatura_chave_publica_x509: false,
      consulta_revogacao_lcr_ocsp_online: false,
      validacao_cadeia_iti_online: false,
    },
    conferencia_externa: null,
    titulo_exigencia: 'Falha Técnica na Análise do Arquivo',
    texto_nota_devolucao: '',
  };
}

export function applyExternalConferenceToAudit(
  analise: AnaliseAssinaturaPdf,
  conferencia: ConferenciaExternaAssinatura | null,
  conferenciaAnteriorDivergente = false,
): AnaliseAssinaturaPdf {
  if (!conferencia) {
    if (!conferenciaAnteriorDivergente) return analise;
    return {
      ...analise,
      conferencia_externa: null,
      conferencia_externa_invalidada_por_alteracao: true,
    };
  }

  const hashCompativel =
    Boolean(analise.hash_sha256) &&
    conferencia.hash_sha256.toLowerCase() === analise.hash_sha256!.toLowerCase();

  if (!hashCompativel) {
    return {
      ...analise,
      conferencia_externa: null,
      conferencia_externa_invalidada_por_alteracao: true,
    };
  }

  const confAtualizada: ConferenciaExternaAssinatura = {
    ...conferencia,
    hash_compativel_com_arquivo_atual: true,
  };

  // Se a verificação matemática local já provou adulteração física dos bytes (ASSINATURA_INVALIDA),
  // preserva o alerta técnico caso tentem sobrepor, a menos que a conferência externa também seja INVALIDA.
  let novoStatus: StatusAuditoriaAssinatura = analise.status_auditoria;
  let novoMotivo = analise.motivo_status;
  let novaOrigemValidacao = analise.origem_validacao;
  let novoAlcanceValidacao = analise.alcance_validacao;

  if (conferencia.resultado === 'VALIDA') {
    if (analise.status_auditoria !== 'ASSINATURA_INVALIDA') {
      novoStatus = 'ASSINATURA_VALIDA';
      novaOrigemValidacao =
        conferencia.origem_registro === 'INTEGRACAO_VERIFICAVEL'
          ? `Integração verificável (${conferencia.orgao_verificador})`
          : `Conferência externa registrada manualmente (${conferencia.orgao_verificador})`;
      novoAlcanceValidacao = `Vinculada ao hash SHA-256 exato do arquivo (${conferencia.hash_sha256.slice(0, 16)}…), conferido por ${conferencia.responsavel_nome} em ${conferencia.data_conferencia}.`;
      novoMotivo = `Assinatura validada mediante conferência externa no ${conferencia.orgao_verificador}, vinculada ao hash SHA-256 deste arquivo.`;
    }
  } else if (conferencia.resultado === 'INVALIDA') {
    novoStatus = 'ASSINATURA_INVALIDA';
    novaOrigemValidacao = `Conferência externa registrada manualmente (${conferencia.orgao_verificador})`;
    novoAlcanceValidacao = `Registro de reprovação vinculado ao hash SHA-256 (${conferencia.hash_sha256.slice(0, 16)}…) por ${conferencia.responsavel_nome}.`;
    novoMotivo = `Assinatura apontada como inválida na conferência externa (${conferencia.orgao_verificador}): ${conferencia.relatorio_conformidade || 'Motivo registrado na conferência externa.'}`;
  } else if (conferencia.resultado === 'INCONCLUSIVA') {
    if (analise.status_auditoria !== 'ASSINATURA_INVALIDA') {
      novoStatus = 'VALIDACAO_INCONCLUSIVA';
      novaOrigemValidacao = `Conferência externa registrada manualmente (${conferencia.orgao_verificador})`;
      novoMotivo = `Conferência externa registrada como inconclusiva por ${conferencia.responsavel_nome}: ${conferencia.relatorio_conformidade || 'Sem detalhes adicionais.'}`;
    }
  }

  return {
    ...analise,
    status_auditoria: novoStatus,
    status_validade: novoStatus,
    origem_resultado:
      conferencia.origem_registro === 'INTEGRACAO_VERIFICAVEL'
        ? 'INTEGRACAO_VERIFICAVEL'
        : 'CONFERENCIA_EXTERNA_MANUAL',
    origem_validacao: novaOrigemValidacao,
    alcance_validacao: novoAlcanceValidacao,
    motivo_status: novoMotivo,
    conferencia_externa: confAtualizada,
    conferencia_externa_invalidada_por_alteracao: false,
  };
}

export function auditPdfSignatures(
  bytes: Buffer | Uint8Array,
  options?: {
    fileName?: string;
    modifiedAt?: string | null;
    conferenciaExterna?: ConferenciaExternaAssinatura | null;
  },
): AnaliseAssinaturaPdf {
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);

  if (!buf || buf.length === 0) {
    return createFailedSignatureAuditResult(
      'Arquivo vazio (0 bytes): não foi possível realizar a análise de estrutura PDF.',
      { tamanhoBytes: 0, modificadoEm: options?.modifiedAt ?? null },
    );
  }

  const hashSha256 = createHash('sha256').update(buf).digest('hex');
  const headerSlice = buf.subarray(0, Math.min(buf.length, 1024)).toString('latin1');
  if (!headerSlice.includes('%PDF-')) {
    return createFailedSignatureAuditResult(
      'O arquivo analisado não apresenta cabeçalho PDF válido (%PDF-). Não é possível auditar assinaturas PAdES neste formato.',
      {
        tamanhoBytes: buf.length,
        modificadoEm: options?.modifiedAt ?? null,
        hashSha256,
      },
    );
  }

  const sigDicts = extractPdfSignatureDictionaries(buf);
  const latin1Sample = buf.subarray(0, Math.min(buf.length, 512 * 1024)).toString('latin1');
  const hasSigTypeMarker = /\/Type\s*\/Sig\b/.test(latin1Sample);

  if (sigDicts.length === 0 && !hasSigTypeMarker) {
    const indicioVisual = detectVisualSignatureIndications(buf);
    const motivoSemAssinatura = indicioVisual
      ? 'Nenhuma assinatura digital criptográfica (PAdES/PKCS#7) foi encontrada no PDF. O documento contém apenas menções textuais ou carimbos visuais de assinatura (ex.: documento impresso em PDF ou digitalizado), o que não constitui prova criptográfica.'
      : 'O arquivo PDF foi analisado integralmente e não contém dicionários de assinatura digital (/ByteRange ou /Contents PKCS#7/CMS).';

    const baseSemAssinatura: AnaliseAssinaturaPdf = {
      versao_motor: 2,
      status_auditoria: 'NENHUMA_ASSINATURA_DETECTADA',
      status_validade: 'NENHUMA_ASSINATURA_DETECTADA',
      possui_assinatura_criptografica: false,
      possui_indicio_visual_sem_criptografia: indicioVisual,
      hash_sha256: hashSha256,
      tamanho_bytes: buf.length,
      modificado_em: options?.modifiedAt ?? null,
      auditado_em: new Date().toISOString(),
      origem_resultado: 'INSPECAO_TECNICA_AUTOMATICA_LOCAL',
      origem_validacao: 'Inspeção técnica estrutural do arquivo PDF',
      alcance_validacao:
        'Verificou a presença de dicionários /Sig, /ByteRange e pacotes PKCS#7/CMS nos bytes do PDF.',
      motivo_status: motivoSemAssinatura,
      aviso_juridico: AVISO_JURIDICO_ASSINATURA,
      padrao_detectado: indicioVisual
        ? 'Indício visual/textual sem estrutura criptográfica PAdES'
        : 'Nenhuma assinatura digital detectada',
      signatarios_detectados: [],
      certificados_signatarios: [],
      autoridades_certificadoras: [],
      outros_componentes_cadeia: [],
      detalhes_assinaturas: [],
      verificacoes_executadas: {
        leitura_estrutura_pdf: true,
        calculo_hash_sha256_arquivo: true,
        extracao_dicionarios_byterange_contents: true,
        decodificacao_asn1_cms_pkcs7: false,
        leitura_certificados_x509: false,
        verificacao_alinhamento_byterange: false,
        verificacao_hash_message_digest: false,
        verificacao_assinatura_chave_publica_x509: false,
        consulta_revogacao_lcr_ocsp_online: false,
        validacao_cadeia_iti_online: false,
      },
      conferencia_externa: null,
      titulo_exigencia: indicioVisual
        ? 'Ausência de Estrutura Criptográfica (Assinatura Apenas Visual / PDF Achatado)'
        : 'Documento PDF sem Assinatura Digital Criptográfica',
      texto_nota_devolucao: '',
    };

    return applyExternalConferenceToAudit(baseSemAssinatura, options?.conferenciaExterna ?? null);
  }

  const certificadosSignatariosMap = new Map<string, CertificadoAuditado>();
  const autoridadesCertificadorasMap = new Map<string, CertificadoAuditado>();
  const outrosComponentesMap = new Map<string, CertificadoAuditado>();
  const detalhesAssinaturas: DetalheAssinaturaPdf[] = [];

  let anyCmsDecoded = false;
  let anyCertRead = false;
  let anyByteRangeChecked = false;
  let anyDigestChecked = false;
  let anyPubKeyChecked = false;

  let countValidaCriptoIntegral = 0;
  let countCmsIntegraByteRangeParcial = 0;
  let countPendente = 0;
  let countInconclusiva = 0;
  let countInvalida = 0;
  const motivosInvalidade: string[] = [];
  const motivosPendenciaOuInconclusao: string[] = [];

  for (let idx = 0; idx < sigDicts.length; idx++) {
    const dict = sigDicts[idx];
    const subFilterLabel = dict.subFilter || 'Não especificado no dicionário /Sig';

    // 1. Verificação dos limites e alinhamento do /ByteRange
    let coberturaByteRange: DetalheAssinaturaPdf['cobertura_byterange'] = 'NAO_APLICAVEL';
    let byteRangeErro: string | null = null;
    if (dict.byteRange) {
      anyByteRangeChecked = true;
      const [o1, l1, o2, l2] = dict.byteRange;
      if (o1 < 0 || l1 <= 0 || o2 <= 0 || l2 <= 0 || o1 + l1 > o2 || o2 + l2 > buf.length) {
        coberturaByteRange = 'INVALIDO_FORA_LIMITES';
        byteRangeErro = `Estrutura /ByteRange [${o1}, ${l1}, ${o2}, ${l2}] inválida: os limites excedem o tamanho real do arquivo (${buf.length} bytes).`;
      } else {
        const alignedWithContents =
          o1 === 0 &&
          dict.contentsStartOffset === o1 + l1 &&
          dict.contentsEndOffset === o2 &&
          buf[o1 + l1] === 0x3c &&
          buf[o2 - 1] === 0x3e;

        if (alignedWithContents && o2 + l2 === buf.length) {
          coberturaByteRange = 'INTEGRAL';
        } else if (alignedWithContents && o2 + l2 < buf.length) {
          coberturaByteRange = 'PARCIAL_INCREMENTAL';
        } else {
          coberturaByteRange = 'DESALINHADO_PDF_MESCLADO';
        }
      }
    }

    if (!dict.contentsHex || /^0+$/.test(dict.contentsHex)) {
      countInconclusiva++;
      motivosPendenciaOuInconclusao.push(
        `Campo de assinatura #${idx + 1}: bloco /Contents ausente ou preenchido apenas com zeros.`,
      );
      detalhesAssinaturas.push({
        signatario: 'Signatário não identificado (bloco /Contents vazio)',
        documento_mascarado: null,
        emissor: 'Não informado no certificado',
        data_assinatura: dict.pdfSigningTimeM || 'Não informada no pacote CMS',
        subfilter: subFilterLabel,
        algoritmo_hash: 'Não identificado',
        integridade: 'Validação inconclusiva: pacote criptográfico /Contents vazio',
        status_tecnico: 'INCONCLUSIVA',
        motivo_tecnico: 'O dicionário /Sig existe, mas o bloco /Contents não contém estrutura PKCS#7/CMS.',
        cobertura_byterange: coberturaByteRange,
        numero_serie: null,
        validade_certificado: null,
        cpf_cnpj: null,
        email: null,
      });
      continue;
    }

    const rawCmsDer = Buffer.from(dict.contentsHex, 'hex');
    const cms = parseCmsSignedData(rawCmsDer);
    if (cms.cmsParseValid) anyCmsDecoded = true;
    if (cms.certificates.length > 0) anyCertRead = true;

    // Classifica os certificados X.509 contidos neste bloco CMS
    let signerCertEntry =
      cms.certificates.find((c) => serialMatches(c.x509.serialNumber, cms.signerSerialHex)) ??
      cms.certificates.find(
        (c) =>
          !c.x509.ca &&
          !ehNomeAutoridadeCertificadora(parseDistinguishedName(c.x509.subject).CN || '') &&
          !ehNomeCarimboTempoOuServidor(parseDistinguishedName(c.x509.subject).CN || '', c.hasTsaOid),
      ) ??
      null;

    for (const c of cms.certificates) {
      const isMatchedSigner = signerCertEntry?.x509.serialNumber === c.x509.serialNumber;
      const certAuditado = buildCertificadoAuditado(c.x509, c.hasTsaOid, isMatchedSigner);
      const mapKey = `${certAuditado.numero_serie}:${certAuditado.nome_exibicao}`;

      if (certAuditado.papel === 'SIGNATARIO') {
        certificadosSignatariosMap.set(mapKey, certAuditado);
        // Registra também o emissor declarado no certificado do signatário na seção de ACs, se ainda não listado
        if (
          certAuditado.emissor_ac &&
          certAuditado.emissor_ac !== 'Não informado no certificado' &&
          !autoridadesCertificadorasMap.has(`ISSUER:${certAuditado.emissor_ac}`)
        ) {
          autoridadesCertificadorasMap.set(`ISSUER:${certAuditado.emissor_ac}`, {
            papel: 'AUTORIDADE_CERTIFICADORA',
            nome_exibicao: certAuditado.emissor_ac,
            documento_mascarado: null,
            emissor_ac: certAuditado.organizacao || 'Cadeia de Certificação',
            organizacao: certAuditado.organizacao || 'Não informada no certificado',
            unidade_organizacional: certAuditado.unidade_organizacional,
            numero_serie: 'Referenciado pelo certificado do signatário (Emissor)',
            validade_inicio: 'Conforme cadeia da AC emissora',
            validade_fim: 'Conforme cadeia da AC emissora',
            email: null,
            eh_autoridade_certificadora: true,
            eh_carimbo_tempo: false,
          });
        }
      } else if (certAuditado.papel === 'AUTORIDADE_CERTIFICADORA') {
        autoridadesCertificadorasMap.set(mapKey, certAuditado);
        // Remove eventual entrada sintética duplicada pelo nome
        autoridadesCertificadorasMap.delete(`ISSUER:${certAuditado.nome_exibicao}`);
      } else {
        outrosComponentesMap.set(mapKey, certAuditado);
      }
    }

    // 2. Verificação criptográfica do messageDigest sobre o /ByteRange (quando alinhado)
    let digestValid: boolean | null = null;
    let digestReason: string | null = null;
    if (
      dict.byteRange &&
      (coberturaByteRange === 'INTEGRAL' || coberturaByteRange === 'PARCIAL_INCREMENTAL') &&
      cms.digestAlgNode &&
      cms.messageDigestAttr
    ) {
      anyDigestChecked = true;
      const [o1, l1, o2, l2] = dict.byteRange;
      const hash = createHash(cms.digestAlgNode);
      hash.update(buf.subarray(o1, o1 + l1));
      hash.update(buf.subarray(o2, o2 + l2));
      const calculatedDigest = hash.digest();
      digestValid = calculatedDigest.equals(cms.messageDigestAttr);
      if (!digestValid) {
        digestReason =
          'Integridade criptográfica violada: o hash (messageDigest) calculado sobre os bytes assinados diverge do valor registrado na assinatura — o documento sofreu alteração após ser assinado.';
      }
    }

    // 3. Verificação matemática da assinatura (SignerInfo.signature) com a chave pública X.509
    let pubKeySignatureValid: boolean | null = null;
    let pubKeyReason: string | null = null;
    if (
      signerCertEntry &&
      cms.signedAttrsDerWithSetTag &&
      cms.signatureBytes &&
      cms.digestAlgNode
    ) {
      anyPubKeyChecked = true;
      try {
        pubKeySignatureValid = cryptoVerify(
          cms.digestAlgNode,
          cms.signedAttrsDerWithSetTag,
          signerCertEntry.x509.publicKey,
          cms.signatureBytes,
        );
        if (!pubKeySignatureValid) {
          pubKeyReason =
            'Assinatura criptográfica (PKCS#7/CMS) inválida: a verificação matemática com a chave pública do certificado do signatário falhou.';
        }
      } catch {
        pubKeySignatureValid = false;
        pubKeyReason =
          'Falha na verificação matemática da assinatura PKCS#7/CMS com a chave pública do certificado.';
      }
    }

    // 4. Verificação de vigência temporal do certificado na data da assinatura (se ambos presentes)
    let certExpiredAtSigning = false;
    let certValidityReason: string | null = null;
    if (signerCertEntry && cms.signingTimeDate) {
      const notBefore = parseCertDateString(signerCertEntry.x509.validFrom);
      const notAfter = parseCertDateString(signerCertEntry.x509.validTo);
      if (
        (notBefore && cms.signingTimeDate.getTime() < notBefore.getTime()) ||
        (notAfter && cms.signingTimeDate.getTime() > notAfter.getTime())
      ) {
        certExpiredAtSigning = true;
        certValidityReason = `O certificado do signatário estava fora do período de validade (${formatDatePtBr(notBefore)} a ${formatDatePtBr(notAfter)}) na data/hora registrada na assinatura (${formatDatePtBr(cms.signingTimeDate)}).`;
      }
    }

    const signerAuditado = signerCertEntry
      ? buildCertificadoAuditado(signerCertEntry.x509, signerCertEntry.hasTsaOid, true)
      : null;

    const dataAssinaturaFormatada =
      formatDatePtBr(cms.signingTimeDate) ||
      dict.pdfSigningTimeM ||
      'Não informada no pacote CMS';

    let statusTecnicoItem: DetalheAssinaturaPdf['status_tecnico'] = 'INCONCLUSIVA';
    let integridadeTexto = 'Validação técnica inconclusiva';
    let motivoTecnicoItem: string | null = null;

    if (byteRangeErro) {
      statusTecnicoItem = 'INVALIDA';
      integridadeTexto = 'Assinatura inválida: limites /ByteRange corrompidos';
      motivoTecnicoItem = byteRangeErro;
      countInvalida++;
      motivosInvalidade.push(byteRangeErro);
    } else if (digestValid === false && digestReason) {
      statusTecnicoItem = 'INVALIDA';
      integridadeTexto = 'Assinatura inválida: bytes do documento alterados após a assinatura';
      motivoTecnicoItem = digestReason;
      countInvalida++;
      motivosInvalidade.push(digestReason);
    } else if (pubKeySignatureValid === false && pubKeyReason) {
      statusTecnicoItem = 'INVALIDA';
      integridadeTexto = 'Assinatura inválida: falha na verificação criptográfica da chave pública';
      motivoTecnicoItem = pubKeyReason;
      countInvalida++;
      motivosInvalidade.push(pubKeyReason);
    } else if (certExpiredAtSigning && certValidityReason) {
      statusTecnicoItem = 'INVALIDA';
      integridadeTexto = 'Assinatura inválida: certificado expirado ou fora de vigência na assinatura';
      motivoTecnicoItem = certValidityReason;
      countInvalida++;
      motivosInvalidade.push(certValidityReason);
    } else if (
      coberturaByteRange === 'INTEGRAL' &&
      digestValid === true &&
      pubKeySignatureValid === true
    ) {
      statusTecnicoItem = 'VALIDA_CRIPTOGRAFICAMENTE';
      integridadeTexto =
        'Integridade matemática comprovada (ByteRange integral + messageDigest + chave pública X.509 verificados)';
      motivoTecnicoItem =
        'Os bytes do documento não sofreram alteração após a assinatura e a assinatura matemática CMS corresponde à chave pública do certificado do signatário.';
      countValidaCriptoIntegral++;
    } else if (
      pubKeySignatureValid === true &&
      (coberturaByteRange === 'DESALINHADO_PDF_MESCLADO' ||
        coberturaByteRange === 'PARCIAL_INCREMENTAL')
    ) {
      statusTecnicoItem = 'ASSINATURA_CMS_INTEGRA_BYTERANGE_PARCIAL';
      if (coberturaByteRange === 'DESALINHADO_PDF_MESCLADO') {
        const bytesCobertos = dict.byteRange ? dict.byteRange[2] + dict.byteRange[3] : 0;
        integridadeTexto = `Assinatura CMS íntegra para o certificado, porém /ByteRange refere-se à peça de origem (${Math.round(bytesCobertos / 1024)} KB de ${Math.round(buf.length / 1024)} KB — PDF mesclado/concatenado)`;
        motivoTecnicoItem =
          'A assinatura matemática do bloco CMS/PKCS#7 está íntegra para o certificado X.509 do signatário, mas o intervalo /ByteRange não abrange a totalidade do arquivo atual (ocorre quando peças assinadas individualmente são juntadas/mescladas em um único PDF de autos). Requer validação da peça original ou conferência no ITI.';
      } else {
        integridadeTexto =
          'Assinatura CMS íntegra no intervalo assinado, mas o PDF possui atualizações incrementais posteriores ao /ByteRange';
        motivoTecnicoItem =
          'O hash messageDigest e a chave pública X.509 foram verificados sobre o intervalo original, porém existem bytes adicionados ao final do arquivo após a assinatura (revisão incremental).';
      }
      countCmsIntegraByteRangeParcial++;
      motivosPendenciaOuInconclusao.push(motivoTecnicoItem);
    } else if (signerAuditado && cms.cmsParseValid) {
      statusTecnicoItem = 'PENDENTE_VALIDACAO_EXTERNA';
      integridadeTexto = 'Estrutura CMS e certificado X.509 identificados — validação completa pendente';
      motivoTecnicoItem =
        'O certificado X.509 foi extraído da estrutura PKCS#7/CMS, mas a verificação completa de integridade e cadeia requer validação no Verificador do ITI.';
      countPendente++;
      motivosPendenciaOuInconclusao.push(motivoTecnicoItem);
    } else {
      statusTecnicoItem = 'INCONCLUSIVA';
      integridadeTexto = 'Validação inconclusiva: pacote CMS sem certificado de signatário verificável';
      motivoTecnicoItem =
        'Não foi possível extrair um certificado X.509 de signatário válido ou parâmetros suficientes para concluir a verificação criptográfica local.';
      countInconclusiva++;
      motivosPendenciaOuInconclusao.push(motivoTecnicoItem);
    }

    detalhesAssinaturas.push({
      signatario:
        signerAuditado?.nome_exibicao ||
        'Signatário não identificado no certificado X.509',
      documento_mascarado: signerAuditado?.documento_mascarado ?? null,
      emissor: signerAuditado?.emissor_ac || 'Não informado no certificado',
      data_assinatura: dataAssinaturaFormatada,
      subfilter: subFilterLabel,
      algoritmo_hash: cms.digestAlgLabel,
      integridade: integridadeTexto,
      status_tecnico: statusTecnicoItem,
      motivo_tecnico: motivoTecnicoItem,
      cobertura_byterange: coberturaByteRange,
      numero_serie: signerAuditado?.numero_serie ?? null,
      validade_certificado: signerAuditado
        ? `${signerAuditado.validade_inicio} até ${signerAuditado.validade_fim}`
        : null,
      cpf_cnpj: signerAuditado?.documento_mascarado ?? null,
      email: signerAuditado?.email ?? null,
    });
  }

  const certificadosSignatarios = [...certificadosSignatariosMap.values()];
  const autoridadesCertificadoras = [...autoridadesCertificadorasMap.values()];
  const outrosComponentes = [...outrosComponentesMap.values()];
  const signatariosDetectados = certificadosSignatarios.map((c) => c.nome_exibicao);

  // Determinação criteriosa do status global da auditoria
  let statusAuditoria: StatusAuditoriaAssinatura;
  let origemValidacao: string;
  let alcanceValidacao: string;
  let motivoStatus: string;
  let padraoDetectado: string;

  if (countInvalida > 0) {
    statusAuditoria = 'ASSINATURA_INVALIDA';
    origemValidacao =
      'Verificação técnica criptográfica local (análise de ByteRange, hash messageDigest e chave pública X.509)';
    alcanceValidacao =
      'Evidência matemática/estrutural aferida diretamente sobre os bytes e certificados embutidos no arquivo PDF.';
    motivoStatus = motivosInvalidade[0];
    padraoDetectado = 'Assinatura PAdES/PKCS#7 com evidência técnica de invalidade';
  } else if (
    countValidaCriptoIntegral > 0 &&
    countCmsIntegraByteRangeParcial === 0 &&
    countPendente === 0 &&
    countInconclusiva === 0
  ) {
    statusAuditoria = 'ASSINATURA_VALIDA';
    origemValidacao =
      'Verificação técnica criptográfica local (CMS/PKCS#7, cobertura integral de ByteRange, hash messageDigest e chave pública X.509)';
    alcanceValidacao =
      'Comprova matematicamente que os bytes do PDF estão íntegros desde a assinatura e que a assinatura foi gerada pela chave privada do certificado X.509 do signatário. A consulta online de revogação (LCR/OCSP) e a conformidade normativa ICP-Brasil podem ser ratificadas no Verificador oficial do ITI.';
    motivoStatus = `Verificação criptográfica concluída com êxito para ${countValidaCriptoIntegral} assinatura(s): o intervalo /ByteRange cobre 100% do arquivo, o hash messageDigest confere com os bytes do PDF e a assinatura matemática foi comprovada com a chave pública X.509 do signatário.`;
    padraoDetectado = `Assinatura Digital PAdES/PKCS#7 (${detalhesAssinaturas[0]?.algoritmo_hash || 'CMS'}) — Integridade Criptográfica Verificada`;
  } else if (countCmsIntegraByteRangeParcial > 0 || countPendente > 0 || countValidaCriptoIntegral > 0) {
    statusAuditoria = 'ASSINATURA_DETECTADA_VALIDACAO_PENDENTE';
    origemValidacao =
      'Inspeção técnica local de pacotes CMS/PKCS#7 e certificados X.509 (validação externa pendente)';
    alcanceValidacao =
      'Identificou a estrutura de assinatura digital e os certificados X.509 (com verificação da assinatura matemática do atributo CMS), mas a validação integral do arquivo e da cadeia/revogação ICP-Brasil depende de confirmação no Verificador do ITI.';
    motivoStatus =
      motivosPendenciaOuInconclusao[0] ||
      'Assinatura digital PAdES/PKCS#7 detectada no documento. Para confirmação conclusiva de cadeia ICP-Brasil, não revogação (LCR/OCSP) e integridade da peça original, valide o arquivo no portal oficial do ITI (validar.iti.gov.br) ou registre a conferência externa.';
    padraoDetectado =
      countCmsIntegraByteRangeParcial > 0
        ? `Estrutura PAdES/PKCS#7 detectada (${sigDicts.length} assinatura(s) em PDF mesclado/incremental) — Validação Pendente`
        : 'Estrutura PAdES/PKCS#7 detectada — Validação Pendente';
  } else {
    statusAuditoria = 'VALIDACAO_INCONCLUSIVA';
    origemValidacao = 'Inspeção técnica local de estrutura PDF e pacotes ASN.1/CMS';
    alcanceValidacao =
      'Foram localizados marcadores de assinatura no PDF, porém sem elementos criptográficos suficientes para confirmar ou refutar a validade localmente.';
    motivoStatus =
      motivosPendenciaOuInconclusao[0] ||
      'Marcadores de assinatura foram encontrados no PDF, mas não foi possível concluir a verificação técnica local dos pacotes criptográficos.';
    padraoDetectado = 'Marcadores de assinatura com validação técnica inconclusiva';
  }

  const baseResult: AnaliseAssinaturaPdf = {
    versao_motor: 2,
    status_auditoria: statusAuditoria,
    status_validade: statusAuditoria,
    possui_assinatura_criptografica: true,
    possui_indicio_visual_sem_criptografia: false,
    hash_sha256: hashSha256,
    tamanho_bytes: buf.length,
    modificado_em: options?.modifiedAt ?? null,
    auditado_em: new Date().toISOString(),
    origem_resultado: 'INSPECAO_TECNICA_AUTOMATICA_LOCAL',
    origem_validacao: origemValidacao,
    alcance_validacao: alcanceValidacao,
    motivo_status: motivoStatus,
    aviso_juridico: AVISO_JURIDICO_ASSINATURA,
    padrao_detectado: padraoDetectado,
    signatarios_detectados: signatariosDetectados,
    certificados_signatarios: certificadosSignatarios,
    autoridades_certificadoras: autoridadesCertificadoras,
    outros_componentes_cadeia: outrosComponentes,
    detalhes_assinaturas: detalhesAssinaturas,
    verificacoes_executadas: {
      leitura_estrutura_pdf: true,
      calculo_hash_sha256_arquivo: true,
      extracao_dicionarios_byterange_contents: sigDicts.length > 0,
      decodificacao_asn1_cms_pkcs7: anyCmsDecoded,
      leitura_certificados_x509: anyCertRead,
      verificacao_alinhamento_byterange: anyByteRangeChecked,
      verificacao_hash_message_digest: anyDigestChecked,
      verificacao_assinatura_chave_publica_x509: anyPubKeyChecked,
      consulta_revogacao_lcr_ocsp_online: false,
      validacao_cadeia_iti_online: false,
    },
    conferencia_externa: null,
    titulo_exigencia: '',
    texto_nota_devolucao: '',
  };

  return applyExternalConferenceToAudit(baseResult, options?.conferenciaExterna ?? null);
}

/**
 * Normaliza e higieniza qualquer resultado vindo de versões anteriores do Connector/CLI ou cache legado,
 * garantindo que nomes de certificados, "ICP-Brasil" ou metadados sem verificação criptográfica completa
 * NUNCA sejam exibidos como "Assinatura Válida / Homologada" e que ACs ("AC VALID RFB v5", "ICP-Brasil")
 * e ruídos ("Not specified") sejam separados dos signatários reais.
 */
export function normalizeSignatureAuditResult(
  raw: unknown,
  options?: {
    conferenciaExterna?: ConferenciaExternaAssinatura | null;
    conferenciaAnteriorDivergente?: boolean;
  },
): AnaliseAssinaturaPdf {
  if (!raw || typeof raw !== 'object') {
    return createFailedSignatureAuditResult(
      'Não foi possível analisar o arquivo: o motor documental retornou resposta vazia ou incompatível.',
    );
  }

  const obj = raw as Record<string, any>;

  if (typeof obj.error === 'string' && obj.error.trim()) {
    return createFailedSignatureAuditResult(
      `Falha ao analisar o arquivo: ${obj.error.trim()}`,
    );
  }

  // Se já foi gerado pelo motor v2, apenas aplica eventual conferência externa atualizada
  if (obj.versao_motor === 2 && typeof obj.status_auditoria === 'string') {
    return applyExternalConferenceToAudit(
      obj as AnaliseAssinaturaPdf,
      options?.conferenciaExterna ?? obj.conferencia_externa ?? null,
      options?.conferenciaAnteriorDivergente ?? false,
    );
  }

  // Normalização de payload legado (v1 do CLI Rust)
  const possuiCripto = Boolean(obj.possui_assinatura_criptografica);
  const indicioVisual = Boolean(obj.possui_indicio_visual_sem_criptografia);
  const rawSignatarios: string[] = Array.isArray(obj.signatarios_detectados)
    ? obj.signatarios_detectados.filter((s): s is string => typeof s === 'string')
    : [];
  const rawDetalhes: any[] = Array.isArray(obj.detalhes_assinaturas)
    ? obj.detalhes_assinaturas
    : [];

  const certificadosSignatarios: CertificadoAuditado[] = [];
  const autoridadesCertificadoras: CertificadoAuditado[] = [];
  const outrosComponentes: CertificadoAuditado[] = [];
  const seenSigners = new Set<string>();
  const seenCAs = new Set<string>();
  const seenOutros = new Set<string>();

  for (const item of rawSignatarios) {
    const trimmed = item.trim();
    if (ehNomeRuidoPdf(trimmed)) continue;

    if (ehNomeAutoridadeCertificadora(trimmed)) {
      const nomeAc = trimmed.replace(/^Autoridade\s*\/\s*Emissor:\s*/i, '').trim();
      if (nomeAc.toLowerCase() === 'icp-brasil') {
        if (!seenOutros.has(nomeAc)) {
          seenOutros.add(nomeAc);
          outrosComponentes.push({
            papel: 'COMPONENTE_CADEIA',
            nome_exibicao: 'Infraestrutura de Chaves Públicas Brasileira (ICP-Brasil)',
            documento_mascarado: null,
            emissor_ac: 'Raiz ICP-Brasil',
            organizacao: 'ICP-Brasil',
            unidade_organizacional: null,
            numero_serie: 'Não informado no certificado',
            validade_inicio: 'Não informada no certificado',
            validade_fim: 'Não informada no certificado',
            email: null,
            eh_autoridade_certificadora: true,
            eh_carimbo_tempo: false,
          });
        }
      } else if (!seenCAs.has(nomeAc)) {
        seenCAs.add(nomeAc);
        autoridadesCertificadoras.push({
          papel: 'AUTORIDADE_CERTIFICADORA',
          nome_exibicao: nomeAc,
          documento_mascarado: null,
          emissor_ac: 'Cadeia de Certificação',
          organizacao: 'Não informada no certificado',
          unidade_organizacional: null,
          numero_serie: 'Não informado no certificado',
          validade_inicio: 'Não informada no certificado',
          validade_fim: 'Não informada no certificado',
          email: null,
          eh_autoridade_certificadora: true,
          eh_carimbo_tempo: false,
        });
      }
      continue;
    }

    if (ehNomeCarimboTempoOuServidor(trimmed, false)) {
      if (!seenOutros.has(trimmed)) {
        seenOutros.add(trimmed);
        outrosComponentes.push({
          papel: 'CARIMBO_TEMPO_TSA',
          nome_exibicao: trimmed,
          documento_mascarado: null,
          emissor_ac: 'Não informado no certificado',
          organizacao: 'Não informada no certificado',
          unidade_organizacional: null,
          numero_serie: 'Não informado no certificado',
          validade_inicio: 'Não informada no certificado',
          validade_fim: 'Não informada no certificado',
          email: null,
          eh_autoridade_certificadora: false,
          eh_carimbo_tempo: true,
        });
      }
      continue;
    }

    // Textos genéricos que não são nomes de signatários
    if (
      /cont[eé]m texto indicativo|documento sem certificados|central eletr[oô]nica|prefeitura de s[aã]o paulo|plataforma e-notariado|certificado digital icp-brasil/i.test(
        trimmed,
      )
    ) {
      continue;
    }

    const { nomeLimpo, documentoMascarado } = extrairNomeEDocumentoMascarado(trimmed);
    if (!ehNomeRuidoPdf(nomeLimpo) && !seenSigners.has(nomeLimpo)) {
      seenSigners.add(nomeLimpo);
      certificadosSignatarios.push({
        papel: 'SIGNATARIO',
        nome_exibicao: nomeLimpo,
        documento_mascarado: documentoMascarado,
        emissor_ac: 'Não informado no certificado',
        organizacao: 'Não informada no certificado',
        unidade_organizacional: null,
        numero_serie: 'Não informado no certificado',
        validade_inicio: 'Não informada no certificado',
        validade_fim: 'Não informada no certificado',
        email: null,
        eh_autoridade_certificadora: false,
        eh_carimbo_tempo: false,
      });
    }
  }

  const detalhesNormalizados: DetalheAssinaturaPdf[] = [];
  for (const det of rawDetalhes) {
    const rawSig = typeof det?.signatario === 'string' ? det.signatario.trim() : '';
    const { nomeLimpo, documentoMascarado } = extrairNomeEDocumentoMascarado(rawSig);
    const sigValido =
      !ehNomeRuidoPdf(nomeLimpo) && !ehNomeAutoridadeCertificadora(nomeLimpo)
        ? nomeLimpo
        : certificadosSignatarios[0]?.nome_exibicao || 'Signatário não especificado no certificado';

    const rawEmissor = typeof det?.emissor === 'string' ? det.emissor.trim() : '';
    const emissorLimpo =
      rawEmissor &&
      !/^Autoridade Certificadora (Credenciada )?ICP-Brasil$/i.test(rawEmissor)
        ? rawEmissor
        : autoridadesCertificadoras[0]?.nome_exibicao || 'Não informado no certificado';

    if (
      emissorLimpo !== 'Não informado no certificado' &&
      !seenCAs.has(emissorLimpo)
    ) {
      seenCAs.add(emissorLimpo);
      autoridadesCertificadoras.push({
        papel: 'AUTORIDADE_CERTIFICADORA',
        nome_exibicao: emissorLimpo,
        documento_mascarado: null,
        emissor_ac: 'Cadeia de Certificação',
        organizacao: 'Não informada no certificado',
        unidade_organizacional: null,
        numero_serie: 'Não informado no certificado',
        validade_inicio: 'Não informada no certificado',
        validade_fim: 'Não informada no certificado',
        email: null,
        eh_autoridade_certificadora: true,
        eh_carimbo_tempo: false,
      });
    }

    const rawData = typeof det?.data_assinatura === 'string' ? det.data_assinatura.trim() : '';
    const dataLimpa =
      rawData && !/^Data registrada na assinatura digital$/i.test(rawData)
        ? rawData
        : 'Não informada no pacote CMS';

    const rawSub = typeof det?.subfilter === 'string' ? det.subfilter.trim() : '';
    const subLimpo = rawSub.replace(/\s*\(Padrão PAdES ICP-Brasil\)/i, '').trim() || 'Não informado';

    detalhesNormalizados.push({
      signatario: sigValido,
      documento_mascarado: documentoMascarado,
      emissor: emissorLimpo,
      data_assinatura: dataLimpa,
      subfilter: subLimpo,
      algoritmo_hash: 'Não verificado (triagem estrutural)',
      integridade:
        'Estrutura de assinatura detectada — verificação criptográfica de integridade e cadeia pendente',
      status_tecnico: 'PENDENTE_VALIDACAO_EXTERNA',
      motivo_tecnico:
        'A triagem estrutural identificou o pacote PKCS#7/CMS, mas sem verificação matemática completa do hash /ByteRange e da cadeia de certificação.',
      cobertura_byterange: 'NAO_APLICAVEL',
      numero_serie: typeof det?.numero_serie === 'string' ? det.numero_serie : null,
      validade_certificado: null,
      cpf_cnpj: documentoMascarado,
      email: typeof det?.email === 'string' ? det.email : null,
    });

    // Atualiza dados complementares no certificado do signatário correspondente
    const certMatch = certificadosSignatarios.find((c) => c.nome_exibicao === sigValido);
    if (certMatch) {
      if (emissorLimpo !== 'Não informado no certificado') certMatch.emissor_ac = emissorLimpo;
      if (typeof det?.numero_serie === 'string' && det.numero_serie.trim()) {
        certMatch.numero_serie = det.numero_serie.trim();
      }
      if (typeof det?.email === 'string' && det.email.trim()) {
        certMatch.email = det.email.trim();
      }
    }
  }

  let statusAuditoria: StatusAuditoriaAssinatura;
  let motivoStatus: string;
  let padraoDetectado: string;

  if (!possuiCripto) {
    statusAuditoria = 'NENHUMA_ASSINATURA_DETECTADA';
    padraoDetectado = indicioVisual
      ? 'Indício visual/textual sem estrutura criptográfica PAdES'
      : 'Nenhuma assinatura digital detectada';
    motivoStatus = indicioVisual
      ? 'Nenhuma assinatura digital criptográfica (PAdES/PKCS#7) foi encontrada no PDF. O documento contém apenas menções textuais ou visuais de assinatura, o que não comprova validade criptográfica.'
      : 'Nenhuma assinatura digital criptográfica (PAdES/PKCS#7) foi detectada neste arquivo PDF.';
  } else if (certificadosSignatarios.length > 0 || detalhesNormalizados.length > 0) {
    // Nunca promove detecção estrutural legada para ASSINATURA_VALIDA automaticamente
    statusAuditoria = 'ASSINATURA_DETECTADA_VALIDACAO_PENDENTE';
    padraoDetectado = 'Assinatura digital PAdES/PKCS#7 detectada — Validação Pendente';
    motivoStatus =
      'Foram detectados pacotes de assinatura digital e certificados no PDF, mas a triagem estrutural não comprova isoladamente a integridade criptográfica nem a conformidade ICP-Brasil. Valide o PDF no portal oficial do ITI (validar.iti.gov.br) ou reaudite o arquivo.';
  } else {
    statusAuditoria = 'VALIDACAO_INCONCLUSIVA';
    padraoDetectado = 'Marcadores de assinatura detectados — Validação Inconclusiva';
    motivoStatus =
      'Marcadores de assinatura foram detectados no arquivo, porém sem dados criptográficos suficientes para concluir a validação.';
  }

  const normalized: AnaliseAssinaturaPdf = {
    versao_motor: 2,
    status_auditoria: statusAuditoria,
    status_validade: statusAuditoria,
    possui_assinatura_criptografica: possuiCripto,
    possui_indicio_visual_sem_criptografia: indicioVisual,
    hash_sha256: typeof obj.hash_sha256 === 'string' ? obj.hash_sha256 : null,
    tamanho_bytes: typeof obj.tamanho_bytes === 'number' ? obj.tamanho_bytes : null,
    modificado_em: typeof obj.modificado_em === 'string' ? obj.modificado_em : null,
    auditado_em: typeof obj.auditado_em === 'string' ? obj.auditado_em : new Date().toISOString(),
    origem_resultado: 'INSPECAO_TECNICA_AUTOMATICA_LOCAL',
    origem_validacao: 'Triagem técnica estrutural de dicionários PDF e pacotes ASN.1',
    alcance_validacao:
      'Extração de metadados e certificados da estrutura PDF sem verificação online de cadeia/revogação no ITI.',
    motivo_status: motivoStatus,
    aviso_juridico: AVISO_JURIDICO_ASSINATURA,
    padrao_detectado: padraoDetectado,
    signatarios_detectados: certificadosSignatarios.map((c) => c.nome_exibicao),
    certificados_signatarios: certificadosSignatarios,
    autoridades_certificadoras: autoridadesCertificadoras,
    outros_componentes_cadeia: outrosComponentes,
    detalhes_assinaturas: detalhesNormalizados,
    verificacoes_executadas: {
      leitura_estrutura_pdf: true,
      calculo_hash_sha256_arquivo: Boolean(obj.hash_sha256),
      extracao_dicionarios_byterange_contents: possuiCripto,
      decodificacao_asn1_cms_pkcs7: possuiCripto,
      leitura_certificados_x509: certificadosSignatarios.length > 0 || autoridadesCertificadoras.length > 0,
      verificacao_alinhamento_byterange: false,
      verificacao_hash_message_digest: false,
      verificacao_assinatura_chave_publica_x509: false,
      consulta_revogacao_lcr_ocsp_online: false,
      validacao_cadeia_iti_online: false,
    },
    conferencia_externa: null,
    titulo_exigencia: '',
    texto_nota_devolucao: '',
  };

  return applyExternalConferenceToAudit(
    normalized,
    options?.conferenciaExterna ?? null,
    options?.conferenciaAnteriorDivergente ?? false,
  );
}

