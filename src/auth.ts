import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./lib/prisma";
import { authConfig } from "./auth.config";
import { verifyTotpToken, roleRequires2FA } from "./lib/totp";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Senha", type: "password" },
        totpCode: { label: "Código 2FA", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user) return null;

        const passwordsMatch = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );

        if (!passwordsMatch) return null;

        // Verifica se o usuário precisa de 2FA
        if (roleRequires2FA(user.role)) {
          const totpCode = credentials.totpCode as string | undefined;

          if (!user.totpSecret) {
            throw new Error('REQUIRES_2FA');
          }
          
          if (!totpCode) {
            // Senha correta, mas precisa de 2FA — lança erro especial
            throw new Error('REQUIRES_2FA');
          }

          // Valida o código TOTP
          const isValid = verifyTotpToken(totpCode, user.totpSecret);
          if (!isValid) {
            throw new Error('INVALID_2FA_CODE');
          }

          // Se ainda não estava ativado, ativa no primeiro código válido!
          if (!user.totpEnabled) {
            await prisma.user.update({
              where: { id: user.id },
              data: { totpEnabled: true, totpVerifiedAt: new Date() },
            });
          }
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          tenantId: user.tenantId,
        };
      },
    }),
  ],
  session: { strategy: "jwt" },
});
