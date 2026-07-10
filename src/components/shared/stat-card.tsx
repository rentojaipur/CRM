import {
  Clock,
  ClipboardCheck,
  GraduationCap,
  PhoneCall,
  UserPlus,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS = {
  leads: UserPlus,
  followup: PhoneCall,
  clock: Clock,
  admissions: ClipboardCheck,
  students: GraduationCap,
  fees: Wallet,
} as const;

const TONES = {
  blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  green: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  red: "bg-red-500/10 text-red-600 dark:text-red-400",
  amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  violet: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  slate: "bg-slate-500/10 text-slate-600 dark:text-slate-400",
} as const;

export function StatCard({
  label,
  value,
  icon,
  tone = "slate",
}: {
  label: string;
  value: string;
  icon: keyof typeof ICONS;
  tone?: keyof typeof TONES;
}) {
  const Icon = ICONS[icon];
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <span className={cn("flex size-7 items-center justify-center rounded-lg", TONES[tone])}>
          <Icon className="size-4" />
        </span>
      </div>
      <p className="mt-2 truncate text-xl font-bold tracking-tight sm:text-2xl">{value}</p>
    </div>
  );
}
