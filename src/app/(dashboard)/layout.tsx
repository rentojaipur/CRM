import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { withTenant } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { SignOutButton } from "@/components/shared/sign-out-button";
import { MobileNav, Sidebar, type SidebarItem } from "@/components/shared/sidebar";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.instituteId === null) redirect("/super-admin/institutes");

  const { institute, permissions } = await withTenant(async () => ({
    institute: await prisma.institute.findUnique({ where: { id: session.user.instituteId! } }),
    permissions: {
      leads: await hasPermission("lead.view"),
      students: await hasPermission("student.view"),
      admissions: await hasPermission("admission.view"),
      accounts: await hasPermission("fee.view"),
      reports: await hasPermission("reports.view"),
    },
  }));

  const items: SidebarItem[] = [
    { label: "Dashboard", href: "/dashboard", icon: "dashboard" },
    ...(permissions.leads ? [{ label: "Leads", href: "/leads", icon: "leads" as const }] : []),
    ...(permissions.students ? [{ label: "Students", href: "/students", icon: "students" as const }] : []),
    ...(permissions.admissions
      ? [{ label: "Admissions", href: "/admissions", icon: "admissions" as const }]
      : []),
    ...(permissions.accounts ? [{ label: "Accounts", href: "/accounts", icon: "accounts" as const }] : []),
    ...(permissions.reports ? [{ label: "Reports", href: "/reports", icon: "reports" as const }] : []),
    { label: "Settings", href: "/settings", icon: "settings" },
  ];

  return (
    <div className="flex min-h-screen">
      <Sidebar items={items} instituteName={institute?.name ?? "Institute"} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b bg-card px-4 py-2.5 md:justify-end print:hidden">
          <MobileNav items={items} instituteName={institute?.name ?? "Institute"} />
          <div className="flex items-center gap-3">
          <Link href="/profile" className="text-sm text-muted-foreground hover:text-foreground hover:underline">
            {session.user.name} · {session.user.roleName}
          </Link>
            <SignOutButton />
          </div>
        </header>
        <main className="flex flex-1">{children}</main>
      </div>
    </div>
  );
}
