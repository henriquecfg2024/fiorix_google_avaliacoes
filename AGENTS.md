# AGENTS.md

This repository is a Next.js 14 application for the Fiorix dashboard and BI workflows. Use the existing app-router conventions and repo patterns rather than introducing new architecture.

## Project context

- App entry: `src/app/` with the Next.js App Router.
- Shared frontend components live in `src/components/`.
- Business logic and database access live in `src/lib/`.
- Authentication is handled by NextAuth in `src/auth.ts` and `src/lib/auth-helpers.ts`.
- Database access uses the Prisma singleton in `src/lib/prisma.ts`.
- UI primitives are in `src/components/ui/` and typically expect `cn` from `@/lib/utils`.

## Working conventions

- Prefer the existing `@/` import alias and do not introduce alternate alias schemes.
- Mark client-only components with `'use client'` only when they actually need browser interactivity.
- Keep server actions and route handlers in `src/app/actions/` and `src/app/api/` respectively; prefer reuse over ad-hoc logic.
- For authorization, use `requireAuth()`, `requireRole()`, and `requireTenant()` from `@/lib/auth-helpers` instead of duplicating session checks.
- For database access, reuse `prisma` from `@/lib/prisma`; do not instantiate a second Prisma client.
- For BI and import flows, follow the patterns already used in `src/lib/bi-dashboard.ts`, `src/lib/import-history.ts`, and `src/lib/bi-aggregates.ts`.
- Preserve the app’s Portuguese naming and user-facing copy unless a specific task requires otherwise.
- Favor small, targeted edits that match the style of nearby files.

## Commands

Run commands from the project root (`fiorix/`):

- `npm run dev` – start the local app
- `npm run build` – production build (runs `prisma generate` first) *(never run locally on workstation `HCFG-001` — rely on `npm run typecheck`, ESLint, Vitest and Vercel CI)*
- `npm run lint` – project lint check
- `npx prisma generate` – regenerate Prisma client after schema changes

## Important files for context

- `src/lib/prisma.ts` – Prisma singleton and database connection configuration
- `src/lib/auth-helpers.ts` – session and role guard patterns
- `src/auth.ts` – NextAuth configuration and credential provider
- `src/app/(dashboard)/` – dashboard pages and tenant-scoped views
- `src/components/ui/` – reusable UI primitives
- `docs/BACKUP_AND_RECOVERY.md` – operational recovery notes and database guidance
- `src/lib/memorial-infraestrutura/catalog.ts` – Memorial oficial dos servidores do 7º RI (`SRVSQL`, `SRVFILES`, `SRVSIPLANIA`)

## Code review guidance for Codex

- Keep changes consistent with the App Router and current component boundaries.
- Prefer composition over new abstraction layers.
- When editing existing feature flows, match the local data-fetching and component patterns rather than introducing new libraries or helpers.
- Check for existing tenant/role guards before adding new access control logic.
- Use TypeScript strictly and avoid broad `any` usage unless a surrounding file already does so.

## High-risk areas

- Authentication and tenant scoping
- Prisma and Supabase integration
- BI import/update jobs and dashboard aggregates
- CSV and import validation flows

## Atualização Obrigatória do Memorial dos Servidores (7º RI — `SRVSQL`, `SRVFILES` e `SRVSIPLANIA`)

- Toda vez que uma melhoria, correção, tuning de banco/SO, permissão `GRANT` read-only, regra de tarefa agendada/firewall ou mudança de arquitetura nos servidores **`SRVSQL (10.0.0.25)`**, **`SRVFILES (10.0.0.40)`** ou **`SRVSIPLANIA (10.0.0.6)`** for realizada, atualize na mesma entrega o arquivo `src/lib/memorial-infraestrutura/catalog.ts` (`OFFICIAL_INFRA_MEMORIAL_ENTRIES`, `SERVERS_TOPOLOGY_7RI` e `GOVERNANCE_BOUNDARIES_7RI`) com resumo em linguagem simples, causa raiz, solução técnica, métricas Antes vs. Depois, comandos sanitizados (zero segredos) e plano de rollback.
- A rota `/master/memorial-infraestrutura` e a API `/api/master/memorial-infraestrutura` devem permanecer estritamente restritas ao perfil **`MASTER`**.
- Não exponha `<header>` HTML dentro das rotas internas de Gestão Documental / Memorial para evitar conflito com `header { height: 60px }` de `src/app/globals.css`.

When in doubt, follow the nearest existing implementation and stay within the repo’s established patterns.
