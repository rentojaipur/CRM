import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { SignOutButton } from "@/components/shared/sign-out-button";

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session) redirect("/login");
  if (session.user.instituteId !== null) redirect("/dashboard");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-6">
          <span className="font-semibold">EduFlow ERP — Super Admin</span>
          <nav className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link href="/super-admin/institutes" className="hover:text-foreground">
              Institutes
            </Link>
            <Link href="/super-admin/reports" className="hover:text-foreground">
              Reports
            </Link>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{session.user.name}</span>
          <SignOutButton />
        </div>
      </header>
      <main className="flex flex-1">{children}</main>
    </div>
  );
}
