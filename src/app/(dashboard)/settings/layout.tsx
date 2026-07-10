import Link from "next/link";
import { withTenant } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const tabs = await withTenant(async () => {
    const [branches, courses, users, roles] = await Promise.all([
      hasPermission("branch.manage"),
      hasPermission("course.manage"),
      hasPermission("user.manage"),
      hasPermission("role.manage"),
    ]);
    return [
      ...(branches ? [{ href: "/settings/branches", label: "Branches" }] : []),
      ...(courses ? [{ href: "/settings/courses", label: "Courses" }] : []),
      ...(users ? [{ href: "/settings/users", label: "Users" }] : []),
      ...(roles ? [{ href: "/settings/roles", label: "Roles & permissions" }] : []),
    ];
  });

  if (tabs.length === 0) {
    return (
      <div className="flex-1 p-6">
        <p className="text-sm text-muted-foreground">You don&apos;t have access to settings.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your institute&apos;s setup.</p>
      </div>
      <nav className="flex gap-1 overflow-x-auto border-b">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className="whitespace-nowrap rounded-t-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
