import { createHash } from 'node:crypto';

export type IncrementalSource = 'bi' | 'produtividade' | 'metas' | 'tarefas' | 'retornos' | 'impressoes' | 'safras' | 'colaboradores_rh';
type RecordData = Record<string, unknown>;

const required = (record: RecordData, field: string): string => {
  const value = record[field] ?? record[field.toLowerCase()];
  if (value === undefined || value === null || value === '') throw new Error(`MISSING_RECORD_KEY_FIELD_${field}`);
  return String(value);
};

export function logicalRecordIdentity(source: IncrementalSource, record: RecordData): string {
  switch (source) {
    case 'bi':
      return `bi:${required(record, 'PROTOCOLO')}:${required(record, 'SEQ_TITULO')}`;
    case 'produtividade':
      return `produtividade:${required(record, 'CURSOR_VALUE')}:${required(record, 'NumeroDocumento')}:${required(record, 'FlagDocumento')}:${required(record, 'FK_tblWRIHistorico_Id')}`;
    case 'metas':
      return `metas:${required(record, 'PROTOCOLO')}`;
    case 'tarefas':
      return `tarefas:${required(record, 'ID_TAREFA')}:${record.ID_HISTORICO ?? record.id_historico ?? 0}`;
    case 'retornos':
      return `retornos:${required(record, 'IdAndamento')}`;
    case 'impressoes':
      return `impressoes:${required(record, 'IdAndamento')}`;
    case 'safras':
      return `safras:${required(record, 'mes')}`;
    case 'colaboradores_rh':
      return `colaboradores_rh:${record.Registro ?? record.registro ?? record.CPF ?? record.cpf ?? required(record, 'Nome')}`;
  }
}

export function recordKey(source: IncrementalSource, record: RecordData): string {
  return createHash('sha256').update(logicalRecordIdentity(source, record)).digest('hex');
}

export function attachRecordKey(source: IncrementalSource, record: RecordData): RecordData & { record_key: string } {
  return { ...record, record_key: recordKey(source, record) };
}
