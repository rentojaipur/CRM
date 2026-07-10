import Link from "next/link";

const tabs = [
  { href: "/settings/branches", label: "Branches" },
  { href: "/settings/courses", label: "Courses" },
  { href: "/settings/users", label: "Users" },
  { href: "/settings/roles", label: "Roles & permissions" },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 space-y-4 p-6">
      <div>
        <h1 className="text-xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your institute&apos;s setup.</p>
      </div>
      <nav className="flex gap-1 border-b">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className="rounded-t-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
