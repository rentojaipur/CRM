import { db } from "@/lib/prisma";
import { withTenant } from "@/lib/tenant";
import { hasPermission } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createCourse, deleteCourse } from "./actions";

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export default async function CoursesPage(props: PageProps<"/settings/courses">) {
  const { error } = await props.searchParams;

  const { courses, canManage } = await withTenant(async () => ({
    courses: await db.course.findMany({
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { admissions: true, batches: true } } },
    }),
    canManage: await hasPermission("course.manage"),
  }));

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
      <div className="space-y-3">
        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
        )}
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Course</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead className="text-right">MRP fee</TableHead>
                <TableHead className="text-right">Max scholarship</TableHead>
                <TableHead className="text-right">Admissions</TableHead>
                {canManage && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {courses.length === 0 && (
                <TableRow>
                  <TableCell colSpan={canManage ? 6 : 5} className="h-24 text-center text-muted-foreground">
                    No courses yet. Add your first course.
                  </TableCell>
                </TableRow>
              )}
              {courses.map((course) => (
                <TableRow key={course.id}>
                  <TableCell>
                    <div className="font-medium">{course.name}</div>
                    <div className="text-xs text-muted-foreground">{course.code}</div>
                  </TableCell>
                  <TableCell>{course.duration ?? "—"}</TableCell>
                  <TableCell className="text-right">{inr.format(Number(course.mrpFee))}</TableCell>
                  <TableCell className="text-right">{Number(course.maxScholarshipPercent)}%</TableCell>
                  <TableCell className="text-right">{course._count.admissions}</TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <form action={deleteCourse} className="inline">
                        <input type="hidden" name="courseId" value={course.id} />
                        <Button type="submit" variant="ghost" size="sm" className="text-destructive">
                          Delete
                        </Button>
                      </form>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {canManage && (
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Add course</CardTitle>
            <CardDescription>e.g. JEE 2027, NEET 2027, Foundation IX.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={createCourse} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Course name *</Label>
                <Input id="name" name="name" placeholder="JEE 2027" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="code">Code *</Label>
                  <Input id="code" name="code" placeholder="JEE27" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="duration">Duration</Label>
                  <Input id="duration" name="duration" placeholder="2 years" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="mrpFee">MRP fee (₹) *</Label>
                  <Input id="mrpFee" name="mrpFee" type="number" min="0" step="1" placeholder="150000" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="maxScholarshipPercent">Max scholarship % *</Label>
                  <Input
                    id="maxScholarshipPercent"
                    name="maxScholarshipPercent"
                    type="number"
                    min="0"
                    max="100"
                    step="1"
                    defaultValue="0"
                    required
                  />
                </div>
              </div>
              <Button type="submit">Add course</Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
