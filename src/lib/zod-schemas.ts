import { z } from 'zod';

const nullableCsvInt = z.preprocess((value) => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed || trimmed.toUpperCase() === 'NULL' || trimmed === 'undefined') return null;
  }
  return value;
}, z.coerce.number().int().nullable());

const normalizeProdutividadeRow = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;

  const row = value as Record<string, unknown>;
  return {
    pedido: row.pedido ?? row.PEDIDO,
    data: row.data ?? row.DATA,
    hora_num: row.hora_num ?? row.HORA_NUM,
    dia_semana: row.dia_semana ?? row.DIA_SEMANA,
    hora: row.hora ?? row.HORA,
    nome: row.nome ?? row.NOME,
    tipo: row.tipo ?? row.TIPO,
    tipo_pedido: row.tipo_pedido ?? row.TIPO_PEDIDO,
    tipo_detalhado: row.tipo_detalhado ?? row.TIPO_DETALHADO,
    quantidade: row.quantidade ?? row.QUANTIDADE,
  };
};

// Esquema para um item individual do lote de produtividade
const produtividadeRowBaseSchema = z.object({
  pedido: z.coerce.number().int().positive('Número do pedido inválido.'),
  data: z.string().min(1, 'A data é obrigatória.'),
  hora_num: z.coerce.number().int().min(0).max(23).default(0),
  dia_semana: z.string().max(20).optional().default('Monday'),
  hora: z.string().max(10).optional().default('00:00'),
  nome: z.string().max(255).optional().default('Outro'),
  tipo: z.string().max(50).optional().default('TÍTULO'),
  tipo_pedido: z.string().max(100).optional().default('PRENOTADO'),
  tipo_detalhado: z.string().optional().default(''),
  quantidade: z.coerce.number().int().positive().optional().default(1),
});

export const produtividadeRowSchema = z.preprocess(
  normalizeProdutividadeRow,
  produtividadeRowBaseSchema
);

// Esquema para o payload completo da importação de produtividade
export const produtividadeImportSchema = z.object({
  action: z.string().optional(),
  rows: z.array(produtividadeRowSchema).optional(),
  importMeta: z.object({
    importKey: z.string().min(1, 'Chave de importação obrigatória.'),
    fileName: z.string().min(1, 'Nome do arquivo obrigatório.'),
    totalRows: z.coerce.number().int().nonnegative(),
    importedBy: z.string().optional(),
    periodStart: z.string().nullable().optional(),
    periodEnd: z.string().nullable().optional(),
    batchNumber: z.coerce.number().int().optional(),
    totalBatches: z.coerce.number().int().optional(),
  }).optional(),
  errorMessage: z.string().optional(),
});

// Esquema para um item individual do lote de metas
export const metasRowSchema = z.object({
  PROTOCOLO: z.coerce.number().int().positive('Número do protocolo inválido.'),
  DATA_APRESENTADO: z.string().nullable().optional(),
  DT_PREVISAO: z.string().nullable().optional(),
  DT_ENTREGA_REAL: z.string().nullable().optional(),
  STATUS: z.string().max(50).nullable().optional(),
  NATUREZA: z.string().max(255).nullable().optional(),
  ATRASO_DIAS: nullableCsvInt,
  D1_PROTOCOLO: z.string().nullable().optional(),
  D1_ESCANEAMENTO: z.string().nullable().optional(),
  D2_CONTRADITORIO: z.string().nullable().optional(),
  D3_EXTRATO: z.string().nullable().optional(),
  D4_QUALIFICACAO: z.string().nullable().optional(),
  D5_CALCULO: z.string().nullable().optional(),
  D8_IMPRESSAO: z.string().nullable().optional(),
  D9_PREPARACAO: z.string().nullable().optional(),
  D9_CONFERENCIA: z.string().nullable().optional(),
  D10_ENTREGA: z.string().nullable().optional(),
  D_BALCAO_REGISTRADO: z.string().nullable().optional(),
  D_BALCAO_DEVOLVIDO: z.string().nullable().optional(),
  QTD_RETRABALHO: nullableCsvInt,
  DIAS_D1_D2: nullableCsvInt,
  DIAS_D2_D3: nullableCsvInt,
  DIAS_D3_D4: nullableCsvInt,
  DIAS_D4_D5: nullableCsvInt,
  DIAS_D5_D8: nullableCsvInt,
  DIAS_D8_D9: nullableCsvInt,
});

// Esquema para o payload completo da importação de metas
export const metasImportSchema = z.object({
  action: z.string().optional(),
  rows: z.array(metasRowSchema).optional(),
  importMeta: z.object({
    importKey: z.string().min(1, 'Chave de importação obrigatória.'),
    fileName: z.string().min(1, 'Nome do arquivo obrigatório.'),
    totalRows: z.coerce.number().int().nonnegative(),
    importedBy: z.string().optional(),
    periodStart: z.string().nullable().optional(),
    periodEnd: z.string().nullable().optional(),
    batchNumber: z.coerce.number().int().optional(),
    totalBatches: z.coerce.number().int().optional(),
  }).optional(),
  errorMessage: z.string().optional(),
});
