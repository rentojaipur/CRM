import { db } from "./prisma";
import { getTenantContext, requireInstituteId } from "./tenant-context";

type LogAuditInput = {
  action: string;
  entityType: string;
  entityId: string;
  fieldChanged?: string;
  oldValue?: string;
  newValue?: string;
};

// Call on every sensitive mutation (scholarship changes, fee edits,
// role/permission changes) so "who changed what, when" is always answerable.
export async function logAudit(input: LogAuditInput): Promise<void> {
  const instituteId = requireInstituteId();
  const userId = getTenantContext()?.userId;

  await db.auditLog.create({
    data: {
      instituteId,
      userId,
      ...input,
    },
  });
}
