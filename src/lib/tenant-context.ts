import { AsyncLocalStorage } from "node:async_hooks";

export type TenantContext = {
  instituteId: string | null;
  userId: string;
  roleId: string;
};

const storage = new AsyncLocalStorage<TenantContext>();

export function runWithTenantContext<T>(context: TenantContext, fn: () => T): T {
  return storage.run(context, fn);
}

export function getTenantContext(): TenantContext | undefined {
  return storage.getStore();
}

// Super Admin has instituteId === null and is exempt from tenant scoping —
// callers that mutate tenant data must go through this to fail loudly
// instead of silently scoping to nothing.
export function requireInstituteId(): string {
  const context = getTenantContext();
  if (!context?.instituteId) {
    throw new Error("No institute context — this operation requires an institute-scoped session.");
  }
  return context.instituteId;
}
