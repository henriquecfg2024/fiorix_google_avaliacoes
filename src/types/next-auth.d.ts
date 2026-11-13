import type { DefaultSession, DefaultUser } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      tenantId: string;
      departamento?: string | null;
      cargo?: string | null;
    } & DefaultSession["user"];
  }

  interface User extends DefaultUser {
    role: string;
    tenantId: string;
    departamento?: string | null;
    cargo?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: string;
    tenantId: string;
    departamento?: string | null;
    cargo?: string | null;
  }
}
