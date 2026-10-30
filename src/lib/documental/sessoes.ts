/**
 * Cadastro Oficial de Sessões do 7º Registro de Imóveis da Capital.
 * Mapeamento idêntico ao Siplan ("Sessões sem Grupo"), vinculando
 * o caminho de rede UNC oficial (\\SRVFILES\imagens\IMAGENS\<sessao>)
 * ao drive mapeado local (K:\IMAGENS\<sessao>) de forma automática e transparente.
 */

export interface CadastroSessao {
  id: string;
  nome: string;
  grupo: 'Sessões sem Grupo';
  descricao: string;
  sequencia: number;
  padraoLocalizacao: 'milhar' | 'tomo' | 'protocolo' | 'processo' | 'direto';
  caminhoUnc: string;
  pastaLocal: string;
  confidencial: boolean;
  alias?: string[];
}

export const CADASTRO_SESSOES_COMPLETO: CadastroSessao[] = [
  {
    id: 'adjudicacao_extrajudicial',
    nome: 'ADJUDICAÇÃO C. EXTRAJUDICIAL',
    grupo: 'Sessões sem Grupo',
    descricao: 'Adjudicação Compulsória Extrajudicial (Lei 14.382/2022)',
    sequencia: 1,
    padraoLocalizacao: 'direto',
    caminhoUnc: '\\\\SRVFILES\\imagens\\IMAGENS\\ADJUDICAÇAO C. EXTRAJUDICIAL',
    pastaLocal: 'K:\\IMAGENS\\ADJUDICAÇAO C. EXTRAJUDICIAL',
    confidencial: false,
  },
  {
    id: 'anexo_de_certidao',
    nome: 'ANEXO_DE_CERTIDAO',
    grupo: 'Sessões sem Grupo',
    descricao: 'Folhas e Documentos Anexos a Certidões',
    sequencia: 2,
    padraoLocalizacao: 'milhar',
    caminhoUnc: '\\\\SRVFILES\\imagens\\IMAGENS\\ANEXO_DE_CERTIDAO',
    pastaLocal: 'K:\\IMAGENS\\ANEXO_DE_CERTIDAO',
    confidencial: false,
  },
  {
    id: 'consultajur',
    nome: 'CONSULTAJUR',
    grupo: 'Sessões sem Grupo',
    descricao: 'Consultas Jurídicas Internas e Pareceres Cartoriais',
    sequencia: 3,
    padraoLocalizacao: 'milhar',
    caminhoUnc: '\\\\SRVFILES\\imagens\\IMAGENS\\CONSULTAJUR',
    pastaLocal: 'K:\\IMAGENS\\CONSULTAJUR',
    confidencial: false,
  },
  {
    id: 'contra_fe',
    nome: 'CONTRA-FÉ',
    grupo: 'Sessões sem Grupo',
    descricao: 'Contra-Fés de Mandados, Notificações e Citações',
    sequencia: 4,
    padraoLocalizacao: 'direto',
    caminhoUnc: '\\\\SRVFILES\\imagens\\IMAGENS\\Contra-Fé',
    pastaLocal: 'K:\\IMAGENS\\Contra-Fé',
    confidencial: false,
  },
  {
    id: 'devolucoes_antigas',
    nome: 'DEVOLUCOES_ANTIGAS',
    grupo: 'Sessões sem Grupo',
    descricao: 'Acervo de Devoluções Antigas e Suscitações de Dúvida',
    sequencia: 5,
    padraoLocalizacao: 'milhar',
    caminhoUnc: '\\\\SRVFILES\\imagens\\IMAGENS\\DEVOLUCOES_ANTIGAS',
    pastaLocal: 'K:\\IMAGENS\\DEVOLUCOES_ANTIGAS',
    confidencial: false,
  },
  {
    id: 'documentos',
    nome: 'DOCUMENTOS',
    grupo: 'Sessões sem Grupo',
    descricao: 'Documentos Pessoais e Complementares Arquivados',
    sequencia: 6,
    padraoLocalizacao: 'milhar',
    caminhoUnc: '\\\\SRVFILES\\imagens\\IMAGENS\\DOCUMENTOS',
    pastaLocal: 'K:\\IMAGENS\\DOCUMENTOS',
    confidencial: false,
  },
  {
    id: 'ficha_auxiliar',
    nome: 'FICHA AUXILIAR',
    grupo: 'Sessões sem Grupo',
    descricao: 'Fichas Auxiliares de Registro Geral e Indicador',
    sequencia: 7,
    padraoLocalizacao: 'milhar',
    caminhoUnc: '\\\\SRVFILES\\imagens\\IMAGENS\\FICHA AUXILIAR',
    pastaLocal: 'K:\\IMAGENS\\FICHA AUXILIAR',
    confidencial: false,
  },
  {
    id: 'indisponibilidade',
    nome: 'INDISPONIBILIDADE',
    grupo: 'Sessões sem Grupo',
    descricao: 'Ordens de Indisponibilidade de Bens (CNIB e Judiciais)',
    sequencia: 8,
    padraoLocalizacao: 'milhar',
    caminhoUnc: '\\\\SRVFILES\\imagens\\IMAGENS\\INDISPONIBILIDADE',
    pastaLocal: 'K:\\IMAGENS\\INDISPONIBILIDADE',
    confidencial: false,
  },
  {
    id: 'intimacao',
    nome: 'INTIMAÇÃO',
    grupo: 'Sessões sem Grupo',
    descricao: 'Intimações de Devedores Fiduciários e Notificações Extrajudiciais',
    sequencia: 9,
    padraoLocalizacao: 'direto',
    caminhoUnc: '\\\\SRVFILES\\imagens\\IMAGENS\\INTIMAÇÃO',
    pastaLocal: 'K:\\IMAGENS\\INTIMAÇÃO',
    confidencial: false,
    alias: ['INTIMACAO'],
  },
  {
    id: 'lv2',
    nome: 'LV2',
    grupo: 'Sessões sem Grupo',
    descricao: 'Livro nº 2 — Registro Geral (Matrículas Imobiliárias)',
    sequencia: 10,
    padraoLocalizacao: 'milhar',
    caminhoUnc: '\\\\SRVFILES\\imagens\\IMAGENS\\LV2',
    pastaLocal: 'K:\\IMAGENS\\LV2',
    confidencial: false,
    alias: ['MATRICULAS', 'LIVRO2', 'MATRICULA'],
  },
  {
    id: 'lv3',
    nome: 'LV3',
    grupo: 'Sessões sem Grupo',
    descricao: 'Livro nº 3 — Registro Auxiliar (Atos e convenções antenupciais)',
    sequencia: 11,
    padraoLocalizacao: 'milhar',
    caminhoUnc: '\\\\SRVFILES\\imagens\\IMAGENS\\LV3',
    pastaLocal: 'K:\\IMAGENS\\LV3',
    confidencial: false,
    alias: ['LIVRO3'],
  },
  {
    id: 'lv4',
    nome: 'LV4',
    grupo: 'Sessões sem Grupo',
    descricao: 'Livro nº 4 — Registros Diversos (RD / Tomos encadernados 4, 4A, 4AA...)',
    sequencia: 12,
    padraoLocalizacao: 'tomo',
    caminhoUnc: '\\\\SRVFILES\\imagens\\IMAGENS\\LV4',
    pastaLocal: 'K:\\IMAGENS\\LV4',
    confidencial: false,
    alias: ['RD', 'LIVRO4', 'REGISTROS DIVERSOS'],
  },
  {
    id: 'lv7',
    nome: 'LV7',
    grupo: 'Sessões sem Grupo',
    descricao: 'Livro nº 7 — Indicador Pessoal Legado (Fichas e assentamentos)',
    sequencia: 13,
    padraoLocalizacao: 'milhar',
    caminhoUnc: '\\\\SRVFILES\\imagens\\IMAGENS\\LV7',
    pastaLocal: 'K:\\IMAGENS\\LV7',
    confidencial: false,
    alias: ['LIVRO7'],
  },
  {
    id: 'lv8',
    nome: 'LV8',
    grupo: 'Sessões sem Grupo',
    descricao: 'Livro nº 8 — Registro de Loteamentos e Desmembramentos (Tomos 8, 8A, 8B...)',
    sequencia: 14,
    padraoLocalizacao: 'tomo',
    caminhoUnc: '\\\\SRVFILES\\imagens\\IMAGENS\\LV8',
    pastaLocal: 'K:\\IMAGENS\\LV8',
    confidencial: false,
    alias: ['LOTEAMENTO', 'LOTEAMENTOS', 'LIVRO8'],
  },
  {
    id: 'mandado',
    nome: 'MANDADO',
    grupo: 'Sessões sem Grupo',
    descricao: 'Mandados Judiciais (Penhoras, Arrestos, Citações e Desapropriações)',
    sequencia: 15,
    padraoLocalizacao: 'milhar',
    caminhoUnc: '\\\\SRVFILES\\imagens\\IMAGENS\\MANDADO',
    pastaLocal: 'K:\\IMAGENS\\MANDADO',
    confidencial: false,
  },
  {
    id: 'notas_devolutivas',
    nome: 'NOTAS DEVOLUTIVAS',
    grupo: 'Sessões sem Grupo',
    descricao: 'Notas de Devolução (Exigências Registrais Fundamentadas)',
    sequencia: 16,
    padraoLocalizacao: 'milhar',
    caminhoUnc: '\\\\SRVFILES\\imagens\\IMAGENS\\NOTAS DEVOLUTIVAS',
    pastaLocal: 'K:\\IMAGENS\\NOTAS DEVOLUTIVAS',
    confidencial: false,
  },
  {
    id: 'oficioexpedido',
    nome: 'OFICIOEXPEDIDO',
    grupo: 'Sessões sem Grupo',
    descricao: 'Ofícios Expedidos pelo 7º RI para Órgãos Públicos e Juízos',
    sequencia: 17,
    padraoLocalizacao: 'milhar',
    caminhoUnc: '\\\\SRVFILES\\imagens\\IMAGENS\\OFICIOEXPEDIDO',
    pastaLocal: 'K:\\IMAGENS\\OFICIOEXPEDIDO',
    confidencial: false,
  },
  {
    id: 'oficiorecebido',
    nome: 'OFICIORECEBIDO',
    grupo: 'Sessões sem Grupo',
    descricao: 'Ofícios Recebidos de Tribunais, Varas e Autoridades',
    sequencia: 18,
    padraoLocalizacao: 'milhar',
    caminhoUnc: '\\\\SRVFILES\\imagens\\IMAGENS\\OFICIORECEBIDO',
    pastaLocal: 'K:\\IMAGENS\\OFICIORECEBIDO',
    confidencial: false,
  },
  {
    id: 'oficiorecebidoarisp',
    nome: 'OFICIORECEBIDOARISP',
    grupo: 'Sessões sem Grupo',
    descricao: 'Ofícios Eletrônicos Recebidos via Central ARISP / ONR',
    sequencia: 19,
    padraoLocalizacao: 'milhar',
    caminhoUnc: '\\\\SRVFILES\\imagens\\IMAGENS\\OFICIORECEBIDOARISP',
    pastaLocal: 'K:\\IMAGENS\\OFICIORECEBIDOARISP',
    confidencial: false,
  },
  {
    id: 'oficios',
    nome: 'OFICIOS',
    grupo: 'Sessões sem Grupo',
    descricao: 'Acervo Geral de Ofícios e Comunicações Administrativas',
    sequencia: 20,
    padraoLocalizacao: 'milhar',
    caminhoUnc: '\\\\SRVFILES\\imagens\\IMAGENS\\Oficios',
    pastaLocal: 'K:\\IMAGENS\\Oficios',
    confidencial: false,
  },
  {
    id: 'outrosdoctos',
    nome: 'OUTROSDOCTOS',
    grupo: 'Sessões sem Grupo',
    descricao: 'Outros Documentos Diversos e Plantas Arquivadas',
    sequencia: 21,
    padraoLocalizacao: 'milhar',
    caminhoUnc: '\\\\SRVFILES\\imagens\\IMAGENS\\OUTROSDOCTOS',
    pastaLocal: 'K:\\IMAGENS\\OUTROSDOCTOS',
    confidencial: false,
  },
  {
    id: 'pasta_indi',
    nome: 'PASTA-INDI',
    grupo: 'Sessões sem Grupo',
    descricao: 'Indicador Real e Pessoal Histórico em Pastas',
    sequencia: 22,
    padraoLocalizacao: 'milhar',
    caminhoUnc: '\\\\SRVFILES\\imagens\\IMAGENS\\PASTA-INDI',
    pastaLocal: 'K:\\IMAGENS\\PASTA-INDI',
    confidencial: false,
  },
  {
    id: 'pedidos',
    nome: 'PEDIDOS',
    grupo: 'Sessões sem Grupo',
    descricao: 'Pedidos de Certidão e Atendimento ao Público',
    sequencia: 23,
    padraoLocalizacao: 'milhar',
    caminhoUnc: '\\\\SRVFILES\\imagens\\IMAGENS\\PEDIDOS',
    pastaLocal: 'K:\\IMAGENS\\PEDIDOS',
    confidencial: false,
  },
  {
    id: 'pedidos_certidoes',
    nome: 'PEDIDOS_CERTIDOES',
    grupo: 'Sessões sem Grupo',
    descricao: 'Certidões Imobiliárias e Fichas Emitidas',
    sequencia: 24,
    padraoLocalizacao: 'milhar',
    caminhoUnc: '\\\\SRVFILES\\imagens\\IMAGENS\\PEDIDOS_CERTIDOES',
    pastaLocal: 'K:\\IMAGENS\\PEDIDOS_CERTIDOES',
    confidencial: false,
  },
  {
    id: 'pedidos_online',
    nome: 'PEDIDOS-ONLINE',
    grupo: 'Sessões sem Grupo',
    descricao: 'Pedidos Eletrônicos de Certidão (SAEC / ONR)',
    sequencia: 25,
    padraoLocalizacao: 'milhar',
    caminhoUnc: '\\\\SRVFILES\\imagens\\IMAGENS\\PEDIDOS-ONLINE',
    pastaLocal: 'K:\\IMAGENS\\PEDIDOS-ONLINE',
    confidencial: false,
  },
  {
    id: 'processos',
    nome: 'PROCESSOS',
    grupo: 'Sessões sem Grupo',
    descricao: 'Processos Judiciais (1ª e 2ª Varas de Registros Públicos / Varas Cíveis)',
    sequencia: 26,
    padraoLocalizacao: 'processo',
    caminhoUnc: '\\\\SRVFILES\\imagens\\IMAGENS\\PROCESSOS',
    pastaLocal: 'H:\\PROCESSOS - ENVIADOS POR E-MAIL',
    confidencial: false,
  },
  {
    id: 'processos_visualiza',
    nome: 'PROCESSOS-VISUALIZA',
    grupo: 'Sessões sem Grupo',
    descricao: 'Processos em Visualização e Consulta',
    sequencia: 27,
    padraoLocalizacao: 'milhar',
    caminhoUnc: '\\\\SRVFILES\\imagens\\IMAGENS\\PROCESSOS-VISUALIZA',
    pastaLocal: 'K:\\IMAGENS\\PROCESSOS-VISUALIZA',
    confidencial: false,
  },
  {
    id: 'procuracao',
    nome: 'PROCURACAO',
    grupo: 'Sessões sem Grupo',
    descricao: 'Procurações e Substabelecimentos Arquivados na Serventia',
    sequencia: 28,
    padraoLocalizacao: 'milhar',
    caminhoUnc: '\\\\SRVFILES\\imagens\\IMAGENS\\PROCURACAO',
    pastaLocal: 'K:\\IMAGENS\\PROCURACAO',
    confidencial: false,
    alias: ['PROCURAÇÃO'],
  },
  {
    id: 'protocolos',
    nome: 'PROTOCOLOS',
    grupo: 'Sessões sem Grupo',
    descricao: 'Protocolos de Entrada do Livro 1 (Prenotação Geral)',
    sequencia: 29,
    padraoLocalizacao: 'milhar',
    caminhoUnc: '\\\\SRVFILES\\imagens\\IMAGENS\\PROTOCOLOS',
    pastaLocal: 'K:\\IMAGENS\\PROTOCOLOS',
    confidencial: false,
  },
  {
    id: 'rd_registros_diversos',
    nome: 'RD- Registros Diversos',
    grupo: 'Sessões sem Grupo',
    descricao: 'Registros Diversos — Fichas e Arquivamentos por Milhar',
    sequencia: 30,
    padraoLocalizacao: 'milhar',
    caminhoUnc: '\\\\SRVFILES\\imagens\\IMAGENS\\RD- REGISTROS DIVERSOS',
    pastaLocal: 'K:\\IMAGENS\\RD- REGISTROS DIVERSOS',
    confidencial: false,
    alias: ['RD', 'REGISTROS DIVERSOS', 'LV4'],
  },
  {
    id: 'registro_analitico',
    nome: 'REGISTRO_ANALITICO',
    grupo: 'Sessões sem Grupo',
    descricao: 'Relatórios Analíticos de Títulos e Atos Praticados',
    sequencia: 31,
    padraoLocalizacao: 'milhar',
    caminhoUnc: '\\\\SRVFILES\\imagens\\IMAGENS\\REGISTRO_ANALITICO',
    pastaLocal: 'K:\\IMAGENS\\REGISTRO_ANALITICO',
    confidencial: false,
  },
  {
    id: 'retificacao_area',
    nome: 'RETIFICAÇÃODEÁREA',
    grupo: 'Sessões sem Grupo',
    descricao: 'Procedimentos de Retificação de Área e Medidas Perimetrais',
    sequencia: 32,
    padraoLocalizacao: 'direto',
    caminhoUnc: '\\\\SRVFILES\\imagens\\IMAGENS\\RETIFICAÇÃODEÁREA',
    pastaLocal: 'K:\\IMAGENS\\RETIFICAÇÃODEÁREA',
    confidencial: false,
    alias: ['RETIFICACAO DE AREA'],
  },
  {
    id: 'setores',
    nome: 'SETORES',
    grupo: 'Sessões sem Grupo',
    descricao: 'Plantas de Setores Fiscais e Quadras Municipais',
    sequencia: 33,
    padraoLocalizacao: 'direto',
    caminhoUnc: '\\\\SRVFILES\\imagens\\IMAGENS\\SETORES',
    pastaLocal: 'K:\\IMAGENS\\SETORES',
    confidencial: false,
  },
  {
    id: 'sinal',
    nome: 'SINAL',
    grupo: 'Sessões sem Grupo',
    descricao: 'Sinais e Autógrafos Notariais de Confirmação',
    sequencia: 34,
    padraoLocalizacao: 'milhar',
    caminhoUnc: '\\\\SRVFILES\\imagens\\IMAGENS\\SINAL',
    pastaLocal: 'K:\\IMAGENS\\SINAL',
    confidencial: false,
  },
  {
    id: 'sinal_publico',
    nome: 'Sinal_Publico',
    grupo: 'Sessões sem Grupo',
    descricao: 'Cartões de Autógrafo e Fichas de Sinal Público de Tabeliães',
    sequencia: 35,
    padraoLocalizacao: 'milhar',
    caminhoUnc: '\\\\SRVFILES\\imagens\\IMAGENS\\Sinal_Publico',
    pastaLocal: 'K:\\IMAGENS\\Sinal_Publico',
    confidencial: false,
  },
  {
    id: 'talonarios',
    nome: 'TALONARIOS',
    grupo: 'Sessões sem Grupo',
    descricao: 'Talonários Registrais de Protocolo',
    sequencia: 36,
    padraoLocalizacao: 'milhar',
    caminhoUnc: '\\\\SRVFILES\\imagens\\IMAGENS\\TALONARIOS-VISUALIZA',
    pastaLocal: 'K:\\IMAGENS\\TALONARIOS-VISUALIZA',
    confidencial: false,
  },
  {
    id: 'talonarios_visualiza',
    nome: 'TALONARIOS-VISUALIZA',
    grupo: 'Sessões sem Grupo',
    descricao: 'Talonários Digitalizados em Visualização',
    sequencia: 37,
    padraoLocalizacao: 'milhar',
    caminhoUnc: '\\\\SRVFILES\\imagens\\IMAGENS\\TALONARIOS-VISUALIZA',
    pastaLocal: 'K:\\IMAGENS\\TALONARIOS-VISUALIZA',
    confidencial: false,
  },
  {
    id: 'tes',
    nome: 'TES',
    grupo: 'Sessões sem Grupo',
    descricao: 'Sessão Especial TES do Acervo',
    sequencia: 38,
    padraoLocalizacao: 'milhar',
    caminhoUnc: '\\\\SRVFILES\\imagens\\IMAGENS\\TITULOS',
    pastaLocal: 'K:\\IMAGENS\\TITULOS',
    confidencial: false,
  },
  {
    id: 'teste_copia',
    nome: 'Teste - (Copia)',
    grupo: 'Sessões sem Grupo',
    descricao: 'Área Técnica de Homologação e Testes',
    sequencia: 39,
    padraoLocalizacao: 'direto',
    caminhoUnc: '\\\\SRVFILES\\imagens\\IMAGENS\\Teste - (Copia)',
    pastaLocal: 'K:\\IMAGENS\\Teste - (Copia)',
    confidencial: false,
  },
  {
    id: 'titulos',
    nome: 'TITULOS',
    grupo: 'Sessões sem Grupo',
    descricao: 'Títulos Registrais e Notariais Apresentados a Registro',
    sequencia: 40,
    padraoLocalizacao: 'milhar',
    caminhoUnc: '\\\\SRVFILES\\imagens\\IMAGENS\\TITULOS',
    pastaLocal: 'K:\\IMAGENS\\TITULOS',
    confidencial: false,
  },
  {
    id: 'titulos_online',
    nome: 'Titulos_Online',
    grupo: 'Sessões sem Grupo',
    descricao: 'Títulos Digitais e Prenotações Eletrônicas (AC / Subpastas de Protocolo)',
    sequencia: 41,
    padraoLocalizacao: 'protocolo',
    caminhoUnc: '\\\\SRVFILES\\imagens\\IMAGENS\\Titulos_Online',
    pastaLocal: 'K:\\IMAGENS\\Titulos_Online',
    confidencial: false,
  },
  {
    id: 'titulos_visualiza',
    nome: 'TITULOS-VISUALIZA',
    grupo: 'Sessões sem Grupo',
    descricao: 'Títulos em Fila e Estação de Visualização do Siplan',
    sequencia: 42,
    padraoLocalizacao: 'milhar',
    caminhoUnc: '\\\\SRVFILES\\imagens\\IMAGENS\\TITULOS-VISUALIZA',
    pastaLocal: 'K:\\IMAGENS\\TITULOS-VISUALIZA',
    confidencial: false,
  },
  {
    id: 'transcricao_extrato',
    nome: 'Transcrição - Extrato',
    grupo: 'Sessões sem Grupo',
    descricao: 'Livro de Transcrições das Transmissões (Anterior à Lei 6.015/1973)',
    sequencia: 43,
    padraoLocalizacao: 'direto',
    caminhoUnc: '\\\\SRVFILES\\imagens\\IMAGENS\\Transcrição - Extrato',
    pastaLocal: 'K:\\IMAGENS\\Transcrição - Extrato',
    confidencial: false,
    alias: ['TRANSCRICAO', 'LIVRO TRANSCRICAO'],
  },
  {
    id: 'usucapiao_extrajud',
    nome: 'USUCAPIAO_EXTRAJUD',
    grupo: 'Sessões sem Grupo',
    descricao: 'Usucapião Extrajudicial e Minutas de Manifestação (W:\\USUCAPIAO)',
    sequencia: 44,
    padraoLocalizacao: 'processo',
    caminhoUnc: '\\\\SRVFILES\\imagens\\IMAGENS\\USUCAPIAO_EXTRAJUD',
    pastaLocal: 'W:\\USUCAPIAO',
    confidencial: false,
    alias: ['USUCAPIAO', 'MINUTAS'],
  },
];

/**
 * Nomes estritos para os dropdowns (mantém compatibilidade 100% com o Siplan).
 */
export const SESSOES_OFICIAIS = CADASTRO_SESSOES_COMPLETO.map(s => s.nome) as readonly string[];
export type SessaoOficial = (typeof SESSOES_OFICIAIS)[number];

export function obterCadastroSessao(nomeOuId: string): CadastroSessao | undefined {
  if (!nomeOuId) return undefined;
  const n = nomeOuId.trim().toUpperCase();
  return CADASTRO_SESSOES_COMPLETO.find(
    s => s.id.toUpperCase() === n || s.nome.toUpperCase() === n || s.alias?.some(a => a.toUpperCase() === n)
  );
}

/**
 * Converte de forma bidirecional e transparente entre o caminho UNC oficial
 * (\\SRVFILES\imagens\IMAGENS\...) e o mapeamento de drive local do conector (K:\IMAGENS\...).
 */
export function converterCaminhoUncLocal(caminho: string, preferirUnc = false): string {
  if (!caminho) return caminho;
  const uncBase = '\\\\SRVFILES\\imagens\\IMAGENS';
  const localBase = 'K:\\IMAGENS';

  if (preferirUnc) {
    if (caminho.toUpperCase().startsWith(localBase.toUpperCase())) {
      const rel = caminho.slice(localBase.length).replace(/^[\\/]/, '');
      return rel ? `${uncBase}\\${rel}` : uncBase;
    }
    return caminho;
  } else {
    if (caminho.toUpperCase().startsWith(uncBase.toUpperCase())) {
      const rel = caminho.slice(uncBase.length).replace(/^[\\/]/, '');
      return rel ? `${localBase}\\${rel}` : localBase;
    }
    return caminho;
  }
}

/**
 * Mescla o catálogo estático padrão do Siplan com quaisquer sessões personalizadas
 * cadastradas pelo cliente no banco de dados.
 */
export function mesclarSessoesComCustomizadas(customizadas: CadastroSessao[] = []): CadastroSessao[] {
  if (!customizadas || customizadas.length === 0) return CADASTRO_SESSOES_COMPLETO;
  const mapa = new Map<string, CadastroSessao>();
  for (const s of CADASTRO_SESSOES_COMPLETO) {
    mapa.set(s.id.toLowerCase(), s);
  }
  for (const c of customizadas) {
    mapa.set(c.id.toLowerCase(), c);
  }
  return Array.from(mapa.values()).sort((a, b) => (a.sequencia ?? 0) - (b.sequencia ?? 0) || a.nome.localeCompare(b.nome));
}

