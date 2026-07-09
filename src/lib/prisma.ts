import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getTenantContext } from "./tenant-context";

declare global {
  // eslint-disable-next-line no-var
  var prismaGlobal: PrismaClient | undefined;
}

// Prisma 7's client requires an explicit driver adapter (no bundled query
// engine binary). Neon's pooled connection string (the "-pooler" host) works
// fine with the plain `pg` driver — no need for the Neon-specific serverless
// driver unless we later hit connection limits on Vercel.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const prisma = globalThis.prismaGlobal ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaGlobal = prisma;
}

// Models carrying `instituteId` — every one of these must be scoped so an
// institute can never see another institute's rows.
const TENANT_SCOPED_MODELS = new Set([
  "Branch",
  "Role",
  "User",
  "Course",
  "Batch",
  "Lead",
  "Followup",
  "Student",
  "Admission",
  "ApprovalRequest",
  "FeeTransaction",
  "Document",
  "InventoryItem",
  "InventoryIssue",
  "CommunicationTemplate",
  "Notification",
  "AuditLog",
]);

const SCOPED_READ_OPS = new Set(["findMany", "findFirst", "findFirstOrThrow", "count", "aggregate", "groupBy"]);
const SCOPED_WRITE_OPS = new Set(["updateMany", "deleteMany"]);

/**
 * Tenant-scoped Prisma client. Reads/bulk-writes against a model in
 * TENANT_SCOPED_MODELS are auto-filtered by the instituteId in the active
 * AsyncLocalStorage tenant context (see tenant-context.ts), and `create`
 * auto-stamps instituteId — so a raw query that forgets `where: {
 * instituteId }` can't leak cross-institute data.
 *
 * `findUnique`/`findUniqueOrThrow`/single `update`/`delete` are NOT scoped
 * here — Prisma only allows unique-index fields in their `where`, so any
 * code path reaching those must have obtained the id from an
 * already-scoped query first.
 */
export const db = prisma.$extends({
  query: {
    $allModels: {
      async $allOperations({
        model,
        operation,
        args,
        query,
      }: {
        model?: string;
        operation: string;
        args: Record<string, unknown>;
        query: (args: Record<string, unknown>) => Promise<unknown>;
      }) {
        const instituteId = getTenantContext()?.instituteId;
        if (!instituteId || !model || !TENANT_SCOPED_MODELS.has(model)) {
          return query(args);
        }

        const scopedArgs = args as { where?: Record<string, unknown>; data?: Record<string, unknown> };

        if (SCOPED_READ_OPS.has(operation) || SCOPED_WRITE_OPS.has(operation)) {
          scopedArgs.where = { ...scopedArgs.where, instituteId };
        } else if (operation === "create" && scopedArgs.data && !scopedArgs.data.instituteId) {
          scopedArgs.data = { ...scopedArgs.data, instituteId };
        }

        return query(scopedArgs);
      },
    },
  },
});
