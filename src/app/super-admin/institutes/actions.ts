"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/permissions";
import { ROLE_TEMPLATES } from "@/lib/rbac-defaults";

const createInstituteSchema = z.object({
  name: z.string().trim().min(2, "Institute name must be at least 2 characters"),
  plan: z.enum(["TRIAL", "BASIC", "PRO", "ENTERPRISE"]),
  contactEmail: z.string().trim().email("Enter a valid contact email").or(z.literal("")),
  contactPhone: z.string().trim().max(20).optional().default(""),
  address: z.string().trim().max(500).optional().default(""),
  gstNumber: z.string().trim().max(20).optional().default(""),
  adminName: z.string().trim().min(2, "Admin name must be at least 2 characters"),
  adminEmail: z.string().trim().email("Enter a valid admin email"),
  adminPassword: z.string().min(8, "Admin password must be at least 8 characters"),
});

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

export async function createInstitute(formData: FormData) {
  await requireSuperAdmin();

  const parsed = createInstituteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid input";
    redirect(`/super-admin/institutes/new?error=${encodeURIComponent(message)}`);
  }
  const data = parsed.data;

  const existingUser = await prisma.user.findUnique({ where: { email: data.adminEmail } });
  if (existingUser) {
    redirect(`/super-admin/institutes/new?error=${encodeURIComponent("A user with that admin email already exists")}`);
  }

  const base = slugify(data.name) || "institute";
  let slug = base;
  for (let i = 2; await prisma.institute.findUnique({ where: { slug } }); i++) {
    slug = `${base}-${i}`;
  }

  const passwordHash = await bcrypt.hash(data.adminPassword, 10);
  const permissions = await prisma.permission.findMany();
  const permissionIdByKey = new Map(permissions.map((p) => [p.key, p.id]));

  const session = await requireSuperAdmin();

  await prisma.$transaction(async (tx) => {
    const institute = await tx.institute.create({
      data: {
        name: data.name,
        slug,
        plan: data.plan,
        status: data.plan === "TRIAL" ? "TRIAL" : "ACTIVE",
        contactEmail: data.contactEmail || null,
        contactPhone: data.contactPhone || null,
        address: data.address || null,
        gstNumber: data.gstNumber || null,
      },
    });

    let adminRoleId: string | null = null;
    for (const [roleName, permissionKeys] of Object.entries(ROLE_TEMPLATES)) {
      const role = await tx.role.create({
        data: {
          instituteId: institute.id,
          name: roleName,
          rolePermissions: {
            create: permissionKeys.flatMap((key) => {
              const permissionId = permissionIdByKey.get(key);
              return permissionId ? [{ permissionId, allowed: true }] : [];
            }),
          },
        },
      });
      if (roleName === "Institute Admin") adminRoleId = role.id;
    }

    await tx.user.create({
      data: {
        instituteId: institute.id,
        roleId: adminRoleId!,
        name: data.adminName,
        email: data.adminEmail,
        passwordHash,
      },
    });

    await tx.auditLog.create({
      data: {
        instituteId: institute.id,
        userId: session.user.id,
        action: "CREATE",
        entityType: "Institute",
        entityId: institute.id,
        newValue: `${data.name} (${data.plan})`,
      },
    });
  });

  revalidatePath("/super-admin/institutes");
  redirect("/super-admin/institutes");
}

export async function setInstituteStatus(formData: FormData) {
  const session = await requireSuperAdmin();

  const instituteId = String(formData.get("instituteId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!instituteId || !["ACTIVE", "SUSPENDED"].includes(status)) return;

  const institute = await prisma.institute.findUnique({ where: { id: instituteId } });
  if (!institute) return;

  await prisma.$transaction([
    prisma.institute.update({
      where: { id: instituteId },
      data: { status: status as "ACTIVE" | "SUSPENDED" },
    }),
    prisma.auditLog.create({
      data: {
        instituteId,
        userId: session.user.id,
        action: "UPDATE",
        entityType: "Institute",
        entityId: instituteId,
        fieldChanged: "status",
        oldValue: institute.status,
        newValue: status,
      },
    }),
  ]);

  revalidatePath("/super-admin/institutes");
}
