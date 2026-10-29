# Gestão Documental com arquivos locais

## Estado desta entrega
Primeira etapa: pesquisa por nome de arquivo e pasta pelo SaaS, processada pelo Connector.
Não é a migração integral do aplicativo Tauri. Nenhum arquivo do desktop é alterado.
O módulo fica desabilitado por padrão. Nenhum banco ou serviço de produção é alterado pela entrega.

## Fluxo
Usuário autorizado → API com sessão e tenant → tarefa temporária → Connector autenticado
→ pastas permitidas no servidor → resultado de metadados → usuário solicitante.

Nenhuma porta de entrada é aberta no cartório. O Connector consulta a API por HTTPS.
Somente nomes, caminhos relativos, tamanhos e datas são enviados; documentos não são enviados.
A consulta e os metadados são armazenados temporariamente no SaaS, com validade de dois minutos.
Resultados vencidos deixam de ser acessíveis e são removidos na próxima interação do tenant.
Em ambiente sem tráfego, a remoção física exige uma rotina de limpeza:
DELETE FROM "DocumentSearchRequest" WHERE "expiresAt" <= NOW();
Backups do banco seguem a retenção operacional do SaaS.

## Habilitação em homologação
1. Fazer backup e aplicar explicitamente prisma/migrations/document_search_requests.sql no banco de homologação.
   O usuário de banco do servidor precisa ter acesso à tabela; não conceder acesso a anon/authenticated.
2. Configurar DOCUMENTAL_ENABLED=true no SaaS e no Connector.
3. Configurar DOCUMENTAL_ROOTS_JSON no ambiente do Connector com JSON de pastas autorizadas, por exemplo:
   [{"id":"processos","path":"H:\\PROCESSOS - ENVIADOS POR E-MAIL"},{"id":"imagens","path":"K:\\IMAGENS"}]
   O exemplo ilustra o formato JSON; substituir pelos caminhos reais e validar seu escape no arquivo de ambiente.
   Preferir caminhos UNC: serviços Windows podem não enxergar unidades mapeadas na sessão do usuário.
4. Usar credencial existente do Connector, vinculada ao cartório correto. Não expor o secret ao navegador.
5. Reiniciar apenas a instância de homologação. Shadow mode impede o worker documental.
6. Acessar /gestao-documental com ADMIN, MASTER ou SUBSTITUTO e validar com arquivos fictícios.
7. O Connector continua com a agenda de BI independente; pesquisa documental usa sua própria consulta de 10 segundos.

## Controles e limites
- Tenant derivado da sessão ou da credencial do Connector; nunca aceito no corpo da pesquisa.
- Leitura do resultado limitada ao usuário solicitante e cartório.
- Uma pesquisa pendente por usuário; tarefas têm validade de dois minutos.
- Reivindicação atômica com bloqueio de linha; tarefa não pode ser concluída por outro Connector/cartório.
- Termos entre 2 e 120 caracteres; até 100 resultados, 50 mil entradas e 25 segundos por pesquisa.
- Busca por todos os termos no caminho relativo, sem distinção de acento ou maiúsculas.
- Formatos PDF, DOC, DOCX, TIFF, TXT e RTF; arquivos não são abertos ou modificados.
- Sem caminhos recebidos do navegador. Junctions e links simbólicos são ignorados.
- Origens locais confiáveis são pré-requisito: permissões NTFS devem impedir troca maliciosa de pastas durante varredura.
- Caminhos e consultas não são registrados em logs do worker.
- Limites da varredura são cooperativos: uma chamada de filesystem travada na rede pode exceder o prazo.
- Não há repetição automática de tarefa reivindicada; falhas expiram e o usuário pode pesquisar novamente.
- Credencial online não comprova capacidade documental: o Connector pode estar online com módulo desabilitado.
- Pesquisa pode ser parcial; UI informa limites e pastas indisponíveis.
- Feature flag e permissões do menu também são verificadas no servidor.

## Próximas etapas para paridade
1. Índice local persistente e busca por conteúdo, sem repetir varredura a cada consulta.
2. Protocolo específico de prévia/download, com autorização por documento e limites de tamanho.
3. Extrair núcleo Rust de OCR, PDFs, TIFFs e assinaturas para execução no servidor Windows.
4. Migrar ficha, revisão, fila, geração DOCX e impressão, preservando rastreabilidade de origem/confiança.
5. Migrar favoritos, recentes, modelos, perfis e parâmetros por tenant/usuário.
6. Testes de caracterização das heurísticas e comparação com o desktop usando fixtures anonimizadas.
7. Homologar acesso por dois tenants, indisponibilidade de rede e serviço Windows antes de produção.

O PIN local do desktop não é reaproveitado: o módulo web usa autenticação e permissões do SaaS.
CSP, limpeza de dependências e nomes do desktop permanecem tarefas separadas a verificar no código.
Não renomear globalmente FIORIX para FIORIS sem confirmar a identidade definitiva.

## Validação desta entrega
18 testes específicos aprovados: 5 de arquivos locais com fixtures fictícias, 3 de contratos e 10 de autorização das APIs com dependências simuladas.
A checagem TypeScript do SaaS passou. A checagem do Connector aponta erros em arquivos existentes relacionados a node:sqlite e Request.timeout de SQL Server; nenhum erro foi reportado nos novos arquivos documentais.
O SQL não foi aplicado, o serviço não foi reiniciado e o fluxo completo com banco/Connector em execução ainda precisa de homologação.

Regressão adicional: 21 testes existentes de navegação/perfis passaram (39 testes aprovados ao todo). ESLint dos novos módulos e TypeScript do SaaS passaram.
