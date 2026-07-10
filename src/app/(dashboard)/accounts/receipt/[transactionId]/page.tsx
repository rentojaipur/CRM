import Link from "next/link";
import { notFound } from "next/navigation";
import { db, prisma } from "@/lib/prisma";
import { withTenant } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { requireInstituteId } from "@/lib/tenant-context";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { PrintButton } from "@/components/shared/print-button";

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const dateTime = new Intl.DateTimeFormat("en-IN", { dateStyle: "long", timeStyle: "short" });

export default async function ReceiptPage(props: PageProps<"/accounts/receipt/[transactionId]">) {
  const { transactionId } = await props.params;

  const { transaction, institute, canView } = await withTenant(async () => {
    const canView = await hasPermission("fee.view");
    if (!canView) return { transaction: null, institute: null, canView };
    return {
      transaction: await db.feeTransaction.findFirst({
        where: { id: transactionId },
        include: {
          student: true,
          admission: { include: { course: true, feeTransactions: true } },
          recordedBy: true,
        },
      }),
      institute: await prisma.institute.findUnique({ where: { id: requireInstituteId() } }),
      canView,
    };
  });

  if (!canView) {
    return (
      <div className="flex-1 p-6">
        <p className="text-sm text-muted-foreground">You don&apos;t have access to receipts.</p>
      </div>
    );
  }
  if (!transaction || !institute) notFound();

  const admission = transaction.admission;
  const totalFee = admission ? Number(admission.totalFee) : null;
  const paidTillThis = admission
    ? admission.feeTransactions
        .filter((t) => t.paidAt <= transaction.paidAt)
        .reduce((sum, t) => sum + Number(t.amount), 0)
    : null;

  return (
    <div className="flex-1 p-6">
      <div className="mx-auto max-w-lg space-y-4">
        <div className="flex items-center justify-between print:hidden">
          <Link
            href={admission ? `/accounts/${admission.id}` : "/accounts"}
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2")}
          >
            ← Back
          </Link>
          <PrintButton />
        </div>

        <div className="rounded-lg border p-6 print:border-0 print:p-0">
          <div className="text-center">
            <h1 className="text-lg font-semibold">{institute.name}</h1>
            {institute.address && <p className="text-xs text-muted-foreground">{institute.address}</p>}
            {institute.gstNumber && (
              <p className="text-xs text-muted-foreground">GSTIN: {institute.gstNumber}</p>
            )}
            <p className="mt-2 text-sm font-medium tracking-wide">FEE RECEIPT</p>
          </div>

          <Separator className="my-4" />

          <dl className="grid gap-1.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Receipt no.</dt>
              <dd className="font-medium">{transaction.receiptNumber}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Date</dt>
              <dd>{dateTime.format(transaction.paidAt)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Student</dt>
              <dd className="font-medium">{transaction.student.name}</dd>
            </div>
            {transaction.student.fatherName && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Father&apos;s name</dt>
                <dd>{transaction.student.fatherName}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Mobile</dt>
              <dd>{transaction.student.mobile}</dd>
            </div>
            {admission && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Course</dt>
                <dd>{admission.course.name}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Payment mode</dt>
              <dd>{transaction.mode}</dd>
            </div>
            {transaction.transactionRef && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Reference</dt>
                <dd>{transaction.transactionRef}</dd>
              </div>
            )}
          </dl>

          <Separator className="my-4" />

          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">Amount received</span>
            <span className="text-2xl font-semibold">{inr.format(Number(transaction.amount))}</span>
          </div>

          {totalFee !== null && paidTillThis !== null && (
            <div className="mt-3 grid gap-1 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Total course fee</span>
                <span>{inr.format(totalFee)}</span>
              </div>
              <div className="flex justify-between">
                <span>Paid till this receipt</span>
                <span>{inr.format(paidTillThis)}</span>
              </div>
              <div className="flex justify-between font-medium text-foreground">
                <span>Balance</span>
                <span>{inr.format(totalFee - paidTillThis)}</span>
              </div>
            </div>
          )}

          <Separator className="my-4" />

          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Received by: {transaction.recordedBy.name}</span>
            <span>Computer-generated receipt</span>
          </div>
        </div>
      </div>
    </div>
  );
}
