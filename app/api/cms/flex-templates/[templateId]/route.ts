import { NextResponse } from "next/server";
import mongoose from "mongoose";

import { canEditCampaigns } from "@/lib/auth/cms-admin-permissions";
import { requireAdminSession } from "@/lib/auth/require-admin-session";
import {
  deriveFieldsSpecFromSkeleton,
  validateFlexSkeletonJson,
} from "@/lib/derive-flex-template-fields";
import { connectToDatabase } from "@/lib/mongodb";
import FlexCampaignTemplate from "@/models/FlexCampaignTemplate";

export const dynamic = "force-dynamic";

function slugify(input: string): string {
  return String(input ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** GET — รายละเอียดเทมเพลต */
export async function GET(
  _request: Request,
  context: { params: Promise<{ templateId: string }> }
) {
  const admin = await requireAdminSession();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { templateId } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(templateId)) {
    return NextResponse.json({ ok: false, error: "invalid_id" }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const doc = await FlexCampaignTemplate.findById(templateId).lean();
    if (!doc) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }
    const d = doc as {
      _id: unknown;
      name?: string;
      slug?: string;
      description?: string;
      flexSkeletonJson?: string;
    };
    return NextResponse.json({
      ok: true,
      template: {
        id: String(d._id),
        name: String(d.name ?? ""),
        slug: String(d.slug ?? ""),
        description: String(d.description ?? ""),
        flexSkeletonJson: String(d.flexSkeletonJson ?? "{}"),
      },
    });
  } catch (e) {
    console.error("[api/cms/flex-templates/:id GET]", e);
    return NextResponse.json({ ok: false, error: "database_error" }, { status: 503 });
  }
}

/** PATCH — แก้ไข (ถ้าแก้ JSON โครง จะคำนวณ fieldsSpec ใหม่) */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ templateId: string }> }
) {
  const admin = await requireAdminSession();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!canEditCampaigns(admin.role)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const { templateId } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(templateId)) {
    return NextResponse.json({ ok: false, error: "invalid_id" }, { status: 400 });
  }

  let body: {
    name?: string;
    slug?: string;
    description?: string;
    flexSkeletonJson?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const $set: Record<string, string> = {};
  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return NextResponse.json({ ok: false, error: "invalid_name" }, { status: 400 });
    $set.name = name;
  }
  if (body.slug !== undefined) {
    const slug = slugify(body.slug);
    if (!slug) return NextResponse.json({ ok: false, error: "invalid_slug" }, { status: 400 });
    $set.slug = slug;
  }
  if (body.description !== undefined) {
    $set.description = String(body.description).trim();
  }
  if (body.flexSkeletonJson !== undefined) {
    $set.flexSkeletonJson = String(body.flexSkeletonJson).trim() || "{}";
  }

  if (Object.keys($set).length === 0) {
    return NextResponse.json({ ok: false, error: "no_fields" }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const existing = await FlexCampaignTemplate.findById(templateId).lean();
    if (!existing) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }
    const ex = existing as {
      flexSkeletonJson?: string;
    };
    const flexSkeletonJson = $set.flexSkeletonJson ?? String(ex.flexSkeletonJson ?? "{}");
    if ($set.flexSkeletonJson !== undefined) {
      const skErr = validateFlexSkeletonJson(flexSkeletonJson);
      if (skErr) {
        return NextResponse.json({ ok: false, error: skErr }, { status: 400 });
      }
      $set.fieldsSpecJson = deriveFieldsSpecFromSkeleton(flexSkeletonJson);
    }

    await FlexCampaignTemplate.findByIdAndUpdate(templateId, { $set });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("duplicate key")) {
      return NextResponse.json({ ok: false, error: "duplicate_slug" }, { status: 409 });
    }
    console.error("[api/cms/flex-templates/:id PATCH]", e);
    return NextResponse.json({ ok: false, error: "database_error" }, { status: 503 });
  }
}

/** DELETE */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ templateId: string }> }
) {
  const admin = await requireAdminSession();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!canEditCampaigns(admin.role)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const { templateId } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(templateId)) {
    return NextResponse.json({ ok: false, error: "invalid_id" }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const r = await FlexCampaignTemplate.deleteOne({ _id: templateId });
    if (r.deletedCount === 0) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[api/cms/flex-templates/:id DELETE]", e);
    return NextResponse.json({ ok: false, error: "database_error" }, { status: 503 });
  }
}
