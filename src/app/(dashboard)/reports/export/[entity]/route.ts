import { NextRequest } from "next/server";
import { db } from "@/lib/prisma";
import { withTenant } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { exportResponse } from "@/lib/export";

const date = (value: Date | null | undefined) => (value ? value.toISOString().slice(0, 10) : "");

export async function GET(request: NextRequest, ctx: RouteContext<"/reports/export/[entity]">) {
  const { entity } = await ctx.params;
  const format = request.nextUrl.searchParams.get("format");

  return withTenant(async () => {
    // Fees export is available to accounts staff (fee.view); every other
    // entity needs the full reports permission.
    const canReports = await hasPermission("reports.view");
    const allowed = entity === "fees" ? canReports || (await hasPermission("fee.view")) : canReports;
    if (!allowed) {
      return new Response("Forbidden", { status: 403 });
    }

    if (entity === "leads") {
      const leads = await db.lead.findMany({
        orderBy: { createdAt: "desc" },
        include: { branch: true, assignedTo: true },
      });
      return exportResponse(
        leads.map((lead) => ({
          name: lead.name,
          fatherName: lead.fatherName,
          mobile: lead.mobile,
          email: lead.email,
          dob: date(lead.dob),
          school: lead.school,
          class: lead.class,
          source: lead.source,
          status: lead.status,
          branch: lead.branch?.name ?? "",
          assignedTo: lead.assignedTo?.name ?? "",
          createdAt: date(lead.createdAt),
        })),
        "leads",
        format,
      );
    }

    if (entity === "students") {
      const students = await db.student.findMany({
        orderBy: { createdAt: "desc" },
        include: { branch: true, batch: true, admissions: { include: { course: true } } },
      });
      return exportResponse(
        students.map((student) => ({
          name: student.name,
          fatherName: student.fatherName,
          mobile: student.mobile,
          email: student.email,
          dob: date(student.dob),
          school: student.school,
          class: student.class,
          rollNumber: student.rollNumber,
          branch: student.branch?.name ?? "",
          batch: student.batch?.name ?? "",
          courses: student.admissions.map((admission) => admission.course.name).join("; "),
          admittedAt: date(student.createdAt),
        })),
        "students",
        format,
      );
    }

    if (entity === "admissions") {
      const admissions = await db.admission.findMany({
        orderBy: { createdAt: "desc" },
        include: { student: true, course: true, counsellor: true, approvedBy: true },
      });
      return exportResponse(
        admissions.map((admission) => ({
          student: admission.student.name,
          mobile: admission.student.mobile,
          course: admission.course.name,
          totalFee: Number(admission.totalFee),
          scholarshipPercent: Number(admission.scholarshipPercent),
          scholarshipAmount: Number(admission.scholarshipAmount),
          discountReason: admission.discountReason,
          approvalStatus: admission.approvalStatus,
          counsellor: admission.counsellor?.name ?? "",
          approvedBy: admission.approvedBy?.name ?? "",
          createdAt: date(admission.createdAt),
        })),
        "admissions",
        format,
      );
    }

    if (entity === "fees") {
      const transactions = await db.feeTransaction.findMany({
        orderBy: { paidAt: "desc" },
        include: { student: true, admission: { include: { course: true } }, recordedBy: true },
      });
      return exportResponse(
        transactions.map((transaction) => ({
          receiptNumber: transaction.receiptNumber,
          student: transaction.student.name,
          course: transaction.admission?.course.name ?? "",
          amount: Number(transaction.amount),
          mode: transaction.mode,
          reference: transaction.transactionRef,
          paidAt: transaction.paidAt.toISOString().replace("T", " ").slice(0, 16),
          recordedBy: transaction.recordedBy.name,
        })),
        "fee-transactions",
        format,
      );
    }

    return new Response("Unknown export entity", { status: 404 });
  });
}
