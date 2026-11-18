# Regras Permanentes do Repositório — FIORIX (`7º RI`)

## 1. Atualização Obrigatória do Memorial dos Servidores (`SRVSQL`, `SRVFILES` e `SRVSIPLANIA`)
Toda vez que uma melhoria, correção, tuning de banco/SO, permissão `GRANT` read-only, regra de tarefa agendada/firewall ou mudança de arquitetura nos servidores **`SRVSQL (10.0.0.25)`**, **`SRVFILES (10.0.0.40)`** ou **`SRVSIPLANIA (10.0.0.6)`** for realizada, atualize na mesma entrega o arquivo `src/lib/memorial-infraestrutura/catalog.ts` (`OFFICIAL_INFRA_MEMORIAL_ENTRIES`, `SERVERS_TOPOLOGY_7RI` e `GOVERNANCE_BOUNDARIES_7RI`) com resumo em linguagem simples, causa raiz, solução técnica, métricas Antes vs. Depois, comandos sanitizados (zero segredos) e plano de rollback.

## 2. Regras de Segurança e Estação `HCFG-001`
- **Nunca** execute `npm run build` ou `next build` localmente em `HCFG-001`; utilize `npm run typecheck`, `npx eslint --max-warnings=0`, `npm run lint:security`, `npm run test:security`, Vitest e `npm run ci:hygiene`.
- A rota `/master/memorial-infraestrutura` e a API `/api/master/memorial-infraestrutura` devem permanecer estritamente restritas ao perfil **`MASTER`**.
- Não exponha `<header>` HTML dentro das rotas internas de Gestão Documental / Memorial para evitar conflito com `header { height: 60px }` de `src/app/globals.css`.
