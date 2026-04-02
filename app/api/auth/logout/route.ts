import { NextResponse } from "next/server";

import { clearNextAuthCookies } from "@/lib/auth/nextauth-cookie-utils";
import { clearUserAuthCookies } from "@/lib/auth/user-jwt";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  clearUserAuthCookies(response);
  clearNextAuthCookies(response);
  return response;
}
