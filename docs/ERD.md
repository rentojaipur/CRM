# EduFlow ERP — Entity Relationship Diagram

Source of truth for the schema is [`prisma/schema.prisma`](../prisma/schema.prisma). This diagram is a visual summary — regenerate it manually if models change significantly.

```mermaid
erDiagram
    INSTITUTE ||--o{ BRANCH : has
    INSTITUTE ||--o{ USER : employs
    INSTITUTE ||--o{ ROLE : defines
    INSTITUTE ||--o{ COURSE : offers
    INSTITUTE ||--o{ LEAD : owns
    INSTITUTE ||--o{ STUDENT : owns
    INSTITUTE ||--o{ INVENTORYITEM : stocks
    INSTITUTE ||--o{ AUDITLOG : records

    ROLE ||--o{ ROLEPERMISSION : has
    PERMISSION ||--o{ ROLEPERMISSION : grants
    ROLE ||--o{ USER : assigned_to

    LEAD ||--o{ FOLLOWUP : has
    LEAD ||--o| STUDENT : converts_to

    STUDENT ||--o{ ADMISSION : has
    COURSE ||--o{ ADMISSION : for
    ADMISSION ||--o{ APPROVALREQUEST : may_need
    ADMISSION ||--o{ FEETRANSACTION : billed_by

    STUDENT ||--o{ DOCUMENT : uploads
    STUDENT ||--o{ INVENTORYISSUE : receives
    STUDENT }o--o| BATCH : allocated_to

    BRANCH ||--o{ BATCH : hosts
    COURSE ||--o{ BATCH : runs_as

    INVENTORYITEM ||--o{ INVENTORYISSUE : issued_as
```

## Multi-tenancy

Every tenant-scoped table carries `instituteId`. Institute 4 can never see Institute 3's rows — this is enforced at the application layer (a Prisma Client Extension auto-injects `where: { instituteId }` using an `AsyncLocalStorage`-backed request context — see [`src/lib/tenant-context.ts`](../src/lib/tenant-context.ts) and [`src/lib/prisma.ts`](../src/lib/prisma.ts)), not by relying on developers to remember the filter on every query.

`User.instituteId` is nullable — a `null` value marks the Super Admin, who sits outside institute scoping entirely.

## RBAC (permission builder)

`Role` + `Permission` + `RolePermission` implement the checkbox-based permission builder — Institute Admin toggles `allowed` per role/permission from the UI, no code changes needed. `Permission.module` groups keys for the builder screen (e.g. all `Student.*` permissions render under a "Student" section).

## Approval workflow

`ApprovalRequest` is deliberately generic (`entityType` + `entityId`) rather than admission-specific, so future workflows (e.g. fee waivers) can reuse it. Today it's populated when an `Admission.scholarshipPercent` exceeds the institute's configured threshold.

## Audit log

`AuditLog` records `entityType` + `entityId` + `fieldChanged` + `oldValue` → `newValue`, written by a shared `logAudit()` helper (see [`src/lib/audit.ts`](../src/lib/audit.ts)) on every sensitive mutation (scholarship changes, fee edits, role/permission changes).
