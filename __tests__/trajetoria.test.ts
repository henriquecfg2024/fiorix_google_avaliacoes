import { describe, it, expect } from 'vitest';
import { deriveTrajetoria } from '@/lib/trajetoria/engine';

describe('deriveTrajetoria (Motor de Trajetória do Título)', () => {
  it('Protocolo 641881: identifica corretamente título DEVOLVIDO e RETIRADO no balcão via tabela de tarefas', () => {
    const tarefas = [
      {
        tarefa: 'SCANNER',
        data_servico: '2026-08-12T13:01:10.933Z',
        data_cadastro_tarefa: '2026-08-12T13:01:10.933Z',
        data_abertura: '2026-08-12T14:30:00.000Z',
        data_finalizacao: '2026-08-12T14:30:00.000Z',
        situacao_tarefa: 'FINALIZADA',
        responsavel: 'ThiagoSilva',
        tipo: 'PRENOTADO',
        natureza: 'Instrumento Particular',
        dt_devolucao: '2026-08-21T00:00:00.000Z',
        dt_retirada: '2026-08-24T00:00:00.000Z',
        data_entrada: null,
        status_previsao: 'ATRASADO',
      },
      {
        tarefa: 'CONTRADITÓRIO',
        data_servico: '2026-08-12T13:01:10.933Z',
        data_cadastro_tarefa: '2026-08-12T14:30:44.903Z',
        data_abertura: '2026-08-13T09:44:00.000Z',
        data_finalizacao: '2026-08-13T09:44:00.000Z',
        situacao_tarefa: 'FINALIZADA',
        responsavel: 'Jonatan',
        tipo: 'PRENOTADO',
        natureza: 'Instrumento Particular',
        dt_devolucao: '2026-08-21T00:00:00.000Z',
        dt_retirada: '2026-08-24T00:00:00.000Z',
        data_entrada: null,
        status_previsao: 'ATRASADO',
      },
      {
        tarefa: 'EXTRATO',
        data_servico: '2026-08-12T13:01:10.933Z',
        data_cadastro_tarefa: '2026-08-13T09:44:32.293Z',
        data_abertura: '2026-08-15T11:23:00.000Z',
        data_finalizacao: '2026-08-15T11:23:00.000Z',
        situacao_tarefa: 'FINALIZADA',
        responsavel: 'LucasGoncalves',
        tipo: 'PRENOTADO',
        natureza: 'Instrumento Particular',
        dt_devolucao: '2026-08-21T00:00:00.000Z',
        dt_retirada: '2026-08-24T00:00:00.000Z',
        data_entrada: null,
        status_previsao: 'ATRASADO',
      },
      {
        tarefa: 'QUALIFICAÇÃO',
        data_servico: '2026-08-12T13:01:10.933Z',
        data_cadastro_tarefa: '2026-08-15T11:23:59.040Z',
        data_abertura: '2026-08-20T12:07:00.000Z',
        data_finalizacao: '2026-08-20T12:08:00.000Z',
        situacao_tarefa: 'FINALIZADA',
        responsavel: 'Paula C',
        tipo: 'PRENOTADO',
        natureza: 'Instrumento Particular',
        dt_devolucao: '2026-08-21T00:00:00.000Z',
        dt_retirada: '2026-08-24T00:00:00.000Z',
        data_entrada: null,
        status_previsao: 'ATRASADO',
      },
      {
        tarefa: 'CÁLCULO DE CUSTAS',
        data_servico: '2026-08-12T13:01:10.933Z',
        data_cadastro_tarefa: '2026-08-20T12:08:04.010Z',
        data_abertura: '2026-08-21T13:24:15.320Z',
        data_finalizacao: '2026-08-21T13:24:15.320Z',
        situacao_tarefa: 'FINALIZADA',
        responsavel: 'Ricardomarcal',
        tipo: 'PRENOTADO',
        natureza: 'Instrumento Particular',
        dt_devolucao: '2026-08-21T00:00:00.000Z',
        dt_retirada: '2026-08-24T00:00:00.000Z',
        data_entrada: null,
        status_previsao: 'ATRASADO',
      },
      {
        tarefa: 'BALCÃO DEVOLVIDO',
        data_servico: '2026-08-12T13:01:10.933Z',
        data_cadastro_tarefa: '2026-08-21T13:24:15.320Z',
        data_abertura: null,
        data_finalizacao: null,
        situacao_tarefa: 'AGUARDANDO',
        responsavel: 'Ricardomarcal',
        tipo: 'PRENOTADO',
        natureza: 'Instrumento Particular',
        dt_devolucao: '2026-08-21T00:00:00.000Z',
        dt_retirada: '2026-08-24T00:00:00.000Z',
        data_entrada: null,
        status_previsao: 'ATRASADO',
      },
    ];

    const result = deriveTrajetoria(null, null, tarefas);

    expect(result.desfecho).toBe('DEVOLVIDO');
    expect(result.ultimoSetorNum).toBe(11); // Setor 11: Saída (Retirado em 24/08/2026)
    expect(result.ultimoSetorEvidencia).toBe('2026-08-24T00:00:00.000Z');

    const setorMap = new Map(result.setores.map(s => [s.num, s]));

    // Setor 1: Entrada
    expect(setorMap.get(1)?.status).toBe('PERCORRIDO');
    expect(setorMap.get(1)?.evidencia).toBe('2026-08-12T13:01:10.933Z');

    // Setor 2: Digitalização
    expect(setorMap.get(2)?.status).toBe('PERCORRIDO');
    expect(setorMap.get(2)?.evidencia).toBe('2026-08-12T14:30:00.000Z');

    // Setor 3: Contraditório
    expect(setorMap.get(3)?.status).toBe('PERCORRIDO');
    expect(setorMap.get(3)?.evidencia).toBe('2026-08-13T09:44:00.000Z');

    // Setor 4: Extrato
    expect(setorMap.get(4)?.status).toBe('PERCORRIDO');
    expect(setorMap.get(4)?.evidencia).toBe('2026-08-15T11:23:00.000Z');

    // Setor 5: Qualificação
    expect(setorMap.get(5)?.status).toBe('PERCORRIDO');
    expect(setorMap.get(5)?.evidencia).toBe('2026-08-20T12:08:00.000Z');

    // Setor 6: Pré-Cálculo
    expect(setorMap.get(6)?.status).toBe('PERCORRIDO');
    expect(setorMap.get(6)?.evidencia).toBe('2026-08-21T13:24:15.320Z');

    // Setor 7: Registro (Não aplicável pois foi devolvido)
    expect(setorMap.get(7)?.status).toBe('NAO_APLICAVEL');

    // Setor 8: Devolução
    expect(setorMap.get(8)?.status).toBe('PERCORRIDO');
    expect(setorMap.get(8)?.evidencia).toBe('2026-08-21T00:00:00.000Z');

    // Setor 9: Impressão Matrícula (Não aplicável)
    expect(setorMap.get(9)?.status).toBe('NAO_APLICAVEL');

    // Setor 10: Preparação
    expect(setorMap.get(10)?.status).toBe('PERCORRIDO');

    // Setor 11: Saída (Último percorrido / retirado)
    expect(setorMap.get(11)?.status).toBe('ATUAL');
    expect(setorMap.get(11)?.evidencia).toBe('2026-08-24T00:00:00.000Z');
  });

  it('Título devolvido que ainda aguarda retirada no balcão (dt_retirada = null)', () => {
    const tarefas = [
      {
        tarefa: 'BALCÃO DEVOLVIDO',
        data_servico: '2026-09-01T10:00:00.000Z',
        data_cadastro_tarefa: '2026-09-05T14:00:00.000Z',
        data_abertura: null,
        data_finalizacao: null,
        situacao_tarefa: 'AGUARDANDO',
        responsavel: 'Atendente',
        tipo: 'PRENOTADO',
        natureza: 'Escritura Pública',
        dt_devolucao: '2026-09-05T00:00:00.000Z',
        dt_retirada: null,
        data_entrada: null,
        status_previsao: 'NORMAL',
      },
    ];

    const result = deriveTrajetoria(null, null, tarefas);

    expect(result.desfecho).toBe('DEVOLVIDO');
    expect(result.ultimoSetorNum).toBe(8); // Setor 8: Devolução (Aguardando retirada)
    expect(result.ultimoSetorEvidencia).toBe('2026-09-05T00:00:00.000Z');

    const setorMap = new Map(result.setores.map(s => [s.num, s]));
    expect(setorMap.get(8)?.status).toBe('ATUAL');
    expect(setorMap.get(11)?.status).toBe('FUTURO'); // Ainda não retirado
  });

  it('Título registrado da tabela metas permanece sem regressão', () => {
    const metas = {
      protocolo: 642967,
      natureza: 'Compra e Venda',
      tipo: 'PRENOTADO',
      status: 'REGISTRADO',
      data_apresentado: '2026-08-10T10:00:00.000Z',
      d1_protocolo: '2026-08-10T10:00:00.000Z',
      d1_escaneamento: '2026-08-10T12:00:00.000Z',
      d2_contraditorio: '2026-08-11T10:00:00.000Z',
      d3_extrato: '2026-08-12T10:00:00.000Z',
      d4_qualificacao: '2026-08-13T10:00:00.000Z',
      d5_calculo: '2026-08-14T10:00:00.000Z',
      d8_impressao: '2026-08-15T10:00:00.000Z',
      d9_preparacao: '2026-08-16T10:00:00.000Z',
      d9_conferencia: '2026-08-16T11:00:00.000Z',
      d10_entrega: '2026-08-17T10:00:00.000Z',
      d_balcao_registrado: '2026-08-15T15:00:00.000Z',
      d_balcao_devolvido: null,
      qtd_retrabalho: 0,
    };

    const result = deriveTrajetoria(metas, null, []);

    expect(result.desfecho).toBe('REGISTRADO');
    expect(result.ultimoSetorNum).toBe(11);
    const setorMap = new Map(result.setores.map(s => [s.num, s]));
    expect(setorMap.get(7)?.status).toBe('PERCORRIDO');
    expect(setorMap.get(8)?.status).toBe('NAO_APLICAVEL'); // Setor Devolução não aplicável a registrado
    expect(setorMap.get(9)?.status).toBe('PERCORRIDO');
  });

  it('Protocolo 641810: identifica corretamente REINGRESSO após devolução (não trava em DEVOLVIDO)', () => {
    const tarefas = [
      {
        id: 46360,
        tarefa: 'SCANNER',
        data_cadastro_tarefa: '2026-08-12T08:02:39.450Z',
        data_abertura: '2026-08-12T14:30:00.000Z',
        data_finalizacao: '2026-08-12T14:30:00.000Z',
        situacao_tarefa: 'FINALIZADA',
        data_servico: '2026-08-12T08:02:39.450Z',
      },
      {
        id: 46798,
        tarefa: 'CONTRADITÓRIO',
        data_cadastro_tarefa: '2026-08-12T14:30:21.767Z',
        data_abertura: '2026-08-13T11:50:00.000Z',
        data_finalizacao: '2026-08-13T11:50:00.000Z',
        situacao_tarefa: 'FINALIZADA',
      },
      {
        id: 47812,
        tarefa: 'EXTRATO',
        data_cadastro_tarefa: '2026-08-13T11:50:25.033Z',
        data_abertura: '2026-08-15T08:02:00.000Z',
        data_finalizacao: '2026-08-15T08:02:00.000Z',
        situacao_tarefa: 'FINALIZADA',
      },
      {
        id: 51360,
        tarefa: 'QUALIFICAÇÃO',
        data_cadastro_tarefa: '2026-08-15T08:02:24.403Z',
        data_abertura: '2026-08-24T16:24:00.000Z',
        data_finalizacao: '2026-08-24T16:24:00.000Z',
        situacao_tarefa: 'FINALIZADA',
      },
      {
        id: 63363,
        tarefa: 'CÁLCULO DE CUSTAS',
        data_cadastro_tarefa: '2026-08-24T16:24:49.463Z',
        data_abertura: '2026-08-25T14:15:35.210Z',
        data_finalizacao: '2026-08-25T14:15:35.210Z',
        situacao_tarefa: 'FINALIZADA',
      },
      {
        id: 64275,
        tarefa: 'BALCÃO DEVOLVIDO',
        data_cadastro_tarefa: '2026-08-25T14:15:35.210Z',
        data_abertura: '2026-09-01T16:42:04.057Z',
        data_finalizacao: '2026-09-01T16:42:04.057Z',
        situacao_tarefa: 'FINALIZADA',
      },
      // --- Ciclo 2: REENTRADA EM 01/09/2026 ---
      {
        id: 70651,
        tarefa: 'SCANNER',
        data_cadastro_tarefa: '2026-09-01T16:42:04.060Z',
        data_abertura: '2026-09-01T16:51:00.000Z',
        data_finalizacao: '2026-09-01T16:51:00.000Z',
        situacao_tarefa: 'FINALIZADA',
      },
      {
        id: 70662,
        tarefa: 'CONTRADITÓRIO',
        data_cadastro_tarefa: '2026-09-01T16:51:04.450Z',
        data_abertura: '2026-09-02T11:18:00.000Z',
        data_finalizacao: '2026-09-02T11:18:00.000Z',
        situacao_tarefa: 'FINALIZADA',
      },
      {
        id: 70909,
        tarefa: 'EXTRATO',
        data_cadastro_tarefa: '2026-09-02T11:18:31.937Z',
        data_abertura: '2026-09-03T09:40:00.000Z',
        data_finalizacao: '2026-09-03T09:41:00.000Z',
        situacao_tarefa: 'FINALIZADA',
      },
      {
        id: 71501,
        tarefa: 'QUALIFICAÇÃO',
        data_cadastro_tarefa: '2026-09-03T09:41:00.423Z',
        data_abertura: '2026-09-03T17:35:00.000Z',
        data_finalizacao: '2026-09-03T17:35:00.000Z',
        situacao_tarefa: 'FINALIZADA',
      },
      {
        id: 73356,
        tarefa: 'CÁLCULO DE CUSTAS',
        data_cadastro_tarefa: '2026-09-03T17:35:56.700Z',
        data_abertura: null,
        data_finalizacao: null,
        situacao_tarefa: 'AGUARDANDO',
      },
      {
        id: 146941,
        tarefa: 'AGUARDADO PAGAMENTO',
        data_cadastro_tarefa: '2026-09-08T18:16:19.513Z',
        data_abertura: null,
        data_finalizacao: null,
        situacao_tarefa: 'AGUARDANDO',
      },
    ];

    const result = deriveTrajetoria(null, null, tarefas);

    // O título reingressou e está em análise após cálculo de custas / aguardado pagamento
    expect(result.desfecho).toBe('EM_ANALISE');
    expect(result.ultimoSetorNum).toBe(6); // Setor 6: Pré-Cálculo / Custas
    expect(result.ultimoSetorEvidencia).toBe('2026-09-08T18:16:19.513Z');

    const setorMap = new Map(result.setores.map(s => [s.num, s]));
    expect(setorMap.get(1)?.status).toBe('PERCORRIDO');
    expect(setorMap.get(2)?.status).toBe('PERCORRIDO');
    expect(setorMap.get(2)?.evidencia).toBe('2026-09-01T16:51:00.000Z'); // Evidência do 2º ciclo (reingresso)
    expect(setorMap.get(3)?.status).toBe('PERCORRIDO');
    expect(setorMap.get(3)?.evidencia).toBe('2026-09-02T11:18:00.000Z');
    expect(setorMap.get(4)?.status).toBe('PERCORRIDO');
    expect(setorMap.get(4)?.evidencia).toBe('2026-09-03T09:41:00.000Z');
    expect(setorMap.get(5)?.status).toBe('PERCORRIDO');
    expect(setorMap.get(5)?.evidencia).toBe('2026-09-03T17:35:00.000Z');
    expect(setorMap.get(6)?.status).toBe('ATUAL');
    expect(setorMap.get(8)?.status).toBe('FUTURO'); // Setor 8 Devolução não é o estado atual
  });

  it('Protocolo 641810: reflete corretamente REGISTRADO e RETIRADO quando sincronizado com o WebRI', () => {
    const tarefas = [
      {
        id: 46360,
        tarefa: 'SCANNER',
        data_cadastro_tarefa: '2026-08-12T08:02:39.450Z',
        data_abertura: '2026-08-12T14:30:00.000Z',
        data_finalizacao: '2026-08-12T14:30:00.000Z',
        situacao_tarefa: 'FINALIZADA',
      },
      {
        id: 64275,
        tarefa: 'BALCÃO DEVOLVIDO',
        data_cadastro_tarefa: '2026-08-25T14:15:35.210Z',
        data_abertura: '2026-09-01T16:42:04.057Z',
        data_finalizacao: '2026-09-01T16:42:04.057Z',
        situacao_tarefa: 'FINALIZADA',
      },
      {
        id: 70651,
        tarefa: 'SCANNER',
        data_cadastro_tarefa: '2026-09-01T16:42:04.060Z',
        data_abertura: '2026-09-01T16:51:00.000Z',
        data_finalizacao: '2026-09-01T16:51:00.000Z',
        situacao_tarefa: 'FINALIZADA',
      },
      {
        id: 150001,
        tarefa: 'REGISTRO',
        data_cadastro_tarefa: '2026-09-10T16:01:00.000Z',
        data_abertura: '2026-09-10T16:01:00.000Z',
        data_finalizacao: '2026-09-10T16:01:00.000Z',
        situacao_tarefa: 'FINALIZADA',
        dt_retirada: '2026-09-15T00:00:00.000Z',
      },
    ];

    const result = deriveTrajetoria(null, { IsRegistrado: true, IsDevolucao: false, SituacaoPrazo: 'NO PRAZO' }, tarefas);

    expect(result.desfecho).toBe('REGISTRADO');
    expect(result.ultimoSetorNum).toBe(11); // Retirado no Setor 11
    expect(result.ultimoSetorEvidencia).toBe('2026-09-15T00:00:00.000Z');

    const setorMap = new Map(result.setores.map(s => [s.num, s]));
    expect(setorMap.get(7)?.status).toBe('PERCORRIDO');
    expect(setorMap.get(7)?.evidencia).toBe('2026-09-10T16:01:00.000Z');
    expect(setorMap.get(8)?.status).toBe('NAO_APLICAVEL');
    expect(setorMap.get(11)?.status).toBe('ATUAL');
  });

  it('Protocolo 644295: reconhece avanço para Impressão/Preparação e desfecho REGISTRADO mesmo quando tarefas anteriores não tiveram finalizacao registrada', () => {
    const tarefas = [
      {
        id: 155689,
        tarefa: 'QUALIFICAÇÃO',
        data_servico: '2026-09-08T11:04:36.387Z',
        data_cadastro_tarefa: '2026-09-14T11:53:38.573Z',
        data_abertura: null,
        data_finalizacao: null,
        situacao_tarefa: 'AGUARDANDO',
      },
      {
        id: 158004,
        tarefa: 'CÁLCULO DE CUSTAS',
        data_servico: '2026-09-08T11:04:36.387Z',
        data_cadastro_tarefa: '2026-09-17T11:28:17.000Z',
        data_abertura: null,
        data_finalizacao: null,
        situacao_tarefa: 'AGUARDANDO',
      },
      {
        id: 158487,
        tarefa: 'AGUARDANDO PAGAMENTO',
        data_servico: '2026-09-08T11:04:36.387Z',
        data_cadastro_tarefa: '2026-09-18T07:59:04.000Z',
        data_abertura: null,
        data_finalizacao: null,
        situacao_tarefa: 'AGUARDANDO',
      },
      {
        id: 158751,
        tarefa: 'IMPRESSÃO FICHA MATRÍCULA',
        data_servico: '2026-09-08T11:04:36.387Z',
        data_cadastro_tarefa: '2026-09-18T14:51:00.000Z',
        data_abertura: null,
        data_finalizacao: null,
        situacao_tarefa: 'AGUARDANDO',
      },
      {
        id: 159028,
        tarefa: 'PREPARAÇÃO',
        data_servico: '2026-09-08T11:04:36.387Z',
        data_cadastro_tarefa: '2026-09-21T07:22:38.000Z',
        data_abertura: null,
        data_finalizacao: null,
        situacao_tarefa: 'AGUARDANDO',
      },
    ];

    const result = deriveTrajetoria(null, null, tarefas);

    // Como já tem tarefas de Impressão e Preparação, o desfecho é REGISTRADO e o setor atual é Preparação (Setor 10)
    expect(result.desfecho).toBe('REGISTRADO');
    expect(result.ultimoSetorNum).toBe(10);
    expect(result.ultimoSetorEvidencia).toBe('2026-09-21T07:22:38.000Z');

    const setorMap = new Map(result.setores.map(s => [s.num, s]));
    expect(setorMap.get(1)?.status).toBe('PERCORRIDO'); // Entrada
    expect(setorMap.get(10)?.status).toBe('ATUAL');     // Preparação
    expect(setorMap.get(8)?.status).toBe('NAO_APLICAVEL'); // Devolução
  });
});
