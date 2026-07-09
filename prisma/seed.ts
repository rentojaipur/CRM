import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

import { PERMISSIONS, ROLE_TEMPLATES } from "../src/lib/rbac-defaults";

const DEMO_PASSWORD = "ChangeMe123!";

async function main() {
  console.log("Seeding permission master list...");
  for (const permission of PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      update: { label: permission.label, module: permission.module },
      create: permission,
    });
  }

  console.log("Seeding Super Admin system role + user...");
  // Compound unique lookups can't take `null` (Postgres treats every NULL as
  // distinct in a unique index), so the system role — instituteId is null —
  // has to be found-then-created rather than upserted via the compound key.
  const superAdminRole =
    (await prisma.role.findFirst({ where: { instituteId: null, name: "Super Admin" } })) ??
    (await prisma.role.create({ data: { instituteId: null, name: "Super Admin", isSystem: true } }));

  await prisma.user.upsert({
    where: { email: "superadmin@eduflow.app" },
    update: {},
    create: {
      instituteId: null,
      roleId: superAdminRole.id,
      name: "Super Admin",
      email: "superadmin@eduflow.app",
      passwordHash: await bcrypt.hash(DEMO_PASSWORD, 10),
    },
  });

  console.log("Seeding demo institute + role templates...");
  const demoInstitute = await prisma.institute.upsert({
    where: { slug: "demo-institute" },
    update: {},
    create: {
      name: "Demo Institute",
      slug: "demo-institute",
      plan: "ENTERPRISE",
      status: "ACTIVE",
    },
  });

  const permissionsByKey = await prisma.permission.findMany();
  const permissionIdByKey = new Map(permissionsByKey.map((p) => [p.key, p.id]));

  const roleIdByName = new Map<string, string>();
  for (const [roleName, permissionKeys] of Object.entries(ROLE_TEMPLATES)) {
    const role = await prisma.role.upsert({
      where: { instituteId_name: { instituteId: demoInstitute.id, name: roleName } },
      update: {},
      create: { instituteId: demoInstitute.id, name: roleName, isSystem: false },
    });
    roleIdByName.set(roleName, role.id);

    for (const key of permissionKeys) {
      const permissionId = permissionIdByKey.get(key);
      if (!permissionId) continue;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: role.id, permissionId } },
        update: { allowed: true },
        create: { roleId: role.id, permissionId, allowed: true },
      });
    }
  }

  console.log("Seeding demo Institute Admin user...");
  const instituteAdminRoleId = roleIdByName.get("Institute Admin")!;
  await prisma.user.upsert({
    where: { email: "admin@demo-institute.eduflow.app" },
    update: {},
    create: {
      instituteId: demoInstitute.id,
      roleId: instituteAdminRoleId,
      name: "Demo Institute Admin",
      email: "admin@demo-institute.eduflow.app",
      passwordHash: await bcrypt.hash(DEMO_PASSWORD, 10),
    },
  });

  console.log("Done. Demo login credentials (password for both):", DEMO_PASSWORD);
  console.log("  Super Admin:       superadmin@eduflow.app");
  console.log("  Institute Admin:   admin@demo-institute.eduflow.app");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
