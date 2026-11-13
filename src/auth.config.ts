import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  trustHost: true,
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard =
        nextUrl.pathname.startsWith('/dashboard') ||
        nextUrl.pathname.startsWith('/cartorio-virtual') ||
        nextUrl.pathname.startsWith('/gestao-documental') ||
        nextUrl.pathname.startsWith('/visualizador-documental') ||
        nextUrl.pathname.startsWith('/avaliacoes') ||
        nextUrl.pathname.startsWith('/estatisticas') ||
        nextUrl.pathname.startsWith('/relatorios') ||
        nextUrl.pathname.startsWith('/admin') ||
        nextUrl.pathname.startsWith('/administracao') ||
        nextUrl.pathname.startsWith('/bi') ||
        nextUrl.pathname.startsWith('/configuracoes') ||
        nextUrl.pathname.startsWith('/pessoas') ||
        nextUrl.pathname.startsWith('/sistema') ||
        nextUrl.pathname.startsWith('/minha-it') ||
        nextUrl.pathname.startsWith('/minha-conta') ||
        nextUrl.pathname.startsWith('/meu-perfil') ||
        nextUrl.pathname.startsWith('/sem-acesso') ||
        nextUrl.pathname.startsWith('/gestao') ||
        nextUrl.pathname.startsWith('/master') ||
        nextUrl.pathname.startsWith('/trajetoria-titulo') ||
        nextUrl.pathname.startsWith('/controle-impressoes') ||
        nextUrl.pathname.startsWith('/instrucoes-trabalho') ||
        nextUrl.pathname.startsWith('/mensagens') ||
        nextUrl.pathname.startsWith('/espera') ||
        nextUrl.pathname.startsWith('/jornada');

      if (isOnDashboard) {
        if (!isLoggedIn) return false;
        const role = auth.user.role || 'USER';
        const navPermissionsActive = process.env.FEATURE_NAV_PERMISSIONS_V1_ENABLED !== 'false';

        // MASTER tem acesso irrestrito
        if (role === 'MASTER') return true;

        // MASTER apenas para /master e /configuracoes/cartorios
        if (nextUrl.pathname.startsWith('/master') && role !== 'MASTER') {
          return Response.redirect(new URL('/dashboard', nextUrl));
        }

        if (nextUrl.pathname.startsWith('/configuracoes/cartorios') && role !== 'MASTER') {
          return Response.redirect(new URL('/dashboard', nextUrl));
        }

        // Rotas administrativas estruturais de sistema/configurações (exceto departamentos para RH)
        if (
          (nextUrl.pathname.startsWith('/configuracoes') || nextUrl.pathname.startsWith('/sistema/operacoes')) &&
          role !== 'ADMIN' &&
          !(nextUrl.pathname.startsWith('/configuracoes/departamentos') && role === 'RH')
        ) {
          return Response.redirect(new URL('/dashboard', nextUrl));
        }

        // Quando Permissões de Menu (V1) está ativo em produção, RouteAccessGuard + banco validam
        // as regras individuais/perfil em tempo real (inclusive quando o papel acabou de mudar no banco).
        if (navPermissionsActive) {
          return true;
        }

        if (
          (nextUrl.pathname.startsWith('/gestao-documental') ||
            nextUrl.pathname.startsWith('/visualizador-documental')) &&
          !['ADMIN', 'MASTER', 'SUBSTITUTO', 'VISITANTE'].includes(role)
        ) {
          return Response.redirect(new URL('/dashboard', nextUrl));
        }

        // Regras para perfil COLABORADOR
        if (role === 'COLABORADOR') {
          if (
            nextUrl.pathname.startsWith('/cartorio-virtual') ||
            nextUrl.pathname.startsWith('/pessoas') ||
            nextUrl.pathname === '/minha-conta' ||
            nextUrl.pathname === '/meu-perfil' ||
            nextUrl.pathname === '/sem-acesso' ||
            nextUrl.pathname.startsWith('/minha-it') ||
            nextUrl.pathname.startsWith('/trajetoria-titulo') ||
            nextUrl.pathname.startsWith('/controle-impressoes') ||
            nextUrl.pathname.startsWith('/instrucoes-trabalho') ||
            nextUrl.pathname.startsWith('/mensagens') ||
            nextUrl.pathname.startsWith('/espera')
          ) {
            return true;
          }
          return Response.redirect(new URL('/minha-it', nextUrl));
        }

        // Regras para perfil RH: foco em Pessoas (comunicados, férias, holerites) + mensagens
        if (role === 'RH') {
          if (
            nextUrl.pathname.startsWith('/pessoas') ||
            nextUrl.pathname.startsWith('/sistema/pessoas') ||
            nextUrl.pathname === '/minha-conta' ||
            nextUrl.pathname === '/meu-perfil' ||
            nextUrl.pathname === '/sem-acesso' ||
            nextUrl.pathname.startsWith('/minha-it') ||
            nextUrl.pathname.startsWith('/trajetoria-titulo') ||
            nextUrl.pathname.startsWith('/configuracoes/departamentos') ||
            nextUrl.pathname.startsWith('/mensagens')
          ) {
            return true;
          }
          return Response.redirect(new URL('/sistema/pessoas', nextUrl));
        }

        // Regras para perfil SUBSTITUTO e VISITANTE
        if (role === 'SUBSTITUTO' || role === 'VISITANTE') {
          if (
            nextUrl.pathname.startsWith('/cartorio-virtual') ||
            nextUrl.pathname.startsWith('/gestao-documental') ||
            nextUrl.pathname.startsWith('/visualizador-documental') ||
            nextUrl.pathname.startsWith('/pessoas') ||
            nextUrl.pathname.startsWith('/sistema/pessoas') ||
            nextUrl.pathname === '/minha-conta' ||
            nextUrl.pathname === '/meu-perfil' ||
            nextUrl.pathname === '/sem-acesso' ||
            nextUrl.pathname.startsWith('/minha-it') ||
            nextUrl.pathname.startsWith('/trajetoria-titulo') ||
            nextUrl.pathname.startsWith('/mensagens') ||
            nextUrl.pathname.startsWith('/espera') ||
            nextUrl.pathname.startsWith('/jornada') ||
            nextUrl.pathname.startsWith('/controle-impressoes') ||
            nextUrl.pathname.startsWith('/instrucoes-trabalho') ||
            nextUrl.pathname.startsWith('/administracao') ||
            nextUrl.pathname.startsWith('/gestao') ||
            nextUrl.pathname.startsWith('/dashboard') ||
            nextUrl.pathname.startsWith('/bi') ||
            nextUrl.pathname.startsWith('/avaliacoes') ||
            nextUrl.pathname.startsWith('/estatisticas') ||
            nextUrl.pathname.startsWith('/relatorios')
          ) {
            return true;
          }
          return Response.redirect(new URL(role === 'VISITANTE' ? '/dashboard' : '/administracao/its', nextUrl));
        }

        // Regras para perfil USER
        if (role === 'USER') {
          if (nextUrl.pathname.startsWith('/sistema') || nextUrl.pathname.startsWith('/configuracoes')) {
            return Response.redirect(new URL('/minha-it', nextUrl));
          }
          if (nextUrl.pathname.startsWith('/bi/importar') || nextUrl.pathname.startsWith('/bi/importacoes')) {
            return Response.redirect(new URL('/bi', nextUrl));
          }
          return true;
        }

        // ADMIN tem acesso amplo à organização
        return true;
      } else if (isLoggedIn && nextUrl.pathname === '/login') {
        if (process.env.FEATURE_NAV_PERMISSIONS_V1_ENABLED !== 'false') {
          return Response.redirect(new URL('/dashboard', nextUrl));
        }
        const role = auth.user.role || 'USER';
        if (role === 'COLABORADOR' || role === 'USER') {
          return Response.redirect(new URL('/minha-it', nextUrl));
        }
        if (role === 'RH') {
          return Response.redirect(new URL('/sistema/pessoas', nextUrl));
        }
        if (role === 'SUBSTITUTO') {
          return Response.redirect(new URL('/administracao/its', nextUrl));
        }
        if (role === 'VISITANTE') {
          return Response.redirect(new URL('/dashboard', nextUrl));
        }
        return Response.redirect(new URL('/dashboard', nextUrl));
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.tenantId = user.tenantId;
        token.id = user.id;
        token.authAt = Date.now();
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as string;
        session.user.tenantId = token.tenantId as string;
        session.user.id = token.id as string;
        (session.user as any).authAt = typeof token.authAt === 'number' ? token.authAt : undefined;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
