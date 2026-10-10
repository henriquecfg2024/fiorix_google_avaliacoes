import type {
  SenhaRecord,
  KPIs,
  HorarioPico,
  PerformanceAgente,
  Suspensao,
  Agendamento,
  EsperaDataResponse,
} from './espera-service';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURAÇÕES E CONSTANTES DO CARTÓRIO (7º RI)
// ─────────────────────────────────────────────────────────────────────────────
export const ATENDENTES_BASE = [
  { nome: 'ANA SILVA', guiche: 'Guichê 01', pref: 'PRIORIDADE' },
  { nome: 'CARLOS EDUARDO', guiche: 'Guichê 02', pref: 'TÍTULO' },
  { nome: 'MARIANA SANTOS', guiche: 'Guichê 03', pref: 'TÍTULO' },
  { nome: 'RAFAEL LIMA', guiche: 'Guichê 04', pref: 'PEDIDO DE CERTIDÃO' },
  { nome: 'JULIANA COSTA', guiche: 'Guichê 05', pref: 'RETIRADA' },
  { nome: 'BEATRIZ ALMEIDA', guiche: 'Guichê 06', pref: 'RETIRADA' },
  { nome: 'FERNANDO SOUZA', guiche: 'Guichê 07', pref: 'TÍTULO' },
];

export const SERVICOS_CONFIG = [
  { servico: 'TÍTULO', prefixo: 'T', peso: 0.44 },
  { servico: 'RETIRADA', prefixo: 'R', peso: 0.23 },
  { servico: 'PEDIDO DE CERTIDÃO', prefixo: 'C', peso: 0.18 },
  { servico: 'PRIORIDADE', prefixo: 'P', peso: 0.15 },
];

const NOMES_CLIENTES = [
  'Maria Silva', 'João Santos', 'Ana Oliveira', 'Lucas Pereira', 'Juliana Souza',
  'Rodrigo Lima', 'Fernanda Costa', 'Gabriel Almeida', 'Patrícia Gomes', 'Bruno Ribeiro',
  'Camila Carvalho', 'Felipe Martins', 'Mariana Rocha', 'Guilherme Castro', 'Larissa Barbosa',
  'Marcelo Dias', 'Beatriz Cardoso', 'Thiago Cavalcanti', 'Renata Moreira', 'Diego Fernandes',
  'Amanda Correia', 'Rafael Pires', 'Vanessa Mendes', 'Vinícius Ramos', 'Aline Vieira',
  'Eduardo Freitas', 'Letícia Santana', 'Marcos Teixeira', 'Priscila Guimarães', 'Leonardo Pinto',
];

// ─────────────────────────────────────────────────────────────────────────────
// GERADOR DETERMINÍSTICO PSEUDO-RANDOM (SEEDED)
// ─────────────────────────────────────────────────────────────────────────────
function createPrng(seed: number) {
  let s = Math.abs(seed) % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) || 123456789;
}

/**
 * Verifica se a data 'YYYY-MM-DD' é final de semana (Sábado ou Domingo)
 */
export function isWeekend(dateIso: string): boolean {
  if (!dateIso || !/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) return false;
  const [y, m, d] = dateIso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const day = dt.getDay();
  return day === 0 || day === 6; // 0 = Domingo, 6 = Sábado
}

// ─────────────────────────────────────────────────────────────────────────────
// GERADOR DE REGISTROS DE UM DIA ÚTIL
// ─────────────────────────────────────────────────────────────────────────────
export function generateDayRecords(dateIso: string, slaMinutes = 15): SenhaRecord[] {
  if (isWeekend(dateIso)) {
    return []; // Finais de semana NÃO possuem expediente
  }

  const [year, month, day] = dateIso.split('-').map(Number);
  const dt = new Date(year, month - 1, day);
  const dayOfWeek = dt.getDay(); // 1 = Seg, ..., 5 = Sex

  const rng = createPrng(hashString(dateIso));

  // Volume diário calibrado com a realidade do 7º RI:
  // Segundas e Sextas têm movimento maior (110 a 145 senhas); Terça a Quinta (90 a 130 senhas)
  const baseVolume = dayOfWeek === 1 || dayOfWeek === 5 ? 115 : 98;
  const volumeVariance = Math.floor(rng() * 32);
  const totalSenhas = baseVolume + volumeVariance;

  const records: SenhaRecord[] = [];
  let seqT = 1;
  let seqR = 1;
  let seqC = 1;
  let seqP = 1;

  // Horários operacionais das 08h às 18h
  // Distribuição de horários: picos às 10h-11h e às 13h-15h
  for (let i = 0; i < totalSenhas; i++) {
    // Sorteio da hora com distribuição ponderada
    const rHora = rng();
    let hora = 8;
    if (rHora < 0.05) hora = 8;
    else if (rHora < 0.17) hora = 9;
    else if (rHora < 0.33) hora = 10;
    else if (rHora < 0.44) hora = 11;
    else if (rHora < 0.53) hora = 12;
    else if (rHora < 0.70) hora = 13;
    else if (rHora < 0.84) hora = 14;
    else if (rHora < 0.93) hora = 15;
    else if (rHora < 0.98) hora = 16;
    else hora = 17;

    const minEmissao = Math.floor(rng() * 60);
    const emissaoStr = `${String(hora).padStart(2, '0')}:${String(minEmissao).padStart(2, '0')}`;

    // Sorteio do serviço
    const rServico = rng();
    let servicoConfig = SERVICOS_CONFIG[0];
    if (rServico < SERVICOS_CONFIG[3].peso) {
      servicoConfig = SERVICOS_CONFIG[3]; // PRIORIDADE
    } else if (rServico < SERVICOS_CONFIG[3].peso + SERVICOS_CONFIG[2].peso) {
      servicoConfig = SERVICOS_CONFIG[2]; // PEDIDO DE CERTIDÃO
    } else if (rServico < SERVICOS_CONFIG[3].peso + SERVICOS_CONFIG[2].peso + SERVICOS_CONFIG[1].peso) {
      servicoConfig = SERVICOS_CONFIG[1]; // RETIRADA
    } else {
      servicoConfig = SERVICOS_CONFIG[0]; // TÍTULO
    }

    let senhaNumero = 1;
    if (servicoConfig.prefixo === 'T') senhaNumero = seqT++;
    else if (servicoConfig.prefixo === 'R') senhaNumero = seqR++;
    else if (servicoConfig.prefixo === 'C') senhaNumero = seqC++;
    else senhaNumero = seqP++;

    const senha = `${servicoConfig.prefixo}${String(senhaNumero).padStart(4, '0')}`;

    // Situação: 95% finalizado, 5% desistência
    const isDesistencia = rng() < 0.048;

    // Tempo de espera (minutos)
    // 87% dentro do SLA de 15 min, 13% acima
    let tempoEsperaMin: number;
    if (rng() < 0.87) {
      tempoEsperaMin = Math.floor(rng() * (slaMinutes - 2)) + 3; // 3 a 14 min
    } else {
      tempoEsperaMin = Math.floor(rng() * 15) + (slaMinutes + 1); // 16 a 30 min
    }

    // Minuto da chamada
    const emissaoTotalMin = hora * 60 + minEmissao;
    const chamadaTotalMin = emissaoTotalMin + tempoEsperaMin;
    const horaChamada = Math.floor(chamadaTotalMin / 60);
    const minChamada = chamadaTotalMin % 60;
    const chamadaStr = `${String(Math.min(horaChamada, 18)).padStart(2, '0')}:${String(minChamada).padStart(2, '0')}`;

    // Atendente e Guichê
    let atendenteObj = ATENDENTES_BASE.find(a => a.pref === servicoConfig.servico);
    if (!atendenteObj || rng() < 0.35) {
      atendenteObj = ATENDENTES_BASE[Math.floor(rng() * ATENDENTES_BASE.length)];
    }

    let tempoAtendimentoMin: number | null = null;
    let fimAtendimentoStr: string | undefined = undefined;
    let avaliacao: string | undefined = undefined;

    if (!isDesistencia) {
      tempoAtendimentoMin = Math.floor(rng() * 14) + 6; // 6 a 20 min
      const fimTotalMin = chamadaTotalMin + tempoAtendimentoMin;
      const horaFim = Math.floor(fimTotalMin / 60);
      const minFim = fimTotalMin % 60;
      fimAtendimentoStr = `${String(Math.min(horaFim, 18)).padStart(2, '0')}:${String(minFim).padStart(2, '0')}`;

      // Avaliação CSAT
      const rNota = rng();
      if (rNota < 0.70) avaliacao = 'Nota 5';
      else if (rNota < 0.92) avaliacao = 'Nota 4';
      else if (rNota < 0.97) avaliacao = 'Nota 3';
      else avaliacao = 'Nota 2';
    }

    const cliente = NOMES_CLIENTES[Math.floor(rng() * NOMES_CLIENTES.length)];

    records.push({
      id: `hist-${dateIso}-${i + 1}`,
      senha,
      servico: servicoConfig.servico,
      fila: servicoConfig.servico,
      data: dateIso,
      emissao: emissaoStr,
      chamada: chamadaStr,
      inicioAtendimento: isDesistencia ? undefined : chamadaStr,
      fimAtendimento: fimAtendimentoStr,
      tempoEsperaMin,
      tempoAtendimentoMin,
      guiche: isDesistencia ? '—' : atendenteObj.guiche,
      atendente: isDesistencia ? '—' : atendenteObj.nome,
      cliente,
      avaliacao,
      situacao: isDesistencia ? 'Desistência' : 'Finalizado',
    });
  }

  // Ordena por horário decrescente (mais recente primeiro)
  records.sort((a, b) => b.emissao.localeCompare(a.emissao));

  return records;
}

// ─────────────────────────────────────────────────────────────────────────────
// CÁLCULO DE KPIS E MÉTRICAS EXECUTIVAS COMPLETAS
// ─────────────────────────────────────────────────────────────────────────────
export function buildEsperaDataResponseFromRecords(
  records: SenhaRecord[],
  slaMinutes = 15,
  dateOrPeriodLabel?: string
): EsperaDataResponse {
  const totalSenhas = records.length;
  const atendidos = records.filter(r => r.situacao !== 'Desistência' && r.situacao !== 'Cancelado');
  const desistencias = records.filter(r => r.situacao === 'Desistência' || r.situacao === 'Cancelado');
  const comEspera = records.filter(r => r.tempoEsperaMin !== null);
  const dentroSlaEspera = comEspera.filter(r => (r.tempoEsperaMin ?? 0) <= slaMinutes);
  const comAtendimento = records.filter(r => r.tempoAtendimentoMin !== null && r.tempoAtendimentoMin !== undefined);
  const dentroSlaAtendimento = comAtendimento.filter(r => (r.tempoAtendimentoMin ?? 0) <= 15);

  const mediaEsperaMin = comEspera.length > 0
    ? Math.round(comEspera.reduce((acc, r) => acc + (r.tempoEsperaMin ?? 0), 0) / comEspera.length)
    : 0;
  const mediaAtendimentoMin = comAtendimento.length > 0
    ? Math.round(comAtendimento.reduce((acc, r) => acc + (r.tempoAtendimentoMin ?? 0), 0) / comAtendimento.length)
    : 0;
  const slaEsperaPerc = comEspera.length > 0 ? Math.round((dentroSlaEspera.length / comEspera.length) * 100) : 100;
  const slaAtendimentoPerc = comAtendimento.length > 0 ? Math.round((dentroSlaAtendimento.length / comAtendimento.length) * 100) : 100;
  const slaGeralPerc = Math.round(slaEsperaPerc * 0.6 + slaAtendimentoPerc * 0.4);

  const avaliacoes = records
    .map(r => {
      if (!r.avaliacao || r.avaliacao === '—') return null;
      const num = parseFloat(r.avaliacao.replace(/[^0-9.]/g, ''));
      return isNaN(num) ? null : num;
    })
    .filter((n): n is number => n !== null);

  const csatMediaPerc = avaliacoes.length > 0
    ? Math.round((avaliacoes.reduce((a, b) => a + b, 0) / avaliacoes.length) * 20)
    : null;

  // Horários de Pico (08h às 18h)
  const horasLista = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];
  const horasMap: Record<string, { total: number; dentroSla: number; foraSla: number; totalEspera: number; countEspera: number }> = {};
  for (const h of horasLista) {
    horasMap[h] = { total: 0, dentroSla: 0, foraSla: 0, totalEspera: 0, countEspera: 0 };
  }

  for (const r of records) {
    if (r.emissao && r.emissao !== '—') {
      const horaKey = r.emissao.split(':')[0] + ':00';
      if (!horasMap[horaKey]) {
        horasMap[horaKey] = { total: 0, dentroSla: 0, foraSla: 0, totalEspera: 0, countEspera: 0 };
      }
      horasMap[horaKey].total += 1;
      if (r.tempoEsperaMin !== null) {
        horasMap[horaKey].totalEspera += r.tempoEsperaMin;
        horasMap[horaKey].countEspera += 1;
        if (r.tempoEsperaMin <= slaMinutes) {
          horasMap[horaKey].dentroSla += 1;
        } else {
          horasMap[horaKey].foraSla += 1;
        }
      }
    }
  }

  const horariosPico: HorarioPico[] = Object.entries(horasMap)
    .map(([hora, val]) => ({
      hora,
      total: val.total,
      dentroSla: val.dentroSla,
      foraSla: val.foraSla,
      mediaEsperaMin: val.countEspera > 0 ? Math.round(val.totalEspera / val.countEspera) : 0,
    }))
    .sort((a, b) => a.hora.localeCompare(b.hora));

  // Performance dos Agentes
  const agentesMap: Record<string, {
    totalAtendimentos: number;
    totalEspera: number;
    countEspera: number;
    totalAtendimento: number;
    countAtendimento: number;
    dentroSla: number;
    desistencias: number;
    notas: number[];
  }> = {};

  for (const r of records) {
    const rawNome = r.atendente !== '—' && r.atendente ? r.atendente.trim() : 'RECEPÇÃO / TRIAGEM';
    const nome = rawNome.toUpperCase();
    if (!agentesMap[nome]) {
      agentesMap[nome] = {
        totalAtendimentos: 0,
        totalEspera: 0,
        countEspera: 0,
        totalAtendimento: 0,
        countAtendimento: 0,
        dentroSla: 0,
        desistencias: 0,
        notas: [],
      };
    }

    if (r.situacao === 'Desistência' || r.situacao === 'Cancelado') {
      agentesMap[nome].desistencias += 1;
    } else {
      agentesMap[nome].totalAtendimentos += 1;
    }

    if (r.tempoEsperaMin !== null) {
      agentesMap[nome].totalEspera += r.tempoEsperaMin;
      agentesMap[nome].countEspera += 1;
      if (r.tempoEsperaMin <= slaMinutes) {
        agentesMap[nome].dentroSla += 1;
      }
    }

    if (r.tempoAtendimentoMin !== null && r.tempoAtendimentoMin !== undefined) {
      agentesMap[nome].totalAtendimento += r.tempoAtendimentoMin;
      agentesMap[nome].countAtendimento += 1;
    }

    if (r.avaliacao && r.avaliacao !== '—') {
      const num = parseFloat(r.avaliacao.replace(/[^0-9.]/g, ''));
      if (!isNaN(num)) agentesMap[nome].notas.push(num);
    }
  }

  const performanceAgentes: PerformanceAgente[] = Object.entries(agentesMap)
    .map(([atendente, val]) => ({
      atendente,
      totalAtendimentos: val.totalAtendimentos,
      mediaEsperaMin: val.countEspera > 0 ? Math.round(val.totalEspera / val.countEspera) : 0,
      mediaAtendimentoMin: val.countAtendimento > 0 ? Math.round(val.totalAtendimento / val.countAtendimento) : 0,
      dentroSlaPerc: val.countEspera > 0 ? Math.round((val.dentroSla / val.countEspera) * 1000) / 10 : 100,
      desistencias: val.desistencias,
      csatScore: val.notas.length > 0 ? Math.round((val.notas.reduce((a, b) => a + b, 0) / val.notas.length) * 20) : null,
    }))
    .sort((a, b) => b.totalAtendimentos - a.totalAtendimentos);

  // Pausas representativas
  const suspensoes: Suspensao[] = ATENDENTES_BASE.slice(0, 4).map((a, idx) => ({
    id: `susp-${idx}`,
    atendente: a.nome,
    motivo: idx % 2 === 0 ? 'Horário de Almoço' : 'Intervalo / Pausa',
    inicio: `${12 + idx}:00`,
    fim: `${12 + idx}:45`,
    duracaoMin: 45,
    emAndamento: false,
  }));

  // Agendamentos representativos
  const agendamentos: Agendamento[] = [
    {
      id: 'ag-1',
      cliente: 'Mariana Rocha',
      servico: 'TÍTULO',
      horario: '10:00',
      status: 'Compareceu',
      senha: 'T0025',
    },
    {
      id: 'ag-2',
      cliente: 'Lucas Pereira',
      servico: 'PEDIDO DE CERTIDÃO',
      horario: '11:30',
      status: 'Compareceu',
      senha: 'C0012',
    },
    {
      id: 'ag-3',
      cliente: 'Renata Moreira',
      servico: 'RETIRADA',
      horario: '14:00',
      status: 'Compareceu',
      senha: 'R0018',
    },
  ];

  return {
    configured: true,
    records,
    slaMinutes,
    lastSyncAt: new Date().toISOString(),
    total: totalSenhas,
    kpis: {
      slaGeralPerc,
      slaEsperaPerc,
      mediaEsperaMin,
      slaAtendimentoPerc,
      mediaAtendimentoMin,
      totalSenhas,
      totalAtendidas: atendidos.length,
      totalDesistencias: desistencias.length,
      csatMediaPerc,
      totalAgendamentos: agendamentos.length,
    },
    realtime: {
      fila: [],
      emAtendimento: [],
    },
    horariosPico,
    performanceAgentes,
    suspensoes,
    agendamentos,
    error: null,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// GERADOR DO MÊS COMPLETO (POPULA TODOS OS DIAS ÚTEIS)
// ─────────────────────────────────────────────────────────────────────────────
export function generateMonthRecords(year: number, month: number, slaMinutes = 15): SenhaRecord[] {
  const daysInMonth = new Date(year, month, 0).getDate();
  const allRecords: SenhaRecord[] = [];
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });

  for (let day = 1; day <= daysInMonth; day++) {
    const dateIso = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    // Finais de semana e datas futuras (após hoje) não possuem atendimentos
    if (!isWeekend(dateIso) && dateIso <= todayStr) {
      const dayRecs = generateDayRecords(dateIso, slaMinutes);
      allRecords.push(...dayRecs);
    }
  }

  allRecords.sort((a, b) => {
    if (a.data !== b.data) {
      return (b.data || '').localeCompare(a.data || '');
    }
    return b.emissao.localeCompare(a.emissao);
  });

  return allRecords;
}
