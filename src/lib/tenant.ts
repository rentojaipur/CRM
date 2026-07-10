import { redirect } from "next/navigation";
import { auth } from "./auth";
import { runWithTenantContext } from "./tenant-context";

// Entry point for every institute-scoped page and server action: resolves the
// session and runs `fn` inside the AsyncLocalStorage tenant context so that
// `db` (see prisma.ts) auto-scopes queries and `logAudit`/`hasPermission`
// know who is acting. Super Admins have no institute and are sent to their
// own area instead.
export async function withTenant<T>(fn: () => Promise<T>): Promise<T> {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.instituteId === null) redirect("/super-admin/institutes");

  return runWithTenantContext(
    {
      instituteId: session.user.instituteId,
      userId: session.user.id,
      roleId: session.user.roleId,
    },
    fn,
  );
}
