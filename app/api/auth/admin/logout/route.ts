import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { verifyAdminAccessToken } from "@/lib/auth/admin-jwt";
import { createAuditLog } from "@/lib/audit-log";
import { ADMIN_TOKEN_COOKIE } from "@/lib/auth/token-constants";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_TOKEN_COOKIE)?.value ?? "";
  let username = "";
  if (token) {
    try {
      const payload = await verifyAdminAccessToken(token);
      username = typeof payload.sub === "string" ? payload.sub : "";
    } catch {
      username = "";
    }
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_TOKEN_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });

  if (username) {
    await createAuditLog({
      action: `admin logout: ${username}`,
      category: "auth",
      targetType: "cms_admin",
      targetId: username,
    });
  }

  return response;
}
