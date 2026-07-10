// Parsing + validation for bulk lead import (CSV and XLSX). Kept separate
// from the server action so it stays unit-testable.
import { z } from "zod";

export const LEAD_IMPORT_COLUMNS = [
  "name",
  "fatherName",
  "mobile",
  "email",
  "dob",
  "school",
  "class",
  "source",
  "branch",
  "assignedToEmail",
] as const;

export const SAMPLE_CSV = [
  LEAD_IMPORT_COLUMNS.join(","),
  `Aarav Sharma,Vikas Sharma,9876543210,aarav@example.com,2010-05-14,DPS Jaipur,X,WALK_IN,Pratap Nagar,counsellor@institute.com`,
  `Priya Meena,Ramesh Meena,9812345678,,,St. Xavier's,IX,ANTHE,,`,
].join("\r\n");

const VALID_SOURCES = ["WEBSITE", "WALK_IN", "GOOGLE", "FACEBOOK", "ANTHE", "REFERRAL", "OTHER"] as const;

export const importRowSchema = z.object({
  name: z.string().trim().min(2, "name must be at least 2 characters").max(100),
  fatherName: z.string().trim().max(100).optional().default(""),
  mobile: z
    .string()
    .trim()
    .regex(/^[+\d][\d\s-]{7,14}$/, "invalid mobile number"),
  email: z.string().trim().email("invalid email").or(z.literal("")).default(""),
  dob: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "dob must be YYYY-MM-DD")
    .refine((value) => !Number.isNaN(new Date(value).getTime()), "invalid dob")
    .or(z.literal(""))
    .default(""),
  school: z.string().trim().max(150).optional().default(""),
  class: z.string().trim().max(30).optional().default(""),
  source: z
    .string()
    .trim()
    .toUpperCase()
    .default("")
    .transform((value) => (value === "" ? "OTHER" : value))
    .pipe(z.enum(VALID_SOURCES)),
  branch: z.string().trim().max(100).optional().default(""),
  assignedToEmail: z.string().trim().email("invalid assignedToEmail").or(z.literal("")).default(""),
});

export type ImportRow = z.infer<typeof importRowSchema>;

// Minimal RFC-4180-ish CSV parser: quoted fields, escaped quotes, CR/LF.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = "";
  };
  const pushRow = () => {
    pushField();
    if (row.some((cell) => cell.trim() !== "")) rows.push(row);
    row = [];
  };

  const chars = text.replace(/^﻿/, "");
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    if (inQuotes) {
      if (char === '"') {
        if (chars[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      pushField();
    } else if (char === "\n") {
      pushRow();
    } else if (char !== "\r") {
      field += char;
    }
  }
  if (field !== "" || row.length > 0) pushRow();
  return rows;
}

// Turns a header row + data rows into keyed records using LEAD_IMPORT_COLUMNS
// (header match is case-insensitive; unknown columns are ignored).
export function rowsToRecords(rows: string[][]): { records: Record<string, string>[]; headerError?: string } {
  if (rows.length === 0) return { records: [], headerError: "File is empty" };
  const header = rows[0].map((cell) => cell.trim());
  const indexByColumn = new Map<string, number>();
  for (const column of LEAD_IMPORT_COLUMNS) {
    const index = header.findIndex((cell) => cell.toLowerCase() === column.toLowerCase());
    if (index !== -1) indexByColumn.set(column, index);
  }
  if (!indexByColumn.has("name") || !indexByColumn.has("mobile")) {
    return {
      records: [],
      headerError: `Header must include at least "name" and "mobile" — download the sample template for the exact format`,
    };
  }
  const records = rows.slice(1).map((cells) => {
    const record: Record<string, string> = {};
    for (const [column, index] of indexByColumn) {
      record[column] = (cells[index] ?? "").trim();
    }
    return record;
  });
  return { records };
}
