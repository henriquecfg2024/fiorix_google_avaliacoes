import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./lib/prisma";
import { authConfig } from "./auth.config";
import {
  verifyTotpTokenAsync,
  userRequires2FA,
  encryptTotpSecret,
  isEncryptedTotpSecret,
} from "./lib/totp";
import {
  checkLoginLockout,
  recordFailedLogin,
  clearLoginAttempts,
  DUMMY_BCRYPT_HASH,
} from "./lib/security/login-lockout";

export const JWT_SESSION_MAX_AGE_SECONDS = 12 * 60 * 60; // 12 horas (expediente diário)

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

        const normalizedEmail = String(credentials.email).trim().toLowerCase();

        // Proteção contra força bruta direto no authorize() (inclusive via POST /api/auth/callback/credentials)
        const lockout = await checkLoginLockout(normalizedEmail);
        if (lockout.isLocked) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: normalizedEmail },
        });

        if (!user) {
          await bcrypt.compare(credentials.password as string, DUMMY_BCRYPT_HASH);
          await recordFailedLogin(normalizedEmail);
          return null;
        }

        const passwordsMatch = await bcrypt.compare(
          credentials.password as string,
          user.passwordHash
        );

        if (!passwordsMatch) {
          await recordFailedLogin(normalizedEmail);
          return null;
        }

        // Bloqueia imediatamente contas desativadas (status = 'inativo')
        try {
          const statusRows = await prisma.$queryRawUnsafe<Array<{ status: string }>>(
            `SELECT COALESCE(status, 'ativo') as status FROM public."User" WHERE id = $1 LIMIT 1`,
            user.id
          );
          if (statusRows[0]?.status?.trim().toLowerCase() === 'inativo') {
            return null;
          }
        } catch {
          // Coluna opcional em ambientes de dev iniciais
        }

        // Verifica se o usuário precisa de 2FA (por usuário ou MASTER)
        if (userRequires2FA(user)) {
          const totpCode = credentials.totpCode as string | undefined;

          if (!user.totpSecret) {
            throw new Error('REQUIRES_2FA');
          }

          if (!totpCode) {
            // Senha correta, mas precisa de 2FA — lança erro especial
            throw new Error('REQUIRES_2FA');
          }

          // Valida o código TOTP com proteção anti-replay e registro de falha em lockout
          const isValid = await verifyTotpTokenAsync(totpCode, user.totpSecret, `login:${user.id}`);
          if (!isValid) {
            await recordFailedLogin(normalizedEmail);
            throw new Error('INVALID_2FA_CODE');
          }

          // Se ainda não estava ativado (ou se o segredo legado ainda estava em texto plano), atualiza com AES-256-GCM em repouso
          const needsSecretMigration = !isEncryptedTotpSecret(user.totpSecret);
          if (!user.totpEnabled || needsSecretMigration) {
            await prisma.user.update({
              where: { id: user.id },
              data: {
                ...(user.totpEnabled
                  ? {}
                  : { totpEnabled: true, totpRequired: true, totpVerifiedAt: new Date() }),
                ...(needsSecretMigration ? { totpSecret: encryptTotpSecret(user.totpSecret) } : {}),
              },
            });
          }
        }

        await clearLoginAttempts(normalizedEmail);

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
  session: {
    strategy: "jwt",
    maxAge: JWT_SESSION_MAX_AGE_SECONDS,
  },
});
