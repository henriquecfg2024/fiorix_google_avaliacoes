export interface ColaboradorRH {
  id: string;
  nome: string;
  email: string;
  cpf: string;
  setor: "Atendimento" | "Registro" | "Financeiro" | "RH" | "Administração" | "Impressão/Arquivo" | "TI";
  cargo: string;
  p1Inicio: string;
  p1Fim: string;
  p1Dias: number;
  p2Inicio?: string;
  p2Fim?: string;
  p2Dias?: number;
  p3Inicio?: string;
  p3Fim?: string;
  p3Dias?: number;
  totalDias: number;
  status: "planejado" | "pendente" | "conflito" | "publicado";
  observacao?: string;
  historico?: Array<{
    data: string;
    de: string;
    para: string;
    por: string;
    motivo: string;
  }>;
}

// 63 colaboradores oficiais do 7º Registro de Imóveis de SP (Janeiro/2026)
export const MOCK_COLABORADORES_45: ColaboradorRH[] = [
  {
    "id": "col-01",
    "nome": "Alex Nogueira Junior",
    "email": "alex.junior@7risp.com.br",
    "cpf": "***.000.000-01",
    "setor": "Atendimento",
    "cargo": "Auxiliar",
    "p1Inicio": "2027-01-10",
    "p1Fim": "2027-01-29",
    "p1Dias": 20,
    "p2Inicio": "2027-07-05",
    "p2Fim": "2027-07-14",
    "p2Dias": 10,
    "totalDias": 30,
    "status": "publicado",
    "historico": [
      {
        "data": "01/09/2026 10:00",
        "de": "Pendente",
        "para": "20+10 dias",
        "por": "Nadia Najjar (RH)",
        "motivo": "Planejamento anual escala 2027"
      }
    ]
  },
  {
    "id": "col-02",
    "nome": "Amanda Aparecida Gil",
    "email": "amanda.gil@7risp.com.br",
    "cpf": "***.000.000-02",
    "setor": "Registro",
    "cargo": "Escrevente",
    "p1Inicio": "2027-01-15",
    "p1Fim": "2027-02-03",
    "p1Dias": 20,
    "p2Inicio": "2027-08-10",
    "p2Fim": "2027-08-19",
    "p2Dias": 10,
    "totalDias": 30,
    "status": "planejado",
    "historico": [
      {
        "data": "01/09/2026 10:00",
        "de": "Pendente",
        "para": "20+10 dias",
        "por": "Nadia Najjar (RH)",
        "motivo": "Planejamento anual escala 2027"
      }
    ]
  },
  {
    "id": "col-03",
    "nome": "Alisson Azevedo de Lima",
    "email": "alisson.lima@7risp.com.br",
    "cpf": "***.000.000-03",
    "setor": "Atendimento",
    "cargo": "Auxiliar",
    "p1Inicio": "2027-02-01",
    "p1Fim": "2027-02-20",
    "p1Dias": 20,
    "p2Inicio": "2027-09-01",
    "p2Fim": "2027-09-10",
    "p2Dias": 10,
    "totalDias": 30,
    "status": "planejado",
    "historico": [
      {
        "data": "01/09/2026 10:00",
        "de": "Pendente",
        "para": "20+10 dias",
        "por": "Nadia Najjar (RH)",
        "motivo": "Planejamento anual escala 2027"
      }
    ]
  },
  {
    "id": "col-04",
    "nome": "Ana Carolina Roque da Silva",
    "email": "ana.silva@7risp.com.br",
    "cpf": "***.000.000-04",
    "setor": "Atendimento",
    "cargo": "Auxiliar",
    "p1Inicio": "2027-02-15",
    "p1Fim": "2027-03-06",
    "p1Dias": 20,
    "p2Inicio": "2027-10-04",
    "p2Fim": "2027-10-13",
    "p2Dias": 10,
    "totalDias": 30,
    "status": "planejado",
    "historico": [
      {
        "data": "01/09/2026 10:00",
        "de": "Pendente",
        "para": "20+10 dias",
        "por": "Nadia Najjar (RH)",
        "motivo": "Planejamento anual escala 2027"
      }
    ]
  },
  {
    "id": "col-05",
    "nome": "Ander Gleiber de Oliveira Ribeiro",
    "email": "ander.ribeiro@7risp.com.br",
    "cpf": "***.000.000-05",
    "setor": "Registro",
    "cargo": "Escrevente",
    "p1Inicio": "2027-03-01",
    "p1Fim": "2027-03-20",
    "p1Dias": 20,
    "p2Inicio": "2027-11-01",
    "p2Fim": "2027-11-10",
    "p2Dias": 10,
    "totalDias": 30,
    "status": "planejado",
    "historico": [
      {
        "data": "01/09/2026 10:00",
        "de": "Pendente",
        "para": "20+10 dias",
        "por": "Nadia Najjar (RH)",
        "motivo": "Planejamento anual escala 2027"
      }
    ]
  },
  {
    "id": "col-06",
    "nome": "Andreia Zaramella",
    "email": "andreia.zaramella@7risp.com.br",
    "cpf": "***.000.000-06",
    "setor": "Registro",
    "cargo": "Escrevente",
    "p1Inicio": "2027-03-15",
    "p1Fim": "2027-04-03",
    "p1Dias": 20,
    "p2Inicio": "2027-09-15",
    "p2Fim": "2027-09-24",
    "p2Dias": 10,
    "totalDias": 30,
    "status": "planejado",
    "historico": [
      {
        "data": "01/09/2026 10:00",
        "de": "Pendente",
        "para": "20+10 dias",
        "por": "Nadia Najjar (RH)",
        "motivo": "Planejamento anual escala 2027"
      }
    ]
  },
  {
    "id": "col-07",
    "nome": "Anne Caroline Araujo de Lima",
    "email": "anne.lima@7risp.com.br",
    "cpf": "***.000.000-07",
    "setor": "Atendimento",
    "cargo": "Auxiliar",
    "p1Inicio": "2027-04-05",
    "p1Fim": "2027-04-24",
    "p1Dias": 20,
    "p2Inicio": "2027-10-18",
    "p2Fim": "2027-10-27",
    "p2Dias": 10,
    "totalDias": 30,
    "status": "planejado",
    "historico": [
      {
        "data": "01/09/2026 10:00",
        "de": "Pendente",
        "para": "20+10 dias",
        "por": "Nadia Najjar (RH)",
        "motivo": "Planejamento anual escala 2027"
      }
    ]
  },
  {
    "id": "col-08",
    "nome": "Antonio Carlos Belato Câmara",
    "email": "antonio.camara@7risp.com.br",
    "cpf": "***.000.000-08",
    "setor": "Administração",
    "cargo": "Oficial Substituto (§ 4º)",
    "p1Inicio": "2027-04-19",
    "p1Fim": "2027-05-08",
    "p1Dias": 20,
    "p2Inicio": "2027-11-15",
    "p2Fim": "2027-11-24",
    "p2Dias": 10,
    "totalDias": 30,
    "status": "publicado",
    "historico": [
      {
        "data": "01/09/2026 10:00",
        "de": "Pendente",
        "para": "20+10 dias",
        "por": "Nadia Najjar (RH)",
        "motivo": "Planejamento anual escala 2027"
      }
    ]
  },
  {
    "id": "col-09",
    "nome": "Antonio Carlos Ramos de Paula",
    "email": "antonio.paula@7risp.com.br",
    "cpf": "***.000.000-09",
    "setor": "Impressão/Arquivo",
    "cargo": "Auxiliar",
    "p1Inicio": "2027-05-03",
    "p1Fim": "2027-05-22",
    "p1Dias": 20,
    "p2Inicio": "2027-12-01",
    "p2Fim": "2027-12-10",
    "p2Dias": 10,
    "totalDias": 30,
    "status": "planejado",
    "historico": [
      {
        "data": "01/09/2026 10:00",
        "de": "Pendente",
        "para": "20+10 dias",
        "por": "Nadia Najjar (RH)",
        "motivo": "Planejamento anual escala 2027"
      }
    ]
  },
  {
    "id": "col-10",
    "nome": "Aparecida Maria da Silva Pires",
    "email": "aparecida.pires@7risp.com.br",
    "cpf": "***.000.000-10",
    "setor": "Atendimento",
    "cargo": "Auxiliar",
    "p1Inicio": "2027-05-17",
    "p1Fim": "2027-06-05",
    "p1Dias": 20,
    "p2Inicio": "2027-10-10",
    "p2Fim": "2027-10-19",
    "p2Dias": 10,
    "totalDias": 30,
    "status": "planejado",
    "historico": [
      {
        "data": "01/09/2026 10:00",
        "de": "Pendente",
        "para": "20+10 dias",
        "por": "Nadia Najjar (RH)",
        "motivo": "Planejamento anual escala 2027"
      }
    ]
  },
  {
    "id": "col-11",
    "nome": "Bruno Alves Santos",
    "email": "bruno.santos@7risp.com.br",
    "cpf": "***.000.000-11",
    "setor": "Atendimento",
    "cargo": "Auxiliar",
    "p1Inicio": "2027-06-01",
    "p1Fim": "2027-06-30",
    "p1Dias": 30,
    "totalDias": 30,
    "status": "planejado",
    "historico": [
      {
        "data": "01/09/2026 10:00",
        "de": "Pendente",
        "para": "30 dias",
        "por": "Nadia Najjar (RH)",
        "motivo": "Planejamento anual escala 2027"
      }
    ]
  },
  {
    "id": "col-12",
    "nome": "Claudio Donizetti Ferreira da Silva",
    "email": "claudio.silva@7risp.com.br",
    "cpf": "***.000.000-12",
    "setor": "Administração",
    "cargo": "Oficial Substituto (§ 5º)",
    "p1Inicio": "2027-06-14",
    "p1Fim": "2027-07-03",
    "p1Dias": 20,
    "p2Inicio": "2027-11-20",
    "p2Fim": "2027-11-29",
    "p2Dias": 10,
    "totalDias": 30,
    "status": "planejado",
    "historico": [
      {
        "data": "01/09/2026 10:00",
        "de": "Pendente",
        "para": "20+10 dias",
        "por": "Nadia Najjar (RH)",
        "motivo": "Planejamento anual escala 2027"
      }
    ]
  },
  {
    "id": "col-13",
    "nome": "Clayton Nobre Vasconcellos",
    "email": "clayton.vasconcellos@7risp.com.br",
    "cpf": "***.000.000-13",
    "setor": "Registro",
    "cargo": "Escrevente",
    "p1Inicio": "2027-07-01",
    "p1Fim": "2027-07-30",
    "p1Dias": 30,
    "totalDias": 30,
    "status": "planejado",
    "historico": [
      {
        "data": "01/09/2026 10:00",
        "de": "Pendente",
        "para": "30 dias",
        "por": "Nadia Najjar (RH)",
        "motivo": "Planejamento anual escala 2027"
      }
    ]
  },
  {
    "id": "col-14",
    "nome": "Clayton Silva de Souza",
    "email": "clayton.souza@7risp.com.br",
    "cpf": "***.000.000-14",
    "setor": "Registro",
    "cargo": "Escrevente",
    "p1Inicio": "2027-07-15",
    "p1Fim": "2027-08-03",
    "p1Dias": 20,
    "p2Inicio": "2027-12-06",
    "p2Fim": "2027-12-15",
    "p2Dias": 10,
    "totalDias": 30,
    "status": "planejado",
    "historico": [
      {
        "data": "01/09/2026 10:00",
        "de": "Pendente",
        "para": "20+10 dias",
        "por": "Nadia Najjar (RH)",
        "motivo": "Planejamento anual escala 2027"
      }
    ]
  },
  {
    "id": "col-15",
    "nome": "Clivio Andrade de Araujo",
    "email": "clivio.araujo@7risp.com.br",
    "cpf": "***.000.000-15",
    "setor": "Atendimento",
    "cargo": "Auxiliar",
    "p1Inicio": "2027-08-02",
    "p1Fim": "2027-08-21",
    "p1Dias": 20,
    "p2Inicio": "2027-12-10",
    "p2Fim": "2027-12-19",
    "p2Dias": 10,
    "totalDias": 30,
    "status": "publicado",
    "historico": [
      {
        "data": "01/09/2026 10:00",
        "de": "Pendente",
        "para": "20+10 dias",
        "por": "Nadia Najjar (RH)",
        "motivo": "Planejamento anual escala 2027"
      }
    ]
  },
  {
    "id": "col-16",
    "nome": "Cristiane Falanga",
    "email": "cristiane.falanga@7risp.com.br",
    "cpf": "***.000.000-16",
    "setor": "Registro",
    "cargo": "Escrevente",
    "p1Inicio": "2027-08-16",
    "p1Fim": "2027-09-04",
    "p1Dias": 20,
    "p2Inicio": "2027-11-05",
    "p2Fim": "2027-11-14",
    "p2Dias": 10,
    "totalDias": 30,
    "status": "planejado",
    "historico": [
      {
        "data": "01/09/2026 10:00",
        "de": "Pendente",
        "para": "20+10 dias",
        "por": "Nadia Najjar (RH)",
        "motivo": "Planejamento anual escala 2027"
      }
    ]
  },
  {
    "id": "col-17",
    "nome": "Cristiane Pinheiro Baptista Vieira",
    "email": "cristiane.vieira@7risp.com.br",
    "cpf": "***.000.000-17",
    "setor": "Registro",
    "cargo": "Escrevente",
    "p1Inicio": "2027-09-01",
    "p1Fim": "2027-09-30",
    "p1Dias": 30,
    "totalDias": 30,
    "status": "planejado",
    "historico": [
      {
        "data": "01/09/2026 10:00",
        "de": "Pendente",
        "para": "30 dias",
        "por": "Nadia Najjar (RH)",
        "motivo": "Planejamento anual escala 2027"
      }
    ]
  },
  {
    "id": "col-18",
    "nome": "Cristiano Vesentini Neves Caldeiras",
    "email": "cristiano.caldeiras@7risp.com.br",
    "cpf": "***.000.000-18",
    "setor": "Registro",
    "cargo": "Escrevente",
    "p1Inicio": "2027-09-13",
    "p1Fim": "2027-10-02",
    "p1Dias": 20,
    "p2Inicio": "2027-12-13",
    "p2Fim": "2027-12-22",
    "p2Dias": 10,
    "totalDias": 30,
    "status": "planejado",
    "historico": [
      {
        "data": "01/09/2026 10:00",
        "de": "Pendente",
        "para": "20+10 dias",
        "por": "Nadia Najjar (RH)",
        "motivo": "Planejamento anual escala 2027"
      }
    ]
  },
  {
    "id": "col-19",
    "nome": "Daniela Martinez Salvino",
    "email": "daniela.salvino@7risp.com.br",
    "cpf": "***.000.000-19",
    "setor": "Atendimento",
    "cargo": "Auxiliar",
    "p1Inicio": "2027-10-01",
    "p1Fim": "2027-10-30",
    "p1Dias": 30,
    "totalDias": 30,
    "status": "planejado",
    "historico": [
      {
        "data": "01/09/2026 10:00",
        "de": "Pendente",
        "para": "30 dias",
        "por": "Nadia Najjar (RH)",
        "motivo": "Planejamento anual escala 2027"
      }
    ]
  },
  {
    "id": "col-20",
    "nome": "David Bruno Francisco Comunian dos Santos",
    "email": "david.santos@7risp.com.br",
    "cpf": "***.000.000-20",
    "setor": "Registro",
    "cargo": "Escrevente",
    "p1Inicio": "2027-11-01",
    "p1Fim": "2027-11-30",
    "p1Dias": 30,
    "totalDias": 30,
    "status": "planejado",
    "historico": [
      {
        "data": "01/09/2026 10:00",
        "de": "Pendente",
        "para": "30 dias",
        "por": "Nadia Najjar (RH)",
        "motivo": "Planejamento anual escala 2027"
      }
    ]
  },
  {
    "id": "col-21",
    "nome": "David Coutinho da Silva",
    "email": "david.silva@7risp.com.br",
    "cpf": "***.000.000-21",
    "setor": "Impressão/Arquivo",
    "cargo": "Auxiliar",
    "p1Inicio": "2027-12-01",
    "p1Fim": "2027-12-30",
    "p1Dias": 30,
    "totalDias": 30,
    "status": "planejado",
    "historico": [
      {
        "data": "01/09/2026 10:00",
        "de": "Pendente",
        "para": "30 dias",
        "por": "Nadia Najjar (RH)",
        "motivo": "Planejamento anual escala 2027"
      }
    ]
  },
  {
    "id": "col-22",
    "nome": "Diego Silva de Souza Moura",
    "email": "diego.moura@7risp.com.br",
    "cpf": "***.000.000-22",
    "setor": "Registro",
    "cargo": "Escrevente",
    "p1Inicio": "2027-01-10",
    "p1Fim": "2027-01-29",
    "p1Dias": 20,
    "p2Inicio": "2027-07-05",
    "p2Fim": "2027-07-14",
    "p2Dias": 10,
    "totalDias": 30,
    "status": "publicado",
    "historico": [
      {
        "data": "01/09/2026 10:00",
        "de": "Pendente",
        "para": "20+10 dias",
        "por": "Nadia Najjar (RH)",
        "motivo": "Planejamento anual escala 2027"
      }
    ]
  },
  {
    "id": "col-23",
    "nome": "Eduardo Marino Cavalhieri",
    "email": "eduardo.cavalhieri@7risp.com.br",
    "cpf": "***.000.000-23",
    "setor": "Registro",
    "cargo": "Escrevente",
    "p1Inicio": "2027-01-15",
    "p1Fim": "2027-02-03",
    "p1Dias": 20,
    "p2Inicio": "2027-08-10",
    "p2Fim": "2027-08-19",
    "p2Dias": 10,
    "totalDias": 30,
    "status": "planejado",
    "historico": [
      {
        "data": "01/09/2026 10:00",
        "de": "Pendente",
        "para": "20+10 dias",
        "por": "Nadia Najjar (RH)",
        "motivo": "Planejamento anual escala 2027"
      }
    ]
  },
  {
    "id": "col-24",
    "nome": "Elaine Fioranelli Samara",
    "email": "elaine.samara@7risp.com.br",
    "cpf": "***.000.000-24",
    "setor": "Administração",
    "cargo": "Oficial Substituto (§ 4º)",
    "p1Inicio": "2027-02-01",
    "p1Fim": "2027-02-20",
    "p1Dias": 20,
    "p2Inicio": "2027-09-01",
    "p2Fim": "2027-09-10",
    "p2Dias": 10,
    "totalDias": 30,
    "status": "planejado",
    "historico": [
      {
        "data": "01/09/2026 10:00",
        "de": "Pendente",
        "para": "20+10 dias",
        "por": "Nadia Najjar (RH)",
        "motivo": "Planejamento anual escala 2027"
      }
    ]
  },
  {
    "id": "col-25",
    "nome": "Felipe Miniuchi",
    "email": "felipe.miniuchi@7risp.com.br",
    "cpf": "***.000.000-25",
    "setor": "Registro",
    "cargo": "Escrevente",
    "p1Inicio": "2027-02-15",
    "p1Fim": "2027-03-06",
    "p1Dias": 20,
    "p2Inicio": "2027-10-04",
    "p2Fim": "2027-10-13",
    "p2Dias": 10,
    "totalDias": 30,
    "status": "planejado",
    "historico": [
      {
        "data": "01/09/2026 10:00",
        "de": "Pendente",
        "para": "20+10 dias",
        "por": "Nadia Najjar (RH)",
        "motivo": "Planejamento anual escala 2027"
      }
    ]
  },
  {
    "id": "col-26",
    "nome": "Francisco Caninde Martins",
    "email": "francisco.martins@7risp.com.br",
    "cpf": "***.000.000-26",
    "setor": "Impressão/Arquivo",
    "cargo": "Auxiliar",
    "p1Inicio": "2027-03-01",
    "p1Fim": "2027-03-20",
    "p1Dias": 20,
    "p2Inicio": "2027-11-01",
    "p2Fim": "2027-11-10",
    "p2Dias": 10,
    "totalDias": 30,
    "status": "planejado",
    "historico": [
      {
        "data": "01/09/2026 10:00",
        "de": "Pendente",
        "para": "20+10 dias",
        "por": "Nadia Najjar (RH)",
        "motivo": "Planejamento anual escala 2027"
      }
    ]
  },
  {
    "id": "col-27",
    "nome": "Guilherme Mancio da Silva",
    "email": "guilherme.silva@7risp.com.br",
    "cpf": "***.000.000-27",
    "setor": "Registro",
    "cargo": "Escrevente",
    "p1Inicio": "2027-03-15",
    "p1Fim": "2027-04-03",
    "p1Dias": 20,
    "p2Inicio": "2027-09-15",
    "p2Fim": "2027-09-24",
    "p2Dias": 10,
    "totalDias": 30,
    "status": "planejado",
    "historico": [
      {
        "data": "01/09/2026 10:00",
        "de": "Pendente",
        "para": "20+10 dias",
        "por": "Nadia Najjar (RH)",
        "motivo": "Planejamento anual escala 2027"
      }
    ]
  },
  {
    "id": "col-28",
    "nome": "Henrique Cesar Ferreira Gama",
    "email": "henrique.gama@7risp.com.br",
    "cpf": "***.000.000-28",
    "setor": "TI",
    "cargo": "Escrevente - Gestor de TI",
    "p1Inicio": "2027-04-05",
    "p1Fim": "2027-04-24",
    "p1Dias": 20,
    "p2Inicio": "2027-10-18",
    "p2Fim": "2027-10-27",
    "p2Dias": 10,
    "totalDias": 30,
    "status": "planejado",
    "historico": [
      {
        "data": "01/09/2026 10:00",
        "de": "Pendente",
        "para": "20+10 dias",
        "por": "Nadia Najjar (RH)",
        "motivo": "Planejamento anual escala 2027"
      }
    ]
  },
  {
    "id": "col-29",
    "nome": "Iasmim Cristina Cambuy",
    "email": "iasmim.cambuy@7risp.com.br",
    "cpf": "***.000.000-29",
    "setor": "Atendimento",
    "cargo": "Auxiliar",
    "p1Inicio": "2027-04-19",
    "p1Fim": "2027-05-08",
    "p1Dias": 20,
    "p2Inicio": "2027-11-15",
    "p2Fim": "2027-11-24",
    "p2Dias": 10,
    "totalDias": 30,
    "status": "publicado",
    "historico": [
      {
        "data": "01/09/2026 10:00",
        "de": "Pendente",
        "para": "20+10 dias",
        "por": "Nadia Najjar (RH)",
        "motivo": "Planejamento anual escala 2027"
      }
    ]
  },
  {
    "id": "col-30",
    "nome": "Ildo Bezerra dos Santos",
    "email": "ildo.santos@7risp.com.br",
    "cpf": "***.000.000-30",
    "setor": "Atendimento",
    "cargo": "Auxiliar",
    "p1Inicio": "2027-05-03",
    "p1Fim": "2027-05-22",
    "p1Dias": 20,
    "p2Inicio": "2027-12-01",
    "p2Fim": "2027-12-10",
    "p2Dias": 10,
    "totalDias": 30,
    "status": "planejado",
    "historico": [
      {
        "data": "01/09/2026 10:00",
        "de": "Pendente",
        "para": "20+10 dias",
        "por": "Nadia Najjar (RH)",
        "motivo": "Planejamento anual escala 2027"
      }
    ]
  },
  {
    "id": "col-31",
    "nome": "Jean Carlos Cioconi da Costa",
    "email": "jean.costa@7risp.com.br",
    "cpf": "***.000.000-31",
    "setor": "Impressão/Arquivo",
    "cargo": "Auxiliar",
    "p1Inicio": "2027-05-17",
    "p1Fim": "2027-06-05",
    "p1Dias": 20,
    "p2Inicio": "2027-10-10",
    "p2Fim": "2027-10-19",
    "p2Dias": 10,
    "totalDias": 30,
    "status": "planejado",
    "historico": [
      {
        "data": "01/09/2026 10:00",
        "de": "Pendente",
        "para": "20+10 dias",
        "por": "Nadia Najjar (RH)",
        "motivo": "Planejamento anual escala 2027"
      }
    ]
  },
  {
    "id": "col-32",
    "nome": "Jonatan Lima",
    "email": "jonatan.lima@7risp.com.br",
    "cpf": "***.000.000-32",
    "setor": "Atendimento",
    "cargo": "Auxiliar",
    "p1Inicio": "2027-06-01",
    "p1Fim": "2027-06-30",
    "p1Dias": 30,
    "totalDias": 30,
    "status": "planejado",
    "historico": [
      {
        "data": "01/09/2026 10:00",
        "de": "Pendente",
        "para": "30 dias",
        "por": "Nadia Najjar (RH)",
        "motivo": "Planejamento anual escala 2027"
      }
    ]
  },
  {
    "id": "col-33",
    "nome": "Jozilene Vaccari",
    "email": "jozilene.vaccari@7risp.com.br",
    "cpf": "***.000.000-33",
    "setor": "Atendimento",
    "cargo": "Auxiliar",
    "p1Inicio": "2027-06-14",
    "p1Fim": "2027-07-03",
    "p1Dias": 20,
    "p2Inicio": "2027-11-20",
    "p2Fim": "2027-11-29",
    "p2Dias": 10,
    "totalDias": 30,
    "status": "planejado",
    "historico": [
      {
        "data": "01/09/2026 10:00",
        "de": "Pendente",
        "para": "20+10 dias",
        "por": "Nadia Najjar (RH)",
        "motivo": "Planejamento anual escala 2027"
      }
    ]
  },
  {
    "id": "col-34",
    "nome": "João Pedro Santana Silva",
    "email": "joao.silva@7risp.com.br",
    "cpf": "***.000.000-34",
    "setor": "Atendimento",
    "cargo": "Auxiliar",
    "p1Inicio": "2027-07-01",
    "p1Fim": "2027-07-30",
    "p1Dias": 30,
    "totalDias": 30,
    "status": "planejado",
    "historico": [
      {
        "data": "01/09/2026 10:00",
        "de": "Pendente",
        "para": "30 dias",
        "por": "Nadia Najjar (RH)",
        "motivo": "Planejamento anual escala 2027"
      }
    ]
  },
  {
    "id": "col-35",
    "nome": "Juliana Alves Bezerra",
    "email": "juliana.bezerra@7risp.com.br",
    "cpf": "***.000.000-35",
    "setor": "Atendimento",
    "cargo": "Auxiliar",
    "p1Inicio": "2027-07-15",
    "p1Fim": "2027-08-03",
    "p1Dias": 20,
    "p2Inicio": "2027-12-06",
    "p2Fim": "2027-12-15",
    "p2Dias": 10,
    "totalDias": 30,
    "status": "planejado",
    "historico": [
      {
        "data": "01/09/2026 10:00",
        "de": "Pendente",
        "para": "20+10 dias",
        "por": "Nadia Najjar (RH)",
        "motivo": "Planejamento anual escala 2027"
      }
    ]
  },
  {
    "id": "col-36",
    "nome": "Lucas Martins Gonçalves",
    "email": "lucas.goncalves@7risp.com.br",
    "cpf": "***.000.000-36",
    "setor": "Registro",
    "cargo": "Escrevente",
    "p1Inicio": "2027-08-02",
    "p1Fim": "2027-08-21",
    "p1Dias": 20,
    "p2Inicio": "2027-12-10",
    "p2Fim": "2027-12-19",
    "p2Dias": 10,
    "totalDias": 30,
    "status": "publicado",
    "historico": [
      {
        "data": "01/09/2026 10:00",
        "de": "Pendente",
        "para": "20+10 dias",
        "por": "Nadia Najjar (RH)",
        "motivo": "Planejamento anual escala 2027"
      }
    ]
  },
  {
    "id": "col-37",
    "nome": "Leandro Jorge dos Santos",
    "email": "leandro.santos@7risp.com.br",
    "cpf": "***.000.000-37",
    "setor": "Registro",
    "cargo": "Escrevente",
    "p1Inicio": "2027-08-16",
    "p1Fim": "2027-09-04",
    "p1Dias": 20,
    "p2Inicio": "2027-11-05",
    "p2Fim": "2027-11-14",
    "p2Dias": 10,
    "totalDias": 30,
    "status": "planejado",
    "historico": [
      {
        "data": "01/09/2026 10:00",
        "de": "Pendente",
        "para": "20+10 dias",
        "por": "Nadia Najjar (RH)",
        "motivo": "Planejamento anual escala 2027"
      }
    ]
  },
  {
    "id": "col-38",
    "nome": "Luis Carlos Lopes de Almeida",
    "email": "luis.almeida@7risp.com.br",
    "cpf": "***.000.000-38",
    "setor": "Impressão/Arquivo",
    "cargo": "Auxiliar",
    "p1Inicio": "2027-09-01",
    "p1Fim": "2027-09-30",
    "p1Dias": 30,
    "totalDias": 30,
    "status": "planejado",
    "historico": [
      {
        "data": "01/09/2026 10:00",
        "de": "Pendente",
        "para": "30 dias",
        "por": "Nadia Najjar (RH)",
        "motivo": "Planejamento anual escala 2027"
      }
    ]
  },
  {
    "id": "col-39",
    "nome": "Marcia Pinheiro Baptista",
    "email": "marcia.baptista@7risp.com.br",
    "cpf": "***.000.000-39",
    "setor": "Registro",
    "cargo": "Escrevente",
    "p1Inicio": "2027-09-13",
    "p1Fim": "2027-10-02",
    "p1Dias": 20,
    "p2Inicio": "2027-12-13",
    "p2Fim": "2027-12-22",
    "p2Dias": 10,
    "totalDias": 30,
    "status": "planejado",
    "historico": [
      {
        "data": "01/09/2026 10:00",
        "de": "Pendente",
        "para": "20+10 dias",
        "por": "Nadia Najjar (RH)",
        "motivo": "Planejamento anual escala 2027"
      }
    ]
  },
  {
    "id": "col-40",
    "nome": "Marcus Vinicius de Souza Brito",
    "email": "marcus.brito@7risp.com.br",
    "cpf": "***.000.000-40",
    "setor": "Administração",
    "cargo": "Oficial Substituto (§ 4º)",
    "p1Inicio": "2027-10-01",
    "p1Fim": "2027-10-30",
    "p1Dias": 30,
    "totalDias": 30,
    "status": "planejado",
    "historico": [
      {
        "data": "01/09/2026 10:00",
        "de": "Pendente",
        "para": "30 dias",
        "por": "Nadia Najjar (RH)",
        "motivo": "Planejamento anual escala 2027"
      }
    ]
  },
  {
    "id": "col-41",
    "nome": "Miguel Augusto Hadad Leite",
    "email": "miguel.leite@7risp.com.br",
    "cpf": "***.000.000-41",
    "setor": "Registro",
    "cargo": "Escrevente",
    "p1Inicio": "2027-11-01",
    "p1Fim": "2027-11-30",
    "p1Dias": 30,
    "totalDias": 30,
    "status": "planejado",
    "historico": [
      {
        "data": "01/09/2026 10:00",
        "de": "Pendente",
        "para": "30 dias",
        "por": "Nadia Najjar (RH)",
        "motivo": "Planejamento anual escala 2027"
      }
    ]
  },
  {
    "id": "col-42",
    "nome": "Nadia Najjar",
    "email": "nadia.najjar@7risp.com.br",
    "cpf": "***.000.000-42",
    "setor": "RH",
    "cargo": "Auxiliar - Gestora de RH",
    "p1Inicio": "2027-12-01",
    "p1Fim": "2027-12-30",
    "p1Dias": 30,
    "totalDias": 30,
    "status": "planejado",
    "historico": [
      {
        "data": "01/09/2026 10:00",
        "de": "Pendente",
        "para": "30 dias",
        "por": "Nadia Najjar (RH)",
        "motivo": "Planejamento anual escala 2027"
      }
    ]
  },
  {
    "id": "col-43",
    "nome": "Paula Cristina Souza Morais",
    "email": "paula.morais@7risp.com.br",
    "cpf": "***.000.000-43",
    "setor": "Registro",
    "cargo": "Escrevente",
    "p1Inicio": "2027-01-10",
    "p1Fim": "2027-01-29",
    "p1Dias": 20,
    "p2Inicio": "2027-07-05",
    "p2Fim": "2027-07-14",
    "p2Dias": 10,
    "totalDias": 30,
    "status": "publicado",
    "historico": [
      {
        "data": "01/09/2026 10:00",
        "de": "Pendente",
        "para": "20+10 dias",
        "por": "Nadia Najjar (RH)",
        "motivo": "Planejamento anual escala 2027"
      }
    ]
  },
  {
    "id": "col-44",
    "nome": "Rafael Henrique Collim Placidino",
    "email": "rafael.placidino@7risp.com.br",
    "cpf": "***.000.000-44",
    "setor": "Registro",
    "cargo": "Escrevente",
    "p1Inicio": "2027-01-15",
    "p1Fim": "2027-02-03",
    "p1Dias": 20,
    "p2Inicio": "2027-08-10",
    "p2Fim": "2027-08-19",
    "p2Dias": 10,
    "totalDias": 30,
    "status": "planejado",
    "historico": [
      {
        "data": "01/09/2026 10:00",
        "de": "Pendente",
        "para": "20+10 dias",
        "por": "Nadia Najjar (RH)",
        "motivo": "Planejamento anual escala 2027"
      }
    ]
  },
  {
    "id": "col-45",
    "nome": "Raquel Nicole Massafera Botas",
    "email": "raquel.botas@7risp.com.br",
    "cpf": "***.000.000-45",
    "setor": "Atendimento",
    "cargo": "Auxiliar",
    "p1Inicio": "2027-02-01",
    "p1Fim": "2027-02-20",
    "p1Dias": 20,
    "p2Inicio": "2027-09-01",
    "p2Fim": "2027-09-10",
    "p2Dias": 10,
    "totalDias": 30,
    "status": "planejado",
    "historico": [
      {
        "data": "01/09/2026 10:00",
        "de": "Pendente",
        "para": "20+10 dias",
        "por": "Nadia Najjar (RH)",
        "motivo": "Planejamento anual escala 2027"
      }
    ]
  },
  {
    "id": "col-46",
    "nome": "Renan Barros de Sousa",
    "email": "renan.sousa@7risp.com.br",
    "cpf": "***.000.000-46",
    "setor": "Registro",
    "cargo": "Escrevente",
    "p1Inicio": "2027-02-15",
    "p1Fim": "2027-03-06",
    "p1Dias": 20,
    "p2Inicio": "2027-10-04",
    "p2Fim": "2027-10-13",
    "p2Dias": 10,
    "totalDias": 30,
    "status": "planejado",
    "historico": [
      {
        "data": "01/09/2026 10:00",
        "de": "Pendente",
        "para": "20+10 dias",
        "por": "Nadia Najjar (RH)",
        "motivo": "Planejamento anual escala 2027"
      }
    ]
  },
  {
    "id": "col-47",
    "nome": "Ricardo Isidoro da Fonseca",
    "email": "ricardo.fonseca@7risp.com.br",
    "cpf": "***.000.000-47",
    "setor": "Atendimento",
    "cargo": "Auxiliar",
    "p1Inicio": "2027-03-01",
    "p1Fim": "2027-03-20",
    "p1Dias": 20,
    "p2Inicio": "2027-11-01",
    "p2Fim": "2027-11-10",
    "p2Dias": 10,
    "totalDias": 30,
    "status": "planejado",
    "historico": [
      {
        "data": "01/09/2026 10:00",
        "de": "Pendente",
        "para": "20+10 dias",
        "por": "Nadia Najjar (RH)",
        "motivo": "Planejamento anual escala 2027"
      }
    ]
  },
  {
    "id": "col-48",
    "nome": "Ricardo Pereira Marçal",
    "email": "ricardo.marcal@7risp.com.br",
    "cpf": "***.000.000-48",
    "setor": "Atendimento",
    "cargo": "Auxiliar",
    "p1Inicio": "2027-03-15",
    "p1Fim": "2027-04-03",
    "p1Dias": 20,
    "p2Inicio": "2027-09-15",
    "p2Fim": "2027-09-24",
    "p2Dias": 10,
    "totalDias": 30,
    "status": "planejado",
    "historico": [
      {
        "data": "01/09/2026 10:00",
        "de": "Pendente",
        "para": "20+10 dias",
        "por": "Nadia Najjar (RH)",
        "motivo": "Planejamento anual escala 2027"
      }
    ]
  },
  {
    "id": "col-49",
    "nome": "Sonia Fioranelli",
    "email": "sonia.fioranelli@7risp.com.br",
    "cpf": "***.000.000-49",
    "setor": "Administração",
    "cargo": "Oficial Substituto (§ 4º)",
    "p1Inicio": "2027-04-05",
    "p1Fim": "2027-04-24",
    "p1Dias": 20,
    "p2Inicio": "2027-10-18",
    "p2Fim": "2027-10-27",
    "p2Dias": 10,
    "totalDias": 30,
    "status": "planejado",
    "historico": [
      {
        "data": "01/09/2026 10:00",
        "de": "Pendente",
        "para": "20+10 dias",
        "por": "Nadia Najjar (RH)",
        "motivo": "Planejamento anual escala 2027"
      }
    ]
  },
  {
    "id": "col-50",
    "nome": "Sara Regina Serem Calçada",
    "email": "sara.calcada@7risp.com.br",
    "cpf": "***.000.000-50",
    "setor": "Atendimento",
    "cargo": "Auxiliar",
    "p1Inicio": "2027-04-19",
    "p1Fim": "2027-05-08",
    "p1Dias": 20,
    "p2Inicio": "2027-11-15",
    "p2Fim": "2027-11-24",
    "p2Dias": 10,
    "totalDias": 30,
    "status": "publicado",
    "historico": [
      {
        "data": "01/09/2026 10:00",
        "de": "Pendente",
        "para": "20+10 dias",
        "por": "Nadia Najjar (RH)",
        "motivo": "Planejamento anual escala 2027"
      }
    ]
  },
  {
    "id": "col-51",
    "nome": "Tatiana Martins da Silva",
    "email": "tatiana.silva@7risp.com.br",
    "cpf": "***.000.000-51",
    "setor": "Registro",
    "cargo": "Escrevente",
    "p1Inicio": "2027-05-03",
    "p1Fim": "2027-05-22",
    "p1Dias": 20,
    "p2Inicio": "2027-12-01",
    "p2Fim": "2027-12-10",
    "p2Dias": 10,
    "totalDias": 30,
    "status": "planejado",
    "historico": [
      {
        "data": "01/09/2026 10:00",
        "de": "Pendente",
        "para": "20+10 dias",
        "por": "Nadia Najjar (RH)",
        "motivo": "Planejamento anual escala 2027"
      }
    ]
  },
  {
    "id": "col-52",
    "nome": "Thiago de Oliveira Silva",
    "email": "thiago.silva@7risp.com.br",
    "cpf": "***.000.000-52",
    "setor": "Atendimento",
    "cargo": "Auxiliar",
    "p1Inicio": "2027-05-17",
    "p1Fim": "2027-06-05",
    "p1Dias": 20,
    "p2Inicio": "2027-10-10",
    "p2Fim": "2027-10-19",
    "p2Dias": 10,
    "totalDias": 30,
    "status": "planejado",
    "historico": [
      {
        "data": "01/09/2026 10:00",
        "de": "Pendente",
        "para": "20+10 dias",
        "por": "Nadia Najjar (RH)",
        "motivo": "Planejamento anual escala 2027"
      }
    ]
  },
  {
    "id": "col-53",
    "nome": "Vanderlei Matheus Rodrigues",
    "email": "vanderlei.rodrigues@7risp.com.br",
    "cpf": "***.000.000-53",
    "setor": "Atendimento",
    "cargo": "Auxiliar",
    "p1Inicio": "2027-06-01",
    "p1Fim": "2027-06-30",
    "p1Dias": 30,
    "totalDias": 30,
    "status": "planejado",
    "historico": [
      {
        "data": "01/09/2026 10:00",
        "de": "Pendente",
        "para": "30 dias",
        "por": "Nadia Najjar (RH)",
        "motivo": "Planejamento anual escala 2027"
      }
    ]
  },
  {
    "id": "col-54",
    "nome": "Vinicius Borçanelli Ponteli",
    "email": "vinicius.ponteli@7risp.com.br",
    "cpf": "***.000.000-54",
    "setor": "Registro",
    "cargo": "Escrevente",
    "p1Inicio": "2027-06-14",
    "p1Fim": "2027-07-03",
    "p1Dias": 20,
    "p2Inicio": "2027-11-20",
    "p2Fim": "2027-11-29",
    "p2Dias": 10,
    "totalDias": 30,
    "status": "planejado",
    "historico": [
      {
        "data": "01/09/2026 10:00",
        "de": "Pendente",
        "para": "20+10 dias",
        "por": "Nadia Najjar (RH)",
        "motivo": "Planejamento anual escala 2027"
      }
    ]
  },
  {
    "id": "col-55",
    "nome": "Vinicius Theodoro de Souza",
    "email": "vinicius.souza@7risp.com.br",
    "cpf": "***.000.000-55",
    "setor": "Registro",
    "cargo": "Escrevente",
    "p1Inicio": "2027-07-01",
    "p1Fim": "2027-07-30",
    "p1Dias": 30,
    "totalDias": 30,
    "status": "planejado",
    "historico": [
      {
        "data": "01/09/2026 10:00",
        "de": "Pendente",
        "para": "30 dias",
        "por": "Nadia Najjar (RH)",
        "motivo": "Planejamento anual escala 2027"
      }
    ]
  },
  {
    "id": "col-56",
    "nome": "Vitor Damacena Pereira",
    "email": "vitor.pereira@7risp.com.br",
    "cpf": "***.000.000-56",
    "setor": "Registro",
    "cargo": "Escrevente",
    "p1Inicio": "2027-07-15",
    "p1Fim": "2027-08-03",
    "p1Dias": 20,
    "p2Inicio": "2027-12-06",
    "p2Fim": "2027-12-15",
    "p2Dias": 10,
    "totalDias": 30,
    "status": "planejado",
    "historico": [
      {
        "data": "01/09/2026 10:00",
        "de": "Pendente",
        "para": "20+10 dias",
        "por": "Nadia Najjar (RH)",
        "motivo": "Planejamento anual escala 2027"
      }
    ]
  },
  {
    "id": "col-57",
    "nome": "Vitoria Santos Souza",
    "email": "vitoria.souza@7risp.com.br",
    "cpf": "***.000.000-57",
    "setor": "Atendimento",
    "cargo": "Auxiliar",
    "p1Inicio": "2027-08-02",
    "p1Fim": "2027-08-21",
    "p1Dias": 20,
    "p2Inicio": "2027-12-10",
    "p2Fim": "2027-12-19",
    "p2Dias": 10,
    "totalDias": 30,
    "status": "publicado",
    "historico": [
      {
        "data": "01/09/2026 10:00",
        "de": "Pendente",
        "para": "20+10 dias",
        "por": "Nadia Najjar (RH)",
        "motivo": "Planejamento anual escala 2027"
      }
    ]
  },
  {
    "id": "col-58",
    "nome": "Wanderson Maximo Pessoa Santos",
    "email": "wanderson.santos@7risp.com.br",
    "cpf": "***.000.000-58",
    "setor": "Atendimento",
    "cargo": "Auxiliar",
    "p1Inicio": "2027-08-16",
    "p1Fim": "2027-09-04",
    "p1Dias": 20,
    "p2Inicio": "2027-11-05",
    "p2Fim": "2027-11-14",
    "p2Dias": 10,
    "totalDias": 30,
    "status": "planejado",
    "historico": [
      {
        "data": "01/09/2026 10:00",
        "de": "Pendente",
        "para": "20+10 dias",
        "por": "Nadia Najjar (RH)",
        "motivo": "Planejamento anual escala 2027"
      }
    ]
  },
  {
    "id": "col-59",
    "nome": "Yulli Pereira de Castro Andrade Lang",
    "email": "yulli.lang@7risp.com.br",
    "cpf": "***.000.000-59",
    "setor": "Registro",
    "cargo": "Escrevente",
    "p1Inicio": "2027-09-01",
    "p1Fim": "2027-09-30",
    "p1Dias": 30,
    "totalDias": 30,
    "status": "planejado",
    "historico": [
      {
        "data": "01/09/2026 10:00",
        "de": "Pendente",
        "para": "30 dias",
        "por": "Nadia Najjar (RH)",
        "motivo": "Planejamento anual escala 2027"
      }
    ]
  },
  {
    "id": "col-60",
    "nome": "Yuri da Costa Lima",
    "email": "yuri.lima@7risp.com.br",
    "cpf": "***.000.000-60",
    "setor": "Atendimento",
    "cargo": "Auxiliar",
    "p1Inicio": "2027-09-13",
    "p1Fim": "2027-10-02",
    "p1Dias": 20,
    "p2Inicio": "2027-12-13",
    "p2Fim": "2027-12-22",
    "p2Dias": 10,
    "totalDias": 30,
    "status": "planejado",
    "historico": [
      {
        "data": "01/09/2026 10:00",
        "de": "Pendente",
        "para": "20+10 dias",
        "por": "Nadia Najjar (RH)",
        "motivo": "Planejamento anual escala 2027"
      }
    ]
  },
  {
    "id": "col-61",
    "nome": "Carlos Eduardo Moura Alves",
    "email": "carlos.alves@7risp.com.br",
    "cpf": "***.000.000-61",
    "setor": "Atendimento",
    "cargo": "Aprendiz",
    "p1Inicio": "2027-10-01",
    "p1Fim": "2027-10-30",
    "p1Dias": 30,
    "totalDias": 30,
    "status": "planejado",
    "historico": [
      {
        "data": "01/09/2026 10:00",
        "de": "Pendente",
        "para": "30 dias",
        "por": "Nadia Najjar (RH)",
        "motivo": "Planejamento anual escala 2027"
      }
    ]
  },
  {
    "id": "col-62",
    "nome": "Luiz Henrique Borçanelli Ponteli",
    "email": "luiz.ponteli@7risp.com.br",
    "cpf": "***.000.000-62",
    "setor": "Atendimento",
    "cargo": "Aprendiz",
    "p1Inicio": "2027-11-01",
    "p1Fim": "2027-11-30",
    "p1Dias": 30,
    "totalDias": 30,
    "status": "planejado",
    "historico": [
      {
        "data": "01/09/2026 10:00",
        "de": "Pendente",
        "para": "30 dias",
        "por": "Nadia Najjar (RH)",
        "motivo": "Planejamento anual escala 2027"
      }
    ]
  },
  {
    "id": "col-63",
    "nome": "Vitor Matias dos Santos",
    "email": "vitor.santos@7risp.com.br",
    "cpf": "***.000.000-63",
    "setor": "Atendimento",
    "cargo": "Aprendiz",
    "p1Inicio": "2027-12-01",
    "p1Fim": "2027-12-30",
    "p1Dias": 30,
    "totalDias": 30,
    "status": "planejado",
    "historico": [
      {
        "data": "01/09/2026 10:00",
        "de": "Pendente",
        "para": "30 dias",
        "por": "Nadia Najjar (RH)",
        "motivo": "Planejamento anual escala 2027"
      }
    ]
  }
];

export const COLABORADORES_REAIS_63 = MOCK_COLABORADORES_45;
