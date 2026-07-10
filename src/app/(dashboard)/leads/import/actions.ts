"use server";

import { revalidatePath } from "next/cache";
import ExcelJS from "exceljs";
import { db } from "@/lib/prisma";
import { withTenant } from "@/lib/tenant";
import { requireInstituteId } from "@/lib/tenant-context";
import { hasPermission } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { importRowSchema, parseCsv, rowsToRecords } from "@/lib/lead-import";
import type { LeadSource } from "@/generated/prisma/enums";

export type ImportState = {
  done: boolean;
  created: number;
  failed: number;
  errors: string[];
};

const MAX_ROWS = 1000;

async function xlsxToRows(buffer: ArrayBuffer): Promise<string[][]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];
  const rows: string[][] = [];
  sheet.eachRow((row) => {
    const cells: string[] = [];
    // row.values is 1-based; cell values may be rich objects — stringify text.
    for (let i = 1; i <= row.cellCount; i++) {
      const value = row.getCell(i).value;
      if (value === null || value === undefined) {
        cells.push("");
      } else if (value instanceof Date) {
        cells.push(value.toISOString().slice(0, 10));
      } else if (typeof value === "object" && "text" in value) {
        cells.push(String((value as { text: unknown }).text));
      } else if (typeof value === "object" && "result" in value) {
        cells.push(String((value as { result: unknown }).result ?? ""));
      } else {
        cells.push(String(value));
      }
    }
    rows.push(cells);
  });
  return rows;
}

export async function importLeads(_prev: ImportState, formData: FormData): Promise<ImportState> {
  return withTenant(async () => {
    if (!(await hasPermission("lead.create"))) {
      return { done: true, created: 0, failed: 0, errors: ["You don't have permission to create leads."] };
    }
    const instituteId = requireInstituteId();

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return { done: true, created: 0, failed: 0, errors: ["Pick a .csv or .xlsx file first."] };
    }
    if (file.size > 5 * 1024 * 1024) {
      return { done: true, created: 0, failed: 0, errors: ["File is larger than 5 MB."] };
    }

    let rows: string[][];
    try {
      if (file.name.toLowerCase().endsWith(".xlsx")) {
        rows = await xlsxToRows(await file.arrayBuffer());
      } else {
        rows = parseCsv(await file.text());
      }
    } catch {
      return { done: true, created: 0, failed: 0, errors: ["Couldn't read the file — is it a valid .csv or .xlsx?"] };
    }

    const { records, headerError } = rowsToRecords(rows);
    if (headerError) return { done: true, created: 0, failed: 0, errors: [headerError] };
    if (records.length === 0) return { done: true, created: 0, failed: 0, errors: ["No data rows found."] };
    if (records.length > MAX_ROWS) {
      return { done: true, created: 0, failed: 0, errors: [`Too many rows (${records.length}) — max ${MAX_ROWS} per upload.`] };
    }

    // Lookup maps for branch names and user emails, scoped to the institute.
    const branches = await db.branch.findMany();
    const branchIdByName = new Map(branches.map((b) => [b.name.toLowerCase(), b.id]));
    const users = await db.user.findMany({ where: { isActive: true } });
    const userIdByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u.id]));

    let created = 0;
    const errors: string[] = [];

    for (const [index, record] of records.entries()) {
      const rowNumber = index + 2; // 1-based + header row
      const parsed = importRowSchema.safeParse(record);
      if (!parsed.success) {
        errors.push(`Row ${rowNumber}: ${parsed.error.issues[0]?.message}`);
        continue;
      }
      const data = parsed.data;

      let branchId: string | null = null;
      if (data.branch) {
        branchId = branchIdByName.get(data.branch.toLowerCase()) ?? null;
        if (!branchId) {
          errors.push(`Row ${rowNumber}: branch "${data.branch}" not found`);
          continue;
        }
      }
      let assignedToUserId: string | null = null;
      if (data.assignedToEmail) {
        assignedToUserId = userIdByEmail.get(data.assignedToEmail.toLowerCase()) ?? null;
        if (!assignedToUserId) {
          errors.push(`Row ${rowNumber}: user "${data.assignedToEmail}" not found`);
          continue;
        }
      }

      try {
        await db.lead.create({
          data: {
            instituteId,
            name: data.name,
            fatherName: data.fatherName || null,
            mobile: data.mobile,
            email: data.email || null,
            dob: data.dob ? new Date(data.dob) : null,
            school: data.school || null,
            class: data.class || null,
            source: data.source as LeadSource,
            branchId,
            assignedToUserId,
          },
        });
        created++;
      } catch {
        errors.push(`Row ${rowNumber}: could not save`);
      }
    }

    if (created > 0) {
      await logAudit({
        action: "BULK_IMPORT",
        entityType: "Lead",
        entityId: "-",
        newValue: `${created} lead(s) imported from ${file.name} (${errors.length} row(s) failed)`,
      });
      revalidatePath("/leads");
    }

    return { done: true, created, failed: errors.length, errors: errors.slice(0, 25) };
  });
}
