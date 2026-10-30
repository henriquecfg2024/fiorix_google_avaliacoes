import { z } from 'zod';

export const relativePathSchema = z.string().min(1).max(1024).refine(value =>
  !/^[\\/]/.test(value) && !/^[a-zA-Z]:/.test(value) &&
  !value.split(/[\\/]/).some(part => part === '..') && !value.includes('\0'));

export const searchInput = z.object({
  connectorId: z.string().min(1).max(128),
  type: z.literal('search').optional().default('search'),
  // 200: a Busca Cruzada envia até 4 campos separados por " | "
  query: z.string().trim().min(2).max(200),
  forceFresh: z.boolean().optional(),
}).strict();

export const extractPetitionInput = z.object({
  connectorId: z.string().min(1).max(128),
  type: z.literal('extract_petition'),
  rootId: z.string().regex(/^[a-z0-9_-]{1,32}$/),
  relativePath: relativePathSchema,
  pageStart: z.number().int().min(1).max(9999).optional().nullable(),
  pageEnd: z.number().int().min(1).max(9999).optional().nullable(),
  forceFresh: z.boolean().optional(),
}).strict();

export const analyzeSignaturesInput = z.object({
  connectorId: z.string().min(1).max(128),
  type: z.literal('analyze_signatures'),
  rootId: z.string().regex(/^[a-z0-9_-]{1,32}$/),
  relativePath: relativePathSchema,
  forceFresh: z.boolean().optional(),
}).strict();

export const readDocumentTextInput = z.object({
  connectorId: z.string().min(1).max(128),
  type: z.literal('read_document_text'),
  rootId: z.string().regex(/^[a-z0-9_-]{1,32}$/),
  relativePath: relativePathSchema,
  forceFresh: z.boolean().optional(),
}).strict();

// Explorador de pastas do Visualizador: "." = raiz da pasta autorizada
export const listDirectoryInput = z.object({
  connectorId: z.string().min(1).max(128),
  type: z.literal('list_directory'),
  rootId: z.string().regex(/^[a-z0-9_-]{1,32}$/),
  relativePath: relativePathSchema,
}).strict();

export const documentJobInput = z.union([
  searchInput,
  extractPetitionInput,
  analyzeSignaturesInput,
  readDocumentTextInput,
  listDirectoryInput,
]);

export const documentResult = z.object({
  files: z.array(z.object({
    rootId: z.string().regex(/^[a-z0-9_-]{1,32}$/),
    relativePath: relativePathSchema,
    name: z.string().min(1).max(255),
    size: z.number().int().nonnegative(),
    modifiedAt: z.string().datetime(),
  }).strict()).max(100),
  partial: z.boolean(),
  unavailableRoots: z.array(z.string().max(32)).max(10),
}).strict();

export const connectorMessage = z.discriminatedUnion('action', [
  z.object({ action: z.literal('claim'), connectorId: z.string().min(1).max(128) }).strict(),
  z.object({ action: z.literal('complete'), connectorId: z.string().min(1).max(128), id: z.string().uuid(), result: z.union([documentResult, z.record(z.string(), z.any()), z.array(z.any())]) }).strict(),
  z.object({ action: z.literal('fail'), connectorId: z.string().min(1).max(128), id: z.string().uuid() }).strict(),
]);

// ─── Manifestações: fila de conferência e histórico ─────────────────────────
const fichaIdSchema = z.string().trim().min(1).max(80).regex(/^[A-Za-z0-9_.:-]+$/);
// Dados do formulário (DadosManifestacao): objeto livre, tamanho limitado pela rota
const dadosFichaSchema = z.record(z.string(), z.unknown()).refine(d => typeof d.id_ficha === 'string', 'id_ficha ausente');
const arquivoOrigemSchema = z.object({
  name: z.string().max(255),
  relativePath: relativePathSchema,
  rootId: z.string().regex(/^[a-z0-9_-]{1,32}$/).optional(),
}).strict().nullable().optional();

export const salvarFichaInput = z.object({
  acao: z.literal('salvar_fila'),
  fichaId: fichaIdSchema,
  dados: dadosFichaSchema,
  arquivoOrigem: arquivoOrigemSchema,
}).strict();

export const finalizarManifestacaoInput = z.object({
  acao: z.literal('finalizar'),
  fichaId: fichaIdSchema,
  dados: dadosFichaSchema,
  arquivoOrigem: arquivoOrigemSchema,
  minuta: z.record(z.string(), z.unknown()),
  textoFinal: z.string().min(50).max(60000),
  versaoAnteriorId: z.string().uuid().nullable().optional(),
}).strict();

export const importarFilaLocalInput = z.object({
  acao: z.literal('importar_fila_local'),
  fichas: z.array(z.object({
    fichaId: fichaIdSchema,
    dados: dadosFichaSchema,
    arquivoOrigem: arquivoOrigemSchema,
  }).strict()).max(200),
}).strict();

export const manifestacaoInput = z.discriminatedUnion('acao', [salvarFichaInput, finalizarManifestacaoInput, importarFilaLocalInput]);

export const listarManifestacoesQuery = z.object({
  status: z.enum(['conferencia', 'finalizada']).default('finalizada'),
  busca: z.string().trim().max(120).optional(),
  escrevente: z.string().trim().max(120).optional(),
  de: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  ate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limite: z.coerce.number().int().min(1).max(200).optional(),
  deslocamento: z.coerce.number().int().min(0).max(100000).optional(),
});


