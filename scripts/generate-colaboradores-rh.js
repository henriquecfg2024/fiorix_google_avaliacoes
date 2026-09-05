const fs = require('fs');
const path = require('path');

const COLABORADORES_63 = [
  { nome: 'Alex Nogueira Junior', cargo: 'Auxiliar', depto: 'Atendimento' },
  { nome: 'Amanda Aparecida Gil', cargo: 'Escrevente', depto: 'Registro' },
  { nome: 'Alisson Azevedo de Lima', cargo: 'Auxiliar', depto: 'Atendimento' },
  { nome: 'Ana Carolina Roque da Silva', cargo: 'Auxiliar', depto: 'Atendimento' },
  { nome: 'Ander Gleiber de Oliveira Ribeiro', cargo: 'Escrevente', depto: 'Registro' },
  { nome: 'Andreia Zaramella', cargo: 'Escrevente', depto: 'Registro' },
  { nome: 'Anne Caroline Araujo de Lima', cargo: 'Auxiliar', depto: 'Atendimento' },
  { nome: 'Antonio Carlos Belato Câmara', cargo: 'Oficial Substituto (§ 4º)', depto: 'Administração' },
  { nome: 'Antonio Carlos Ramos de Paula', cargo: 'Auxiliar', depto: 'Impressão/Arquivo' },
  { nome: 'Aparecida Maria da Silva Pires', cargo: 'Auxiliar', depto: 'Atendimento' },
  { nome: 'Bruno Alves Santos', cargo: 'Auxiliar', depto: 'Atendimento' },
  { nome: 'Claudio Donizetti Ferreira da Silva', cargo: 'Oficial Substituto (§ 5º)', depto: 'Administração' },
  { nome: 'Clayton Nobre Vasconcellos', cargo: 'Escrevente', depto: 'Registro' },
  { nome: 'Clayton Silva de Souza', cargo: 'Escrevente', depto: 'Registro' },
  { nome: 'Clivio Andrade de Araujo', cargo: 'Auxiliar', depto: 'Atendimento' },
  { nome: 'Cristiane Falanga', cargo: 'Escrevente', depto: 'Registro' },
  { nome: 'Cristiane Pinheiro Baptista Vieira', cargo: 'Escrevente', depto: 'Registro' },
  { nome: 'Cristiano Vesentini Neves Caldeiras', cargo: 'Escrevente', depto: 'Registro' },
  { nome: 'Daniela Martinez Salvino', cargo: 'Auxiliar', depto: 'Atendimento' },
  { nome: 'David Bruno Francisco Comunian dos Santos', cargo: 'Escrevente', depto: 'Registro' },
  { nome: 'David Coutinho da Silva', cargo: 'Auxiliar', depto: 'Impressão/Arquivo' },
  { nome: 'Diego Silva de Souza Moura', cargo: 'Escrevente', depto: 'Registro' },
  { nome: 'Eduardo Marino Cavalhieri', cargo: 'Escrevente', depto: 'Registro' },
  { nome: 'Elaine Fioranelli Samara', cargo: 'Oficial Substituto (§ 4º)', depto: 'Administração' },
  { nome: 'Felipe Miniuchi', cargo: 'Escrevente', depto: 'Registro' },
  { nome: 'Francisco Caninde Martins', cargo: 'Auxiliar', depto: 'Impressão/Arquivo' },
  { nome: 'Guilherme Mancio da Silva', cargo: 'Escrevente', depto: 'Registro' },
  { nome: 'Henrique Cesar Ferreira Gama', cargo: 'Escrevente - Gestor de TI', depto: 'TI' },
  { nome: 'Iasmim Cristina Cambuy', cargo: 'Auxiliar', depto: 'Atendimento' },
  { nome: 'Ildo Bezerra dos Santos', cargo: 'Auxiliar', depto: 'Atendimento' },
  { nome: 'Jean Carlos Cioconi da Costa', cargo: 'Auxiliar', depto: 'Impressão/Arquivo' },
  { nome: 'Jonatan Lima', cargo: 'Auxiliar', depto: 'Atendimento' },
  { nome: 'Jozilene Vaccari', cargo: 'Auxiliar', depto: 'Atendimento' },
  { nome: 'João Pedro Santana Silva', cargo: 'Auxiliar', depto: 'Atendimento' },
  { nome: 'Juliana Alves Bezerra', cargo: 'Auxiliar', depto: 'Atendimento' },
  { nome: 'Lucas Martins Gonçalves', cargo: 'Escrevente', depto: 'Registro' },
  { nome: 'Leandro Jorge dos Santos', cargo: 'Escrevente', depto: 'Registro' },
  { nome: 'Luis Carlos Lopes de Almeida', cargo: 'Auxiliar', depto: 'Impressão/Arquivo' },
  { nome: 'Marcia Pinheiro Baptista', cargo: 'Escrevente', depto: 'Registro' },
  { nome: 'Marcus Vinicius de Souza Brito', cargo: 'Oficial Substituto (§ 4º)', depto: 'Administração' },
  { nome: 'Miguel Augusto Hadad Leite', cargo: 'Escrevente', depto: 'Registro' },
  { nome: 'Nadia Najjar', cargo: 'Auxiliar - Gestora de RH', depto: 'RH' },
  { nome: 'Paula Cristina Souza Morais', cargo: 'Escrevente', depto: 'Registro' },
  { nome: 'Rafael Henrique Collim Placidino', cargo: 'Escrevente', depto: 'Registro' },
  { nome: 'Raquel Nicole Massafera Botas', cargo: 'Auxiliar', depto: 'Atendimento' },
  { nome: 'Renan Barros de Sousa', cargo: 'Escrevente', depto: 'Registro' },
  { nome: 'Ricardo Isidoro da Fonseca', cargo: 'Auxiliar', depto: 'Atendimento' },
  { nome: 'Ricardo Pereira Marçal', cargo: 'Auxiliar', depto: 'Atendimento' },
  { nome: 'Sonia Fioranelli', cargo: 'Oficial Substituto (§ 4º)', depto: 'Administração' },
  { nome: 'Sara Regina Serem Calçada', cargo: 'Auxiliar', depto: 'Atendimento' },
  { nome: 'Tatiana Martins da Silva', cargo: 'Escrevente', depto: 'Registro' },
  { nome: 'Thiago de Oliveira Silva', cargo: 'Auxiliar', depto: 'Atendimento' },
  { nome: 'Vanderlei Matheus Rodrigues', cargo: 'Auxiliar', depto: 'Atendimento' },
  { nome: 'Vinicius Borçanelli Ponteli', cargo: 'Escrevente', depto: 'Registro' },
  { nome: 'Vinicius Theodoro de Souza', cargo: 'Escrevente', depto: 'Registro' },
  { nome: 'Vitor Damacena Pereira', cargo: 'Escrevente', depto: 'Registro' },
  { nome: 'Vitoria Santos Souza', cargo: 'Auxiliar', depto: 'Atendimento' },
  { nome: 'Wanderson Maximo Pessoa Santos', cargo: 'Auxiliar', depto: 'Atendimento' },
  { nome: 'Yulli Pereira de Castro Andrade Lang', cargo: 'Escrevente', depto: 'Registro' },
  { nome: 'Yuri da Costa Lima', cargo: 'Auxiliar', depto: 'Atendimento' },
  { nome: 'Carlos Eduardo Moura Alves', cargo: 'Aprendiz', depto: 'Atendimento' },
  { nome: 'Luiz Henrique Borçanelli Ponteli', cargo: 'Aprendiz', depto: 'Atendimento' },
  { nome: 'Vitor Matias dos Santos', cargo: 'Aprendiz', depto: 'Atendimento' },
];

function sanitizeEmail(nome) {
  const parts = nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z\s]/g, '')
    .trim()
    .split(/\s+/);
  if (parts.length === 1) return `${parts[0]}@7risp.com.br`;
  return `${parts[0]}.${parts[parts.length - 1]}@7risp.com.br`;
}

// Escalas planejadas para 2027 (mês a mês, distribuídos harmonicamente)
const PERIODOS_BASE = [
  { p1: ['2027-01-10', '2027-01-29', 20], p2: ['2027-07-05', '2027-07-14', 10] },
  { p1: ['2027-01-15', '2027-02-03', 20], p2: ['2027-08-10', '2027-08-19', 10] },
  { p1: ['2027-02-01', '2027-02-20', 20], p2: ['2027-09-01', '2027-09-10', 10] },
  { p1: ['2027-02-15', '2027-03-06', 20], p2: ['2027-10-04', '2027-10-13', 10] },
  { p1: ['2027-03-01', '2027-03-20', 20], p2: ['2027-11-01', '2027-11-10', 10] },
  { p1: ['2027-03-15', '2027-04-03', 20], p2: ['2027-09-15', '2027-09-24', 10] },
  { p1: ['2027-04-05', '2027-04-24', 20], p2: ['2027-10-18', '2027-10-27', 10] },
  { p1: ['2027-04-19', '2027-05-08', 20], p2: ['2027-11-15', '2027-11-24', 10] },
  { p1: ['2027-05-03', '2027-05-22', 20], p2: ['2027-12-01', '2027-12-10', 10] },
  { p1: ['2027-05-17', '2027-06-05', 20], p2: ['2027-10-10', '2027-10-19', 10] },
  { p1: ['2027-06-01', '2027-06-30', 30], p2: null },
  { p1: ['2027-06-14', '2027-07-03', 20], p2: ['2027-11-20', '2027-11-29', 10] },
  { p1: ['2027-07-01', '2027-07-30', 30], p2: null },
  { p1: ['2027-07-15', '2027-08-03', 20], p2: ['2027-12-06', '2027-12-15', 10] },
  { p1: ['2027-08-02', '2027-08-21', 20], p2: ['2027-12-10', '2027-12-19', 10] },
  { p1: ['2027-08-16', '2027-09-04', 20], p2: ['2027-11-05', '2027-11-14', 10] },
  { p1: ['2027-09-01', '2027-09-30', 30], p2: null },
  { p1: ['2027-09-13', '2027-10-02', 20], p2: ['2027-12-13', '2027-12-22', 10] },
  { p1: ['2027-10-01', '2027-10-30', 30], p2: null },
  { p1: ['2027-11-01', '2027-11-30', 30], p2: null },
  { p1: ['2027-12-01', '2027-12-30', 30], p2: null },
];

const items = COLABORADORES_63.map((c, i) => {
  const pad = String(i + 1).padStart(2, '0');
  const period = PERIODOS_BASE[i % PERIODOS_BASE.length];
  const email = sanitizeEmail(c.nome);
  const cpf = `***.000.000-${pad}`;
  
  const obj = {
    id: `col-${pad}`,
    nome: c.nome,
    email: email,
    cpf: cpf,
    setor: c.depto,
    cargo: c.cargo,
    p1Inicio: period.p1[0],
    p1Fim: period.p1[1],
    p1Dias: period.p1[2],
    ...(period.p2 ? {
      p2Inicio: period.p2[0],
      p2Fim: period.p2[1],
      p2Dias: period.p2[2],
    } : {}),
    totalDias: period.p1[2] + (period.p2 ? period.p2[2] : 0),
    status: (i % 7 === 0) ? 'publicado' : 'planejado',
    historico: [
      {
        data: '01/09/2026 10:00',
        de: 'Pendente',
        para: period.p2 ? `${period.p1[2]}+${period.p2[2]} dias` : '30 dias',
        por: 'Nadia Najjar (RH)',
        motivo: 'Planejamento anual escala 2027'
      }
    ]
  };
  return obj;
});

const content = `export interface ColaboradorRH {
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
export const MOCK_COLABORADORES_45: ColaboradorRH[] = ${JSON.stringify(items, null, 2)};

export const COLABORADORES_REAIS_63 = MOCK_COLABORADORES_45;
`;

const target = path.join(__dirname, '..', 'src', 'components', 'rh', 'mockColaboradores45.ts');
fs.writeFileSync(target, content, 'utf8');
console.log('mockColaboradores45.ts updated with 63 real collaborators successfully!');
