import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { PasswordInput } from "@/components/shared/password-input";
import { SubmitButton } from "@/components/shared/submit-button";
import { createInstitute } from "../actions";

export default async function NewInstitutePage(props: PageProps<"/super-admin/institutes/new">) {
  const { error } = await props.searchParams;

  return (
    <div className="flex-1 p-6">
      <div className="mx-auto max-w-2xl space-y-4">
        <div>
          <Link
            href="/super-admin/institutes"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2 mb-2")}
          >
            ← Back to institutes
          </Link>
          <h1 className="text-xl font-semibold">Create institute</h1>
          <p className="text-sm text-muted-foreground">
            Sets up the institute with default roles and its first admin account.
          </p>
        </div>

        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
        )}

        <form action={createInstitute}>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Institute details</CardTitle>
              <CardDescription>Basic information and subscription plan.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Institute name *</Label>
                <Input id="name" name="name" placeholder="Aakash Jaipur" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="plan">Plan *</Label>
                  <select
                    id="plan"
                    name="plan"
                    required
                    defaultValue="TRIAL"
                    className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
                  >
                    <option value="TRIAL">Trial</option>
                    <option value="BASIC">Basic</option>
                    <option value="PRO">Pro</option>
                    <option value="ENTERPRISE">Enterprise</option>
                  </select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="gstNumber">GST number</Label>
                  <Input id="gstNumber" name="gstNumber" placeholder="08AAACA1234F1Z5" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="contactEmail">Contact email</Label>
                  <Input id="contactEmail" name="contactEmail" type="email" placeholder="office@institute.com" />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="contactPhone">Contact phone</Label>
                  <Input id="contactPhone" name="contactPhone" placeholder="+91 98765 43210" />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="address">Address</Label>
                <Input id="address" name="address" placeholder="Street, city, state" />
              </div>

              <Separator />

              <div>
                <p className="text-sm font-medium">Institute admin account</p>
                <p className="text-sm text-muted-foreground">
                  This person manages users, courses, and settings for the institute.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="adminName">Admin name *</Label>
                  <Input id="adminName" name="adminName" placeholder="Rahul Sharma" required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="adminEmail">Admin email *</Label>
                  <Input id="adminEmail" name="adminEmail" type="email" placeholder="admin@institute.com" required />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="adminPassword">Admin password *</Label>
                <PasswordInput
                  id="adminPassword"
                  name="adminPassword"
                  minLength={8}
                  placeholder="At least 8 characters"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Link href="/super-admin/institutes" className={buttonVariants({ variant: "outline" })}>
                  Cancel
                </Link>
                <SubmitButton pendingText="Creating...">Create institute</SubmitButton>
              </div>
            </CardContent>
          </Card>
        </form>
      </div>
    </div>
  );
}
