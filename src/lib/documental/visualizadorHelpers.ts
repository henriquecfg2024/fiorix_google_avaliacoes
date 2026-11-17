/** Ajusta URL de PDF (blob:/https:) para recolher painel de miniaturas nativo e ajustar à largura. */
export function construirUrlIframePdf(rawUrl: string): string {
  if (!rawUrl || rawUrl.startsWith('data:')) return rawUrl;
  const base = rawUrl.split('#')[0];
  return `${base}#navpanes=0&view=FitH`;
}

/** Retorna o rótulo legível da sessão/origem do acervo para um arquivo ativo. */
export function obterRotuloSessaoAcervo(rootId?: string, relativePath?: string): string {
  switch ((rootId || '').toLowerCase()) {
    case 'livro2':
      return 'LV2';
    case 'titulos_visualiza':
      return 'TITULOS-VISUALIZA';
    case 'titulos_online':
      return 'Titulos_Online';
    case 'imagens': {
      const primeiroSeg = relativePath?.split(/[\\/]/).find(Boolean);
      return primeiroSeg || 'IMAGENS';
    }
    case 'vol1':
      return 'VOL1 (H:)';
    case 'deptos':
      return 'DEP (W:)';
    case 'processos':
      return 'Processos (H:)';
    case 'minutas':
      return 'Usucapião (W:)';
    case 'local':
      return 'Arquivo Local';
    default:
      return rootId ? rootId.toUpperCase() : 'LOCAL';
  }
}
