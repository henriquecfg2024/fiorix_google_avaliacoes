# Módulo Cartório Virtual — Piloto Local (7º Registro de Imóveis de São Paulo)

## 1. Escopo e Guardas Operacionais do Piloto

Este módulo implementa localmente o piloto funcional, auditável e multi-serventia do **Cartório Virtual** no **FIORIX**, iniciando pela **Certidão de Inteiro Teor solicitada por número de matrícula (Livro 2 - Registro Geral)** do **7º Registro de Imóveis de São Paulo**, com arquitetura isolada por `tenantId` pronta para futura expansão ao **5º RI** sem mistura de dados, filas, anotações ou configurações.

### Travas Inegociáveis Ativas no Piloto
- **Banco SQL da serventia (`SRVSQL\WEBRI` — SQL Server 2012 SP4 `11.0 SP4`)**: **100% SOMENTE LEITURA (`SELECT` com `WITH (NOLOCK)` e `readOnlyIntent: true`)**. Zero procedures, views, triggers, tabelas ou comandos de escrita no banco registral.
- **Emissão automática de certidão**: `DESABILITADA` (`PILOTO_GUARDA_OPERACIONAL.emissaoAutomaticaHabilitada = false`).
- **Assinatura automática ICP-Brasil (A1/A3)**: `DESABILITADA` (nenhuma chave privada, senha ou PIN é solicitado ou armazenado pelo FIORIX).
- **Entrega automática (ONR / WhatsApp Balcão)** e **cobrança automática**: `DESABILITADAS`.
- **Fé pública e competência registral**: agentes virtuais executam exclusivamente tarefas técnicas determinísticas. Perfil técnico de sistema (`ADMIN` / `MASTER`) **não** concede competência para `aprovar_revisao` ou `solicitar_assinatura`; tais atos exigem outorga formal de `OFICIAL`, `OFICIAL_SUBSTITUTO` ou `ESCREVENTE_AUTORIZADO`.
- **Isolamento de dados sintéticos**: `isAmbienteSinteticoPermitido()` bloqueia automaticamente qualquer fixture sintética quando `NODE_ENV === 'production'`, apresentando em produção apenas dados reais do Connector ou estados vazios/indisponibilidades honestas.

---

## 2. Estrutura de Navegação e Governança

### Menu Principal `Cartório Virtual` (logo abaixo de `Início`)
1. **Visão Geral** (`/cartorio-virtual`): KPIs operacionais, pedidos que exigem atenção imediata e métricas do Modo de Comparação (`FIORIX × Equipe`).
2. **Certidões** (`/cartorio-virtual/certidoes` e `/cartorio-virtual/certidoes/[pedidoId]`): filtros internos por estado/origem/divergência, 3 participantes separados (`Solicitante`, `Apresentante RPS`, `Destinatário da Nota`), conferência do Contraditório, atualização de matrícula + reconferência obrigatória.
3. **Central de Impressão** (`/cartorio-virtual/impressao`): geração determinística individual ou em lote (`595 x 842 pt`), pré-visualização PDF embutida, alinhamento físico de frente de folha em modo **Duplex** e reimpressões auditadas.
4. **Anotações e Tarefas** (`/cartorio-virtual/anotacoes`): apontamentos colaborativos, atribuição por pessoa/setor/prazo, fios de resposta e **histórico não-destrutivo de edições (`v1..vN`)**.
5. **Revisões e Aprovações** (`/cartorio-virtual/revisoes`): fila exclusiva para atuação humana autorizada com trava criptográfica de versão (`versaoDadosFonteHash`).
6. **Histórico de Operações** (`/cartorio-virtual/historico`): trilha WORM append-only com hash SHA-256 de ações humanas, agentes virtuais, Connector e transições.

### Governança Técnica (`Sistema & Tecnologia`)
- **Governança do Cartório Virtual** (`/configuracoes/cartorio-virtual`): diagnóstico dos 9 adaptadores, script DBA `GRANT SELECT`, outorga de papéis registrais por usuário, catálogo dos 5 agentes virtuais, regras/modelos versionados e dicionário dos 19 marcadores SIPLAN.

---

## 3. Script DBA Homologado (Somente Leitura no `SRVSQL\WEBRI`)

Quando autorizado pelo Oficial/TI para leitura real pelo `fiorix-connector`, aplicar exclusivamente:

```sql
USE [WEBRI];
GO
GRANT SELECT ON OBJECT::dbo.tblWRICertidao TO [fiorix_connector];
GRANT SELECT ON OBJECT::dbo.tblWRICertidaoItens TO [fiorix_connector];
GRANT SELECT ON OBJECT::dbo.tblWRICertidaoItensImovel TO [fiorix_connector];
GRANT SELECT ON OBJECT::dbo.tblWRICertidaoResultadoContraditorio TO [fiorix_connector];
GRANT SELECT ON OBJECT::dbo.tblWRINaturezaCertidao TO [fiorix_connector];
GRANT SELECT ON OBJECT::dbo.tblWRITipoPedidoCertidao TO [fiorix_connector];
GRANT SELECT ON OBJECT::dbo.tblWRIRecepcao_CertidoesONR TO [fiorix_connector];
GRANT SELECT ON OBJECT::dbo.tblWRIReal TO [fiorix_connector];
GRANT SELECT ON OBJECT::dbo.tblWRIRecepcao TO [fiorix_connector];
GRANT SELECT ON OBJECT::dbo.tblWRITitulos TO [fiorix_connector];
GRANT SELECT ON OBJECT::dbo.tblWRIAtosTitulos TO [fiorix_connector];
GO
```

---

## 4. Mapeamento SIPLAN Confirmado vs Parcial

- **Confirmados nos anexos oficiais (`Modelo_Pedido_de_Certidão.rtf`, `Pedido_certidão_nº_1321013.pdf` e SSMS `WEBRI`)**:
  - Todos os **19 marcadores RTF** (`<Protocolo/>`, `<DataEntrada/>`, `<HoraEntrada/>`, `<DataPrevista/>`, `<FormaEntrega/>`, `<Solicitante/>`, `<Email/>`, `<Cpf/>`, `<Telefone/>`, `<Observacoes/>`, `<Escrevente/>`, `<Lista/>`, `<ValorServico/>`, `<ValorDespesa/>`, `<TotalDeposito/>`, `<Apresentante/>`, `<CpfCnpjApresentante/>`, `<DestinatarioNota/>`, `<CpfCnpjDestinatarioNota/>`).
  - Geometria exata `595 x 842 pt`, cabeçalho institucional PNG `1042 x 242 px` e código de barras vetorial **Code 39** (`*<Protocolo/>*`).
  - Sentinelas SQL saneados: `Num_Livro IN (0, 99999999)`, `ProtocoloEntidade = '0'`, datas `1900-01-01` (preservando datas históricas reais como `1997-01-02`).
- **Parciais (aguardam `SELECT` nas tabelas auxiliares para detalhamento fino)**:
  - Discriminação exata de cotas/despesas acessórias (`tblWRICertidaoCotas` / `tblWRICertidaoDespesasAcessorias`) e tomador RPS separado quando gravado em `tblWRITomadoresNfe`.

---

## 5. Runbook de Filas, Idempotência e Custo Mensal

- **Recuperação de Falhas (`queue-engine.ts`)**:
  - Todo job possui chave determinística `cvjob_<sha256>` vinculada ao `tenantId` + `versaoDadosHash`.
  - Falhas transitórias de leitura usam backoff exponencial (`5s`, `15s`, `45s`...).
  - Queda de conexão ou timeout após disparo externo com potencial efeito colateral entra obrigatoriamente em **`RESULTADO_EXTERNO_DESCONHECIDO`**, vedando repetição automática às cegas até reconciliação humana.
- **Orçamento Adicional Mensal**:
  - **Custo incremental implementado: `US$ 0,00 / mês`** (100% executado sobre a infraestrutura Next.js/Vercel, PostgreSQL/Supabase, `pdf-lib` local e `fiorix-connector` já contratados, respeitando integralmente o teto de `US$ 50,00 / mês`).

---

## 6. Checklist Pré-Produção (Exige Aprovação Expressa do Oficial e do Gestor de TI)

1. Homologar juridicamente o texto padrão da Regra 6.2 (`CERTIFICO, outrossim...`) em `Governança do Cartório Virtual`.
2. Aplicar em janela controlada a migration `prisma/migrations/20261107120000_cartorio_virtual_piloto/migration.sql`.
3. Conceder `GRANT SELECT` somente leitura ao login `[fiorix_connector]` no `SRVSQL\WEBRI` e habilitar `CARTORIO_VIRTUAL_SQL_ENABLED=true`.
4. Cadastrar as autorizações registrais nominais (`OFICIAL`, `OFICIAL_SUBSTITUTO`, `ESCREVENTE_AUTORIZADO`) em `/configuracoes/cartorio-virtual`.
5. Acompanhar a taxa de convergência no **Modo de Comparação** antes de deliberar sobre fases futuras.

