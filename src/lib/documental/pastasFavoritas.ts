'use client';

export type RaizId = 'vol1' | 'imagens' | 'deptos' | 'livro2' | 'processos' | 'minutas';

export interface DefinicaoRaizDocumental {
  id: RaizId;
  sigla: 'VOL1' | 'IMAGENS' | 'DEP' | 'LV2' | 'PROC' | 'USUC';
  unidade: 'VOL1' | 'IMAGENS' | 'DEP';
  rotulo: string;
  rotuloCurto: string;
  caminho: string;
  descricao: string;
  aliases: string[];
  principal?: boolean;
  /** Caminho relativo dentro da unidade principal (ex.: 'lv2' dentro de 'imagens') */
  prefixoUnidade: string;
}

export const RAIZES_DOCUMENTAL: DefinicaoRaizDocumental[] = [
  {
    id: 'vol1',
    sigla: 'VOL1',
    unidade: 'VOL1',
    rotulo: 'VOL1 (\\\\SrvFiles) (H:)',
    rotuloCurto: 'VOL1 (H:)',
    caminho: 'H:\\',
    descricao: 'Processos, Indisponibilidades, Ofícios, Procurações, Pareceres e Setores',
    aliases: ['vol1', 'h'],
    principal: true,
    prefixoUnidade: '',
  },
  {
    id: 'imagens',
    sigla: 'IMAGENS',
    unidade: 'IMAGENS',
    rotulo: 'IMAGENS (\\\\SrvFiles) (K:)',
    rotuloCurto: 'IMAGENS (K:)',
    caminho: 'K:\\IMAGENS',
    descricao: 'Todas as sessões de imagens digitalizadas (LV2, LV3, LV7, etc.)',
    aliases: ['imagens', 'acervo', 'k'],
    principal: true,
    prefixoUnidade: '',
  },
  {
    id: 'deptos',
    sigla: 'DEP',
    unidade: 'DEP',
    rotulo: 'DEP / DEPTOS (\\\\SrvFiles) (W:)',
    rotuloCurto: 'DEP (W:)',
    caminho: 'W:\\',
    descricao: 'Pastas dos departamentos e escreventes (Certidão, Usucapião, Registro, Contraditório, etc.)',
    aliases: ['deptos', 'dep', 'w'],
    principal: true,
    prefixoUnidade: '',
  },
  {
    id: 'livro2',
    sigla: 'LV2',
    unidade: 'IMAGENS',
    rotulo: 'Livro 2 — Matrículas',
    rotuloCurto: 'Livro 2 (K:)',
    caminho: 'K:\\IMAGENS\\LV2',
    descricao: 'Imagens .KEN / TIFF por bloco de 1.000',
    aliases: ['livro2'],
    principal: false,
    prefixoUnidade: 'lv2',
  },
  {
    id: 'processos',
    sigla: 'PROC',
    unidade: 'VOL1',
    rotulo: 'Processos — Enviados por E-mail',
    rotuloCurto: 'Processos (H:)',
    caminho: 'H:\\PROCESSOS - ENVIADOS POR E-MAIL',
    descricao: 'PDFs recebidos das Varas e E-mail',
    aliases: ['processos', 'processos-email', 'email'],
    principal: false,
    prefixoUnidade: 'processos - enviados por e-mail',
  },
  {
    id: 'minutas',
    sigla: 'USUC',
    unidade: 'DEP',
    rotulo: 'Usucapião / Minutas',
    rotuloCurto: 'Usucapião (W:)',
    caminho: 'W:\\USUCAPIAO',
    descricao: 'Pastas dos escreventes (.DOCX)',
    aliases: ['minutas', 'usucapiao'],
    principal: false,
    prefixoUnidade: 'usucapiao',
  },
];

export const UNIDADES_PRINCIPAIS = RAIZES_DOCUMENTAL.filter((r) => r.principal);

export function getRaizDocumental(rootId: string): DefinicaoRaizDocumental | undefined {
  const norm = (rootId || '').trim().toLowerCase();
  return RAIZES_DOCUMENTAL.find((r) => r.id === norm || r.aliases.includes(norm));
}

export function normalizarCaminhoDocumental(s: string): string {
  const limpo = (s || '').replace(/\\/g, '/').replace(/^\/+|\/+$/g, '').trim();
  if (!limpo || limpo === '.') return '';
  return limpo.toLowerCase();
}

export function segmentosCaminhoDocumental(rel: string): string[] {
  const limpo = (rel || '').replace(/^[.\\/]+/, '');
  return limpo.split(/[\\/]/).filter(Boolean);
}

/** Converte qualquer (rootId, relativePath) para (unidadePrincipal, caminhoRelativoNaUnidade). */
export function resolverCaminhoCanonicoUnidade(
  rootId: string,
  relativePath: string,
): { unidade: 'VOL1' | 'IMAGENS' | 'DEP'; caminhoNaUnidade: string } | null {
  const raiz = getRaizDocumental(rootId);
  if (!raiz) return null;
  const relNorm = normalizarCaminhoDocumental(relativePath);
  if (!raiz.prefixoUnidade) {
    return { unidade: raiz.unidade, caminhoNaUnidade: relNorm };
  }
  if (!relNorm) {
    return { unidade: raiz.unidade, caminhoNaUnidade: raiz.prefixoUnidade };
  }
  if (relNorm === raiz.prefixoUnidade || relNorm.startsWith(raiz.prefixoUnidade + '/')) {
    return { unidade: raiz.unidade, caminhoNaUnidade: relNorm };
  }
  return { unidade: raiz.unidade, caminhoNaUnidade: `${raiz.prefixoUnidade}/${relNorm}` };
}

/** Verifica se um arquivo (fileRootId, fileRelativePath) pertence à pasta selecionada (folderRootId, folderRelativePath). */
export function arquivoPertenceAPasta(
  fileRootId: string,
  fileRelativePath: string,
  folderRootId: string,
  folderRelativePath: string,
): boolean {
  const arq = resolverCaminhoCanonicoUnidade(fileRootId, fileRelativePath);
  const pasta = resolverCaminhoCanonicoUnidade(folderRootId, folderRelativePath);
  if (!arq || !pasta) {
    return fileRootId === folderRootId;
  }
  if (arq.unidade !== pasta.unidade) return false;
  if (!pasta.caminhoNaUnidade) return true;
  return (
    arq.caminhoNaUnidade === pasta.caminhoNaUnidade ||
    arq.caminhoNaUnidade.startsWith(pasta.caminhoNaUnidade + '/')
  );
}

export function formatarCaminhoPasta(rootId: RaizId, relativePath: string): string {
  const raiz = getRaizDocumental(rootId);
  if (!raiz) return relativePath || rootId;
  const segs = segmentosCaminhoDocumental(relativePath);
  const base = raiz.caminho.replace(/\\+$/, '');
  if (segs.length === 0) {
    return base.endsWith(':') ? `${base}\\` : base;
  }
  return `${base}\\${segs.join('\\')}`;
}

export function obterRotuloPasta(rootId: RaizId, relativePath: string): string {
  const segs = segmentosCaminhoDocumental(relativePath);
  if (segs.length > 0) {
    return segs[segs.length - 1];
  }
  const raiz = getRaizDocumental(rootId);
  return raiz ? raiz.rotuloCurto : rootId.toUpperCase();
}

export interface PastaFavorita {
  id: string;
  rootId: RaizId;
  relativePath: string;
  rotulo: string;
  caminhoExibicao: string;
  unidade: 'VOL1' | 'IMAGENS' | 'DEP';
  adicionadoEm: number;
}

export const CHAVE_PASTAS_FAVORITAS = 'fiorix_pastas_favoritas_v1';
export const EVENTO_FAVORITOS_ATUALIZADOS = 'fiorix-pastas-favoritas-updated';

export function gerarIdPastaFavorita(rootId: string, relativePath: string): string {
  const canon = resolverCaminhoCanonicoUnidade(rootId, relativePath);
  if (canon) {
    return `${canon.unidade.toLowerCase()}:${canon.caminhoNaUnidade}`;
  }
  return `${rootId.toLowerCase()}:${normalizarCaminhoDocumental(relativePath)}`;
}

export const PASTAS_FAVORITAS_PADRAO: PastaFavorita[] = [
  {
    id: gerarIdPastaFavorita('livro2', ''),
    rootId: 'livro2',
    relativePath: '',
    rotulo: 'LV2 — Matrículas',
    caminhoExibicao: 'K:\\IMAGENS\\LV2',
    unidade: 'IMAGENS',
    adicionadoEm: 1,
  },
  {
    id: gerarIdPastaFavorita('processos', ''),
    rootId: 'processos',
    relativePath: '',
    rotulo: 'PROCESSOS - ENVIADOS POR E-MAIL',
    caminhoExibicao: 'H:\\PROCESSOS - ENVIADOS POR E-MAIL',
    unidade: 'VOL1',
    adicionadoEm: 2,
  },
  {
    id: gerarIdPastaFavorita('minutas', ''),
    rootId: 'minutas',
    relativePath: '',
    rotulo: 'USUCAPIAO (Minutas)',
    caminhoExibicao: 'W:\\USUCAPIAO',
    unidade: 'DEP',
    adicionadoEm: 3,
  },
];

export function lerPastasFavoritas(): PastaFavorita[] {
  if (typeof window === 'undefined') return PASTAS_FAVORITAS_PADRAO;
  try {
    const raw = window.localStorage.getItem(CHAVE_PASTAS_FAVORITAS);
    if (!raw) {
      window.localStorage.setItem(CHAVE_PASTAS_FAVORITAS, JSON.stringify(PASTAS_FAVORITAS_PADRAO));
      return PASTAS_FAVORITAS_PADRAO;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return PASTAS_FAVORITAS_PADRAO;
    return parsed.filter(
      (item): item is PastaFavorita =>
        !!item &&
        typeof item === 'object' &&
        typeof item.id === 'string' &&
        typeof item.rootId === 'string' &&
        typeof item.relativePath === 'string' &&
        typeof item.rotulo === 'string',
    );
  } catch {
    return PASTAS_FAVORITAS_PADRAO;
  }
}

export function salvarPastasFavoritas(lista: PastaFavorita[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CHAVE_PASTAS_FAVORITAS, JSON.stringify(lista));
    window.dispatchEvent(new CustomEvent(EVENTO_FAVORITOS_ATUALIZADOS));
  } catch {
    /* ignora modo privado restrito */
  }
}

export function verificarPastaFavorita(
  favoritos: PastaFavorita[],
  rootId: string,
  relativePath: string,
): boolean {
  const id = gerarIdPastaFavorita(rootId, relativePath);
  return favoritos.some((f) => f.id === id);
}

export function alternarPastaFavoritaNoStorage(
  rootId: RaizId,
  relativePath: string,
  rotuloPersonalizado?: string,
): { favoritos: PastaFavorita[]; adicionada: boolean } {
  const atuais = lerPastasFavoritas();
  const id = gerarIdPastaFavorita(rootId, relativePath);
  const jaExiste = atuais.some((f) => f.id === id);

  if (jaExiste) {
    const novos = atuais.filter((f) => f.id !== id);
    salvarPastasFavoritas(novos);
    return { favoritos: novos, adicionada: false };
  }

  const raiz = getRaizDocumental(rootId);
  const segs = segmentosCaminhoDocumental(relativePath);
  const relLimpo = segs.join('\\');
  const nova: PastaFavorita = {
    id,
    rootId,
    relativePath: relLimpo,
    rotulo: rotuloPersonalizado || obterRotuloPasta(rootId, relLimpo),
    caminhoExibicao: formatarCaminhoPasta(rootId, relLimpo),
    unidade: raiz?.unidade || 'IMAGENS',
    adicionadoEm: Date.now(),
  };
  const novos = [nova, ...atuais];
  salvarPastasFavoritas(novos);
  return { favoritos: novos, adicionada: true };
}

