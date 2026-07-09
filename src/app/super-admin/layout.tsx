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
        <span className="font-semibold">EduFlow ERP — Super Admin</span>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{session.user.name}</span>
          <SignOutButton />
        </div>
      </header>
      <main className="flex flex-1">{children}</main>
    </div>
  );
}
