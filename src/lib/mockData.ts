export interface BiProtocolo {
  id: string;
  protocolo: string;
  status: 'atrasado' | 'no_prazo' | 'devolvido';
  data: string;
  tipo: string;
}

export const mockDashboardData = {
  kpis: {
    total: {
      value: 126731,
      label: '66932 com Registrado (Cod 6) • 29833 fora da régua geral',
    },
    noPrazo: {
      value: 27760,
      percentage: 41.5,
      label: '27760 títulos dentro do limite legal',
    },
    emAtraso: {
      value: 39172,
      percentage: 58.5,
      label: '39172 títulos entregues fora do prazo',
    },
    devolucoes: {
      value: 5660,
      percentage: 4.5,
      label: '5660 títulos com nota devolutiva na régua geral',
    },
  },
  tabela: [
    {
      id: '1',
      protocolo: '1982736',
      status: 'atrasado',
      data: '2026-08-01',
      tipo: 'Compra e Venda',
    },
    {
      id: '2',
      protocolo: '1982740',
      status: 'atrasado',
      data: '2026-08-02',
      tipo: 'Hipoteca',
    },
    {
      id: '3',
      protocolo: '1982755',
      status: 'devolvido',
      data: '2026-08-03',
      tipo: 'Usucapião',
    },
    {
      id: '4',
      protocolo: '1982790',
      status: 'no_prazo',
      data: '2026-08-05',
      tipo: 'Penhora',
    },
    {
      id: '5',
      protocolo: '1982811',
      status: 'atrasado',
      data: '2026-08-06',
      tipo: 'Compra e Venda',
    },
    {
      id: '6',
      protocolo: '1982822',
      status: 'atrasado',
      data: '2026-08-07',
      tipo: 'Doação',
    },
    {
      id: '7',
      protocolo: '1982833',
      status: 'devolvido',
      data: '2026-08-08',
      tipo: 'Compra e Venda',
    },
  ] as BiProtocolo[],
};
