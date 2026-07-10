import Link from "next/link";
import { db } from "@/lib/prisma";
import { withTenant } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const dateFormat = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" });

type InstallmentEntry = { seq: number; amount: number; dueDate: string };

export default async function AccountsPage() {
  const { admissions, canView } = await withTenant(async () => {
    const canView = await hasPermission("fee.view");
    if (!canView) return { admissions: [], canView };
    return {
      admissions: await db.admission.findMany({
        where: { approvalStatus: { in: ["NOT_REQUIRED", "APPROVED"] } },
        orderBy: { createdAt: "desc" },
        include: { student: true, course: true, feeTransactions: true },
        take: 100,
      }),
      canView,
    };
  });

  if (!canView) {
    return (
      <div className="flex-1 p-6">
        <p className="text-sm text-muted-foreground">You don&apos;t have access to accounts.</p>
      </div>
    );
  }

  const rows = admissions.map((admission) => {
    const total = Number(admission.totalFee);
    const paid = admission.feeTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
    const pending = total - paid;
    const plan = (admission.installmentPlan as InstallmentEntry[] | null) ?? [];
    // Next unpaid installment: first plan entry whose cumulative amount
    // exceeds what's been paid so far.
    const nextDue = plan.find(
      (entry, index) => plan.slice(0, index + 1).reduce((sum, e) => sum + e.amount, 0) > paid,
    );
    return { admission, total, paid, pending, nextDue };
  });

  const totals = rows.reduce(
    (acc, row) => ({ total: acc.total + row.total, paid: acc.paid + row.paid, pending: acc.pending + row.pending }),
    { total: 0, paid: 0, pending: 0 },
  );

  return (
    <div className="flex-1 space-y-4 p-6">
      <div>
        <h1 className="text-xl font-semibold">Accounts</h1>
        <p className="text-sm text-muted-foreground">Fee collection and pending tracking.</p>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:max-w-xl">
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground">Total fee</p>
          <p className="text-lg font-semibold">{inr.format(totals.total)}</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground">Collected</p>
          <p className="text-lg font-semibold text-green-700">{inr.format(totals.paid)}</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground">Pending</p>
          <p className="text-lg font-semibold text-destructive">{inr.format(totals.pending)}</p>
        </div>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Course</TableHead>
              <TableHead className="text-right">Total fee</TableHead>
              <TableHead className="text-right">Paid</TableHead>
              <TableHead className="text-right">Pending</TableHead>
              <TableHead>Next due</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No approved admissions yet.
                </TableCell>
              </TableRow>
            )}
            {rows.map(({ admission, total, paid, pending, nextDue }) => (
              <TableRow key={admission.id}>
                <TableCell>
                  <Link href={`/accounts/${admission.id}`} className="font-medium hover:underline">
                    {admission.student.name}
                  </Link>
                  <div className="text-xs text-muted-foreground">{admission.student.mobile}</div>
                </TableCell>
                <TableCell>{admission.course.name}</TableCell>
                <TableCell className="text-right">{inr.format(total)}</TableCell>
                <TableCell className="text-right text-green-700">{inr.format(paid)}</TableCell>
                <TableCell className="text-right text-destructive">{inr.format(pending)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {pending <= 0 || !nextDue ? "—" : dateFormat.format(new Date(nextDue.dueDate))}
                </TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={pending <= 0 ? "border-green-600 text-green-700" : "border-amber-600 text-amber-700"}
                  >
                    {pending <= 0 ? "PAID" : paid > 0 ? "PARTIAL" : "UNPAID"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
