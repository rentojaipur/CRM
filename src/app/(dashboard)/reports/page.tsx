import { db } from "@/lib/prisma";
import { withTenant } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

const EXPORTS = [
  { entity: "leads", label: "Leads" },
  { entity: "students", label: "Students" },
  { entity: "admissions", label: "Admissions" },
  { entity: "fees", label: "Fee transactions" },
];

export default async function ReportsPage() {
  const { canView, counsellors, sources } = await withTenant(async () => {
    const canView = await hasPermission("reports.view");
    if (!canView) return { canView, counsellors: [], sources: [] };

    const users = await db.user.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
    const counsellors = await Promise.all(
      users.map(async (user) => {
        const [assignedLeads, followups, admissions, revenue] = await Promise.all([
          db.lead.count({ where: { assignedToUserId: user.id } }),
          db.lead.count({ where: { assignedToUserId: user.id, followups: { some: {} } } }),
          db.admission.count({ where: { counsellorId: user.id } }),
          db.feeTransaction.aggregate({
            _sum: { amount: true },
            where: { admission: { counsellorId: user.id } },
          }),
        ]);
        return {
          id: user.id,
          name: user.name,
          assignedLeads,
          followups,
          admissions,
          conversion: assignedLeads > 0 ? Math.round((admissions / assignedLeads) * 100) : 0,
          revenue: Number(revenue._sum.amount ?? 0),
        };
      }),
    );

    const sourceGroups = await db.lead.groupBy({ by: ["source"], _count: { _all: true } });
    const totalLeads = sourceGroups.reduce((sum, group) => sum + group._count._all, 0);
    const sources = sourceGroups
      .map((group) => ({
        source: group.source,
        count: group._count._all,
        percent: totalLeads > 0 ? Math.round((group._count._all / totalLeads) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    return { canView, counsellors: counsellors.filter((c) => c.assignedLeads + c.admissions > 0), sources };
  });

  if (!canView) {
    return (
      <div className="flex-1 p-6">
        <p className="text-sm text-muted-foreground">You don&apos;t have access to reports.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 p-6">
      <div>
        <h1 className="text-xl font-semibold">Reports</h1>
        <p className="text-sm text-muted-foreground">Performance and raw data export.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Raw data export</CardTitle>
          <CardDescription>Download your institute&apos;s data as CSV or Excel.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-x-6 gap-y-3">
          {EXPORTS.map((item) => (
            <div key={item.entity} className="flex items-center gap-2">
              <span className="text-sm">{item.label}:</span>
              <a
                href={`/reports/export/${item.entity}`}
                download
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                CSV
              </a>
              <a
                href={`/reports/export/${item.entity}?format=xlsx`}
                download
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Excel
              </a>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Counsellor performance</CardTitle>
            <CardDescription>Leads handled, conversions, and revenue per counsellor.</CardDescription>
          </CardHeader>
          <CardContent>
            {counsellors.length === 0 && (
              <p className="text-sm text-muted-foreground">No counsellor activity yet.</p>
            )}
            {counsellors.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Counsellor</TableHead>
                    <TableHead className="text-right">Leads</TableHead>
                    <TableHead className="text-right">With follow-up</TableHead>
                    <TableHead className="text-right">Admissions</TableHead>
                    <TableHead className="text-right">Conversion</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {counsellors.map((counsellor) => (
                    <TableRow key={counsellor.id}>
                      <TableCell className="font-medium">{counsellor.name}</TableCell>
                      <TableCell className="text-right">{counsellor.assignedLeads}</TableCell>
                      <TableCell className="text-right">{counsellor.followups}</TableCell>
                      <TableCell className="text-right">{counsellor.admissions}</TableCell>
                      <TableCell className="text-right">{counsellor.conversion}%</TableCell>
                      <TableCell className="text-right">{inr.format(counsellor.revenue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Leads by source</CardTitle>
          </CardHeader>
          <CardContent>
            {sources.length === 0 && <p className="text-sm text-muted-foreground">No leads yet.</p>}
            <div className="space-y-2">
              {sources.map((entry) => (
                <div key={entry.source}>
                  <div className="mb-0.5 flex justify-between text-sm">
                    <span>{entry.source.replace("_", "-")}</span>
                    <span className="text-muted-foreground">
                      {entry.count} · {entry.percent}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted">
                    <div className="h-1.5 rounded-full bg-primary" style={{ width: `${entry.percent}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
