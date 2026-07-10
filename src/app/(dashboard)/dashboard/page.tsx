import Link from "next/link";
import { db } from "@/lib/prisma";
import { withTenant } from "@/lib/tenant";
import { getTenantContext } from "@/lib/tenant-context";
import { hasPermission } from "@/lib/permissions";
import { auth } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { statusBadge } from "../leads/status-badge";
import { StatCard } from "@/components/shared/stat-card";

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const dateFormat = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" });

export default async function DashboardPage() {
  const session = await auth();

  const data = await withTenant(async () => {
    const userId = getTenantContext()!.userId;
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [canManageUsers, canLeads, canFollowup, canFees, canApprove] = await Promise.all([
      hasPermission("user.manage"),
      hasPermission("lead.view"),
      hasPermission("lead.followup"),
      hasPermission("fee.view"),
      hasPermission("admission.approve"),
    ]);
    const isAdmin = canManageUsers; // institute admin-like role

    // ---- Counsellor personal block (anyone who works leads) ----
    const my =
      canFollowup && !isAdmin
        ? {
            leads: await db.lead.count({ where: { assignedToUserId: userId } }),
            pendingFollowups: await db.lead.count({
              where: {
                assignedToUserId: userId,
                status: { in: ["NEW", "INTERESTED", "FOLLOWUP"] },
              },
            }),
            dueToday: await db.lead.count({
              where: {
                assignedToUserId: userId,
                status: { notIn: ["CONVERTED", "LOST"] },
                followups: { some: { nextFollowupDate: { lte: new Date() }, status: "SCHEDULED" } },
              },
            }),
            admissions: await db.admission.count({ where: { counsellorId: userId } }),
            myLeads: await db.lead.findMany({
              where: { assignedToUserId: userId, status: { notIn: ["CONVERTED", "LOST"] } },
              orderBy: { updatedAt: "desc" },
              take: 5,
              include: { branch: true },
            }),
          }
        : null;

    // ---- Accounts block ----
    const accounts = canFees
      ? await (async () => {
          const [todayCollection, monthCollection, feeTotals, collectedTotal, recentPayments] =
            await Promise.all([
              db.feeTransaction.aggregate({ _sum: { amount: true }, where: { paidAt: { gte: startOfDay } } }),
              db.feeTransaction.aggregate({ _sum: { amount: true }, where: { paidAt: { gte: startOfMonth } } }),
              db.admission.aggregate({
                _sum: { totalFee: true },
                where: { approvalStatus: { in: ["NOT_REQUIRED", "APPROVED"] } },
              }),
              db.feeTransaction.aggregate({ _sum: { amount: true } }),
              db.feeTransaction.findMany({
                orderBy: { paidAt: "desc" },
                take: 5,
                include: { student: true },
              }),
            ]);
          return {
            today: Number(todayCollection._sum.amount ?? 0),
            month: Number(monthCollection._sum.amount ?? 0),
            pending: Number(feeTotals._sum.totalFee ?? 0) - Number(collectedTotal._sum.amount ?? 0),
            recentPayments,
          };
        })()
      : null;

    // ---- Admin overview ----
    const admin = isAdmin
      ? await (async () => {
          const [todayLeads, monthLeads, monthAdmissions, students, users] = await Promise.all([
            db.lead.count({ where: { createdAt: { gte: startOfDay } } }),
            db.lead.count({ where: { createdAt: { gte: startOfMonth } } }),
            db.admission.count({ where: { createdAt: { gte: startOfMonth } } }),
            db.student.count(),
            db.user.findMany({ where: { isActive: true } }),
          ]);
          const counsellorCards = (
            await Promise.all(
              users.map(async (user) => {
                const [leads, admissions, revenue] = await Promise.all([
                  db.lead.count({ where: { assignedToUserId: user.id } }),
                  db.admission.count({ where: { counsellorId: user.id } }),
                  db.feeTransaction.aggregate({
                    _sum: { amount: true },
                    where: { admission: { counsellorId: user.id } },
                  }),
                ]);
                return { id: user.id, name: user.name, leads, admissions, revenue: Number(revenue._sum.amount ?? 0) };
              }),
            )
          ).filter((c) => c.leads + c.admissions > 0);
          return { todayLeads, monthLeads, monthAdmissions, students, counsellorCards };
        })()
      : null;

    const pendingApprovals = canApprove
      ? await db.admission.count({ where: { approvalStatus: "PENDING" } })
      : 0;
    const recentLeads =
      isAdmin && canLeads
        ? await db.lead.findMany({
            orderBy: { createdAt: "desc" },
            take: 5,
            include: { assignedTo: true, branch: true },
          })
        : null;

    return { my, accounts, admin, pendingApprovals, recentLeads, isAdmin };
  });

  return (
    <div className="flex-1 space-y-5 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-semibold">
          Hi {session?.user.name?.split(" ")[0]} 👋
        </h1>
        <p className="text-sm text-muted-foreground">Here&apos;s what needs your attention today.</p>
      </div>

      {data.pendingApprovals > 0 && (
        <Link
          href="/admissions?status=PENDING"
          className="block rounded-lg border border-amber-500/50 bg-gradient-to-r from-amber-500/15 to-amber-500/5 px-4 py-3 text-sm font-medium text-amber-800 transition-colors hover:from-amber-500/25 dark:text-amber-400"
        >
          ⚠ {data.pendingApprovals} admission{data.pendingApprovals === 1 ? "" : "s"} pending your approval —
          review now →
        </Link>
      )}

      {data.my && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">My work</h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="My leads" value={String(data.my.leads)} tone="blue" icon="leads" />
            <StatCard
              label="In pipeline"
              value={String(data.my.pendingFollowups)}
              tone="amber"
              icon="followup"
            />
            <StatCard label="Due today" value={String(data.my.dueToday)} tone="red" icon="clock" />
            <StatCard label="My admissions" value={String(data.my.admissions)} tone="green" icon="admissions" />
          </div>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-sm font-medium">
                My active leads
                <Link href="/leads" className="text-xs font-normal text-primary hover:underline">
                  View all →
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lead</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.my.myLeads.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="h-16 text-center text-muted-foreground">
                        Nothing pending — great job!
                      </TableCell>
                    </TableRow>
                  )}
                  {data.my.myLeads.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell>
                        <Link href={`/leads/${lead.id}`} className="font-medium hover:underline">
                          {lead.name}
                        </Link>
                        <div className="text-xs text-muted-foreground">{lead.mobile}</div>
                      </TableCell>
                      <TableCell>{lead.branch?.name ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusBadge[lead.status]}>
                          {lead.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>
      )}

      {data.admin && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Leads &amp; admissions
          </h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard label="Today's leads" value={String(data.admin.todayLeads)} tone="blue" icon="leads" />
            <StatCard label="Leads this month" value={String(data.admin.monthLeads)} tone="violet" icon="leads" />
            <StatCard
              label="Admissions this month"
              value={String(data.admin.monthAdmissions)}
              tone="green"
              icon="admissions"
            />
            <StatCard label="Total students" value={String(data.admin.students)} tone="slate" icon="students" />
          </div>
        </section>
      )}

      {data.accounts && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Accounts</h2>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard
              label="Collected today"
              value={inr.format(data.accounts.today)}
              tone="green"
              icon="fees"
            />
            <StatCard
              label="Collected this month"
              value={inr.format(data.accounts.month)}
              tone="green"
              icon="fees"
            />
            <StatCard label="Pending fees" value={inr.format(data.accounts.pending)} tone="red" icon="fees" />
            <Link href="/accounts" className="flex items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary">
              Open accounts →
            </Link>
          </div>
          {!data.isAdmin && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Recent payments</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <Table>
                  <TableBody>
                    {data.accounts.recentPayments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="font-medium">{payment.student.name}</TableCell>
                        <TableCell>{payment.mode}</TableCell>
                        <TableCell className="text-right text-green-700">
                          {inr.format(Number(payment.amount))}
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">
                          {dateFormat.format(payment.paidAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </section>
      )}

      {data.admin && data.admin.counsellorCards.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Counsellor performance
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.admin.counsellorCards.map((counsellor) => (
              <Card key={counsellor.id}>
                <CardContent className="pt-4">
                  <div className="mb-3 flex items-center gap-2">
                    <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {counsellor.name
                        .split(" ")
                        .map((part) => part[0])
                        .slice(0, 2)
                        .join("")}
                    </div>
                    <span className="text-sm font-medium">{counsellor.name}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-lg font-semibold">{counsellor.leads}</p>
                      <p className="text-xs text-muted-foreground">Leads</p>
                    </div>
                    <div>
                      <p className="text-lg font-semibold">{counsellor.admissions}</p>
                      <p className="text-xs text-muted-foreground">Admissions</p>
                    </div>
                    <div>
                      <p className="text-lg font-semibold">{inr.format(counsellor.revenue)}</p>
                      <p className="text-xs text-muted-foreground">Revenue</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      {data.recentLeads && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Recent leads</h2>
          <Card>
            <CardContent className="overflow-x-auto pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lead</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Assigned to</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentLeads.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell>
                        <Link href={`/leads/${lead.id}`} className="font-medium hover:underline">
                          {lead.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-xs">{lead.source.replace("_", "-")}</TableCell>
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
            </CardContent>
          </Card>
        </section>
      )}
    </div>
  );
}
