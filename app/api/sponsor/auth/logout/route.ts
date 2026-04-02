import { NextResponse } from "next/server";

import { SPONSOR_TOKEN_COOKIE } from "@/lib/auth/token-constants";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SPONSOR_TOKEN_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
