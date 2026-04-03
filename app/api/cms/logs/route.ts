import { NextResponse } from "next/server";

import { toThaiAuditAction } from "@/lib/audit-action-th";
import { createAuditLog } from "@/lib/audit-log";
import { canManageAdmins } from "@/lib/auth/cms-admin-permissions";
import { requireAdminSession } from "@/lib/auth/require-admin-session";
import { connectToDatabase } from "@/lib/mongodb";
import AuditLog from "@/models/AuditLog";

/** ต้องตรงกับ body ที่ส่งจาก CMS เพื่อกันคลิกพลาด */
const CLEAR_AUDIT_LOGS_CONFIRM = "CLEAR_ALL_AUDIT_LOGS";

const PAGE_SIZE = 20;

export async function GET(request: Request) {
  const admin = await requireAdminSession();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
  const category = String(url.searchParams.get("category") ?? "").trim();
  const search = String(url.searchParams.get("search") ?? "").trim();

  const query: Record<string, unknown> = {};
  if (category && category !== "all") {
    query.category = category;
  }
  if (search) {
    query.$or = [
      { action: { $regex: search, $options: "i" } },
      { targetType: { $regex: search, $options: "i" } },
      { targetId: { $regex: search, $options: "i" } },
    ];
  }

  try {
    await connectToDatabase();
    const [total, docs] = await Promise.all([
      AuditLog.countDocuments(query),
      AuditLog.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .select("action category targetType targetId createdAt")
        .lean(),
    ]);

    return NextResponse.json({
      ok: true,
      page,
      pageSize: PAGE_SIZE,
      total,
      totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)),
      logs: docs.map((doc) => ({
        id: String(doc._id),
        action: toThaiAuditAction(String(doc.action ?? "")),
        category: String(doc.category ?? "other"),
        targetType: String(doc.targetType ?? ""),
        targetId: String(doc.targetId ?? ""),
        createdAt: doc.createdAt instanceof Date ? doc.createdAt.toISOString().slice(0, 16).replace("T", " ") : "-",
      })),
    });
  } catch (e) {
    console.error("[api/cms/logs]", e);
    return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });
  }
}

export async function DELETE(request: Request) {
  const admin = await requireAdminSession();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!canManageAdmins(admin.role)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  let body: { confirm?: string };
  try {
    body = (await request.json()) as { confirm?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }
  if (body.confirm !== CLEAR_AUDIT_LOGS_CONFIRM) {
    return NextResponse.json({ ok: false, error: "confirmation_required" }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const result = await AuditLog.deleteMany({});
    await createAuditLog({
      action: `ล้างประวัติ ${String(result.deletedCount)} รายการ โดย ${admin.username}`,
      category: "system",
      targetType: "audit_log",
      targetId: "all",
    });
    return NextResponse.json({ ok: true, deletedCount: result.deletedCount });
  } catch (e) {
    console.error("[api/cms/logs:DELETE]", e);
    return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });
  }
}
