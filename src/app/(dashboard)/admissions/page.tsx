import Link from "next/link";
import { db } from "@/lib/prisma";
import { withTenant } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { SearchBox } from "@/components/shared/search-box";
import { SubmitButton } from "@/components/shared/submit-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ApprovalStatus } from "@/generated/prisma/enums";
import { reviewAdmission } from "./actions";

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const dateFormat = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" });

const approvalBadge: Record<string, string> = {
  NOT_REQUIRED: "text-muted-foreground",
  PENDING: "border-amber-600 text-amber-700",
  APPROVED: "border-green-600 text-green-700",
  REJECTED: "border-red-600 text-red-700",
};

const FILTERS = ["ALL", "PENDING", "APPROVED", "REJECTED"];

export default async function AdmissionsPage(props: PageProps<"/admissions">) {
  const { error, status, q } = await props.searchParams;
  const query = typeof q === "string" ? q.trim() : "";
  const statusFilter =
    typeof status === "string" && FILTERS.includes(status) && status !== "ALL"
      ? (status as ApprovalStatus)
      : undefined;

  const { admissions, pendingCount, canView, canApprove } = await withTenant(async () => {
    const canView = await hasPermission("admission.view");
    if (!canView) return { admissions: [], pendingCount: 0, canView, canApprove: false };
    return {
      admissions: await db.admission.findMany({
        where: {
          ...(statusFilter ? { approvalStatus: statusFilter } : {}),
          ...(query
            ? { student: { is: { OR: [{ name: { contains: query, mode: "insensitive" as const } }, { mobile: { contains: query } }] } } }
            : {}),
        },
        orderBy: { createdAt: "desc" },
        include: { student: true, course: true, counsellor: true },
        take: 100,
      }),
      pendingCount: await db.admission.count({ where: { approvalStatus: "PENDING" } }),
      canView,
      canApprove: await hasPermission("admission.approve"),
    };
  });

  if (!canView) {
    return (
      <div className="flex-1 p-6">
        <p className="text-sm text-muted-foreground">You don&apos;t have access to admissions.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Admissions</h1>
          <p className="text-sm text-muted-foreground">Course enrolments and their approval state.</p>
        </div>
        <SearchBox action="/admissions" placeholder="Search student or mobile..." defaultValue={query} />
      </div>

      {pendingCount > 0 && canApprove && (
        <p className="rounded-md border border-amber-600/40 bg-amber-600/10 px-3 py-2 text-sm text-amber-700">
          {pendingCount} admission{pendingCount === 1 ? "" : "s"} pending your approval.
        </p>
      )}
      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      <div className="flex gap-1 border-b">
        {FILTERS.map((f) => (
          <Link
            key={f}
            href={f === "ALL" ? "/admissions" : `/admissions?status=${f}`}
            className={cn(
              "rounded-t-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
              (statusFilter ?? "ALL") === f && "bg-muted font-medium text-foreground",
            )}
          >
            {f.charAt(0) + f.slice(1).toLowerCase()}
          </Link>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Course</TableHead>
              <TableHead className="text-right">Payable fee</TableHead>
              <TableHead className="text-right">Scholarship</TableHead>
              <TableHead>Counsellor</TableHead>
              <TableHead>Approval</TableHead>
              <TableHead>Date</TableHead>
              {canApprove && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {admissions.length === 0 && (
              <TableRow>
                <TableCell colSpan={canApprove ? 8 : 7} className="h-24 text-center text-muted-foreground">
                  No admissions{statusFilter ? ` with status ${statusFilter}` : " yet"}.
                </TableCell>
              </TableRow>
            )}
            {admissions.map((admission) => (
              <TableRow key={admission.id}>
                <TableCell>
                  <div className="font-medium">{admission.student.name}</div>
                  <div className="text-xs text-muted-foreground">{admission.student.mobile}</div>
                </TableCell>
                <TableCell>{admission.course.name}</TableCell>
                <TableCell className="text-right">{inr.format(Number(admission.totalFee))}</TableCell>
                <TableCell className="text-right">
                  {Number(admission.scholarshipPercent)}%
                  <div className="text-xs text-muted-foreground">
                    −{inr.format(Number(admission.scholarshipAmount))}
                  </div>
                </TableCell>
                <TableCell>{admission.counsellor?.name ?? "—"}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={approvalBadge[admission.approvalStatus]}>
                    {admission.approvalStatus.replace("_", " ")}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {dateFormat.format(admission.createdAt)}
                </TableCell>
                {canApprove && (
                  <TableCell className="text-right">
                    {admission.approvalStatus === "PENDING" ? (
                      <div className="flex justify-end gap-1">
                        <form action={reviewAdmission}>
                          <input type="hidden" name="admissionId" value={admission.id} />
                          <input type="hidden" name="decision" value="APPROVED" />
                          <SubmitButton size="sm" variant="outline" className="text-green-700">Approve</SubmitButton>
                        </form>
                        <form action={reviewAdmission}>
                          <input type="hidden" name="admissionId" value={admission.id} />
                          <input type="hidden" name="decision" value="REJECTED" />
                          <SubmitButton size="sm" variant="ghost" className="text-destructive">Reject</SubmitButton>
                        </form>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
