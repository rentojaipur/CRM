import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { setInstituteStatus } from "./actions";

const planVariant: Record<string, "default" | "secondary" | "outline"> = {
  ENTERPRISE: "default",
  PRO: "secondary",
  BASIC: "secondary",
  TRIAL: "outline",
};

export default async function InstitutesPage() {
  const institutes = await prisma.institute.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { users: true, students: true } } },
  });

  return (
    <div className="flex-1 space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Institutes</h1>
          <p className="text-sm text-muted-foreground">
            {institutes.length} institute{institutes.length === 1 ? "" : "s"} on the platform
          </p>
        </div>
        <Link href="/super-admin/institutes/new" className={buttonVariants()}>
          Create institute
        </Link>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Institute</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead className="text-right">Users</TableHead>
              <TableHead className="text-right">Students</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {institutes.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No institutes yet. Create your first one.
                </TableCell>
              </TableRow>
            )}
            {institutes.map((institute) => (
              <TableRow key={institute.id}>
                <TableCell>
                  <div className="font-medium">{institute.name}</div>
                  <div className="text-xs text-muted-foreground">{institute.slug}</div>
                </TableCell>
                <TableCell>
                  <Badge variant={planVariant[institute.plan] ?? "outline"}>{institute.plan}</Badge>
                </TableCell>
                <TableCell className="text-right">{institute._count.users}</TableCell>
                <TableCell className="text-right">{institute._count.students}</TableCell>
                <TableCell>
                  <Badge
                    variant={institute.status === "SUSPENDED" ? "destructive" : "outline"}
                    className={institute.status === "ACTIVE" ? "border-green-600 text-green-700" : ""}
                  >
                    {institute.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <form action={setInstituteStatus} className="inline">
                    <input type="hidden" name="instituteId" value={institute.id} />
                    <input
                      type="hidden"
                      name="status"
                      value={institute.status === "SUSPENDED" ? "ACTIVE" : "SUSPENDED"}
                    />
                    <Button type="submit" variant="ghost" size="sm">
                      {institute.status === "SUSPENDED" ? "Activate" : "Suspend"}
                    </Button>
                  </form>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
