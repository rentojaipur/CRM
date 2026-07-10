import { db } from "@/lib/prisma";
import { withTenant } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
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
import { PasswordInput } from "@/components/shared/password-input";
import { SubmitButton } from "@/components/shared/submit-button";
import { createUser, toggleUserActive } from "./actions";

const dateFormat = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" });

export default async function UsersPage(props: PageProps<"/settings/users">) {
  const { error } = await props.searchParams;

  const { users, roles, branches, canManage } = await withTenant(async () => ({
    users: await db.user.findMany({
      orderBy: { createdAt: "asc" },
      include: { role: true, branch: true },
    }),
    roles: await db.role.findMany({ orderBy: { createdAt: "asc" } }),
    branches: await db.branch.findMany({ orderBy: { name: "asc" } }),
    canManage: await hasPermission("user.manage"),
  }));

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div className="space-y-3">
        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
        )}
        <div className="overflow-x-auto rounded-lg border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Last login</TableHead>
                <TableHead>Status</TableHead>
                {canManage && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="font-medium">{user.name}</div>
                    <div className="text-xs text-muted-foreground">{user.email}</div>
                  </TableCell>
                  <TableCell>{user.role.name}</TableCell>
                  <TableCell>{user.branch?.name ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {user.lastLoginAt ? dateFormat.format(user.lastLoginAt) : "Never"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={user.isActive ? "outline" : "destructive"}
                      className={user.isActive ? "border-green-600 text-green-700" : ""}
                    >
                      {user.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <form action={toggleUserActive} className="inline">
                        <input type="hidden" name="userId" value={user.id} />
                        <SubmitButton variant="ghost" size="sm">{user.isActive ? "Deactivate" : "Activate"}</SubmitButton>
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
            <CardTitle className="text-base">Add user</CardTitle>
            <CardDescription>A staff member of your institute.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createUser} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Full name *</Label>
                <Input id="name" name="name" placeholder="Sneha Verma" required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">Email *</Label>
                <Input id="email" name="email" type="email" placeholder="sneha@institute.com" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" name="phone" placeholder="+91 98765 43210" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="password">Password *</Label>
                  <PasswordInput id="password" name="password" minLength={8} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="roleId">Role *</Label>
                  <select
                    id="roleId"
                    name="roleId"
                    required
                    className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
                  >
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name}
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
                    <option value="">All branches</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <SubmitButton pendingText="Adding...">Add user</SubmitButton>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
