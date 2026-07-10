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
import { statusBadge } from "../leads/status-badge";

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const dateFormat = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" });

export default async function DashboardPage() {
  const data = await withTenant(async () => {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [canLeads, canAdmissions, canFees, canApprove] = await Promise.all([
      hasPermission("lead.view"),
      hasPermission("admission.view"),
      hasPermission("fee.view"),
      hasPermission("admission.approve"),
    ]);

    const [todayLeads, monthAdmissions, monthRevenue, feeTotals, collectedTotal, pendingApprovals, recentLeads] =
      await Promise.all([
        canLeads ? db.lead.count({ where: { createdAt: { gte: startOfDay } } }) : null,
        canAdmissions ? db.admission.count({ where: { createdAt: { gte: startOfMonth } } }) : null,
        canFees
          ? db.feeTransaction.aggregate({ _sum: { amount: true }, where: { paidAt: { gte: startOfMonth } } })
          : null,
        canFees
          ? db.admission.aggregate({
              _sum: { totalFee: true },
              where: { approvalStatus: { in: ["NOT_REQUIRED", "APPROVED"] } },
            })
          : null,
        canFees ? db.feeTransaction.aggregate({ _sum: { amount: true } }) : null,
        canApprove ? db.admission.count({ where: { approvalStatus: "PENDING" } }) : null,
        canLeads
          ? db.lead.findMany({
              orderBy: { createdAt: "desc" },
              take: 5,
              include: { assignedTo: true, branch: true },
            })
          : null,
      ]);

    const totalFee = Number(feeTotals?._sum.totalFee ?? 0);
    const collected = Number(collectedTotal?._sum.amount ?? 0);

    return {
      todayLeads,
      monthAdmissions,
      monthRevenue: monthRevenue ? Number(monthRevenue._sum.amount ?? 0) : null,
      pendingFees: feeTotals ? totalFee - collected : null,
      pendingApprovals,
      recentLeads,
    };
  });

  const cards = [
    { label: "Today's leads", value: data.todayLeads, format: (v: number) => String(v) },
    { label: "Admissions this month", value: data.monthAdmissions, format: (v: number) => String(v) },
    {
      label: "Revenue this month",
      value: data.monthRevenue,
      format: (v: number) => inr.format(v),
      className: "text-green-700",
    },
    {
      label: "Pending fees",
      value: data.pendingFees,
      format: (v: number) => inr.format(v),
      className: "text-destructive",
    },
  ].filter((card) => card.value !== null);

  return (
    <div className="flex-1 space-y-4 p-6">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Today at a glance.</p>
      </div>

      {data.pendingApprovals !== null && data.pendingApprovals > 0 && (
        <Link
          href="/admissions?status=PENDING"
          className="block rounded-md border border-amber-600/40 bg-amber-600/10 px-3 py-2 text-sm text-amber-700 hover:bg-amber-600/20"
        >
          ⚠ {data.pendingApprovals} admission{data.pendingApprovals === 1 ? "" : "s"} pending your approval —
          click to review
        </Link>
      )}

      {cards.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {cards.map((card) => (
            <div key={card.label} className="rounded-lg bg-muted/50 p-4">
              <p className="text-xs text-muted-foreground">{card.label}</p>
              <p className={`text-2xl font-semibold ${card.className ?? ""}`}>
                {card.format(card.value as number)}
              </p>
            </div>
          ))}
        </div>
      )}

      {data.recentLeads && (
        <div className="rounded-lg border">
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <span className="text-sm font-medium">Recent leads</span>
            <Link href="/leads" className="text-xs text-muted-foreground hover:text-foreground hover:underline">
              View all →
            </Link>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lead</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Assigned to</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.recentLeads.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="h-20 text-center text-muted-foreground">
                    No leads yet.
                  </TableCell>
                </TableRow>
              )}
              {data.recentLeads.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell>
                    <Link href={`/leads/${lead.id}`} className="font-medium hover:underline">
                      {lead.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-xs">{lead.source.replace("_", "-")}</TableCell>
                  <TableCell>{lead.branch?.name ?? "—"}</TableCell>
                  <TableCell>{lead.assignedTo?.name ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={statusBadge[lead.status]}>
                      {lead.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {dateFormat.format(lead.createdAt)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
