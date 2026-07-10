"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, prisma } from "@/lib/prisma";
import { withTenant } from "@/lib/tenant";
import { getTenantContext, requireInstituteId } from "@/lib/tenant-context";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

const MODES = ["CASH", "ONLINE", "CHEQUE", "UPI"] as const;

const collectSchema = z.object({
  admissionId: z.string().min(1),
  amount: z.coerce.number().positive("Amount must be positive").max(10000000),
  mode: z.enum(MODES),
  transactionRef: z.string().trim().max(100).optional().default(""),
});

export async function collectFee(formData: FormData) {
  const admissionIdRaw = String(formData.get("admissionId") ?? "");
  let receiptId = "";

  await withTenant(async () => {
    await requirePermission("fee.collect");
    const instituteId = requireInstituteId();

    const parsed = collectSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      redirect(
        `/accounts/${admissionIdRaw}?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid input")}`,
      );
    }
    const data = parsed.data;

    const admission = await db.admission.findFirst({
      where: { id: data.admissionId },
      include: { student: true, feeTransactions: true },
    });
    if (!admission) redirect("/accounts");
    if (admission.approvalStatus === "PENDING" || admission.approvalStatus === "REJECTED") {
      redirect(
        `/accounts/${admission.id}?error=${encodeURIComponent(
          "Fees can only be collected for approved admissions",
        )}`,
      );
    }

    const paid = admission.feeTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
    const pending = Number(admission.totalFee) - paid;
    if (data.amount > pending) {
      redirect(
        `/accounts/${admission.id}?error=${encodeURIComponent(
          `Amount exceeds pending fee (₹${pending.toLocaleString("en-IN")})`,
        )}`,
      );
    }

    // Sequential per-institute receipt number, unique-constrained; retry a
    // few times if two collections race for the same sequence.
    const year = new Date().getFullYear();
    for (let attempt = 0; ; attempt++) {
      const count = await db.feeTransaction.count();
      const receiptNumber = `RCP-${year}-${String(count + 1 + attempt).padStart(5, "0")}`;
      try {
        const transaction = await prisma.feeTransaction.create({
          data: {
            instituteId,
            studentId: admission.studentId,
            admissionId: admission.id,
            amount: data.amount,
            mode: data.mode,
            transactionRef: data.transactionRef || null,
            receiptNumber,
            recordedByUserId: getTenantContext()!.userId,
          },
        });
        receiptId = transaction.id;
        break;
      } catch (error) {
        const isUniqueClash =
          error instanceof Error && "code" in error && (error as { code?: string }).code === "P2002";
        if (!isUniqueClash || attempt >= 3) throw error;
      }
    }

    await logAudit({
      action: "CREATE",
      entityType: "FeeTransaction",
      entityId: receiptId,
      newValue: `₹${data.amount.toLocaleString("en-IN")} via ${data.mode} for ${admission.student.name}`,
    });
  });

  revalidatePath("/accounts");
  revalidatePath(`/accounts/${admissionIdRaw}`);
  redirect(`/accounts/receipt/${receiptId}`);
}
