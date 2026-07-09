// Master permission list + default role templates. Single source of truth —
// consumed by prisma/seed.ts (global seed) and by the create-institute flow
// (every new institute gets these roles stamped out, which its admin can
// then customize from the permission builder).

export const PERMISSIONS = [
  { key: "student.view", label: "View Students", module: "Student" },
  { key: "student.create", label: "Create Students", module: "Student" },
  { key: "student.edit", label: "Edit Students", module: "Student" },
  { key: "student.delete", label: "Delete Students", module: "Student" },
  { key: "lead.view", label: "View Leads", module: "Lead" },
  { key: "lead.create", label: "Create Leads", module: "Lead" },
  { key: "lead.followup", label: "Add Follow-ups", module: "Lead" },
  { key: "admission.view", label: "View Admissions", module: "Admission" },
  { key: "admission.create", label: "Create Admissions", module: "Admission" },
  { key: "admission.approve", label: "Approve Admissions", module: "Admission" },
  { key: "fee.view", label: "View Fees", module: "Fee" },
  { key: "fee.collect", label: "Collect Fees", module: "Fee" },
  { key: "fee.edit", label: "Edit Fees", module: "Fee" },
  { key: "scholarship.change", label: "Change Scholarship", module: "Fee" },
  { key: "batch.view", label: "View Batches", module: "Batch" },
  { key: "batch.manage", label: "Manage Batches", module: "Batch" },
  { key: "inventory.view", label: "View Inventory", module: "Inventory" },
  { key: "inventory.manage", label: "Manage Inventory", module: "Inventory" },
  { key: "user.manage", label: "Manage Users", module: "Settings" },
  { key: "role.manage", label: "Manage Roles & Permissions", module: "Settings" },
  { key: "branch.manage", label: "Manage Branches", module: "Settings" },
  { key: "course.manage", label: "Manage Courses", module: "Settings" },
  { key: "reports.view", label: "View Reports", module: "Reports" },
] as const;

export const ROLE_TEMPLATES: Record<string, string[]> = {
  "Institute Admin": PERMISSIONS.map((p) => p.key),
  Reception: ["student.view", "student.create", "lead.view", "lead.create"],
  Counsellor: ["lead.view", "lead.followup", "admission.view", "admission.create", "student.view"],
  Accounts: ["fee.view", "fee.collect", "student.view"],
  "Data Team": ["student.view", "student.edit", "batch.view", "batch.manage"],
  "Store Admin": ["inventory.view", "inventory.manage"],
  Faculty: ["batch.view", "student.view"],
};
