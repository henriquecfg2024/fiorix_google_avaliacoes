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
                            nextUrl.pathname.startsWith('/bi') ||
                            nextUrl.pathname.startsWith('/configuracoes');
                            
      if (isOnDashboard) {
        if (!isLoggedIn) return false;
        if (nextUrl.pathname.startsWith('/configuracoes/cartorios') && auth.user.role !== 'MASTER') {
          return Response.redirect(new URL('/dashboard', nextUrl));
        }
        if (nextUrl.pathname.startsWith('/configuracoes') && auth.user.role === 'USER') {
          return Response.redirect(new URL('/dashboard', nextUrl));
        }
        return true;
      } else if (isLoggedIn && nextUrl.pathname === '/login') {
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
