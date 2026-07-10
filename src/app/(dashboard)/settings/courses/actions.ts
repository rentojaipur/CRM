"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/prisma";
import { withTenant } from "@/lib/tenant";
import { requireInstituteId } from "@/lib/tenant-context";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

const courseSchema = z.object({
  name: z.string().trim().min(2, "Course name must be at least 2 characters").max(100),
  code: z
    .string()
    .trim()
    .min(2, "Course code must be at least 2 characters")
    .max(20)
    .regex(/^[A-Za-z0-9-]+$/, "Course code can only contain letters, numbers, and hyphens"),
  duration: z.string().trim().max(50).optional().default(""),
  mrpFee: z.coerce.number().min(0, "Fee can't be negative").max(10000000),
  maxScholarshipPercent: z.coerce.number().min(0).max(100, "Scholarship can't exceed 100%"),
});

export async function createCourse(formData: FormData) {
  await withTenant(async () => {
    await requirePermission("course.manage");

    const parsed = courseSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      redirect(`/settings/courses?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid input")}`);
    }
    const data = parsed.data;

    try {
      const course = await db.course.create({
        data: {
          instituteId: requireInstituteId(),
          name: data.name,
          code: data.code.toUpperCase(),
          duration: data.duration || null,
          mrpFee: data.mrpFee,
          maxScholarshipPercent: data.maxScholarshipPercent,
        },
      });
      await logAudit({
        action: "CREATE",
        entityType: "Course",
        entityId: course.id,
        newValue: `${course.name} (${course.code})`,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        redirect(
          `/settings/courses?error=${encodeURIComponent(`Course code "${data.code.toUpperCase()}" already exists`)}`,
        );
      }
      throw error;
    }
  });

  revalidatePath("/settings/courses");
  redirect("/settings/courses");
}

export async function deleteCourse(formData: FormData) {
  await withTenant(async () => {
    await requirePermission("course.manage");

    const id = String(formData.get("courseId") ?? "");
    const course = await db.course.findFirst({
      where: { id },
      include: { _count: { select: { admissions: true, batches: true } } },
    });
    if (!course) redirect("/settings/courses");

    const { admissions, batches } = course._count;
    if (admissions + batches > 0) {
      redirect(
        `/settings/courses?error=${encodeURIComponent(
          `Can't delete "${course.name}" — it has ${admissions} admission(s) and ${batches} batch(es) attached.`,
        )}`,
      );
    }

    await db.course.delete({ where: { id } });
    await logAudit({
      action: "DELETE",
      entityType: "Course",
      entityId: id,
      oldValue: `${course.name} (${course.code})`,
    });
  });

  revalidatePath("/settings/courses");
  redirect("/settings/courses");
}
