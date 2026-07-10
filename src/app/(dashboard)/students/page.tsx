import { db } from "@/lib/prisma";
import { withTenant } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { Badge } from "@/components/ui/badge";
import { SearchBox } from "@/components/shared/search-box";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const dateFormat = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" });

export default async function StudentsPage(props: PageProps<"/students">) {
  const { q } = await props.searchParams;
  const query = typeof q === "string" ? q.trim() : "";
  const { students, canView } = await withTenant(async () => {
    const canView = await hasPermission("student.view");
    if (!canView) return { students: [], canView };
    return {
      students: await db.student.findMany({
        where: query
          ? { OR: [{ name: { contains: query, mode: "insensitive" } }, { mobile: { contains: query } }, { rollNumber: { contains: query, mode: "insensitive" } }] }
          : undefined,
        orderBy: { createdAt: "desc" },
        include: {
          branch: true,
          batch: true,
          admissions: { include: { course: true }, orderBy: { createdAt: "desc" } },
        },
        take: 100,
      }),
      canView,
    };
  });

  if (!canView) {
    return (
      <div className="flex-1 p-6">
        <p className="text-sm text-muted-foreground">You don&apos;t have access to students.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-4 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Students</h1>
          <p className="text-sm text-muted-foreground">
            {students.length} admitted student{students.length === 1 ? "" : "s"}.
          </p>
        </div>
        <SearchBox action="/students" placeholder="Search name, mobile, roll no..." defaultValue={query} />
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead>Course</TableHead>
              <TableHead>Class</TableHead>
              <TableHead>Branch</TableHead>
              <TableHead>Roll no.</TableHead>
              <TableHead>Batch</TableHead>
              <TableHead>Admitted</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No students yet — convert a lead from the Leads page.
                </TableCell>
              </TableRow>
            )}
            {students.map((student) => (
              <TableRow key={student.id}>
                <TableCell>
                  <div className="font-medium">{student.name}</div>
                  <div className="text-xs text-muted-foreground">{student.mobile}</div>
                </TableCell>
                <TableCell>
                  {student.admissions.length === 0
                    ? "—"
                    : student.admissions.map((admission) => (
                        <Badge key={admission.id} variant="secondary" className="mr-1">
                          {admission.course.name}
                        </Badge>
                      ))}
                </TableCell>
                <TableCell>{student.class ?? "—"}</TableCell>
                <TableCell>{student.branch?.name ?? "—"}</TableCell>
                <TableCell>{student.rollNumber ?? "—"}</TableCell>
                <TableCell>{student.batch?.name ?? "—"}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {dateFormat.format(student.createdAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
