import { NextResponse } from "next/server";
import mongoose from "mongoose";

import { canEditCampaigns } from "@/lib/auth/cms-admin-permissions";
import { requireAdminSession } from "@/lib/auth/require-admin-session";
import { createCampaignFromFormData } from "@/lib/create-campaign-from-form";

type Params = { params: Promise<{ sponsorId: string }> };

/**
 * POST — สร้างแคมเปญ (multipart/form-data)
 * - flexMessageJson: ข้อความ JSON Flex (จะอัปโหลดเป็นไฟล์ใน Drive โฟลเดอร์ย่อยตาม sponsorId)
 * - previewImage: รูปตัวอย่าง (optional)
 * - tagIds: JSON array string เช่น ["id1","id2"]
 */
export async function POST(request: Request, { params }: Params) {
  const admin = await requireAdminSession();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!canEditCampaigns(admin.role)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const { sponsorId } = await params;
  if (!mongoose.Types.ObjectId.isValid(sponsorId)) {
    return NextResponse.json({ ok: false, error: "invalid_sponsor_id" }, { status: 400 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_form" }, { status: 400 });
  }

  const result = await createCampaignFromFormData(sponsorId, form, { createdBy: "cms" });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true, campaignId: result.campaignId });
}
