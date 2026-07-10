import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  const role = await prisma.role.findFirst({ where: { name: "Accounts", institute: { slug: "aakash-jaipur" } } });
  await prisma.user.upsert({
    where: { email: "accounts@aakash-jaipur.com" },
    update: {},
    create: {
      instituteId: role!.instituteId!,
      roleId: role!.id,
      name: "Amit Accounts",
      email: "accounts@aakash-jaipur.com",
      passwordHash: await bcrypt.hash("AccountsPass123!", 10),
    },
  });
  console.log("accounts user ready");
  await prisma.$disconnect();
}
main();
