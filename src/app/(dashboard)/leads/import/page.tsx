import Link from "next/link";
import { withTenant } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LEAD_IMPORT_COLUMNS } from "@/lib/lead-import";
import { ImportForm } from "./import-form";

export default async function LeadImportPage() {
  const canCreate = await withTenant(() => hasPermission("lead.create"));

  if (!canCreate) {
    return (
      <div className="flex-1 p-6">
        <p className="text-sm text-muted-foreground">You don&apos;t have permission to import leads.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6">
      <div className="mx-auto max-w-2xl space-y-4">
        <div>
          <Link href="/leads" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2 mb-1")}>
            ← Back to leads
          </Link>
          <h1 className="text-xl font-semibold">Bulk import leads</h1>
          <p className="text-sm text-muted-foreground">
            Upload a .csv or .xlsx file — up to 1,000 leads at a time.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Step 1 — Download the template</CardTitle>
            <CardDescription>
              Fill your data in this exact format, then upload it below. Required columns:{" "}
              <code className="text-xs">name</code> and <code className="text-xs">mobile</code>; the rest are
              optional.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <a href="/leads/import/sample" download className={buttonVariants({ variant: "outline" })}>
              Download sample CSV
            </a>
            <p className="text-xs text-muted-foreground">
              Columns: {LEAD_IMPORT_COLUMNS.join(", ")} · source one of WEBSITE, WALK_IN, GOOGLE, FACEBOOK,
              ANTHE, REFERRAL, OTHER · dob as YYYY-MM-DD · branch by name · assignedToEmail must be an existing
              user&apos;s email.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Step 2 — Upload your file</CardTitle>
            <CardDescription>
              Rows with problems are skipped and reported — the rest import fine.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ImportForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
