import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/leads",
  "/students",
  "/admissions",
  "/accounts",
  "/inventory",
  "/data-team",
  "/reports",
  "/settings",
  "/super-admin",
];

export default auth((req) => {
  const isProtected = PROTECTED_PREFIXES.some((prefix) => req.nextUrl.pathname.startsWith(prefix));
  if (isProtected && !req.auth) {
    return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
  }
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
