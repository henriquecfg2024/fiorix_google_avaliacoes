export const MESES_NOMES = [
  { value: 1, label: 'Janeiro' },
  { value: 2, label: 'Fevereiro' },
  { value: 3, label: 'Março' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Maio' },
  { value: 6, label: 'Junho' },
  { value: 7, label: 'Julho' },
  { value: 8, label: 'Agosto' },
  { value: 9, label: 'Setembro' },
  { value: 10, label: 'Outubro' },
  { value: 11, label: 'Novembro' },
  { value: 12, label: 'Dezembro' },
] as const;

export function buildAnosDisponiveis(baseYear: number): number[] {
  const top = Math.max(baseYear, new Date().getFullYear());
  const anos: number[] = [];
  for (let y = top; y >= 2009; y -= 1) {
    anos.push(y);
  }
  return anos;
}

export function formatarDataBr(iso: string | null | undefined): string {
  if (!iso) return '—';
  const clean = String(iso).slice(0, 10);
  const parts = clean.split('-');
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

export function formatarDataHoraBr(iso: string | null | undefined): string {
  if (!iso) return '—';
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  return dt.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function labelModalidade(mod: string): string {
  if (mod === 'REURB_S') return 'REURB-S';
  if (mod === 'REURB_E') return 'REURB-E';
  if (mod === 'ART_69') return 'Art. 69';
  return mod;
}

export function labelStatusImportacaoOnr(status: string): string {
  if (status === 'IMPORTADA_ONR' || status === 'CONFIRMADA_ONR') return 'Importada no ONR';
  if (status === 'EXPORTADA_AGUARDANDO_CONFIRMACAO' || status === 'PENDENTE_CONFIRMACAO') {
    return 'JSON gerado (aguardando confirmação)';
  }
  if (status === 'NAO_GERADO') return 'Não gerado';
  return 'Não exportada';
}

export function triggerDownloadBlob(content: string | Blob, fileName: string, mime = 'application/json') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
