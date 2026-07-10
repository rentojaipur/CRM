import { auth } from "@/lib/auth";
import { SAMPLE_CSV } from "@/lib/lead-import";

export async function GET() {
  const session = await auth();
  if (!session) return new Response("Unauthorized", { status: 401 });

  return new Response(SAMPLE_CSV, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="leads-import-sample.csv"',
    },
  });
}
