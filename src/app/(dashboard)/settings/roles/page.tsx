import Link from "next/link";
import { db, prisma } from "@/lib/prisma";
import { withTenant } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createRole, deleteRole, updateRolePermissions } from "./actions";

export default async function RolesPage(props: PageProps<"/settings/roles">) {
  const { error, saved, role: selectedRoleId } = await props.searchParams;

  const { roles, permissions, canManage } = await withTenant(async () => ({
    roles: await db.role.findMany({
      orderBy: { createdAt: "asc" },
      include: {
        rolePermissions: { where: { allowed: true }, include: { permission: true } },
        _count: { select: { users: true } },
      },
    }),
    permissions: await prisma.permission.findMany({ orderBy: [{ module: "asc" }, { label: "asc" }] }),
    canManage: await hasPermission("role.manage"),
  }));

  const selectedRole = roles.find((r) => r.id === selectedRoleId) ?? roles[0];
  const grantedKeys = new Set(selectedRole?.rolePermissions.map((rp) => rp.permission.key) ?? []);

  const modules = [...new Set(permissions.map((p) => p.module))];

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
      )}
      {saved && (
        <p className="rounded-md bg-green-600/10 px-3 py-2 text-sm text-green-700">
          Permissions saved.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <div className="space-y-4">
          <div className="rounded-lg border">
            {roles.map((role) => (
              <Link
                key={role.id}
                href={`/settings/roles?role=${role.id}`}
                className={cn(
                  "flex items-center justify-between border-b px-3 py-2.5 text-sm last:border-b-0 hover:bg-muted",
                  role.id === selectedRole?.id && "bg-muted font-medium",
                )}
              >
                <span className="flex items-center gap-2">
                  {role.name}
                  {role.isSystem && (
                    <Badge variant="outline" className="text-xs">
                      Protected
                    </Badge>
                  )}
                </span>
                <span className="text-xs text-muted-foreground">
                  {role._count.users} user{role._count.users === 1 ? "" : "s"}
                </span>
              </Link>
            ))}
          </div>

          {canManage && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">New role</CardTitle>
                <CardDescription>e.g. Telecaller, Branch Manager.</CardDescription>
              </CardHeader>
              <CardContent>
                <form action={createRole} className="flex gap-2">
                  <div className="grid flex-1 gap-2">
                    <Label htmlFor="name" className="sr-only">
                      Role name
                    </Label>
                    <Input id="name" name="name" placeholder="Role name" required />
                  </div>
                  <Button type="submit">Create</Button>
                </form>
              </CardContent>
            </Card>
          )}
        </div>

        {selectedRole && (
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-base">{selectedRole.name} — permissions</CardTitle>
                  <CardDescription>
                    {selectedRole.isSystem
                      ? "This protected role always has every permission."
                      : "Tick what this role is allowed to do, then save."}
                  </CardDescription>
                </div>
                {canManage && !selectedRole.isSystem && selectedRole._count.users === 0 && (
                  <form action={deleteRole}>
                    <input type="hidden" name="roleId" value={selectedRole.id} />
                    <Button type="submit" variant="ghost" size="sm" className="text-destructive">
                      Delete role
                    </Button>
                  </form>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <form action={updateRolePermissions} className="space-y-5">
                <input type="hidden" name="roleId" value={selectedRole.id} />
                {modules.map((module) => (
                  <fieldset key={module} className="space-y-2">
                    <legend className="mb-1 text-sm font-medium">{module}</legend>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {permissions
                        .filter((p) => p.module === module)
                        .map((permission) => (
                          <label
                            key={permission.key}
                            className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm has-[:checked]:border-primary/50 has-[:checked]:bg-muted/50"
                          >
                            <input
                              type="checkbox"
                              name="permission"
                              value={permission.key}
                              defaultChecked={grantedKeys.has(permission.key)}
                              disabled={!canManage || selectedRole.isSystem}
                              className="size-4 accent-primary"
                            />
                            {permission.label}
                          </label>
                        ))}
                    </div>
                  </fieldset>
                ))}
                {canManage && !selectedRole.isSystem && <Button type="submit">Save permissions</Button>}
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
