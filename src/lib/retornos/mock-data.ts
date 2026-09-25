import { RetornoItem } from './types';

// Amostra estruturada com 229 registros para manter fidelidade com o protótipo
export const MOCK_RETORNOS: RetornoItem[] = [
  {
    idAndamento: "1001",
    idRecepcao: 84001,
    numeroPrenotacao: 635000,
    dataRecepcao: "2026-02-10T09:30:00Z",
    tipoRecepcao: "ENTRADA",
    formaTitulo: "Instrumento Particular",
    idTipoRetorno: 294,
    siglaRetorno: "RPE",
    tipoRetorno: "Retorno Pessoal Exigência",
    familiaRetorno: "Pessoal",
    classificacao: "Sem marcador",
    dataRetorno: "2026-02-15T15:10:00Z",
    idUsuarioOrigem: "usr_henrique",
    usuarioOrigem: "HENRIQUE CESAR",
    idUsuarioDestino: "usr_jonatan",
    usuarioDestinoRetorno: "Jonatan Lima",
    observacao: "Falta reconhecimento de firma por semelhança do vendedor conforme Art. 221 da LRP. Complementar certidão de casamento atualizada.",
    seqTitulo: 1,
  },
  {
    idAndamento: "1002",
    idRecepcao: 84002,
    numeroPrenotacao: 635001,
    dataRecepcao: "2026-02-10T10:15:00Z",
    tipoRecepcao: "ENTRADA",
    formaTitulo: "Instrumento Particular",
    idTipoRetorno: 293,
    siglaRetorno: "RRE",
    tipoRetorno: "Retorno Real Exigência",
    familiaRetorno: "Real",
    classificacao: "Sem marcador",
    dataRetorno: "2026-02-15T14:35:00Z",
    idUsuarioOrigem: "usr_henrique",
    usuarioOrigem: "HENRIQUE CESAR",
    idUsuarioDestino: "usr_kelly",
    usuarioDestinoRetorno: "KELLY FERNANDA CARVALHO SILVA",
    observacao: "Divergência na descrição perimétrica do lote 12 com a matrícula mãe 45.120. Apresentar planta aprovada pelo município.",
    seqTitulo: 1,
  },
  {
    idAndamento: "1003",
    idRecepcao: 84003,
    numeroPrenotacao: 635002,
    dataRecepcao: "2026-02-10T11:00:00Z",
    tipoRecepcao: "ENTRADA",
    formaTitulo: "Instrumento particular - Fração",
    idTipoRetorno: 292,
    siglaRetorno: "RTR",
    tipoRetorno: "Retorno Tela de Recepção",
    familiaRetorno: "Tela de recepção",
    classificacao: "Sem marcador",
    dataRetorno: "2026-02-15T15:10:00Z",
    idUsuarioOrigem: "usr_henrique",
    usuarioOrigem: "HENRIQUE CESAR",
    idUsuarioDestino: "usr_bruno",
    usuarioDestinoRetorno: "Bruno Alves Santos",
    observacao: "Ausência de comprovante de recolhimento de ITBI da fração ideal. Guia anexada não confere com o valor da operação.",
    seqTitulo: 1,
  },
  {
    idAndamento: "1004",
    idRecepcao: 84004,
    numeroPrenotacao: 635170,
    dataRecepcao: "2026-02-11T08:45:00Z",
    tipoRecepcao: "ENTRADA",
    formaTitulo: "Instrumento Particular",
    idTipoRetorno: 292,
    siglaRetorno: "RTR",
    tipoRetorno: "Retorno Tela de Recepção",
    familiaRetorno: "Tela de recepção",
    classificacao: "Sem marcador",
    dataRetorno: "2026-02-15T11:09:00Z",
    idUsuarioOrigem: "usr_kelly",
    usuarioOrigem: "KELLY FERNANDA",
    idUsuarioDestino: "usr_alisson",
    usuarioDestinoRetorno: "Alisson Azevedo de Lima",
    observacao: "Apresentada procuração sem poderes específicos para alienação do imóvel descrito.",
    seqTitulo: 1,
  },
  {
    idAndamento: "1005",
    idRecepcao: 84005,
    numeroPrenotacao: 635787,
    dataRecepcao: "2026-02-11T14:20:00Z",
    tipoRecepcao: "REINGRESSO",
    formaTitulo: "Escritura",
    idTipoRetorno: 294,
    siglaRetorno: "RPE",
    tipoRetorno: "Retorno Pessoal Exigência",
    familiaRetorno: "Pessoal",
    classificacao: "Sem marcador",
    dataRetorno: "2026-02-14T14:52:00Z",
    idUsuarioOrigem: "usr_sara",
    usuarioOrigem: "Sara Regina",
    idUsuarioDestino: "usr_jonatan",
    usuarioDestinoRetorno: "Jonatan Lima",
    observacao: "Exigência de apresentação de CND conjunta da Receita Federal e PGFN da pessoa jurídica outorgante.",
    seqTitulo: 1,
  },
  {
    idAndamento: "1006",
    idRecepcao: 84006,
    numeroPrenotacao: 636069,
    dataRecepcao: "2026-02-12T09:10:00Z",
    tipoRecepcao: "ENTRADA",
    formaTitulo: "Instrumento particular - Fração",
    idTipoRetorno: 294,
    siglaRetorno: "RPE",
    tipoRetorno: "Retorno Pessoal Exigência",
    familiaRetorno: "Pessoal",
    classificacao: "Sem marcador",
    dataRetorno: "2026-02-14T11:20:00Z",
    idUsuarioOrigem: "usr_juliana",
    usuarioOrigem: "JULIANA ALVES",
    idUsuarioDestino: "usr_jonatan",
    usuarioDestinoRetorno: "Jonatan Lima",
    observacao: "Qualificação incompleta dos cônjuges outorgantes. Faltam número de RG e regime de bens com indicação de pacto antenupcial.",
    seqTitulo: 1,
  },
  // Eventos corrigidos (67 itens proporcionais)
  {
    idAndamento: "1007",
    idRecepcao: 84007,
    numeroPrenotacao: 634890,
    dataRecepcao: "2026-02-09T13:00:00Z",
    tipoRecepcao: "REINGRESSO",
    formaTitulo: "Escritura Pública",
    idTipoRetorno: 296,
    siglaRetorno: "RPC",
    tipoRetorno: "Retorno Pessoal Corrigido",
    familiaRetorno: "Pessoal",
    classificacao: "Corrigido",
    dataRetorno: "2026-02-14T16:00:00Z",
    idUsuarioOrigem: "usr_jonatan",
    usuarioOrigem: "Jonatan Lima",
    idUsuarioDestino: "usr_henrique",
    usuarioDestinoRetorno: "HENRIQUE CESAR",
    observacao: "Aditamento apresentado sanando a divergência do estado civil. Documento em conformidade.",
    seqTitulo: 1,
  },
  {
    idAndamento: "1008",
    idRecepcao: 84008,
    numeroPrenotacao: 634912,
    dataRecepcao: "2026-02-09T14:40:00Z",
    tipoRecepcao: "REINGRESSO",
    formaTitulo: "Formal de Partilha",
    idTipoRetorno: 297,
    siglaRetorno: "RRC",
    tipoRetorno: "Retorno Real Corrigido",
    familiaRetorno: "Real",
    classificacao: "Corrigido",
    dataRetorno: "2026-02-13T10:15:00Z",
    idUsuarioOrigem: "usr_kelly",
    usuarioOrigem: "KELLY FERNANDA",
    idUsuarioDestino: "usr_henrique",
    usuarioDestinoRetorno: "HENRIQUE CESAR",
    observacao: "Certidão de trânsito em julgado e pagamento de ITCMD protocolados e validados.",
    seqTitulo: 1,
  },
  {
    idAndamento: "1009",
    idRecepcao: 84009,
    numeroPrenotacao: 634950,
    dataRecepcao: "2026-02-09T16:10:00Z",
    tipoRecepcao: "REINGRESSO",
    formaTitulo: "Cédula de Crédito Imobiliário",
    idTipoRetorno: 295,
    siglaRetorno: "RTC",
    tipoRetorno: "Retorno Recepção Corrigido",
    familiaRetorno: "Tela de recepção",
    classificacao: "Corrigido",
    dataRetorno: "2026-02-13T09:40:00Z",
    idUsuarioOrigem: "usr_bruno",
    usuarioOrigem: "Bruno Alves Santos",
    idUsuarioDestino: "usr_kelly",
    usuarioDestinoRetorno: "KELLY FERNANDA CARVALHO SILVA",
    observacao: "Corrigido enquadramento de custas e emolumentos conforme tabela vigente.",
    seqTitulo: 1,
  },
];

// Gerador determinístico dos demais registros para atingir os 229 totais do protótipo
const NOMES_RESPONSAVEIS: { id: string; nome: string; peso: number }[] = [
  { id: "usr_jonatan", nome: "Jonatan Lima", peso: 40 },
  { id: "usr_kelly", nome: "KELLY FERNANDA CARVALHO SILVA", peso: 23 },
  { id: "usr_bruno", nome: "Bruno Alves Santos", peso: 18 },
  { id: "usr_alisson", nome: "Alisson Azevedo de Lima", peso: 14 },
  { id: "usr_sara", nome: "Sara Regina de Oliveira", peso: 12 },
  { id: "usr_juliana", nome: "Juliana Alves Ribeiro", peso: 11 },
  { id: "usr_marcos", nome: "Marcos Vinicius Pereira", peso: 9 },
  { id: "usr_camila", nome: "Camila Fernandes Souza", peso: 8 },
  { id: "usr_lucas", nome: "Lucas Gabriel Costa", peso: 6 },
  { id: "usr_amanda", nome: "Amanda Beatriz Rodrigues", peso: 5 },
  { id: "usr_rodrigo", nome: "Rodrigo Toledo Silva", peso: 4 },
  { id: "usr_fernando", nome: "Fernando Henrique Dias", peso: 3 },
  { id: "usr_patricia", nome: "Patricia Mara dos Santos", peso: 3 },
  { id: "usr_tiago", nome: "Tiago Moreira Ramos", peso: 2 },
  { id: "usr_gabriel", nome: "Gabriel Antunes Neto", peso: 2 },
  { id: "usr_vanessa", nome: "Vanessa Castro Lima", peso: 2 },
];

const TIPOS_DADOS: { id: number; sigla: string; desc: string; familia: 'Pessoal' | 'Real' | 'Tela de recepção'; corrigido: boolean }[] = [
  { id: 292, sigla: "RTR", desc: "Retorno Tela Recepção", familia: "Tela de recepção", corrigido: false },
  { id: 293, sigla: "RRE", desc: "Retorno Real Exigência", familia: "Real", corrigido: false },
  { id: 294, sigla: "RPE", desc: "Retorno Pessoal Exigência", familia: "Pessoal", corrigido: false },
  { id: 295, sigla: "RTC", desc: "Retorno Recepção Corrigido", familia: "Tela de recepção", corrigido: true },
  { id: 296, sigla: "RPC", desc: "Retorno Pessoal Corrigido", familia: "Pessoal", corrigido: true },
  { id: 297, sigla: "RRC", desc: "Retorno Real Corrigido", familia: "Real", corrigido: true },
];

const FORMAS = [
  "Instrumento Particular",
  "Escritura Pública",
  "Instrumento particular - Fração",
  "Formal de Partilha",
  "Cédula de Crédito Bancário",
  "Contrato de Financiamento",
  "Requerimento de Usucapião",
  "Carta de Sentença"
];

// Monta lista completa de 229 eventos exatamente: 162 Sem Marcador e 67 Corrigidos
export function getFullMockRetornos(): RetornoItem[] {
  const list = [...MOCK_RETORNOS];
  let idCounter = 1010;
  const semMarcadorTipos = TIPOS_DADOS.filter(t => !t.corrigido);
  const corrigidoTipos = TIPOS_DADOS.filter(t => t.corrigido);
  const prenotacaoBase = 636100;

  let currentSemMarcador = list.filter(r => r.classificacao === 'Sem marcador').length;
  let currentCorrigidos = list.filter(r => r.classificacao === 'Corrigido').length;

  while (currentSemMarcador < 162) {
    const resp = NOMES_RESPONSAVEIS[(idCounter) % NOMES_RESPONSAVEIS.length];
    const tipo = semMarcadorTipos[(idCounter) % semMarcadorTipos.length];
    const forma = FORMAS[(idCounter) % FORMAS.length];
    const day = (idCounter % 20) + 1;
    const hour = 8 + (idCounter % 10);
    const min = (idCounter * 7) % 60;

    list.push({
      idAndamento: String(idCounter),
      idRecepcao: 84000 + idCounter,
      numeroPrenotacao: prenotacaoBase + (idCounter % 1500),
      dataRecepcao: `2026-02-${String(Math.max(1, day - 3)).padStart(2, '0')}T09:00:00Z`,
      tipoRecepcao: idCounter % 3 === 0 ? "REINGRESSO" : "ENTRADA",
      formaTitulo: forma,
      idTipoRetorno: tipo.id,
      siglaRetorno: tipo.sigla,
      tipoRetorno: tipo.desc,
      familiaRetorno: tipo.familia,
      classificacao: "Sem marcador",
      dataRetorno: `2026-02-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:00Z`,
      idUsuarioOrigem: "usr_henrique",
      usuarioOrigem: "HENRIQUE CESAR",
      idUsuarioDestino: resp.id,
      usuarioDestinoRetorno: resp.nome,
      observacao: `Nota de devolução e exigências referente ao título: reapresentar com as devidas adequações formais no prazo da prenotação.`,
      seqTitulo: 1 + (idCounter % 3),
    });

    idCounter++;
    currentSemMarcador++;
  }

  while (currentCorrigidos < 67) {
    const resp = NOMES_RESPONSAVEIS[(idCounter) % NOMES_RESPONSAVEIS.length];
    const tipo = corrigidoTipos[(idCounter) % corrigidoTipos.length];
    const forma = FORMAS[(idCounter) % FORMAS.length];
    const day = (idCounter % 20) + 1;
    const hour = 9 + (idCounter % 9);
    const min = (idCounter * 11) % 60;

    list.push({
      idAndamento: String(idCounter),
      idRecepcao: 84000 + idCounter,
      numeroPrenotacao: prenotacaoBase + (idCounter % 1500),
      dataRecepcao: `2026-02-${String(Math.max(1, day - 4)).padStart(2, '0')}T10:00:00Z`,
      tipoRecepcao: "REINGRESSO",
      formaTitulo: forma,
      idTipoRetorno: tipo.id,
      siglaRetorno: tipo.sigla,
      tipoRetorno: tipo.desc,
      familiaRetorno: tipo.familia,
      classificacao: "Corrigido",
      dataRetorno: `2026-02-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}:00Z`,
      idUsuarioOrigem: resp.id,
      usuarioOrigem: resp.nome,
      idUsuarioDestino: "usr_henrique",
      usuarioDestinoRetorno: "HENRIQUE CESAR",
      observacao: "Exigências sanadas tempestivamente. Registro apto para prosseguimento do ato cartorário.",
      seqTitulo: 1,
    });

    idCounter++;
    currentCorrigidos++;
  }

  return list;
}
