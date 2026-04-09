import { NextResponse } from "next/server";

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

/** GET — รายการเทมเพลต (แอดมินล็อกอิน) */
export async function GET() {
  const admin = await requireAdminSession();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    await connectToDatabase();
    const docs = await FlexCampaignTemplate.find({})
      .sort({ updatedAt: -1 })
      .select("name slug updatedAt")
      .lean();
    const templates = docs.map((d) => ({
      id: String(d._id),
      name: String(d.name ?? ""),
      slug: String(d.slug ?? ""),
      updatedAt: d.updatedAt ? new Date(d.updatedAt).toISOString() : null,
    }));
    return NextResponse.json({ ok: true, templates });
  } catch (e) {
    console.error("[api/cms/flex-templates GET]", e);
    return NextResponse.json({ ok: false, error: "database_error" }, { status: 503 });
  }
}

/** POST — สร้างเทมเพลต (สร้าง fieldsSpec อัตโนมัติจาก placeholder ใน JSON) */
export async function POST(request: Request) {
  const admin = await requireAdminSession();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!canEditCampaigns(admin.role)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
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

  const name = String(body.name ?? "").trim();
  let slug = slugify(String(body.slug ?? "").trim());
  if (!slug) slug = slugify(name);
  if (!slug) {
    slug = `tpl-${Date.now()}`;
  }
  const description = String(body.description ?? "").trim();
  const flexSkeletonJson = String(body.flexSkeletonJson ?? "").trim() || "{}";

  if (!name || !slug) {
    return NextResponse.json({ ok: false, error: "missing_name_or_slug" }, { status: 400 });
  }

  const skErr = validateFlexSkeletonJson(flexSkeletonJson);
  if (skErr) {
    return NextResponse.json({ ok: false, error: skErr }, { status: 400 });
  }
  const fieldsSpecJson = deriveFieldsSpecFromSkeleton(flexSkeletonJson);

  try {
    await connectToDatabase();
    const doc = await FlexCampaignTemplate.create({
      name,
      slug,
      description,
      fieldsSpecJson,
      flexSkeletonJson,
    });
    return NextResponse.json({ ok: true, id: String(doc._id) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("duplicate key")) {
      return NextResponse.json({ ok: false, error: "duplicate_slug" }, { status: 409 });
    }
    console.error("[api/cms/flex-templates POST]", e);
    return NextResponse.json({ ok: false, error: "database_error" }, { status: 503 });
  }
}
