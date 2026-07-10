import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

// GET-form search box — submits ?q=... to the current page (server-filtered).
export function SearchBox({
  action,
  placeholder,
  defaultValue,
}: {
  action: string;
  placeholder: string;
  defaultValue?: string;
}) {
  return (
    <form action={action} method="GET" className="relative w-full max-w-xs">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        name="q"
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="pl-8"
      />
    </form>
  );
}
