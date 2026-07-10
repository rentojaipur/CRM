import Link from "next/link";
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
import type { LeadStatus } from "@/generated/prisma/enums";
import { SearchBox } from "@/components/shared/search-box";
import { SubmitButton } from "@/components/shared/submit-button";
import { createLead } from "./actions";
import { statusBadge } from "./status-badge";

const dateFormat = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" });

const SOURCES = ["WEBSITE", "WALK_IN", "GOOGLE", "FACEBOOK", "ANTHE", "REFERRAL", "OTHER"];
const STATUS_FILTERS = ["ALL", "NEW", "INTERESTED", "FOLLOWUP", "CONVERTED", "LOST"];

export default async function LeadsPage(props: PageProps<"/leads">) {
  const { error, status, q } = await props.searchParams;
  const query = typeof q === "string" ? q.trim() : "";
  const statusFilter =
    typeof status === "string" && STATUS_FILTERS.includes(status) && status !== "ALL"
      ? (status as LeadStatus)
      : undefined;

  const { leads, branches, users, canView, canCreate } = await withTenant(async () => {
    const canView = await hasPermission("lead.view");
    if (!canView) {
      return { leads: [], branches: [], users: [], canView, canCreate: false };
    }
    return {
      leads: await db.lead.findMany({
        where: {
          ...(statusFilter ? { status: statusFilter } : {}),
          ...(query
            ? { OR: [{ name: { contains: query, mode: "insensitive" as const } }, { mobile: { contains: query } }] }
            : {}),
        },
        orderBy: { createdAt: "desc" },
        include: { branch: true, assignedTo: true, _count: { select: { followups: true } } },
        take: 100,
      }),
      branches: await db.branch.findMany({ orderBy: { name: "asc" } }),
      users: await db.user.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
      canView,
      canCreate: await hasPermission("lead.create"),
    };
  });

  if (!canView) {
    return (
      <div className="flex-1 p-6">
        <p className="text-sm text-muted-foreground">You don&apos;t have access to leads.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Leads</h1>
          <p className="text-sm text-muted-foreground">Enquiries and their follow-up pipeline.</p>
        </div>
        <div className="flex items-center gap-2">
          <SearchBox action="/leads" placeholder="Search name or mobile..." defaultValue={query} />
          {canCreate && (
            <Link href="/leads/import" className={buttonVariants({ variant: "outline" })}>
              Import
            </Link>
          )}
        </div>
      </div>

      <div className="flex gap-1 border-b">
        {STATUS_FILTERS.map((s) => (
          <Link
            key={s}
            href={s === "ALL" ? "/leads" : `/leads?status=${s}`}
            className={cn(
              "rounded-t-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
              (statusFilter ?? "ALL") === s && "bg-muted font-medium text-foreground",
            )}
          >
            {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
          </Link>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <div className="space-y-3">
          {error && (
            <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
          )}
          <div className="overflow-x-auto rounded-lg border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Branch</TableHead>
                  <TableHead>Assigned to</TableHead>
                  <TableHead className="text-right">Follow-ups</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      No leads{statusFilter ? ` with status ${statusFilter}` : " yet"}.
                    </TableCell>
                  </TableRow>
                )}
                {leads.map((lead) => (
                  <TableRow key={lead.id}>
                    <TableCell>
                      <Link href={`/leads/${lead.id}`} className="font-medium hover:underline">
                        {lead.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">{lead.mobile}</div>
                    </TableCell>
                    <TableCell className="text-xs">{lead.source.replace("_", "-")}</TableCell>
                    <TableCell>{lead.branch?.name ?? "—"}</TableCell>
                    <TableCell>{lead.assignedTo?.name ?? "—"}</TableCell>
                    <TableCell className="text-right">{lead._count.followups}</TableCell>
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
        </div>

        {canCreate && (
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="text-base">New lead</CardTitle>
              <CardDescription>Capture an enquiry.</CardDescription>
            </CardHeader>
            <CardContent>
              <form action={createLead} className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Student name *</Label>
                  <Input id="name" name="name" placeholder="Aarav Sharma" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="fatherName">Father&apos;s name</Label>
                    <Input id="fatherName" name="fatherName" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="mobile">Mobile *</Label>
                    <Input id="mobile" name="mobile" placeholder="98765 43210" required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" name="email" type="email" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="dob">Date of birth</Label>
                    <Input id="dob" name="dob" type="date" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="school">School</Label>
                    <Input id="school" name="school" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="class">Class</Label>
                    <Input id="class" name="class" placeholder="X" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="source">Source *</Label>
                    <select
                      id="source"
                      name="source"
                      required
                      className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
                    >
                      {SOURCES.map((source) => (
                        <option key={source} value={source}>
                          {source.charAt(0) + source.slice(1).toLowerCase().replace("_", "-")}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="branchId">Branch</Label>
                    <select
                      id="branchId"
                      name="branchId"
                      className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
                    >
                      <option value="">—</option>
                      {branches.map((branch) => (
                        <option key={branch.id} value={branch.id}>
                          {branch.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="assignedToUserId">Assign to</Label>
                  <select
                    id="assignedToUserId"
                    name="assignedToUserId"
                    className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
                  >
                    <option value="">Unassigned</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                </div>
                <SubmitButton pendingText="Creating...">Create lead</SubmitButton>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
