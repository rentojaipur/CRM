export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b p-4 font-semibold">EduFlow ERP</header>
      <main className="flex flex-1">{children}</main>
    </div>
  );
}
