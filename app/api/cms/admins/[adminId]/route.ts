import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { NextResponse } from "next/server";

import { createAuditLog } from "@/lib/audit-log";
import { canManageAdmins } from "@/lib/auth/cms-admin-permissions";
import { requireAdminSession } from "@/lib/auth/require-admin-session";
import { connectToDatabase } from "@/lib/mongodb";
import CmsAdmin from "@/models/CmsAdmin";

/** ลบแอดมินออกจาก MongoDB (เฉพาะ role admin เต็ม, ห้ามลบตัวเอง, ต้องเหลืออย่างน้อย 1 บัญชีที่ไม่ใช่ reviewer) */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ adminId: string }> }
) {
  const actor = await requireAdminSession();
  if (!actor.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!canManageAdmins(actor.role)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const { adminId } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(adminId)) {
    return NextResponse.json({ ok: false, error: "invalid_admin_id" }, { status: 400 });
  }

  if (actor.id === adminId) {
    return NextResponse.json({ ok: false, error: "cannot_delete_self" }, { status: 400 });
  }

  const oid = new mongoose.Types.ObjectId(adminId);

  try {
    await connectToDatabase();
    const target = await CmsAdmin.findById(oid).select("username role").lean();
    if (!target) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    const isReviewer = target.role === "reviewer";
    if (!isReviewer) {
      const remainingPrivileged = await CmsAdmin.countDocuments({
        _id: { $ne: oid },
        role: { $ne: "reviewer" },
      });
      if (remainingPrivileged < 1) {
        return NextResponse.json(
          { ok: false, error: "last_privileged_admin" },
          { status: 409 }
        );
      }
    }

    await CmsAdmin.deleteOne({ _id: oid });

    await createAuditLog({
      action: `ลบแอดมิน CMS: ${String(target.username ?? "")} โดย ${actor.username}`,
      category: "system",
      targetType: "cms_admin",
      targetId: adminId,
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[api/cms/admins/:adminId:DELETE]", e);
    return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ adminId: string }> }
) {
  const actor = await requireAdminSession();
  if (!actor.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { adminId } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(adminId)) {
    return NextResponse.json({ ok: false, error: "invalid_admin_id" }, { status: 400 });
  }

  const isSelfUpdate = actor.id === adminId;
  if (!canManageAdmins(actor.role) && !isSelfUpdate) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  let body: {
    name?: string;
    password?: string;
    isActive?: boolean;
    role?: "admin" | "reviewer";
    lineNotifyEnabled?: boolean;
    lineNotifyUserId?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const $set: Record<string, unknown> = {};
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) {
      return NextResponse.json({ ok: false, error: "invalid_name" }, { status: 400 });
    }
    $set.name = name;
  }
  if (body.password !== undefined) {
    const password = String(body.password);
    if (password && password.length < 8) {
      return NextResponse.json({ ok: false, error: "password_too_short" }, { status: 400 });
    }
    if (password) {
      $set.passwordHash = await bcrypt.hash(password, 10);
    }
  }
  if (body.isActive !== undefined) {
    if (!canManageAdmins(actor.role)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }
    $set.isActive = body.isActive === true;
  }
  if (body.role !== undefined) {
    if (!canManageAdmins(actor.role)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }
    $set.role = body.role === "reviewer" ? "reviewer" : "admin";
  }
  if (body.lineNotifyEnabled !== undefined) {
    $set.lineNotifyEnabled = body.lineNotifyEnabled === true;
  }
  if (body.lineNotifyUserId !== undefined) {
    if (!isSelfUpdate && !canManageAdmins(actor.role)) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }
    const uid = String(body.lineNotifyUserId ?? "").trim();
    $set.lineNotifyUserId = uid;
    if (!uid) {
      $set.lineNotifyDisplayName = "";
    }
  }
  if (Object.keys($set).length === 0) {
    return NextResponse.json({ ok: false, error: "no_fields_to_update" }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const updated = await CmsAdmin.findByIdAndUpdate(adminId, { $set }, { returnDocument: "after" })
      .select("username name isActive")
      .lean();

    if (!updated) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    await createAuditLog({
      action: `แก้ไขข้อมูลแอดมิน CMS: ${String(updated.username ?? "")} โดย ${actor.username}`,
      category: "system",
      targetType: "cms_admin",
      targetId: String(updated._id),
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[api/cms/admins/:adminId:PATCH]", e);
    return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });
  }
}
