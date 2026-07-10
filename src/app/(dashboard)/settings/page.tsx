import { redirect } from "next/navigation";
import { withTenant } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";

export default async function SettingsPage() {
  const target = await withTenant(async () => {
    if (await hasPermission("branch.manage")) return "/settings/branches";
    if (await hasPermission("course.manage")) return "/settings/courses";
    if (await hasPermission("user.manage")) return "/settings/users";
    if (await hasPermission("role.manage")) return "/settings/roles";
    return null;
  });

  if (target) redirect(target);

  return (
    <p className="text-sm text-muted-foreground">You don&apos;t have access to settings.</p>
  );
}
