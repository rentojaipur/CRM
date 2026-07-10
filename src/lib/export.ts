import ExcelJS from "exceljs";

function csvEscape(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => csvEscape(row[header])).join(","));
  }
  return lines.join("\r\n");
}

export async function toXlsx(rows: Record<string, unknown>[], sheetName: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  if (rows.length > 0) {
    const headers = Object.keys(rows[0]);
    sheet.addRow(headers);
    sheet.getRow(1).font = { bold: true };
    for (const row of rows) {
      sheet.addRow(headers.map((header) => row[header] ?? ""));
    }
    sheet.columns.forEach((column) => {
      column.width = 18;
    });
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export function exportResponse(
  rows: Record<string, unknown>[],
  filename: string,
  format: string | null,
): Promise<Response> | Response {
  if (format === "xlsx") {
    return toXlsx(rows, filename).then(
      (buffer) =>
        new Response(new Uint8Array(buffer), {
          headers: {
            "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "Content-Disposition": `attachment; filename="${filename}.xlsx"`,
          },
        }),
    );
  }
  return new Response(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}.csv"`,
    },
  });
}
