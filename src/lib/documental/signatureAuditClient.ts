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
  versao_motor?: number;
  status_auditoria?: StatusAuditoriaAssinatura;
  status_validade: string;
  possui_assinatura_criptografica: boolean;
  possui_indicio_visual_sem_criptografia: boolean;
  hash_sha256?: string | null;
  tamanho_bytes?: number | null;
  modificado_em?: string | null;
  auditado_em?: string;
  origem_resultado?:
    | 'INSPECAO_TECNICA_AUTOMATICA_LOCAL'
    | 'CONFERENCIA_EXTERNA_MANUAL'
    | 'INTEGRACAO_VERIFICAVEL';
  origem_validacao?: string;
  alcance_validacao?: string;
  motivo_status?: string;
  aviso_juridico?: string;
  padrao_detectado: string;
  signatarios_detectados: string[];
  certificados_signatarios?: CertificadoAuditado[];
  autoridades_certificadoras?: CertificadoAuditado[];
  outros_componentes_cadeia?: CertificadoAuditado[];
  detalhes_assinaturas?: DetalheAssinaturaPdf[];
  verificacoes_executadas?: VerificacaoTecnicaExecutada;
  conferencia_externa?: ConferenciaExternaAssinatura | null;
  conferencia_externa_invalidada_por_alteracao?: boolean;
  titulo_exigencia: string;
  texto_nota_devolucao: string;
}

export const AVISO_JURIDICO_ASSINATURA =
  'A verificação técnica de assinatura digital afere apenas parâmetros criptográficos e estruturais do arquivo; não comprova a veracidade do conteúdo do documento nem determina, por si só, sua aceitação jurídica ou dispensa de qualificação registral.';

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

export function createFailedSignatureAuditResult(
  motivo: string,
  options?: {
    tamanhoBytes?: number | null;
    modificadoEm?: string | null;
    hashSha256?: string | null;
  },
): Required<AnaliseAssinaturaPdf> {
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
    alcance_validacao:
      'Nenhuma verificação de assinatura pôde ser concluída porque o arquivo não pôde ser analisado.',
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
    conferencia_externa_invalidada_por_alteracao: false,
    titulo_exigencia: 'Falha Técnica na Análise do Arquivo',
    texto_nota_devolucao: '',
  };
}

export function applyExternalConferenceToAudit(
  analise: Required<AnaliseAssinaturaPdf>,
  conferencia: ConferenciaExternaAssinatura | null,
  conferenciaAnteriorDivergente = false,
): Required<AnaliseAssinaturaPdf> {
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

export function normalizeSignatureAuditResult(
  raw: unknown,
  options?: {
    conferenciaExterna?: ConferenciaExternaAssinatura | null;
    conferenciaAnteriorDivergente?: boolean;
  },
): Required<AnaliseAssinaturaPdf> {
  if (!raw || typeof raw !== 'object') {
    return createFailedSignatureAuditResult(
      'Não foi possível analisar o arquivo: o motor documental retornou resposta vazia ou incompatível.',
    );
  }

  const obj = raw as Record<string, any>;

  if (typeof obj.error === 'string' && obj.error.trim()) {
    return createFailedSignatureAuditResult(`Falha ao analisar o arquivo: ${obj.error.trim()}`);
  }

  if (obj.versao_motor === 2 && typeof obj.status_auditoria === 'string') {
    const baseV2: Required<AnaliseAssinaturaPdf> = {
      versao_motor: 2,
      status_auditoria: obj.status_auditoria as StatusAuditoriaAssinatura,
      status_validade: String(obj.status_validade || obj.status_auditoria),
      possui_assinatura_criptografica: Boolean(obj.possui_assinatura_criptografica),
      possui_indicio_visual_sem_criptografia: Boolean(obj.possui_indicio_visual_sem_criptografia),
      hash_sha256: typeof obj.hash_sha256 === 'string' ? obj.hash_sha256 : null,
      tamanho_bytes: typeof obj.tamanho_bytes === 'number' ? obj.tamanho_bytes : null,
      modificado_em: typeof obj.modificado_em === 'string' ? obj.modificado_em : null,
      auditado_em: typeof obj.auditado_em === 'string' ? obj.auditado_em : new Date().toISOString(),
      origem_resultado: obj.origem_resultado || 'INSPECAO_TECNICA_AUTOMATICA_LOCAL',
      origem_validacao: obj.origem_validacao || 'Inspeção técnica local',
      alcance_validacao: obj.alcance_validacao || 'Verificação estrutural e criptográfica local.',
      motivo_status: obj.motivo_status || '',
      aviso_juridico: obj.aviso_juridico || AVISO_JURIDICO_ASSINATURA,
      padrao_detectado: obj.padrao_detectado || '',
      signatarios_detectados: Array.isArray(obj.signatarios_detectados) ? obj.signatarios_detectados : [],
      certificados_signatarios: Array.isArray(obj.certificados_signatarios) ? obj.certificados_signatarios : [],
      autoridades_certificadoras: Array.isArray(obj.autoridades_certificadoras) ? obj.autoridades_certificadoras : [],
      outros_componentes_cadeia: Array.isArray(obj.outros_componentes_cadeia) ? obj.outros_componentes_cadeia : [],
      detalhes_assinaturas: Array.isArray(obj.detalhes_assinaturas) ? obj.detalhes_assinaturas : [],
      verificacoes_executadas: obj.verificacoes_executadas || {
        leitura_estrutura_pdf: true,
        calculo_hash_sha256_arquivo: Boolean(obj.hash_sha256),
        extracao_dicionarios_byterange_contents: Boolean(obj.possui_assinatura_criptografica),
        decodificacao_asn1_cms_pkcs7: Boolean(obj.possui_assinatura_criptografica),
        leitura_certificados_x509: true,
        verificacao_alinhamento_byterange: true,
        verificacao_hash_message_digest: true,
        verificacao_assinatura_chave_publica_x509: true,
        consulta_revogacao_lcr_ocsp_online: false,
        validacao_cadeia_iti_online: false,
      },
      conferencia_externa: obj.conferencia_externa ?? null,
      conferencia_externa_invalidada_por_alteracao: Boolean(obj.conferencia_externa_invalidada_por_alteracao),
      titulo_exigencia: obj.titulo_exigencia || '',
      texto_nota_devolucao: obj.texto_nota_devolucao || '',
    };
    return applyExternalConferenceToAudit(
      baseV2,
      options?.conferenciaExterna ?? baseV2.conferencia_externa ?? null,
      options?.conferenciaAnteriorDivergente ?? baseV2.conferencia_externa_invalidada_por_alteracao,
    );
  }

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
      rawEmissor && !/^Autoridade Certificadora (Credenciada )?ICP-Brasil$/i.test(rawEmissor)
        ? rawEmissor
        : autoridadesCertificadoras[0]?.nome_exibicao || 'Não informado no certificado';

    if (emissorLimpo !== 'Não informado no certificado' && !seenCAs.has(emissorLimpo)) {
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

  const normalized: Required<AnaliseAssinaturaPdf> = {
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
      leitura_certificados_x509:
        certificadosSignatarios.length > 0 || autoridadesCertificadoras.length > 0,
      verificacao_alinhamento_byterange: false,
      verificacao_hash_message_digest: false,
      verificacao_assinatura_chave_publica_x509: false,
      consulta_revogacao_lcr_ocsp_online: false,
      validacao_cadeia_iti_online: false,
    },
    conferencia_externa: null,
    conferencia_externa_invalidada_por_alteracao: false,
    titulo_exigencia: '',
    texto_nota_devolucao: '',
  };

  return applyExternalConferenceToAudit(
    normalized,
    options?.conferenciaExterna ?? null,
    options?.conferenciaAnteriorDivergente ?? false,
  );
}

