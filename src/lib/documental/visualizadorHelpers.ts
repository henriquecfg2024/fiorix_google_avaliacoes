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

export interface AvaliacaoAcessoExclusivoParams {
  navPermissionsEnabled: boolean;
  userRole?: string | null;
  allowedItemIds: string[];
}

/**
 * Determina se o Visualizador (/gestao-documental/visualizador) é a única tela
 * navegável liberada para o usuário em todo o FIORIX.
 */
export function isAcessoExclusivoVisualizador({
  navPermissionsEnabled,
  userRole,
  allowedItemIds,
}: AvaliacaoAcessoExclusivoParams): boolean {
  if (String(userRole || '').toUpperCase() === 'MASTER') return false;
  if (!navPermissionsEnabled) return false;

  const itensNavegaveis = allowedItemIds.filter(
    (id) => Boolean(id) && id !== 'validacao_autenticidade_documental',
  );

  return (
    itensNavegaveis.length === 0 ||
    (itensNavegaveis.length === 1 && itensNavegaveis[0] === 'visualizador_documental')
  );
}

/** Retorna até 2 iniciais maiúsculas para o avatar compacto do usuário. */
export function obterIniciaisUsuario(nome?: string | null): string {
  if (!nome) return 'U';
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return 'U';
  if (partes.length === 1) return partes[0].substring(0, 2).toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}
