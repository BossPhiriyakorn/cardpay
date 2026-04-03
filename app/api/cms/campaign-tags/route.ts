import { NextResponse } from "next/server";
import mongoose from "mongoose";

import { createAuditLog } from "@/lib/audit-log";
import { canEditCampaigns } from "@/lib/auth/cms-admin-permissions";
import { requireAdminSession } from "@/lib/auth/require-admin-session";
import { connectToDatabase } from "@/lib/mongodb";
import { listCampaignTags } from "@/lib/cms/campaign-tags-repository";
import CampaignTag from "@/models/CampaignTag";

/** GET — แท็กแคมเปญ */
export async function GET() {
  try {
    const { source, tags } = await listCampaignTags();
    return NextResponse.json({ ok: true, source, tags });
  } catch (e) {
    console.error("[api/cms/campaign-tags]", e);
    return NextResponse.json(
      { ok: false, error: "ไม่สามารถโหลดแท็กได้" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const admin = await requireAdminSession();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!canEditCampaigns(admin.role)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  let body: {
    nameTh?: string;
    nameEn?: string;
    slug?: string;
    isActive?: boolean;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const nameTh = String(body.nameTh ?? "").trim();
  const nameEn = String(body.nameEn ?? "").trim();
  const slug = String(body.slug ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const isActive = body.isActive !== false;

  if (!nameTh || !slug) {
    return NextResponse.json({ ok: false, error: "missing_required_fields" }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const last = await CampaignTag.findOne({}).sort({ sortOrder: -1 }).select("sortOrder").lean();
    const tag = await CampaignTag.create({
      nameTh,
      nameEn,
      slug,
      isActive,
      sortOrder: Number(last?.sortOrder ?? -1) + 1,
    });

    await createAuditLog({
      action: `สร้างแท็กแคมเปญ: ${nameTh} (${slug}) โดย ${admin.username}`,
      category: "campaign",
      targetType: "campaign_tag",
      targetId: String(tag._id),
    });

    return NextResponse.json({ ok: true, tagId: String(tag._id) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("duplicate key")) {
      return NextResponse.json({ ok: false, error: "slug_taken" }, { status: 409 });
    }
    console.error("[api/cms/campaign-tags:POST]", e);
    return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const admin = await requireAdminSession();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!canEditCampaigns(admin.role)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  let body: {
    id?: string;
    nameTh?: string;
    nameEn?: string;
    slug?: string;
    isActive?: boolean;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const id = String(body.id ?? "").trim();
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return NextResponse.json({ ok: false, error: "invalid_tag_id" }, { status: 400 });
  }

  const $set: Record<string, unknown> = {};
  if (body.nameTh !== undefined) {
    const value = String(body.nameTh).trim();
    if (!value) {
      return NextResponse.json({ ok: false, error: "invalid_name_th" }, { status: 400 });
    }
    $set.nameTh = value;
  }
  if (body.nameEn !== undefined) {
    $set.nameEn = String(body.nameEn).trim();
  }
  if (body.slug !== undefined) {
    const slug = String(body.slug)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "");
    if (!slug) {
      return NextResponse.json({ ok: false, error: "invalid_slug" }, { status: 400 });
    }
    $set.slug = slug;
  }
  if (body.isActive !== undefined) {
    $set.isActive = body.isActive === true;
  }
  if (Object.keys($set).length === 0) {
    return NextResponse.json({ ok: false, error: "no_fields_to_update" }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const updated = await CampaignTag.findByIdAndUpdate(id, { $set }, { returnDocument: "after" }).lean();
    if (!updated) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    await createAuditLog({
      action: `แก้ไขแท็กแคมเปญ: ${String(updated.nameTh ?? "")} โดย ${admin.username}`,
      category: "campaign",
      targetType: "campaign_tag",
      targetId: String(updated._id),
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("duplicate key")) {
      return NextResponse.json({ ok: false, error: "slug_taken" }, { status: 409 });
    }
    console.error("[api/cms/campaign-tags:PATCH]", e);
    return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });
  }
}
