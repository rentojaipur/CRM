export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b p-4 font-semibold">EduFlow ERP — Super Admin</header>
      <main className="flex flex-1">{children}</main>
    </div>
  );
}
