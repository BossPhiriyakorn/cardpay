import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { createAuditLog } from "@/lib/audit-log";
import { canManageAdmins, getCmsRoleLabel } from "@/lib/auth/cms-admin-permissions";
import { requireAdminSession } from "@/lib/auth/require-admin-session";
import { connectToDatabase } from "@/lib/mongodb";
import CmsAdmin from "@/models/CmsAdmin";

/** GET — รายการแอดมิน */
export async function GET() {
  const admin = await requireAdminSession();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    await connectToDatabase();
    const docs = await CmsAdmin.find({})
      .select("username name role isActive updatedAt")
      .sort({ updatedAt: -1 })
      .lean();

    return NextResponse.json({
      ok: true,
      admins: docs.map((doc) => ({
        id: String(doc._id),
        name: String(doc.name ?? doc.username ?? ""),
        username: String(doc.username ?? ""),
        role: getCmsRoleLabel(doc.role === "reviewer" ? "reviewer" : "admin"),
        roleKey: doc.role === "reviewer" ? "reviewer" : "admin",
        status: doc.isActive ? "Online" : "Offline",
        lastActive: doc.updatedAt instanceof Date ? doc.updatedAt.toISOString().slice(0, 16).replace("T", " ") : "-",
      })),
    });
  } catch (e) {
    console.error("[api/cms/admins]", e);
    return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const admin = await requireAdminSession();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!canManageAdmins(admin.role)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  let body: { username?: string; name?: string; password?: string; role?: "admin" | "reviewer" };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const username = String(body.username ?? "").trim().toLowerCase();
  const name = String(body.name ?? "").trim();
  const password = String(body.password ?? "");
  const role = body.role === "reviewer" ? "reviewer" : "admin";

  if (!/^[a-z0-9_]{3,32}$/.test(username)) {
    return NextResponse.json({ ok: false, error: "invalid_username" }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ ok: false, error: "password_too_short" }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const passwordHash = await bcrypt.hash(password, 10);
    const created = await CmsAdmin.create({
      username,
      name: name || username,
      passwordHash,
      role,
      isActive: true,
    });

    await createAuditLog({
      action: `สร้างแอดมิน CMS: ${username} โดย ${admin.username}`,
      category: "system",
      targetType: "cms_admin",
      targetId: String(created._id),
    });

    return NextResponse.json({ ok: true, adminId: String(created._id) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("duplicate key")) {
      return NextResponse.json({ ok: false, error: "username_taken" }, { status: 409 });
    }
    console.error("[api/cms/admins:POST]", e);
    return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });
  }
}
