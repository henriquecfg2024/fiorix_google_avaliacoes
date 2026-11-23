import { z } from 'zod';

export const relativePathSchema = z.string().min(1).max(1024).refine(value =>
  !/^[\\/]/.test(value) && !/^[a-zA-Z]:/.test(value) &&
  !value.split(/[\\/]/).some(part => part === '..') && !value.includes('\0'));

export const connectorIdSchema = z
  .string()
  .max(128)
  .optional()
  .transform(v => (v && v.trim() ? v.trim() : 'auto'));

export const searchInput = z.object({
  connectorId: connectorIdSchema,
  type: z.literal('search').optional().default('search'),
  rootId: z.string().regex(/^[a-z0-9_-]{1,32}$/).optional(),
  // 260: a Busca Cruzada envia até 5 campos separados por " | "
  query: z.string().trim().min(2).max(260),
  forceFresh: z.boolean().optional(),
}).strict();

export const extractPetitionInput = z.object({
  connectorId: connectorIdSchema,
  type: z.literal('extract_petition'),
  rootId: z.string().regex(/^[a-z0-9_-]{1,32}$/),
  relativePath: relativePathSchema,
  pageStart: z.number().int().min(1).max(9999).optional().nullable(),
  pageEnd: z.number().int().min(1).max(9999).optional().nullable(),
  forceFresh: z.boolean().optional(),
}).strict();

export const analyzeSignaturesInput = z.object({
  connectorId: connectorIdSchema,
  type: z.literal('analyze_signatures'),
  rootId: z.string().regex(/^[a-z0-9_-]{1,32}$/),
  relativePath: relativePathSchema,
  forceFresh: z.boolean().optional(),
}).strict();

export const readDocumentTextInput = z.object({
  connectorId: connectorIdSchema,
  type: z.literal('read_document_text'),
  rootId: z.string().regex(/^[a-z0-9_-]{1,32}$/),
  relativePath: relativePathSchema,
  pageStart: z.number().int().min(1).max(9999).optional().nullable(),
  pageEnd: z.number().int().min(1).max(9999).optional().nullable(),
  forceFresh: z.boolean().optional(),
}).strict();

export const ocrDocumentPagesInput = z.object({
  connectorId: connectorIdSchema,
  type: z.literal('ocr_document_pages'),
  rootId: z.string().regex(/^[a-z0-9_-]{1,32}$/),
  relativePath: relativePathSchema,
  pageStart: z.number().int().min(1).max(9999).optional().nullable(),
  pageEnd: z.number().int().min(1).max(9999).optional().nullable(),
  forceFresh: z.boolean().optional(),
}).strict();

// Transferência segura em blocos via HTTPS (para Safari, Mac, iPad e estações fora da máquina do Connector)
export const readDocumentChunkInput = z.object({
  connectorId: connectorIdSchema,
  type: z.literal('read_document_chunk'),
  rootId: z.string().regex(/^[a-z0-9_-]{1,32}$/),
  relativePath: relativePathSchema,
  offset: z.number().int().min(0).max(524288000),
  length: z.number().int().min(1024).max(2621440).optional(),
}).strict();

// Explorador de pastas do Visualizador: "." = raiz da pasta autorizada
export const listDirectoryInput = z.object({
  connectorId: connectorIdSchema,
  type: z.literal('list_directory'),
  rootId: z.string().regex(/^[a-z0-9_-]{1,32}$/),
  relativePath: relativePathSchema,
}).strict();

// Staging binario direto do Connector para Storage privado efemero (evita chunks Base64 via Vercel)
export const stageDocumentFileInput = z.object({
  connectorId: connectorIdSchema,
  type: z.literal('stage_document_file'),
  rootId: z.string().regex(/^[a-z0-9_-]{1,32}$/),
  relativePath: relativePathSchema,
}).strict();

export const filtrosImovelPesquisaSchema = z.object({
  contribuinte: z.string().trim().max(50).optional(),
  maiorArea: z.boolean().optional(),
  tipoImovelId: z.number().int().min(0).max(100000).nullable().optional(),
  tipoImovelTexto: z.string().trim().max(80).optional(),
  unidade: z.string().trim().max(80).optional(),
  distritoId: z.number().int().min(0).max(100000).nullable().optional(),
  distritoTexto: z.string().trim().max(80).optional(),
  subdistritoId: z.number().int().min(0).max(100000).nullable().optional(),
  subdistritoTexto: z.string().trim().max(80).optional(),
  cep: z.string().trim().max(20).optional(),
  cidade: z.string().trim().max(120).optional(),
  bairro: z.string().trim().max(120).optional(),
  tipoLogradouroId: z.number().int().min(0).max(100000).nullable().optional(),
  tipoLogradouroTexto: z.string().trim().max(60).optional(),
  logradouro: z.string().trim().max(160).optional(),
  numero: z.string().trim().max(30).optional(),
  complemento: z.string().trim().max(120).optional(),
  andar: z.string().trim().max(50).optional(),
  pavimento: z.string().trim().max(50).optional(),
  vaga: z.string().trim().max(50).optional(),
  distanciaEsquina: z.string().trim().max(60).optional(),
  edificioCondominio: z.string().trim().max(180).optional(),
  loteamento: z.string().trim().max(180).optional(),
  bloco: z.string().trim().max(60).optional(),
  setor: z.string().trim().max(100).optional(),
  lote: z.string().trim().max(60).optional(),
  quadra: z.string().trim().max(60).optional(),
  gleba: z.string().trim().max(60).optional(),
  logradouroAnterior: z.string().trim().max(160).optional(),
  tipoAreaId: z.number().int().min(0).max(100000).nullable().optional(),
  tipoAreaTexto: z.string().trim().max(80).optional(),
  tipoConfrontanteId: z.number().int().min(0).max(100000).nullable().optional(),
  tipoConfrontanteTexto: z.string().trim().max(80).optional(),
  confrontante: z.string().trim().max(240).optional(),
  tipoMedidaId: z.number().int().min(0).max(100000).nullable().optional(),
  tipoMedidaTexto: z.string().trim().max(80).optional(),
  medida: z.string().trim().max(120).optional(),
  incra: z.string().trim().max(60).optional(),
  car: z.string().trim().max(80).optional(),
  irf: z.string().trim().max(40).optional(),
  mf: z.string().trim().max(30).optional(),
  mr: z.string().trim().max(30).optional(),
  qmf: z.string().trim().max(30).optional(),
  qmr: z.string().trim().max(30).optional(),
  fraMin: z.string().trim().max(30).optional(),
  descricaoImovel: z.string().trim().max(240).optional(),
}).strict();

export const filtrosPropriedadePesquisaSchema = z.object({
  somenteContraditorioIndisponibilidade: z.boolean().optional(),
  livroId: z.number().int().min(0).max(10000).nullable().optional(),
  numeroLivro: z.number().int().min(1).max(99999999).nullable().optional(),
  livroCompl: z.string().trim().max(50).optional(),
  livroAntigo: z.number().int().min(1).max(99999999).nullable().optional(),
  livroAntigoCompl: z.string().trim().max(50).optional(),
  folha: z.number().int().min(1).max(999999).nullable().optional(),
  folhaCompl: z.string().trim().max(50).optional(),
  nome: z.string().trim().max(240).optional(),
  modoNome: z.enum(['exata', 'comecar_com', 'primeiro_sobrenome', 'sobrenome', 'qualquer_parte']).optional(),
  aplicarSubstituicao: z.boolean().optional(),
  nomeMaisDocumento: z.boolean().optional(),
  documento1: z.string().trim().max(40).optional(),
  documento2: z.string().trim().max(40).optional(),
  dtRegInicial: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')).optional(),
  dtRegFinal: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')).optional(),
}).strict();

export const pesquisaRegistralInput = z.object({
  connectorId: connectorIdSchema,
  type: z.literal('pesquisa_registral'),
  aba: z.enum(['imovel', 'propriedade']),
  filtrosImovel: filtrosImovelPesquisaSchema.optional(),
  filtrosPropriedade: filtrosPropriedadePesquisaSchema.optional(),
  limite: z.number().int().min(10).max(100).optional(),
  forceFresh: z.boolean().optional(),
}).strict();

export const pesquisaRegistralCatalogosInput = z.object({
  connectorId: connectorIdSchema,
  type: z.literal('pesquisa_registral_catalogos'),
  forceFresh: z.boolean().optional(),
}).strict();

export const reurbRevalidarInput = z.object({
  connectorId: connectorIdSchema,
  type: z.literal('reurb_revalidar'),
  query: z.string().min(2).max(2000),
}).strict();

export const documentJobInput = z.union([
  searchInput,
  extractPetitionInput,
  analyzeSignaturesInput,
  readDocumentTextInput,
  ocrDocumentPagesInput,
  readDocumentChunkInput,
  listDirectoryInput,
  stageDocumentFileInput,
  pesquisaRegistralInput,
  pesquisaRegistralCatalogosInput,
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

export const storageUploadMetaSchema = z.object({
  rootId: z.string().regex(/^[a-z0-9_-]{1,32}$/),
  relativePath: relativePathSchema,
  sizeBytes: z.number().int().min(1).max(50331648), // 48 MB
  mtimeMs: z.number().nonnegative().max(99999999999999),
  ext: z.string().regex(/^\.?[a-zA-Z0-9]{1,8}$/).optional(),
  variant: z.string().regex(/^[a-z0-9_-]{1,32}$/).optional(),
}).strict();

export const connectorMessage = z.discriminatedUnion('action', [
  z.object({ action: z.literal('claim'), connectorId: z.string().min(1).max(128) }).strict(),
  z.object({ action: z.literal('complete'), connectorId: z.string().min(1).max(128), id: z.string().uuid(), result: z.union([documentResult, z.record(z.string(), z.any()), z.array(z.any())]) }).strict(),
  z.object({ action: z.literal('fail'), connectorId: z.string().min(1).max(128), id: z.string().uuid(), error: z.string().max(300).optional() }).strict(),
  z.object({ action: z.literal('prepare_storage_upload'), connectorId: z.string().min(1).max(128), file: storageUploadMetaSchema }).strict(),
  z.object({ action: z.literal('prepare_storage_upload_batch'), connectorId: z.string().min(1).max(128), files: z.array(storageUploadMetaSchema).min(1).max(120) }).strict(),
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
  confirmouImpressao: z.literal(true),
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

export const conferirFichaInput = z.object({
  acao: z.literal('conferir_ficha'),
  registroId: z.string().uuid(),
  statusConferencia: z.enum(['AGUARDANDO_CONFERENCIA', 'CONFERIDO']),
}).strict();

export const manifestacaoInput = z.discriminatedUnion('acao', [
  salvarFichaInput,
  finalizarManifestacaoInput,
  importarFilaLocalInput,
  conferirFichaInput,
]);

export const listarManifestacoesQuery = z.object({
  status: z.enum(['conferencia', 'finalizada', 'todas']).default('finalizada'),
  busca: z.string().trim().max(120).optional(),
  escrevente: z.string().trim().max(120).optional(),
  de: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  ate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limite: z.coerce.number().int().min(1).max(200).optional(),
  deslocamento: z.coerce.number().int().min(0).max(100000).optional(),
});


