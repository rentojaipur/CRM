import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/prisma";
import { withTenant } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SubmitButton } from "@/components/shared/submit-button";
import { collectFee } from "../actions";

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const dateFormat = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" });
const dateTime = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" });

type InstallmentEntry = { seq: number; amount: number; dueDate: string };

export default async function AdmissionAccountPage(props: PageProps<"/accounts/[admissionId]">) {
  const { admissionId } = await props.params;
  const { error } = await props.searchParams;

  const { admission, canView, canCollect } = await withTenant(async () => {
    const canView = await hasPermission("fee.view");
    if (!canView) return { admission: null, canView, canCollect: false };
    return {
      admission: await db.admission.findFirst({
        where: { id: admissionId },
        include: {
          student: true,
          course: true,
          feeTransactions: { orderBy: { paidAt: "desc" }, include: { recordedBy: true } },
        },
      }),
      canView,
      canCollect: await hasPermission("fee.collect"),
    };
  });

  if (!canView) {
    return (
      <div className="flex-1 p-6">
        <p className="text-sm text-muted-foreground">You don&apos;t have access to accounts.</p>
      </div>
    );
  }
  if (!admission) notFound();

  const total = Number(admission.totalFee);
  const paid = admission.feeTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
  const pending = total - paid;
  const plan = (admission.installmentPlan as InstallmentEntry[] | null) ?? [];
  const planRows = plan.map((entry, index) => {
    const start = plan.slice(0, index).reduce((sum, e) => sum + e.amount, 0);
    const covered = Math.max(0, Math.min(entry.amount, paid - start));
    return { ...entry, state: covered >= entry.amount ? "PAID" : covered > 0 ? "PARTIAL" : "DUE" };
  });

  return (
    <div className="flex-1 space-y-4 p-6">
      <div>
        <Link href="/accounts" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2 mb-1")}>
          ← Back to accounts
        </Link>
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">{admission.student.name}</h1>
          <span className="text-sm text-muted-foreground">{admission.course.name}</span>
        </div>
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      <div className="grid grid-cols-3 gap-3 sm:max-w-xl">
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground">Total fee</p>
          <p className="text-lg font-semibold">{inr.format(total)}</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground">Paid</p>
          <p className="text-lg font-semibold text-green-700">{inr.format(paid)}</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-3">
          <p className="text-xs text-muted-foreground">Pending</p>
          <p className="text-lg font-semibold text-destructive">{inr.format(pending)}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          {canCollect && pending > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Collect fee</CardTitle>
                <CardDescription>Records the payment and generates a receipt.</CardDescription>
              </CardHeader>
              <CardContent>
                <form action={collectFee} className="grid gap-4">
                  <input type="hidden" name="admissionId" value={admission.id} />
                  <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="amount">Amount (₹) *</Label>
                      <Input
                        id="amount"
                        name="amount"
                        type="number"
                        min="1"
                        max={pending}
                        step="1"
                        defaultValue={planRows.find((p) => p.state !== "PAID")?.amount ?? pending}
                        required
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="mode">Mode *</Label>
                      <select
                        id="mode"
                        name="mode"
                        required
                        className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
                      >
                        <option value="CASH">Cash</option>
                        <option value="UPI">UPI</option>
                        <option value="ONLINE">Online</option>
                        <option value="CHEQUE">Cheque</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="transactionRef">Reference (UTR / cheque no.)</Label>
                    <Input id="transactionRef" name="transactionRef" placeholder="Optional" />
                  </div>
                  <SubmitButton pendingText="Recording...">Collect &amp; generate receipt</SubmitButton>
                </form>
              </CardContent>
            </Card>
          )}
          {pending <= 0 && (
            <p className="rounded-md border border-green-600/40 bg-green-600/10 px-3 py-2 text-sm text-green-700">
              Fully paid. 🎉
            </p>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Installment plan</CardTitle>
            </CardHeader>
            <CardContent>
              {planRows.length === 0 && <p className="text-sm text-muted-foreground">No plan recorded.</p>}
              {planRows.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>#</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Due date</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {planRows.map((entry) => (
                      <TableRow key={entry.seq}>
                        <TableCell>{entry.seq}</TableCell>
                        <TableCell className="text-right">{inr.format(entry.amount)}</TableCell>
                        <TableCell>{dateFormat.format(new Date(entry.dueDate))}</TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              entry.state === "PAID"
                                ? "border-green-600 text-green-700"
                                : entry.state === "PARTIAL"
                                  ? "border-amber-600 text-amber-700"
                                  : "border-red-600 text-red-700"
                            }
                          >
                            {entry.state}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Payments</CardTitle>
            <CardDescription>
              {admission.feeTransactions.length} payment{admission.feeTransactions.length === 1 ? "" : "s"} recorded.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {admission.feeTransactions.length === 0 && (
              <p className="text-sm text-muted-foreground">No payments yet.</p>
            )}
            {admission.feeTransactions.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Receipt</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Mode</TableHead>
                    <TableHead>When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {admission.feeTransactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell>
                        <Link
                          href={`/accounts/receipt/${transaction.id}`}
                          className="font-medium text-blue-700 hover:underline"
                        >
                          {transaction.receiptNumber}
                        </Link>
                        <div className="text-xs text-muted-foreground">by {transaction.recordedBy.name}</div>
                      </TableCell>
                      <TableCell className="text-right">{inr.format(Number(transaction.amount))}</TableCell>
                      <TableCell className="text-xs">{transaction.mode}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {dateTime.format(transaction.paidAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
