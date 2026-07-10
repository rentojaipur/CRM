import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/shared/password-input";
import { SubmitButton } from "@/components/shared/submit-button";
import { changePassword, updateProfile } from "./actions";

export default async function ProfilePage(props: PageProps<"/profile">) {
  const session = await auth();
  if (!session) redirect("/login");
  const { error, saved, passwordChanged } = await props.searchParams;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { role: true, institute: true },
  });
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-muted/30 p-6">
      <div className="mx-auto max-w-xl space-y-4">
        <div>
          <Link href="/" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "-ml-2 mb-1")}>
            ← Back to app
          </Link>
          <h1 className="text-xl font-semibold">My profile</h1>
          <p className="text-sm text-muted-foreground">
            {user.role.name}
            {user.institute ? ` · ${user.institute.name}` : " · Platform owner"}
          </p>
        </div>

        {error && (
          <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
        )}
        {saved && (
          <p className="rounded-md border border-green-600/40 bg-green-600/10 px-3 py-2 text-sm text-green-700">
            Profile saved.
          </p>
        )}
        {passwordChanged && (
          <p className="rounded-md border border-green-600/40 bg-green-600/10 px-3 py-2 text-sm text-green-700">
            Password changed. Use the new password from your next sign-in.
          </p>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Account details</CardTitle>
            <CardDescription>Name, email, and mobile are managed by your admin.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateProfile} className="grid gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Name</Label>
                  <Input value={user.name} disabled />
                </div>
                <div className="grid gap-2">
                  <Label>Mobile</Label>
                  <Input value={user.phone ?? "—"} disabled />
                </div>
              </div>
              <div className="grid gap-2">
                <Label>Email</Label>
                <Input value={user.email} disabled />
              </div>
              <div className="grid grid-cols-2 items-end gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="dob">Date of birth</Label>
                  <Input
                    id="dob"
                    name="dob"
                    type="date"
                    defaultValue={user.dob ? user.dob.toISOString().slice(0, 10) : ""}
                  />
                </div>
                <SubmitButton pendingText="Saving..." className="w-fit">
                  Save
                </SubmitButton>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Change password</CardTitle>
            <CardDescription>You&apos;ll need your current password.</CardDescription>
          </CardHeader>
          <CardContent>
            <form action={changePassword} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="currentPassword">Current password *</Label>
                <PasswordInput id="currentPassword" name="currentPassword" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="newPassword">New password *</Label>
                  <PasswordInput id="newPassword" name="newPassword" minLength={8} required />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="confirmPassword">Confirm new password *</Label>
                  <PasswordInput id="confirmPassword" name="confirmPassword" minLength={8} required />
                </div>
              </div>
              <SubmitButton pendingText="Changing..." className="w-fit">
                Change password
              </SubmitButton>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
