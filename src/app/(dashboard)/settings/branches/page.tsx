import { db } from "@/lib/prisma";
import { withTenant } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { SubmitButton } from "@/components/shared/submit-button";
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
import { createBranch, deleteBranch } from "./actions";

export default async function BranchesPage(props: PageProps<"/settings/branches">) {
  const { error } = await props.searchParams;

  const { branches, canManage } = await withTenant(async () => ({
    branches: await db.branch.findMany({
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { users: true, students: true, batches: true } } },
    }),
    canManage: await hasPermission("branch.manage"),
  }));

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div className="space-y-3">
        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
        )}
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Branch</TableHead>
                <TableHead className="text-right">Users</TableHead>
                <TableHead className="text-right">Students</TableHead>
                <TableHead className="text-right">Batches</TableHead>
                {canManage && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {branches.length === 0 && (
                <TableRow>
                  <TableCell colSpan={canManage ? 5 : 4} className="h-24 text-center text-muted-foreground">
                    No branches yet. Add your first branch.
                  </TableCell>
                </TableRow>
              )}
              {branches.map((branch) => (
                <TableRow key={branch.id}>
                  <TableCell>
                    <div className="font-medium">{branch.name}</div>
                    {branch.address && (
                      <div className="text-xs text-muted-foreground">{branch.address}</div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{branch._count.users}</TableCell>
                  <TableCell className="text-right">{branch._count.students}</TableCell>
                  <TableCell className="text-right">{branch._count.batches}</TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <form action={deleteBranch} className="inline">
                        <input type="hidden" name="branchId" value={branch.id} />
                        <SubmitButton variant="ghost" size="sm" className="text-destructive">Delete</SubmitButton>
                      </form>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {canManage && (
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Add branch</CardTitle>
            <CardDescription>A location of your institute, e.g. Pratap Nagar.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createBranch} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Branch name *</Label>
                <Input id="name" name="name" placeholder="Pratap Nagar" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="address">Address</Label>
                <Input id="address" name="address" placeholder="Street, area, city" />
              </div>
              <SubmitButton pendingText="Adding...">Add branch</SubmitButton>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
