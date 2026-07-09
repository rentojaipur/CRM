import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      instituteId: string | null;
      roleId: string;
      roleName: string;
    } & DefaultSession["user"];
  }

  interface User {
    instituteId: string | null;
    roleId: string;
    roleName: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    instituteId: string | null;
    roleId: string;
    roleName: string;
  }
}

// next-auth/jwt re-exports from @auth/core/jwt, which is the module the
// session/jwt callbacks actually reference — augment it directly too, or
// `token.instituteId` resolves via JWT's `Record<string, unknown>` base
// and types as `unknown` instead of `string | null`.
declare module "@auth/core/jwt" {
  interface JWT {
    instituteId: string | null;
    roleId: string;
    roleName: string;
  }
}
