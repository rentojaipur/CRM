import { auth } from "./auth";
import { prisma } from "./prisma";
import { getTenantContext } from "./tenant-context";

export class PermissionDeniedError extends Error {
  constructor(key: string) {
    super(`Permission denied: ${key}`);
    this.name = "PermissionDeniedError";
  }
}

export async function hasPermission(key: string): Promise<boolean> {
  const context = getTenantContext();
  if (!context) return false;

  const role = await prisma.role.findUnique({
    where: { id: context.roleId },
    include: { rolePermissions: { include: { permission: true } } },
  });

  return role?.rolePermissions.some((rp) => rp.allowed && rp.permission.key === key) ?? false;
}

// Guard for Server Actions / route handlers — throws instead of returning a
// boolean so a missed check fails loudly rather than silently allowing.
export async function requirePermission(key: string): Promise<void> {
  if (!(await hasPermission(key))) {
    throw new PermissionDeniedError(key);
  }
}

// Layouts guard page access, but server actions are directly callable
// endpoints — every super-admin action must re-check the session itself.
export async function requireSuperAdmin() {
  const session = await auth();
  if (!session || session.user.instituteId !== null) {
    throw new PermissionDeniedError("super-admin");
  }
  return session;
}
