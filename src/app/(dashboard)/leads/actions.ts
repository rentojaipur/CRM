"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db, prisma } from "@/lib/prisma";
import { withTenant } from "@/lib/tenant";
import { getTenantContext, requireInstituteId } from "@/lib/tenant-context";
import { requirePermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

const LEAD_SOURCES = ["WEBSITE", "WALK_IN", "GOOGLE", "FACEBOOK", "ANTHE", "REFERRAL", "OTHER"] as const;
const LEAD_STATUSES = ["NEW", "INTERESTED", "FOLLOWUP", "CONVERTED", "LOST"] as const;

const leadSchema = z.object({
  name: z.string().trim().min(2, "Student name must be at least 2 characters").max(100),
  fatherName: z.string().trim().max(100).optional().default(""),
  mobile: z
    .string()
    .trim()
    .regex(/^[+\d][\d\s-]{7,14}$/, "Enter a valid mobile number"),
  email: z.string().trim().email("Enter a valid email").or(z.literal("")),
  dob: z.string().optional().default(""),
  school: z.string().trim().max(150).optional().default(""),
  class: z.string().trim().max(30).optional().default(""),
  source: z.enum(LEAD_SOURCES),
  branchId: z.string().optional().default(""),
  assignedToUserId: z.string().optional().default(""),
});

export async function createLead(formData: FormData) {
  let leadId = "";

  await withTenant(async () => {
    await requirePermission("lead.create");
    const instituteId = requireInstituteId();

    const parsed = leadSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      redirect(`/leads?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid input")}`);
    }
    const data = parsed.data;

    let branchId: string | null = null;
    if (data.branchId) {
      const branch = await db.branch.findFirst({ where: { id: data.branchId } });
      if (!branch) redirect(`/leads?error=${encodeURIComponent("Pick a valid branch")}`);
      branchId = branch.id;
    }
    let assignedToUserId: string | null = null;
    if (data.assignedToUserId) {
      const assignee = await db.user.findFirst({ where: { id: data.assignedToUserId, isActive: true } });
      if (!assignee) redirect(`/leads?error=${encodeURIComponent("Pick a valid counsellor")}`);
      assignedToUserId = assignee.id;
    }

    const lead = await db.lead.create({
      data: {
        instituteId,
        name: data.name,
        fatherName: data.fatherName || null,
        mobile: data.mobile,
        email: data.email || null,
        dob: data.dob ? new Date(data.dob) : null,
        school: data.school || null,
        class: data.class || null,
        source: data.source,
        branchId,
        assignedToUserId,
      },
    });
    leadId = lead.id;
    await logAudit({
      action: "CREATE",
      entityType: "Lead",
      entityId: lead.id,
      newValue: `${lead.name} (${lead.mobile}) via ${lead.source}`,
    });
  });

  revalidatePath("/leads");
  redirect(`/leads/${leadId}`);
}

export async function updateLeadStatus(formData: FormData) {
  const leadId = String(formData.get("leadId") ?? "");

  await withTenant(async () => {
    await requirePermission("lead.followup");

    const status = String(formData.get("status") ?? "");
    if (!LEAD_STATUSES.includes(status as (typeof LEAD_STATUSES)[number])) {
      redirect(`/leads/${leadId}`);
    }

    const lead = await db.lead.findFirst({ where: { id: leadId } });
    if (!lead) redirect("/leads");
    if (lead.status === status) redirect(`/leads/${leadId}`);

    await prisma.lead.update({
      where: { id: lead.id },
      data: { status: status as (typeof LEAD_STATUSES)[number] },
    });
    await logAudit({
      action: "UPDATE",
      entityType: "Lead",
      entityId: lead.id,
      fieldChanged: "status",
      oldValue: lead.status,
      newValue: status,
    });
  });

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
  redirect(`/leads/${leadId}`);
}

const followupSchema = z.object({
  remark: z.string().trim().min(2, "Remark can't be empty").max(1000),
  nextFollowupDate: z.string().optional().default(""),
});

export async function addFollowup(formData: FormData) {
  const leadId = String(formData.get("leadId") ?? "");

  await withTenant(async () => {
    await requirePermission("lead.followup");

    const parsed = followupSchema.safeParse(Object.fromEntries(formData));
    if (!parsed.success) {
      redirect(`/leads/${leadId}?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid input")}`);
    }

    // Scoped lookup proves the lead belongs to this institute — followups
    // themselves carry no instituteId (scoped through the lead).
    const lead = await db.lead.findFirst({ where: { id: leadId } });
    if (!lead) redirect("/leads");

    await prisma.followup.create({
      data: {
        leadId: lead.id,
        remark: parsed.data.remark,
        nextFollowupDate: parsed.data.nextFollowupDate ? new Date(parsed.data.nextFollowupDate) : null,
        createdByUserId: getTenantContext()!.userId,
      },
    });

    // A fresh follow-up on a NEW lead moves it into the pipeline.
    if (lead.status === "NEW") {
      await prisma.lead.update({ where: { id: lead.id }, data: { status: "FOLLOWUP" } });
    }
  });

  revalidatePath(`/leads/${leadId}`);
  redirect(`/leads/${leadId}`);
}
