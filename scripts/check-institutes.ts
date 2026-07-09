import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  const institutes = await prisma.institute.findMany({
    select: { name: true, slug: true, plan: true, status: true, _count: { select: { users: true, roles: true } } },
  });
  console.log("INSTITUTES:", JSON.stringify(institutes));
  const audits = await prisma.auditLog.findMany({
    select: { action: true, entityType: true, fieldChanged: true, oldValue: true, newValue: true },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  console.log("AUDIT:", JSON.stringify(audits));
  const aakashRoles = await prisma.role.findMany({
    where: { institute: { slug: "aakash-jaipur" } },
    select: { name: true, _count: { select: { rolePermissions: true } } },
  });
  console.log("AAKASH ROLES:", JSON.stringify(aakashRoles));
  await prisma.$disconnect();
}
main();
