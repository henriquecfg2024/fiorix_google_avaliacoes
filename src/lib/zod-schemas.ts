import { z } from 'zod';

// Esquema para um item individual do lote de produtividade
export const produtividadeRowSchema = z.object({
  pedido: z.coerce.number({ invalid_type_error: 'Número do pedido inválido.' }).int().positive(),
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
  PROTOCOLO: z.coerce.number({ invalid_type_error: 'Número do protocolo inválido.' }).int().positive(),
  DATA_APRESENTADO: z.string().nullable().optional(),
  DT_PREVISAO: z.string().nullable().optional(),
  DT_ENTREGA_REAL: z.string().nullable().optional(),
  STATUS: z.string().max(50).nullable().optional(),
  NATUREZA: z.string().max(255).nullable().optional(),
  ATRASO_DIAS: z.coerce.number().int().nullable().optional(),
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
  QTD_RETRABALHO: z.coerce.number().int().nullable().optional(),
  DIAS_D1_D2: z.coerce.number().int().nullable().optional(),
  DIAS_D2_D3: z.coerce.number().int().nullable().optional(),
  DIAS_D3_D4: z.coerce.number().int().nullable().optional(),
  DIAS_D4_D5: z.coerce.number().int().nullable().optional(),
  DIAS_D5_D8: z.coerce.number().int().nullable().optional(),
  DIAS_D8_D9: z.coerce.number().int().nullable().optional(),
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
