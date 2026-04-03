import bcrypt from "bcryptjs";

import { NextResponse } from "next/server";

import { getAdminCookieMaxAgeSeconds, signAdminAccessToken } from "@/lib/auth/admin-jwt";
import { createAuditLog } from "@/lib/audit-log";
import { ADMIN_TOKEN_COOKIE } from "@/lib/auth/token-constants";
import { connectToDatabase } from "@/lib/mongodb";
import CmsAdmin from "@/models/CmsAdmin";

export async function POST(request: Request) {
  let body: { username?: string; password?: string };
  try {
    body = (await request.json()) as { username?: string; password?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const username = (body.username ?? "").trim().toLowerCase();
  const password = body.password ?? "";

  if (!username || !password) {
    return NextResponse.json({ ok: false, error: "missing_credentials" }, { status: 400 });
  }

  try {
    await connectToDatabase();
  } catch (e) {
    console.error("[admin/login] DB:", e);
    return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });
  }

  const admin = await CmsAdmin.findOne({ username, isActive: true }).select("+passwordHash");

  if (!admin?.passwordHash) {
    return NextResponse.json({ ok: false, error: "invalid_credentials" }, { status: 401 });
  }

  const match = await bcrypt.compare(password, admin.passwordHash);
  if (!match) {
    return NextResponse.json({ ok: false, error: "invalid_credentials" }, { status: 401 });
  }

  let token: string;
  try {
    token = await signAdminAccessToken(
      username,
      admin.role === "reviewer" ? "reviewer" : "admin"
    );
  } catch (e) {
    console.error("[admin/login] JWT:", e);
    return NextResponse.json({ ok: false, error: "token_config" }, { status: 503 });
  }

  const maxAge = getAdminCookieMaxAgeSeconds();

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  });

  await createAuditLog({
    action: `เข้าสู่ระบบแอดมิน: ${username}`,
    category: "auth",
    targetType: "cms_admin",
    targetId: username,
  });

  return response;
}
