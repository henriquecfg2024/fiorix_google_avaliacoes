export interface CausaConfigItem {
  id: string;
  nome: string;
  descricao: string;
  cor: string;
}

/**
 * Taxonomia oficial das Causas de Erros Internos do 7º RI de São Paulo,
 * calibrada sobre o acervo real de observações de retorno (292 Tela Recepção, 293 Real, 294 Pessoal).
 */
export const CAUSAS_CONFIG: readonly CausaConfigItem[] = [
  {
    id: "grafia_nomes_vides",
    nome: "Grafia de Nomes & Vides (Pessoal)",
    descricao: "Correção de grafia de nomes/sobrenomes ou lançamento de VIDE no Indicador Pessoal",
    cor: "#10B981",
  },
  {
    id: "matricula_real",
    nome: "Matrícula & Transcrição (Indicador Real)",
    descricao: "Matrícula ou transcrição lançada incorretamente, omitida, livro ou unidade divergente",
    cor: "#8B5CF6",
  },
  {
    id: "cpf_rg_qualificacao",
    nome: "CPF, RG & Qualificação Civil",
    descricao: "Divergência ou omissão de CPF, RG, cônjuge, estado civil, regime de bens ou qualificação",
    cor: "#3B82F6",
  },
  {
    id: "contribuinte_iptu",
    nome: "Contribuinte & Cadastro Fiscal (IPTU)",
    descricao: "Falta de lançamento ou atualização do número de contribuinte (SQL/IPTU) individualizado",
    cor: "#F59E0B",
  },
  {
    id: "natureza_data_recepcao",
    nome: "Natureza & Data do Título (Recepção)",
    descricao: "Erro no lançamento da natureza do título, tipo de prenotação ou data do título/saída",
    cor: "#F97316",
  },
  {
    id: "omissao_partes",
    nome: "Omissão de Partes no Contraditório",
    descricao: "Falta de inclusão de adquirente, transmitente, herdeiro, credor ou participante no contraditório",
    cor: "#EC4899",
  },
  {
    id: "vinculacao_reentrada",
    nome: "Vinculação de Protocolo & Reentrada",
    descricao: "Falta de vinculação ou vinculação incorreta de protocolo anterior ou título em reentrada",
    cor: "#06B6D4",
  },
  {
    id: "documentacao_emolumentos",
    nome: "Documentação, Certidões & Custas",
    descricao: "Divergência documental, certidões, procuração/firma ou conferência de custas e tributos",
    cor: "#14B8A6",
  },
] as const;

export const CATEGORIAS_OFICIAIS_SET = new Set<string>(CAUSAS_CONFIG.map((c) => c.nome));

export function normalizarTextoCausa(texto: string): string {
  return (texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function isObservacaoGenerica(obs: string): boolean {
  const norm = normalizarTextoCausa(obs);
  if (!norm) return true;
  return /^(retorno realizado\.?|corrigido\.?|solicitacao atendida\.?|feita a inclusao conforme retorno\.?|ok!?|concluido\.?)$/.test(
    norm
  );
}

/**
 * Classifica a observação de retorno interno em uma causa oficial do 7º RI.
 * Lê integralmente o texto normalizado e utiliza o tipo de retorno oficial (292/293/294)
 * como desempate semântico quando a observação contiver apenas confirmação genérica.
 */
export function classificarCausa(obs: string, idTipoRetorno?: number): string {
  const norm = normalizarTextoCausa(obs);

  // 1. Observações em branco ou apenas confirmação de conclusão -> classifica pelo tipo oficial do retorno
  if (isObservacaoGenerica(obs)) {
    if (idTipoRetorno === 293) return "Matrícula & Transcrição (Indicador Real)";
    if (idTipoRetorno === 294) return "Grafia de Nomes & Vides (Pessoal)";
    if (idTipoRetorno === 292) return "Natureza & Data do Título (Recepção)";
    return "Outras Causas";
  }

  // 2. Contribuinte / IPTU / SQL do imóvel
  if (/\b(contribuinte\w*|iptu|sql|cadastro municipal|incra)\b/.test(norm)) {
    return "Contribuinte & Cadastro Fiscal (IPTU)";
  }

  // 3. Matrícula, Transcrição, Livro ou Unidade no Indicador Real / Recepção
  if (
    /\b(matricul\w*|transcric\w*|tr\.\s*\d|sem livro|livro\s*\d|extratad\w*\s+na\s+matricul\w*|lancamento da unidade)\b/.test(
      norm
    )
  ) {
    return "Matrícula & Transcrição (Indicador Real)";
  }

  // 4. Vinculação de Protocolo & Reentrada (evitando falso-positivo em "comprador X, vinculado ao protocolo nº Y")
  if (
    /\b(vinculac\w*|desvincul\w*|reentrada|re-entrada)\b/.test(norm) ||
    /\b(nao vincul\w*|faltou vincular|vincular com a prenotacao|prendid\w* com um titulo)\b/.test(norm)
  ) {
    return "Vinculação de Protocolo & Reentrada";
  }

  // 5. Natureza do Ato, Tipo de Prenotação ou Data do Título / Saída (Recepção)
  if (
    /\b(natureza|tipo de prenotacao|data do titulo|data de saida|instrumento com data|instrumento particular)\b/.test(
      norm
    )
  ) {
    return "Natureza & Data do Título (Recepção)";
  }

  // 6. CPF, RG, Estado Civil, Cônjuge, Regime de Bens, Casamento ou Qualificação Civil
  if (
    /\b(cpf|cnpj|rg|r\.g\.|conjuge|esposo|esposa|regime de bens|estado civil|nacionalidade|angolana|sexo|feminino|masculino|nupcias|certidao de casamento|qualificacao completa|incluir a qualificacao|documentos e nome)\b/.test(
      norm
    )
  ) {
    return "CPF, RG & Qualificação Civil";
  }

  // 7. Omissão / Inclusão de Partes quando não se trata de erro de grafia/nome/vide
  const mencionaGrafiaOuVide =
    /\b(vide|vides|nome|nomes|sobrenome|grafia|homonimo)\b/.test(norm) ||
    /\bcorreto\b.*\be nao\b/.test(norm);

  if (
    !mencionaGrafiaOuVide &&
    /\b(participante\w*|partes do titulo|arrematante|credor fiduciario|falecido|convivente|faltou lancar|faltou incluir|lancar adquirente|lancar banco|incluir no contraditorio|lancamento dos participantes|lancar os participantes)\b/.test(
      norm
    )
  ) {
    return "Omissão de Partes no Contraditório";
  }

  // 8. Grafia de Nomes, Sobrenomes & Vides (Indicador Pessoal)
  if (
    mencionaGrafiaOuVide ||
    (idTipoRetorno === 294 && /\b([a-z]{3,}\s+para\s+[a-z]{3,}|correto\s+[a-z]{3,})\b/.test(norm))
  ) {
    return "Grafia de Nomes & Vides (Pessoal)";
  }

  // 9. Demais ocorrências envolvendo partes no contraditório
  if (
    /\b(participante\w*|adquirente\w*|transmitente\w*|comprador\w*|vendedor\w*|herdeir\w*|credor\w*|devedor\w*|outorgante\w*|outorgad\w*)\b/.test(
      norm
    )
  ) {
    return "Omissão de Partes no Contraditório";
  }

  // 10. Documentação, Certidões, Procuração, Firma ou Custas/Emolumentos
  if (
    /\b(certidao|certidoes|procurac\w*|firma|assinatura|mandato|emolumento\w*|custas|itbi|guia|imposto|tribut\w*)\b/.test(
      norm
    )
  ) {
    return "Documentação, Certidões & Custas";
  }

  // Fallback contextual pelo tipo de retorno oficial caso surja redação abreviada inédita
  if (idTipoRetorno === 293) return "Matrícula & Transcrição (Indicador Real)";
  if (idTipoRetorno === 294) return "Grafia de Nomes & Vides (Pessoal)";
  if (idTipoRetorno === 292) return "Natureza & Data do Título (Recepção)";

  return "Outras Causas";
}
