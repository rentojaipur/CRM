import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  const admission = await prisma.admission.findFirst({
    include: { student: true, approvalRequests: true, approvedBy: true },
  });
  console.log("ADMISSION:", JSON.stringify({
    student: admission?.student.name,
    totalFee: admission?.totalFee,
    scholarshipPercent: admission?.scholarshipPercent,
    approvalStatus: admission?.approvalStatus,
    approvedBy: admission?.approvedBy?.name,
    installmentPlan: admission?.installmentPlan,
    approvalRequest: admission?.approvalRequests.map(r => ({ rule: r.ruleTriggered, status: r.status, reviewedAt: !!r.reviewedAt })),
  }, null, 2));
  const notifications = await prisma.notification.findMany({ select: { type: true, title: true, message: true, user: { select: { name: true } } } });
  console.log("NOTIFICATIONS:", JSON.stringify(notifications, null, 2));
  const lead = await prisma.lead.findFirst({ where: { name: "Aarav Sharma" }, select: { status: true } });
  console.log("LEAD STATUS:", lead?.status);
  await prisma.$disconnect();
}
main();
