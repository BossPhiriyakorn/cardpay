import { NextResponse } from "next/server";
import mongoose from "mongoose";

import { canEditCampaigns } from "@/lib/auth/cms-admin-permissions";
import { requireAdminSession } from "@/lib/auth/require-admin-session";
import { connectToDatabase } from "@/lib/mongodb";
import { setActiveSponsorFlexTemplateId } from "@/lib/platform-settings";
import FlexCampaignTemplate from "@/models/FlexCampaignTemplate";

export const dynamic = "force-dynamic";

/**
 * PATCH — ตั้งเทมเพลตที่สปอนเซอร์ใช้สร้างแคมเปญ (ทีละหนึ่งเทมเพลต) หรือ body.templateId = null เพื่อปิด
 */
export async function PATCH(request: Request) {
  const admin = await requireAdminSession();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!canEditCampaigns(admin.role)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  let body: { templateId?: string | null };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const raw = body.templateId;
  const templateId =
    raw === null || raw === undefined || String(raw).trim() === "" ? null : String(raw).trim();

  if (templateId && !mongoose.Types.ObjectId.isValid(templateId)) {
    return NextResponse.json({ ok: false, error: "invalid_template_id" }, { status: 400 });
  }

  try {
    await connectToDatabase();
    if (templateId) {
      const exists = await FlexCampaignTemplate.findById(templateId).select("_id").lean();
      if (!exists) {
        return NextResponse.json({ ok: false, error: "template_not_found" }, { status: 404 });
      }
    }
    await setActiveSponsorFlexTemplateId(templateId);
    return NextResponse.json({ ok: true, activeTemplateId: templateId });
  } catch (e) {
    console.error("[api/cms/flex-templates/active PATCH]", e);
    return NextResponse.json({ ok: false, error: "database_error" }, { status: 503 });
  }
}
