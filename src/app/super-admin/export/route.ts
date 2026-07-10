import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin, PermissionDeniedError } from "@/lib/permissions";
import { exportResponse } from "@/lib/export";

export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin();
  } catch (error) {
    if (error instanceof PermissionDeniedError) return new Response("Forbidden", { status: 403 });
    throw error;
  }

  const institutes = await prisma.institute.findMany({
    orderBy: { createdAt: "asc" },
    include: {
      _count: { select: { users: true, students: true, leads: true, admissions: true } },
      feeTransactions: { select: { amount: true } },
    },
  });

  return exportResponse(
    institutes.map((institute) => ({
      name: institute.name,
      slug: institute.slug,
      plan: institute.plan,
      status: institute.status,
      users: institute._count.users,
      students: institute._count.students,
      leads: institute._count.leads,
      admissions: institute._count.admissions,
      revenueCollected: institute.feeTransactions.reduce((sum, t) => sum + Number(t.amount), 0),
      contactEmail: institute.contactEmail,
      createdAt: institute.createdAt.toISOString().slice(0, 10),
    })),
    "institutes",
    request.nextUrl.searchParams.get("format"),
  );
}
