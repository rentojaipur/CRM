"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db, prisma } from "@/lib/prisma";
import { withTenant } from "@/lib/tenant";
import { getTenantContext, requireInstituteId } from "@/lib/tenant-context";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

const userSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().trim().email("Enter a valid email"),
  phone: z.string().trim().max(20).optional().default(""),
  password: z.string().min(8, "Password must be at least 8 characters"),
  roleId: z.string().min(1, "Pick a role"),
  branchId: z.string().optional().default(""),
});

export async function createUser(formData: FormData) {
  await withTenant(async () => {
    await requirePermission("user.manage");
    const instituteId = requireInstituteId();

    const parsed = userSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      redirect(`/settings/users?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid input")}`);
    }
    const data = parsed.data;

    // Subscription seat limit set by the Super Admin per institute.
    const institute = await prisma.institute.findUnique({ where: { id: instituteId } });
    const currentUsers = await db.user.count();
    if (institute && currentUsers >= institute.maxUsers) {
      redirect(
        `/settings/users?error=${encodeURIComponent(
          `User limit reached (${institute.maxUsers} on your plan). Contact support to increase it.`,
        )}`,
      );
    }

    // Email is globally unique across the platform.
    const existing = await prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      redirect(`/settings/users?error=${encodeURIComponent("A user with that email already exists")}`);
    }

    // Role and branch must belong to this institute — scoped findFirst proves it.
    const role = await db.role.findFirst({ where: { id: data.roleId } });
    if (!role) {
      redirect(`/settings/users?error=${encodeURIComponent("Pick a valid role")}`);
    }
    let branchId: string | null = null;
    if (data.branchId) {
      const branch = await db.branch.findFirst({ where: { id: data.branchId } });
      if (!branch) {
        redirect(`/settings/users?error=${encodeURIComponent("Pick a valid branch")}`);
      }
      branchId = branch.id;
    }

    const user = await db.user.create({
      data: {
        instituteId,
        name: data.name,
        email: data.email,
        phone: data.phone || null,
        passwordHash: await bcrypt.hash(data.password, 10),
        roleId: role.id,
        branchId,
      },
    });
    await logAudit({
      action: "CREATE",
      entityType: "User",
      entityId: user.id,
      newValue: `${user.name} <${user.email}> as ${role.name}`,
    });
  });

  revalidatePath("/settings/users");
  redirect("/settings/users");
}

export async function toggleUserActive(formData: FormData) {
  await withTenant(async () => {
    await requirePermission("user.manage");

    const id = String(formData.get("userId") ?? "");
    if (id === getTenantContext()?.userId) {
      redirect(`/settings/users?error=${encodeURIComponent("You can't deactivate your own account")}`);
    }

    const user = await db.user.findFirst({ where: { id } });
    if (!user) redirect("/settings/users");

    await prisma.user.update({
      where: { id },
      data: { isActive: !user.isActive },
    });
    await logAudit({
      action: "UPDATE",
      entityType: "User",
      entityId: id,
      fieldChanged: "isActive",
      oldValue: String(user.isActive),
      newValue: String(!user.isActive),
    });
  });

  revalidatePath("/settings/users");
  redirect("/settings/users");
}
