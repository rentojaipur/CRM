import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  const result = await prisma.role.updateMany({
    where: { name: "Institute Admin", instituteId: { not: null } },
    data: { isSystem: true },
  });
  console.log(`Marked ${result.count} Institute Admin role(s) as system roles.`);
  await prisma.$disconnect();
}
main();
