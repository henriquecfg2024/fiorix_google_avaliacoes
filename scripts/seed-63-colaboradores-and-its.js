const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

const TENANT_ID = 'cms3xd0wm00002pw9j2k0ahan';

const COLABORADORES_63 = [
  { nome: 'Alex Nogueira Junior', cargo: 'auxiliar', depto: 'Atendimento' },
  { nome: 'Amanda Aparecida Gil', cargo: 'escrevente', depto: 'Registro' },
  { nome: 'Alisson Azevedo de Lima', cargo: 'auxiliar', depto: 'Atendimento' },
  { nome: 'Ana Carolina Roque da Silva', cargo: 'auxiliar', depto: 'Atendimento' },
  { nome: 'Ander Gleiber de Oliveira Ribeiro', cargo: 'escrevente', depto: 'Registro' },
  { nome: 'Andreia Zaramella', cargo: 'escrevente', depto: 'Registro' },
  { nome: 'Anne Caroline Araujo de Lima', cargo: 'auxiliar', depto: 'Atendimento' },
  { nome: 'Antonio Carlos Belato Câmara', cargo: 'Oficial Substituto (§ 4º)', depto: 'Administração' },
  { nome: 'Antonio Carlos Ramos de Paula', cargo: 'auxiliar', depto: 'Impressão/Arquivo' },
  { nome: 'Aparecida Maria da Silva Pires', cargo: 'auxiliar', depto: 'Atendimento' },
  { nome: 'Bruno Alves Santos', cargo: 'auxiliar', depto: 'Atendimento' },
  { nome: 'Claudio Donizetti Ferreira da Silva', cargo: 'Oficial Substituto (§ 5º)', depto: 'Administração' },
  { nome: 'Clayton Nobre Vasconcellos', cargo: 'escrevente', depto: 'Registro' },
  { nome: 'Clayton Silva de Souza', cargo: 'escrevente', depto: 'Registro' },
  { nome: 'Clivio Andrade de Araujo', cargo: 'auxiliar', depto: 'Atendimento' },
  { nome: 'Cristiane Falanga', cargo: 'escrevente', depto: 'Registro' },
  { nome: 'Cristiane Pinheiro Baptista Vieira', cargo: 'escrevente', depto: 'Registro' },
  { nome: 'Cristiano Vesentini Neves Caldeiras', cargo: 'escrevente', depto: 'Registro' },
  { nome: 'Daniela Martinez Salvino', cargo: 'auxiliar', depto: 'Atendimento' },
  { nome: 'David Bruno Francisco Comunian dos Santos', cargo: 'escrevente', depto: 'Registro' },
  { nome: 'David Coutinho da Silva', cargo: 'auxiliar', depto: 'Impressão/Arquivo' },
  { nome: 'Diego Silva de Souza Moura', cargo: 'escrevente', depto: 'Registro' },
  { nome: 'Eduardo Marino Cavalhieri', cargo: 'escrevente', depto: 'Registro' },
  { nome: 'Elaine Fioranelli Samara', cargo: 'Oficial Substituto (§ 4º)', depto: 'Administração' },
  { nome: 'Felipe Miniuchi', cargo: 'escrevente', depto: 'Registro' },
  { nome: 'Francisco Caninde Martins', cargo: 'auxiliar', depto: 'Impressão/Arquivo' },
  { nome: 'Guilherme Mancio da Silva', cargo: 'escrevente', depto: 'Registro' },
  { nome: 'Henrique Cesar Ferreira Gama', cargo: 'escrevente', depto: 'TI', role: 'ADMIN' },
  { nome: 'Iasmim Cristina Cambuy', cargo: 'auxiliar', depto: 'Atendimento' },
  { nome: 'Ildo Bezerra dos Santos', cargo: 'auxiliar', depto: 'Atendimento' },
  { nome: 'Jean Carlos Cioconi da Costa', cargo: 'auxiliar', depto: 'Impressão/Arquivo' },
  { nome: 'Jonatan Lima', cargo: 'auxiliar', depto: 'Atendimento' },
  { nome: 'Jozilene Vaccari', cargo: 'auxiliar', depto: 'Atendimento' },
  { nome: 'João Pedro Santana Silva', cargo: 'auxiliar', depto: 'Atendimento' },
  { nome: 'Juliana Alves Bezerra', cargo: 'auxiliar', depto: 'Atendimento' },
  { nome: 'Lucas Martins Gonçalves', cargo: 'escrevente', depto: 'Registro' },
  { nome: 'Leandro Jorge dos Santos', cargo: 'escrevente', depto: 'Registro' },
  { nome: 'Luis Carlos Lopes de Almeida', cargo: 'auxiliar', depto: 'Impressão/Arquivo' },
  { nome: 'Marcia Pinheiro Baptista', cargo: 'escrevente', depto: 'Registro' },
  { nome: 'Marcus Vinicius de Souza Brito', cargo: 'Oficial Substituto (§ 4º)', depto: 'Administração' },
  { nome: 'Miguel Augusto Hadad Leite', cargo: 'escrevente', depto: 'Registro' },
  { nome: 'Nadia Najjar', cargo: 'auxiliar', depto: 'RH', role: 'RH' },
  { nome: 'Paula Cristina Souza Morais', cargo: 'escrevente', depto: 'Registro' },
  { nome: 'Rafael Henrique Collim Placidino', cargo: 'escrevente', depto: 'Registro' },
  { nome: 'Raquel Nicole Massafera Botas', cargo: 'auxiliar', depto: 'Atendimento' },
  { nome: 'Renan Barros de Sousa', cargo: 'escrevente', depto: 'Registro' },
  { nome: 'Ricardo Isidoro da Fonseca', cargo: 'auxiliar', depto: 'Atendimento' },
  { nome: 'Ricardo Pereira Marçal', cargo: 'auxiliar', depto: 'Atendimento' },
  { nome: 'Sonia Fioranelli', cargo: 'Oficial Substituto (§ 4º)', depto: 'Administração' },
  { nome: 'Sara Regina Serem Calçada', cargo: 'auxiliar', depto: 'Atendimento' },
  { nome: 'Tatiana Martins da Silva', cargo: 'escrevente', depto: 'Registro' },
  { nome: 'Thiago de Oliveira Silva', cargo: 'auxiliar', depto: 'Atendimento' },
  { nome: 'Vanderlei Matheus Rodrigues', cargo: 'auxiliar', depto: 'Atendimento' },
  { nome: 'Vinicius Borçanelli Ponteli', cargo: 'escrevente', depto: 'Registro' },
  { nome: 'Vinicius Theodoro de Souza', cargo: 'escrevente', depto: 'Registro' },
  { nome: 'Vitor Damacena Pereira', cargo: 'escrevente', depto: 'Registro' },
  { nome: 'Vitoria Santos Souza', cargo: 'auxiliar', depto: 'Atendimento' },
  { nome: 'Wanderson Maximo Pessoa Santos', cargo: 'auxiliar', depto: 'Atendimento' },
  { nome: 'Yulli Pereira de Castro Andrade Lang', cargo: 'escrevente', depto: 'Registro' },
  { nome: 'Yuri da Costa Lima', cargo: 'auxiliar', depto: 'Atendimento' },
  { nome: 'Carlos Eduardo Moura Alves', cargo: 'aprendiz', depto: 'Atendimento' },
  { nome: 'Luiz Henrique Borçanelli Ponteli', cargo: 'aprendiz', depto: 'Atendimento' },
  { nome: 'Vitor Matias dos Santos', cargo: 'aprendiz', depto: 'Atendimento' },
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

function generateCPF(idx) {
  const num = String(idx + 1).padStart(2, '0');
  return `100.000.000-${num}`;
}

const ITS_12 = [
  {
    codigo: 'IT-ATD-001',
    titulo: 'Recepção e Exame de Prenotação no Balcão',
    departamento: 'Atendimento',
    tempo: 10,
    objetivo: 'Padronizar a conferência inicial de documentos físicos e digitais para geração da prenotação.',
    quandoUsar: 'Ao recepcionar títulos de apresentantes no balcão presencial ou via malote digital.',
    raci: { R: 'Atendente', A: 'Oficial Substituto', C: 'Triagem', I: 'Apresentante' },
    passos: [
      { ordem: 1, titulo: 'Conferir Qualificação do Apresentante', desc: 'Identificar CPF/CNPJ, documento oficial com foto e endereço.' },
      { ordem: 2, titulo: 'Checar Complementaridade do Título', desc: 'Verificar se constam certidões exigíveis por Lei e comprovante de recolhimento de emolumentos.' },
      { ordem: 3, titulo: 'Gerar Protocolo de Prenotação', desc: 'Emitir comprovante no SIPLAN com carimbo de data, hora e número sequencial.' },
      { ordem: 4, titulo: 'Encaminhamento Interno', desc: 'Destinar a pasta de protocolo para a triagem técnica de exame e cálculo.' },
    ],
  },
  {
    codigo: 'IT-ATD-002',
    titulo: 'Roteiro e Postura no Atendimento Presencial',
    departamento: 'Atendimento',
    tempo: 5,
    objetivo: 'Garantir cordialidade, clareza e acolhimento empático com o usuário do cartório.',
    quandoUsar: 'Em todos os atendimentos prestados no balcão e salas de reunião.',
    raci: { R: 'Atendente', A: 'Nadia Najjar (RH)', C: 'Equipe', I: 'Público Geral' },
    passos: [
      { ordem: 1, titulo: 'Saudação Padrão', desc: 'Cumprimentar o usuário informando seu nome e mantendo contato visual.' },
      { ordem: 2, titulo: 'Escuta Ativa', desc: 'Compreender a necessidade antes de solicitar documentos para evitar retornos desnecessários.' },
      { ordem: 3, titulo: 'Explicação Didática', desc: 'Explicar os prazos legais da Lei 6.015/73 de forma acessível e sem jargões excessivos.' },
    ],
  },
  {
    codigo: 'IT-ATD-003',
    titulo: 'Cadastro e Diferenciação de Apresentante',
    departamento: 'Atendimento',
    tempo: 8,
    objetivo: 'Evitar duplicidade ou confusão cadastral entre apresentante e parte interessada no SIPLAN.',
    quandoUsar: 'No cadastramento de novos títulos ou solicitações de certidão.',
    raci: { R: 'Atendente', A: 'Henrique Cesar (TI)', C: 'Registro', I: 'Sistemas' },
    passos: [
      { ordem: 1, titulo: 'Busca Prévia por CPF/CNPJ', desc: 'Pesquisar na base histórica do sistema antes de abrir novo cadastro.' },
      { ordem: 2, titulo: 'Verificação de Homônimos', desc: 'Conferir data de nascimento e filiação caso o nome seja comum.' },
      { ordem: 3, titulo: 'Vinculação ao Número de Matrícula', desc: 'Conectar o cadastro à matrícula ou transcrição imobiliária informada.' },
    ],
  },
  {
    codigo: 'IT-ATD-004',
    titulo: 'Rotina de Diários Oficiais e Normas Internas',
    departamento: 'Atendimento',
    tempo: 10,
    objetivo: 'Assegurar a leitura diária e aplicação das diretrizes normativas da Corregedoria.',
    quandoUsar: 'Todas as manhãs entre 07h30 e 08h30.',
    raci: { R: 'Escrevente de Plantão', A: 'Oficiais Substitutos', C: 'Equipe', I: 'Cartório' },
    passos: [
      { ordem: 1, titulo: 'Acesso ao DJE / INR / IRIB', desc: 'Consultar publicações de pareceres e decisões administrativas imobiliárias.' },
      { ordem: 2, titulo: 'Filtro de Relevância', desc: 'Identificar normas que impactem minutas de notas devolutivas ou registros em andamento.' },
      { ordem: 3, titulo: 'Disseminação Interna', desc: 'Notificar os escreventes através do módulo de comunicados operacionais.' },
    ],
  },
  {
    codigo: 'IT-REG-001',
    titulo: 'Triagem e Exame Formal de Títulos',
    departamento: 'Registro',
    tempo: 15,
    objetivo: 'Examinar a legalidade estrita do título conforme a Lei 6.015/73 e Princípio da Continuidade.',
    quandoUsar: 'Na distribuição diária de prenotações para o corpo de escreventes.',
    raci: { R: 'Escrevente', A: 'Oficial Substituto', C: 'TI', I: 'Apresentante' },
    passos: [
      { ordem: 1, titulo: 'Conferência de Matrícula', desc: 'Verificar cadeia de titulares e inexistência de ônus impeditivos vigentes.' },
      { ordem: 2, titulo: 'Exame de Cláusulas Contratuais', desc: 'Conferir valor de venda, quitação, ITBI e certidões negativas fiscais.' },
      { ordem: 3, titulo: 'Minuta da Nota Devolutiva ou Registro', desc: 'Elaborar nota fundamentada se houver pendência ou despachar para lavratura do ato.' },
    ],
  },
  {
    codigo: 'IT-REG-002',
    titulo: 'Registro de Loteamento e Fração Ideal',
    departamento: 'Registro',
    tempo: 20,
    objetivo: 'Executar a abertura de matrículas filhas e conferir memorial descritivo da Lei 6.766/79.',
    quandoUsar: 'Em incorporações, desmembramentos e condomínios edilícios.',
    raci: { R: 'Escrevente Especialista', A: 'Oficiais Substitutos', C: 'Prefeitura', I: 'Empreendedor' },
    passos: [
      { ordem: 1, titulo: 'Conferência Urbanística', desc: 'Checar termo de aprovação municipal e licença ambiental válida.' },
      { ordem: 2, titulo: 'Cálculo de Fração Ideal', desc: 'Validar tabela de áreas privativas, comuns e coeficiente de proporcionalidade.' },
      { ordem: 3, titulo: 'Lavratura do Ato Mestre', desc: 'Inscrever o registro na matrícula mãe e abrir as fichas das novas unidades.' },
    ],
  },
  {
    codigo: 'IT-IND-001',
    titulo: 'Consulta e Inclusão na Central de Indisponibilidade (CNIB)',
    departamento: 'Indisponibilidade',
    tempo: 10,
    objetivo: 'Evitar alienação de imóveis gravados com ordens de indisponibilidade judicial.',
    quandoUsar: 'Obrigatoriamente antes de qualquer ato de lavratura ou registro definitivo.',
    raci: { R: 'Operador CNIB', A: 'Oficial Substituto', C: 'Poder Judiciário', I: 'Partes' },
    passos: [
      { ordem: 1, titulo: 'Emissão de Certidão CNIB', desc: 'Consultar CPF/CNPJ de todos os transmitentes na plataforma nacional.' },
      { ordem: 2, titulo: 'Comprovação no Protocolo', desc: 'Anexar o código de hash da consulta com data e horário no dossiê do título.' },
      { ordem: 3, titulo: 'Averbação se Houver Bloqueio', desc: 'Se positivo, lançar a averbação de indisponibilidade na matrícula indicada.' },
    ],
  },
  {
    codigo: 'IT-INT-001',
    titulo: 'Procedimento de Intimação Fiduciária (CDT)',
    departamento: 'Intimação',
    tempo: 12,
    objetivo: 'Proceder à notificação do devedor fiduciante nos termos do Art. 26 da Lei 9.514/97.',
    quandoUsar: 'Em requerimentos de cobrança e consolidação de propriedade fiduciária.',
    raci: { R: 'Escrevente Notificador', A: 'Oficial Substituto', C: 'Credor Fiduciário', I: 'Fiduciante' },
    passos: [
      { ordem: 1, titulo: 'Conferência do Demonstrativo de Débito', desc: 'Validar planilha de cálculo e prazo de carência contratual.' },
      { ordem: 2, titulo: 'Expedição do Mandado Notificatório', desc: 'Redigir mandado com prazo improrrogável de 15 dias para purgação da mora.' },
      { ordem: 3, titulo: 'Diligência Pessoal ou Correios', desc: 'Colher assinatura do devedor ou registrar certidão de tentativa de intimação.' },
    ],
  },
  {
    codigo: 'IT-OFI-001',
    titulo: 'Cumprimento de Ofícios e Ordens Judiciais',
    departamento: 'Ofício',
    tempo: 15,
    objetivo: 'Garantir resposta célere e cumprimento seguro de mandados judiciais e requisições públicas.',
    quandoUsar: 'Ao receber ofícios de Varas Cíveis, Trabalhistas, Família ou Corregedoria.',
    raci: { R: 'Setor de Ofícios', A: 'Oficial Substituto', C: 'Juízo Solicitante', I: 'Cartório' },
    passos: [
      { ordem: 1, titulo: 'Lançamento no Livro de Ordens', desc: 'Registrar número do processo, Vara de origem e prazo concedido pelo magistrado.' },
      { ordem: 2, titulo: 'Localização de Bens e Matrículas', desc: 'Executar busca por indicadores reais e pessoais nos arquivos digitais.' },
      { ordem: 3, titulo: 'Minuta de Ofício de Resposta', desc: 'Submeter minuta de esclarecimento ou certidão comprobatória para assinatura do Oficial.' },
    ],
  },
  {
    codigo: 'IT-RET-001',
    titulo: 'Retificação Administrativa de Área e Memorial',
    departamento: 'Registro',
    tempo: 20,
    objetivo: 'Processar a correção de medidas perimétricas e confrontações nos termos do Art. 213 da LRP.',
    quandoUsar: 'Quando houver divergência entre a situação fática do imóvel e a descrição tabular.',
    raci: { R: 'Escrevente Técnico', A: 'Oficial Substituto', C: 'Confrontantes', I: 'Proprietário' },
    passos: [
      { ordem: 1, titulo: 'Exame de Planta e Memorial', desc: 'Conferir ART/RRT de profissional habilitado com coordenadas georreferenciadas.' },
      { ordem: 2, titulo: 'Anuência dos Confrontantes', desc: 'Verificar assinaturas de todos os lindeiros ou expedir cartas de notificação.' },
      { ordem: 3, titulo: 'Averbação Retificatória', desc: 'Redigir averbação encerrando a descrição precária e abrindo nova matrícula retificada.' },
    ],
  },
  {
    codigo: 'IT-IMP-001',
    titulo: 'Impressão, Preparação e Arquivamento de Matrículas',
    departamento: 'Impressão/Arquivo',
    tempo: 8,
    objetivo: 'Controlar o livro físico encadernado e o espelho digitalizado correspondente.',
    quandoUsar: 'Após o fechamento dos lotes de registro e expedição de certidões.',
    raci: { R: 'Arquivista', A: 'Chefe de Impressão', C: 'Registro', I: 'Arquivo Geral' },
    passos: [
      { ordem: 1, titulo: 'Impressão em Papel de Segurança', desc: 'Imprimir fichas soltas com numeração e chancela de segurança.' },
      { ordem: 2, titulo: 'Digitalização e OCR', desc: 'Digitalizar as fichas em alta resolução (300 DPI) para inserção no repositório digital.' },
      { ordem: 3, titulo: 'Armazenamento Físico', desc: 'Arquivar a ficha na pasta correspondente da estante sob controle térmico.' },
    ],
  },
  {
    codigo: 'IT-TI-001',
    titulo: 'Rotina de Malote Digital, Backup e Segurança da Informação',
    departamento: 'TI',
    tempo: 10,
    objetivo: 'Assegurar integridade dos dados, backups em nuvem e recepção de títulos pelo Malote Digital.',
    quandoUsar: 'Diariamente a cada 60 minutos durante o expediente.',
    raci: { R: 'Henrique Cesar (TI)', A: 'Oficial Substituto', C: 'Equipe', I: 'ONR / TJSP' },
    passos: [
      { ordem: 1, titulo: 'Verificação do Malote Digital', desc: 'Processar arquivos recebidos no sistema oficial do Tribunal de Justiça.' },
      { ordem: 2, titulo: 'Monitoramento do Conector FIORIX', desc: 'Conferir telemetria de lotes, memória e pulso do conector on-premise.' },
      { ordem: 3, titulo: 'Snapshot e Backup Offsite', desc: 'Validar rotina automática de backup diário com hash de integridade.' },
    ],
  },
];

async function seed() {
  console.log('=== SEED OFICIAL 7º RI: 63 COLABORADORES & 12 ITS ===');

  const defaultPasswordHash = await bcrypt.hash('Fiorix@2026', 10);

  // 1. Inserir ou Atualizar 63 Colaboradores
  console.log('\n--- Semeando 63 Colaboradores Oficiais ---');
  let userCount = 0;

  for (let i = 0; i < COLABORADORES_63.length; i++) {
    const colab = COLABORADORES_63[i];
    const email = sanitizeEmail(colab.nome);
    const cpf = generateCPF(i);
    const role = colab.role || 'COLABORADOR';

    // REGRA CRÍTICA: Não alterar admin@fiorix.com.br
    if (email === 'admin@fiorix.com.br') {
      console.log('PULANDO: admin@fiorix.com.br (MASTER protegido)');
      continue;
    }

    try {
      // Buscar se já existe por email
      const existing = await prisma.user.findUnique({ where: { email } });

      if (existing) {
        // Se já existe e não for MASTER, atualizar dados
        if (existing.role !== 'MASTER') {
          await prisma.$executeRawUnsafe(
            `
            UPDATE public."User"
            SET name = $1, role = $2::"Role", cpf = $3, departamento = $4, cargo = $5, status = 'ativo', "updatedAt" = NOW()
            WHERE email = $6 AND role != 'MASTER' AND email != 'admin@fiorix.com.br';
          `,
            colab.nome,
            role,
            cpf,
            colab.depto,
            colab.cargo,
            email
          );
          userCount++;
        }
      } else {
        // Inserir novo usuário
        const newId = `c7ri_u_${String(i + 1).padStart(3, '0')}`;
        await prisma.$executeRawUnsafe(
          `
          INSERT INTO public."User" (id, name, email, "passwordHash", role, "tenantId", cpf, departamento, cargo, status, "createdAt", "updatedAt")
          VALUES ($1, $2, $3, $4, $5::"Role", $6, $7, $8, $9, 'ativo', NOW(), NOW())
          ON CONFLICT (email) DO NOTHING;
        `,
          newId,
          colab.nome,
          email,
          defaultPasswordHash,
          role,
          TENANT_ID,
          cpf,
          colab.depto,
          colab.cargo
        );
        userCount++;
      }
    } catch (err) {
      console.error(`Erro ao semear colaborador ${colab.nome}:`, err.message);
    }
  }
  console.log(`✓ ${userCount} colaboradores semeados/atualizados com sucesso.`);

  // 2. Inserir as 12 ITs Oficiais do Cartório
  console.log('\n--- Semeando 12 Instruções de Trabalho (ITs) Reais ---');
  let itCount = 0;

  for (const it of ITS_12) {
    try {
      await prisma.$executeRawUnsafe(
        `
        INSERT INTO public.fiorix_its (
          tenant_id, codigo, titulo, departamento, tempo_leitura_min,
          objetivo, quando_usar, responsavel_raci, passo_a_passo, status, versao, vigencia
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, 'ativa', '1.0', CURRENT_DATE)
        ON CONFLICT (tenant_id, codigo) DO UPDATE SET
          titulo = EXCLUDED.titulo,
          departamento = EXCLUDED.departamento,
          tempo_leitura_min = EXCLUDED.tempo_leitura_min,
          objetivo = EXCLUDED.objetivo,
          quando_usar = EXCLUDED.quando_usar,
          responsavel_raci = EXCLUDED.responsavel_raci,
          passo_a_passo = EXCLUDED.passo_a_passo,
          status = 'ativa',
          updated_at = NOW();
      `,
        TENANT_ID,
        it.codigo,
        it.titulo,
        it.departamento,
        it.tempo,
        it.objetivo,
        it.quandoUsar,
        JSON.stringify(it.raci),
        JSON.stringify(it.passos)
      );
      itCount++;
    } catch (err) {
      console.error(`Erro ao semear IT ${it.codigo}:`, err.message);
    }
  }
  console.log(`✓ ${itCount}/12 ITs reais cadastradas no banco com sucesso.`);

  // 3. Semeando dados iniciais para a Matriz de Polivalência (Amostra para os colaboradores chave)
  console.log('\n--- Semeando Matriz de Polivalência Inicial ---');
  try {
    const its = await prisma.$queryRawUnsafe(
      `SELECT id, codigo FROM public.fiorix_its WHERE tenant_id = $1 LIMIT 12`,
      TENANT_ID
    );
    const users = await prisma.$queryRawUnsafe(
      `SELECT id, name, departamento FROM public."User" WHERE "tenantId" = $1 AND role != 'MASTER' LIMIT 30`,
      TENANT_ID
    );

    for (const u of users) {
      for (const it of its) {
        // Nível aleatório realista: se mesmo departamento -> nível 2 a 4; se outro -> 0 a 1
        const mesmoDepto = (u.departamento === 'Registro' && it.codigo.startsWith('IT-REG')) ||
                           (u.departamento === 'Atendimento' && it.codigo.startsWith('IT-ATD')) ||
                           (u.departamento === 'TI' && it.codigo.startsWith('IT-TI'));
        const nivel = mesmoDepto ? (u.name.includes('Henrique') ? 4 : 3) : 1;

        await prisma.$executeRawUnsafe(
          `
          INSERT INTO public.fiorix_matriz_polivalencia (tenant_id, usuario_id, it_id, nivel, data_avaliacao)
          VALUES ($1, $2, $3::uuid, $4, CURRENT_DATE)
          ON CONFLICT (tenant_id, usuario_id, it_id) DO UPDATE SET nivel = EXCLUDED.nivel;
        `,
          TENANT_ID,
          u.id,
          it.id,
          nivel
        );
      }
    }
    console.log('✓ Matriz de Polivalência inicial populada.');
  } catch (err) {
    console.warn('Aviso ao popular matriz inicial:', err.message);
  }

  console.log('\n=== SEED FINALIZADO COM SUCESSO! ===');
}

seed()
  .catch((e) => {
    console.error('Falha geral no seed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
