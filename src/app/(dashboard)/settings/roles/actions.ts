"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, prisma } from "@/lib/prisma";
import { withTenant } from "@/lib/tenant";
import { requireInstituteId } from "@/lib/tenant-context";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

const roleSchema = z.object({
  name: z.string().trim().min(2, "Role name must be at least 2 characters").max(50),
});

export async function createRole(formData: FormData) {
  let newRoleId = "";

  await withTenant(async () => {
    await requirePermission("role.manage");
    const instituteId = requireInstituteId();

    const parsed = roleSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      redirect(`/settings/roles?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid input")}`);
    }

    const existing = await db.role.findFirst({ where: { name: parsed.data.name } });
    if (existing) {
      redirect(`/settings/roles?error=${encodeURIComponent(`Role "${parsed.data.name}" already exists`)}`);
    }

    const role = await db.role.create({
      data: { instituteId, name: parsed.data.name },
    });
    newRoleId = role.id;
    await logAudit({
      action: "CREATE",
      entityType: "Role",
      entityId: role.id,
      newValue: role.name,
    });
  });

  revalidatePath("/settings/roles");
  redirect(`/settings/roles?role=${newRoleId}`);
}

export async function updateRolePermissions(formData: FormData) {
  const roleId = String(formData.get("roleId") ?? "");

  await withTenant(async () => {
    await requirePermission("role.manage");

    const role = await db.role.findFirst({ where: { id: roleId } });
    if (!role) redirect("/settings/roles");
    if (role.isSystem) {
      redirect(
        `/settings/roles?role=${roleId}&error=${encodeURIComponent(
          `"${role.name}" is a protected role and can't be edited`,
        )}`,
      );
    }

    const permissions = await prisma.permission.findMany();
    const checkedKeys = new Set(formData.getAll("permission").map(String));
    const grantedIds = permissions.filter((p) => checkedKeys.has(p.key)).map((p) => p.id);

    await prisma.$transaction([
      prisma.rolePermission.deleteMany({ where: { roleId } }),
      prisma.rolePermission.createMany({
        data: grantedIds.map((permissionId) => ({ roleId, permissionId, allowed: true })),
      }),
    ]);

    await logAudit({
      action: "UPDATE",
      entityType: "Role",
      entityId: roleId,
      fieldChanged: "permissions",
      newValue: `${grantedIds.length} permission(s): ${[...checkedKeys].sort().join(", ") || "none"}`,
    });
  });

  revalidatePath("/settings/roles");
  redirect(`/settings/roles?role=${roleId}&saved=1`);
}

export async function deleteRole(formData: FormData) {
  await withTenant(async () => {
    await requirePermission("role.manage");

    const id = String(formData.get("roleId") ?? "");
    const role = await db.role.findFirst({
      where: { id },
      include: { _count: { select: { users: true } } },
    });
    if (!role) redirect("/settings/roles");
    if (role.isSystem) {
      redirect(`/settings/roles?error=${encodeURIComponent(`"${role.name}" is a protected role and can't be deleted`)}`);
    }
    if (role._count.users > 0) {
      redirect(
        `/settings/roles?error=${encodeURIComponent(
          `Can't delete "${role.name}" — ${role._count.users} user(s) still have this role`,
        )}`,
      );
    }

    await prisma.role.delete({ where: { id } });
    await logAudit({
      action: "DELETE",
      entityType: "Role",
      entityId: id,
      oldValue: role.name,
    });
  });

  revalidatePath("/settings/roles");
  redirect("/settings/roles");
}
