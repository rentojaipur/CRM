"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
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
    <aside className="hidden w-52 shrink-0 flex-col border-r bg-card md:flex print:hidden">
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

export function MobileNav({ items, instituteName }: { items: SidebarItem[]; instituteName: string }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="flex size-9 items-center justify-center rounded-md border text-muted-foreground"
      >
        <Menu className="size-5" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex">
          <div className="w-64 border-r bg-card p-3 shadow-xl">
            <div className="mb-2 flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <div className="flex size-7 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground">
                  E
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold leading-tight">EduFlow</p>
                  <p className="truncate text-xs text-muted-foreground leading-tight">{instituteName}</p>
                </div>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="p-1 text-muted-foreground">
                <X className="size-5" />
              </button>
            </div>
            <nav className="flex flex-col gap-0.5">
              {items.map((item) => {
                const Icon = ICONS[item.icon];
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-3 py-2.5 text-sm",
                      active ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground",
                    )}
                  >
                    <Icon className="size-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <button type="button" aria-label="Close menu" className="flex-1 bg-black/40" onClick={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}
