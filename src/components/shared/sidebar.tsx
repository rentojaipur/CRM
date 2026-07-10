"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  ClipboardCheck,
  GraduationCap,
  LayoutDashboard,
  Settings,
  UserPlus,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS = {
  dashboard: LayoutDashboard,
  leads: UserPlus,
  students: GraduationCap,
  admissions: ClipboardCheck,
  accounts: Wallet,
  reports: BarChart3,
  settings: Settings,
} as const;

export type SidebarItem = {
  label: string;
  href: string;
  icon: keyof typeof ICONS;
};

export function Sidebar({ items, instituteName }: { items: SidebarItem[]; instituteName: string }) {
  const pathname = usePathname();

  return (
    <aside className="flex w-52 shrink-0 flex-col border-r bg-muted/30 print:hidden">
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
          E
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight">EduFlow</p>
          <p className="truncate text-xs text-muted-foreground leading-tight">{instituteName}</p>
        </div>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 px-2">
        {items
          .filter((item) => item.icon !== "settings")
          .map((item) => {
            const Icon = ICONS[item.icon];
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
      </nav>
      <div className="border-t px-2 py-2">
        {items
          .filter((item) => item.icon === "settings")
          .map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <Settings className="size-4" />
                {item.label}
              </Link>
            );
          })}
      </div>
    </aside>
  );
}
