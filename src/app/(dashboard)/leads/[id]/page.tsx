import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/prisma";
import { withTenant } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { addFollowup, updateLeadStatus } from "../actions";
import { statusBadge } from "../status-badge";

const dateTime = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" });
const dateOnly = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" });

const LEAD_STATUSES = ["NEW", "INTERESTED", "FOLLOWUP", "CONVERTED", "LOST"];

export default async function LeadDetailPage(props: PageProps<"/leads/[id]">) {
  const { id } = await props.params;
  const { error } = await props.searchParams;

  const { lead, canView, canFollowup } = await withTenant(async () => {
    const canView = await hasPermission("lead.view");
    if (!canView) return { lead: null, canView, canFollowup: false };
    return {
      lead: await db.lead.findFirst({
        where: { id },
        include: {
          branch: true,
          assignedTo: true,
          followups: { orderBy: { createdAt: "desc" }, include: { createdBy: true } },
        },
      }),
      canView,
      canFollowup: await hasPermission("lead.followup"),
    };
  });

  if (!canView) {
    return (
      <div className="flex-1 p-6">
        <p className="text-sm text-muted-foreground">You don&apos;t have access to leads.</p>
      </div>
    );
  }
  if (!lead) notFound();

  const details: Array<[string, string]> = [
    ["Father's name", lead.fatherName ?? "—"],
    ["Mobile", lead.mobile],
    ["Email", lead.email ?? "—"],
    ["Date of birth", lead.dob ? dateOnly.format(lead.dob) : "—"],
    ["School", lead.school ?? "—"],
    ["Class", lead.class ?? "—"],
    ["Source", lead.source.replace("_", "-")],
    ["Branch", lead.branch?.name ?? "—"],
    ["Assigned to", lead.assignedTo?.name ?? "Unassigned"],
    ["Created", dateTime.format(lead.createdAt)],
  ];

  return (
    <div className="flex-1 space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/leads"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2 mb-1")}
          >
            ← Back to leads
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold">{lead.name}</h1>
            <Badge variant="outline" className={statusBadge[lead.status]}>
              {lead.status}
            </Badge>
          </div>
        </div>
        {canFollowup && (
          <form action={updateLeadStatus} className="flex items-center gap-2">
            <input type="hidden" name="leadId" value={lead.id} />
            <select
              name="status"
              defaultValue={lead.status}
              className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
            >
              {LEAD_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status.charAt(0) + status.slice(1).toLowerCase()}
                </option>
              ))}
            </select>
            <Button type="submit" variant="outline">
              Update status
            </Button>
          </form>
        )}
      </div>

      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Lead details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-2 text-sm">
              {details.map(([label, value]) => (
                <div key={label} className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="text-right font-medium">{value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {canFollowup && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Add follow-up</CardTitle>
                <CardDescription>Log the conversation and schedule the next call.</CardDescription>
              </CardHeader>
              <CardContent>
                <form action={addFollowup} className="grid gap-4">
                  <input type="hidden" name="leadId" value={lead.id} />
                  <div className="grid gap-2">
                    <Label htmlFor="remark">Remark *</Label>
                    <textarea
                      id="remark"
                      name="remark"
                      required
                      rows={2}
                      placeholder="Parent wants a callback tomorrow evening..."
                      className="border-input rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs"
                    />
                  </div>
                  <div className="flex items-end gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="nextFollowupDate">Next follow-up</Label>
                      <Input id="nextFollowupDate" name="nextFollowupDate" type="date" />
                    </div>
                    <Button type="submit">Add follow-up</Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Timeline</CardTitle>
              <CardDescription>
                {lead.followups.length} follow-up{lead.followups.length === 1 ? "" : "s"} so far.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {lead.followups.length === 0 && (
                <p className="text-sm text-muted-foreground">No follow-ups yet.</p>
              )}
              <ol className="space-y-0">
                {lead.followups.map((followup, index) => (
                  <li key={followup.id} className="relative flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                      {index < lead.followups.length - 1 && (
                        <span className="w-px flex-1 bg-border" />
                      )}
                    </div>
                    <div className="pb-5">
                      <p className="text-sm">{followup.remark}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {followup.createdBy.name} · {dateTime.format(followup.createdAt)}
                        {followup.nextFollowupDate && (
                          <> · next: {dateOnly.format(followup.nextFollowupDate)}</>
                        )}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
              {lead.followups.length > 0 && <Separator className="mt-1" />}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
