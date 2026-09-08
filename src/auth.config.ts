import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnDashboard = nextUrl.pathname.startsWith('/dashboard') || 
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
                            nextUrl.pathname.startsWith('/gestao') ||
                            nextUrl.pathname.startsWith('/instrucoes-trabalho');
                            
      if (isOnDashboard) {
        if (!isLoggedIn) return false;
        const role = auth.user.role || 'USER';

        // MASTER tem acesso irrestrito
        if (role === 'MASTER') return true;

        // MASTER apenas para /configuracoes/cartorios
        if (nextUrl.pathname.startsWith('/configuracoes/cartorios') && role !== 'MASTER') {
          return Response.redirect(new URL('/dashboard', nextUrl));
        }

        // Regras para perfil COLABORADOR: acesso a /pessoas, /minha-conta, /minha-it e /instrucoes-trabalho
        if (role === 'COLABORADOR') {
          if (
            nextUrl.pathname.startsWith('/pessoas') ||
            nextUrl.pathname === '/minha-conta' ||
            nextUrl.pathname.startsWith('/minha-it') ||
            nextUrl.pathname.startsWith('/instrucoes-trabalho')
          ) {
            return true;
          }
          return Response.redirect(new URL('/pessoas', nextUrl));
        }

        // Regras para perfil RH: acesso a /pessoas, /sistema/pessoas, /minha-conta, /gestao, /administracao, /minha-it, /instrucoes-trabalho, /configuracoes/departamentos
        if (role === 'RH') {
          if (
            nextUrl.pathname.startsWith('/pessoas') ||
            nextUrl.pathname.startsWith('/sistema/pessoas') ||
            nextUrl.pathname === '/minha-conta' ||
            nextUrl.pathname.startsWith('/minha-it') ||
            nextUrl.pathname.startsWith('/instrucoes-trabalho') ||
            nextUrl.pathname.startsWith('/gestao') ||
            nextUrl.pathname.startsWith('/administracao') ||
            nextUrl.pathname.startsWith('/configuracoes/departamentos')
          ) {
            return true;
          }
          return Response.redirect(new URL('/sistema/pessoas', nextUrl));
        }

        // Regras para perfil USER: acesso operacional ao dashboard, bi, avaliacoes, relatorios, pessoas
        if (role === 'USER') {
          if (nextUrl.pathname.startsWith('/sistema') || nextUrl.pathname.startsWith('/configuracoes')) {
            return Response.redirect(new URL('/dashboard', nextUrl));
          }
          if (nextUrl.pathname.startsWith('/bi/importar') || nextUrl.pathname.startsWith('/bi/importacoes')) {
            return Response.redirect(new URL('/bi', nextUrl));
          }
          return true;
        }

        // ADMIN tem acesso amplo à organização
        return true;
      } else if (isLoggedIn && nextUrl.pathname === '/login') {
        const role = auth.user.role || 'USER';
        if (role === 'COLABORADOR') {
          return Response.redirect(new URL('/pessoas', nextUrl));
        }
        if (role === 'RH') {
          return Response.redirect(new URL('/sistema/pessoas', nextUrl));
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
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.role = token.role as string;
        session.user.tenantId = token.tenantId as string;
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  providers: [], // Add providers with an empty array for now
} satisfies NextAuthConfig;
