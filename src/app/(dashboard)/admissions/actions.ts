"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, prisma } from "@/lib/prisma";
import { withTenant } from "@/lib/tenant";
import { getTenantContext, requireInstituteId } from "@/lib/tenant-context";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

const admissionSchema = z.object({
  leadId: z.string().min(1),
  courseId: z.string().min(1, "Pick a course"),
  scholarshipPercent: z.coerce.number().min(0).max(100, "Scholarship can't exceed 100%"),
  discountReason: z.string().trim().max(500).optional().default(""),
  installments: z.coerce.number().int().min(1, "At least 1 installment").max(12, "At most 12 installments"),
});

// Users whose role grants a permission — used to notify approvers.
async function findUsersWithPermission(key: string) {
  return db.user.findMany({
    where: {
      isActive: true,
      role: {
        rolePermissions: { some: { allowed: true, permission: { key } } },
      },
    },
  });
}

export async function createAdmission(formData: FormData) {
  const leadIdRaw = String(formData.get("leadId") ?? "");

  await withTenant(async () => {
    await requirePermission("admission.create");
    const instituteId = requireInstituteId();
    const actorId = getTenantContext()!.userId;

    const parsed = admissionSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      redirect(
        `/leads/${leadIdRaw}?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid input")}`,
      );
    }
    const data = parsed.data;

    const lead = await db.lead.findFirst({
      where: { id: data.leadId },
      include: { student: true },
    });
    if (!lead) redirect("/leads");
    if (lead.student) {
      redirect(`/leads/${lead.id}?error=${encodeURIComponent("This lead is already admitted")}`);
    }

    const course = await db.course.findFirst({ where: { id: data.courseId } });
    if (!course) {
      redirect(`/leads/${lead.id}?error=${encodeURIComponent("Pick a valid course")}`);
    }

    const mrp = Number(course.mrpFee);
    const scholarshipAmount = Math.round((mrp * data.scholarshipPercent) / 100);
    const totalFee = mrp - scholarshipAmount;
    const needsApproval = data.scholarshipPercent > Number(course.maxScholarshipPercent);

    if (needsApproval && !data.discountReason) {
      redirect(
        `/leads/${lead.id}?error=${encodeURIComponent(
          `Scholarship above ${Number(course.maxScholarshipPercent)}% needs a discount reason`,
        )}`,
      );
    }

    // Equal installments, monthly due dates from today; last one takes the
    // rounding remainder so the plan always sums to totalFee.
    const base = Math.floor(totalFee / data.installments);
    const installmentPlan = Array.from({ length: data.installments }, (_, i) => {
      const dueDate = new Date();
      dueDate.setMonth(dueDate.getMonth() + i);
      return {
        seq: i + 1,
        amount: i === data.installments - 1 ? totalFee - base * (data.installments - 1) : base,
        dueDate: dueDate.toISOString().slice(0, 10),
      };
    });

    const ruleTriggered = `Scholarship ${data.scholarshipPercent}% > max ${Number(course.maxScholarshipPercent)}% for ${course.name}`;
    const approvers = needsApproval ? await findUsersWithPermission("admission.approve") : [];

    const admissionId = await prisma.$transaction(async (tx) => {
      const student = await tx.student.create({
        data: {
          instituteId,
          branchId: lead.branchId,
          leadId: lead.id,
          name: lead.name,
          fatherName: lead.fatherName,
          mobile: lead.mobile,
          email: lead.email,
          dob: lead.dob,
          school: lead.school,
          class: lead.class,
        },
      });

      const admission = await tx.admission.create({
        data: {
          instituteId,
          studentId: student.id,
          courseId: course.id,
          totalFee,
          scholarshipPercent: data.scholarshipPercent,
          scholarshipAmount,
          discountReason: data.discountReason || null,
          installmentPlan,
          counsellorId: actorId,
          approvalStatus: needsApproval ? "PENDING" : "NOT_REQUIRED",
        },
      });

      if (needsApproval) {
        await tx.approvalRequest.create({
          data: {
            instituteId,
            entityType: "ADMISSION",
            entityId: admission.id,
            admissionId: admission.id,
            ruleTriggered,
            requestedByUserId: actorId,
          },
        });
        if (approvers.length > 0) {
          await tx.notification.createMany({
            data: approvers.map((approver) => ({
              instituteId,
              userId: approver.id,
              type: "APPROVAL_PENDING",
              title: "Approval pending",
              message: `${lead.name}: ${ruleTriggered}`,
            })),
          });
        }
      }

      await tx.lead.update({ where: { id: lead.id }, data: { status: "CONVERTED" } });

      return admission.id;
    });

    await logAudit({
      action: "CREATE",
      entityType: "Admission",
      entityId: admissionId,
      newValue: `${lead.name} → ${course.name}, fee ₹${totalFee} (scholarship ${data.scholarshipPercent}%${needsApproval ? ", approval pending" : ""})`,
    });
  });

  revalidatePath("/admissions");
  revalidatePath("/leads");
  revalidatePath("/students");
  redirect("/admissions");
}

export async function reviewAdmission(formData: FormData) {
  await withTenant(async () => {
    await requirePermission("admission.approve");
    const instituteId = requireInstituteId();
    const reviewerId = getTenantContext()!.userId;

    const admissionId = String(formData.get("admissionId") ?? "");
    const decision = String(formData.get("decision") ?? "");
    if (!["APPROVED", "REJECTED"].includes(decision)) redirect("/admissions");

    const admission = await db.admission.findFirst({
      where: { id: admissionId },
      include: { student: true, course: true, approvalRequests: { where: { status: "PENDING" } } },
    });
    if (!admission) redirect("/admissions");
    if (admission.approvalStatus !== "PENDING") {
      redirect(`/admissions?error=${encodeURIComponent("This admission is not pending approval")}`);
    }

    await prisma.$transaction(async (tx) => {
      await tx.admission.update({
        where: { id: admission.id },
        data: {
          approvalStatus: decision as "APPROVED" | "REJECTED",
          approvedByUserId: reviewerId,
        },
      });
      for (const request of admission.approvalRequests) {
        await tx.approvalRequest.update({
          where: { id: request.id },
          data: {
            status: decision as "APPROVED" | "REJECTED",
            reviewedByUserId: reviewerId,
            reviewedAt: new Date(),
          },
        });
      }
      if (admission.counsellorId) {
        await tx.notification.create({
          data: {
            instituteId,
            userId: admission.counsellorId,
            type: `APPROVAL_${decision}`,
            title: `Admission ${decision.toLowerCase()}`,
            message: `${admission.student.name} — ${admission.course.name} (scholarship ${Number(admission.scholarshipPercent)}%)`,
          },
        });
      }
    });

    await logAudit({
      action: "UPDATE",
      entityType: "Admission",
      entityId: admission.id,
      fieldChanged: "approvalStatus",
      oldValue: "PENDING",
      newValue: decision,
    });
  });

  revalidatePath("/admissions");
  redirect("/admissions");
}
