"use client";

import { useActionState } from "react";
import { Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { importLeads, type ImportState } from "./actions";

const initialState: ImportState = { done: false, created: 0, failed: 0, errors: [] };

export function ImportForm() {
  const [state, formAction, pending] = useActionState(importLeads, initialState);

  return (
    <div className="space-y-4">
      <form action={formAction} className="flex flex-wrap items-center gap-3">
        <input
          type="file"
          name="file"
          accept=".csv,.xlsx"
          required
          className="border-input rounded-md border bg-transparent px-3 py-1.5 text-sm shadow-xs file:mr-3 file:border-0 file:bg-transparent file:text-sm file:font-medium"
        />
        <Button type="submit" disabled={pending}>
          {pending ? <Loader2 className="animate-spin" /> : <Upload className="size-4" />}
          {pending ? "Importing..." : "Import"}
        </Button>
      </form>

      {state.done && (
        <div className="space-y-2">
          <p
            className={
              state.created > 0
                ? "rounded-md border border-green-600/40 bg-green-600/10 px-3 py-2 text-sm text-green-700"
                : "rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            }
          >
            {state.created} lead{state.created === 1 ? "" : "s"} imported
            {state.failed > 0 && `, ${state.failed} row${state.failed === 1 ? "" : "s"} failed`}.
          </p>
          {state.errors.length > 0 && (
            <ul className="list-inside list-disc rounded-md border px-3 py-2 text-xs text-muted-foreground">
              {state.errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
