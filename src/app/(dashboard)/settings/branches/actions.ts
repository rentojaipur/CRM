"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/prisma";
import { withTenant } from "@/lib/tenant";
import { requireInstituteId } from "@/lib/tenant-context";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

const branchSchema = z.object({
  name: z.string().trim().min(2, "Branch name must be at least 2 characters").max(100),
  address: z.string().trim().max(500).optional().default(""),
});

export async function createBranch(formData: FormData) {
  await withTenant(async () => {
    await requirePermission("branch.manage");

    const parsed = branchSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      redirect(`/settings/branches?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid input")}`);
    }

    const branch = await db.branch.create({
      data: {
        instituteId: requireInstituteId(),
        name: parsed.data.name,
        address: parsed.data.address || null,
      },
    });
    await logAudit({
      action: "CREATE",
      entityType: "Branch",
      entityId: branch.id,
      newValue: branch.name,
    });
  });

  revalidatePath("/settings/branches");
  redirect("/settings/branches");
}

export async function deleteBranch(formData: FormData) {
  await withTenant(async () => {
    await requirePermission("branch.manage");

    const id = String(formData.get("branchId") ?? "");
    // Scoped findFirst proves the branch belongs to this institute before the
    // unscoped delete below.
    const branch = await db.branch.findFirst({
      where: { id },
      include: { _count: { select: { users: true, leads: true, students: true, batches: true } } },
    });
    if (!branch) redirect("/settings/branches");

    const { users, leads, students, batches } = branch._count;
    const inUse = users + leads + students + batches;
    if (inUse > 0) {
      redirect(
        `/settings/branches?error=${encodeURIComponent(
          `Can't delete "${branch.name}" — it has ${users} user(s), ${leads} lead(s), ${students} student(s), and ${batches} batch(es) attached.`,
        )}`,
      );
    }

    await db.branch.delete({ where: { id } });
    await logAudit({
      action: "DELETE",
      entityType: "Branch",
      entityId: id,
      oldValue: branch.name,
    });
  });

  revalidatePath("/settings/branches");
  redirect("/settings/branches");
}
