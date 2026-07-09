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
