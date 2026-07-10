import { prisma } from "@/lib/prisma";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export default async function SuperAdminReportsPage() {
  const [institutes, users, students, revenue] = await Promise.all([
    prisma.institute.count(),
    prisma.user.count({ where: { instituteId: { not: null } } }),
    prisma.student.count(),
    prisma.feeTransaction.aggregate({ _sum: { amount: true } }),
  ]);

  const cards = [
    { label: "Institutes", value: String(institutes) },
    { label: "Total users", value: String(users) },
    { label: "Total students", value: String(students) },
    { label: "Fees collected (platform)", value: inr.format(Number(revenue._sum.amount ?? 0)) },
  ];

  return (
    <div className="flex-1 space-y-4 p-6">
      <div>
        <h1 className="text-xl font-semibold">Global reports</h1>
        <p className="text-sm text-muted-foreground">Platform-wide numbers across all institutes.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-lg bg-muted/50 p-4">
            <p className="text-xs text-muted-foreground">{card.label}</p>
            <p className="text-2xl font-semibold">{card.value}</p>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Raw data export</CardTitle>
          <CardDescription>All institutes with usage counts and collected revenue.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <a href="/super-admin/export" download className={buttonVariants({ variant: "outline", size: "sm" })}>
            CSV
          </a>
          <a
            href="/super-admin/export?format=xlsx"
            download
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Excel
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
