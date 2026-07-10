"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function updateProfile(formData: FormData) {
  const session = await auth();
  if (!session) redirect("/login");

  const dobRaw = String(formData.get("dob") ?? "").trim();
  const dob = dobRaw && /^\d{4}-\d{2}-\d{2}$/.test(dobRaw) ? new Date(dobRaw) : null;
  if (dobRaw && !dob) redirect(`/profile?error=${encodeURIComponent("Invalid date of birth")}`);

  await prisma.user.update({ where: { id: session.user.id }, data: { dob } });
  revalidatePath("/profile");
  redirect("/profile?saved=1");
}

const passwordSchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password"),
  newPassword: z.string().min(8, "New password must be at least 8 characters"),
  confirmPassword: z.string(),
});

export async function changePassword(formData: FormData) {
  const session = await auth();
  if (!session) redirect("/login");

  const parsed = passwordSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(`/profile?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid input")}`);
  }
  const { currentPassword, newPassword, confirmPassword } = parsed.data;
  if (newPassword !== confirmPassword) {
    redirect(`/profile?error=${encodeURIComponent("New passwords don't match")}`);
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) redirect("/login");
  const valid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!valid) {
    redirect(`/profile?error=${encodeURIComponent("Current password is incorrect")}`);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(newPassword, 10) },
  });

  if (user.instituteId) {
    await prisma.auditLog.create({
      data: {
        instituteId: user.instituteId,
        userId: user.id,
        action: "UPDATE",
        entityType: "User",
        entityId: user.id,
        fieldChanged: "password",
        newValue: "(changed)",
      },
    });
  }

  redirect("/profile?passwordChanged=1");
}
