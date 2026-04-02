import { NextResponse } from "next/server";
import mongoose from "mongoose";

import { canEditCampaigns } from "@/lib/auth/cms-admin-permissions";
import { requireAdminSession } from "@/lib/auth/require-admin-session";
import {
  createFlexJsonOnDrive,
  parseAndStringifyFlexJson,
  uploadPreviewImageOnDrive,
} from "@/lib/cms/campaign-drive";
import { connectToDatabase } from "@/lib/mongodb";
import { shareQuotaFromBudget } from "@/lib/share-quota";
import Campaign from "@/models/Campaign";
import Sponsor from "@/models/Sponsor";

const MAX_ALT = 400;

type Params = { params: Promise<{ sponsorId: string }> };

function clampShareAltText(v: unknown): string {
  const s = String(v ?? "").trim();
  return s.slice(0, MAX_ALT);
}

function mapDriveErr(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes("Missing GOOGLE_SERVICE_ACCOUNT_FILE") || msg.includes("not found at:")) {
    return "drive_not_configured";
  }
  if (msg.includes("Missing Google Drive folder ID")) {
    return "drive_folder_not_configured";
  }
  return "drive_upload_failed";
}

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

  const name = String(form.get("name") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const totalBudget = Number(String(form.get("totalBudget") ?? "").replace(/,/g, ""));
  const shareAltText = clampShareAltText(form.get("shareAltText"));
  const statusRaw = String(form.get("status") ?? "active");
  const status =
    statusRaw === "paused" || statusRaw === "completed" ? statusRaw : "active";
  const rewardPerShare = Number(form.get("rewardPerShare"));
  const maxRewardPerUser = Number(form.get("maxRewardPerUser"));
  const maxRewardPerUserPerDay = Number(form.get("maxRewardPerUserPerDay"));
  const flexMessageJson = String(form.get("flexMessageJson") ?? "");
  const tagIdsRaw = String(form.get("tagIds") ?? "[]");

  if (!name) {
    return NextResponse.json({ ok: false, error: "missing_name" }, { status: 400 });
  }
  if (!Number.isFinite(totalBudget) || totalBudget < 0) {
    return NextResponse.json({ ok: false, error: "invalid_total_budget" }, { status: 400 });
  }
  if (!Number.isFinite(maxRewardPerUser) || maxRewardPerUser < 0) {
    return NextResponse.json({ ok: false, error: "invalid_max_reward_per_user" }, { status: 400 });
  }
  if (!Number.isFinite(maxRewardPerUserPerDay) || maxRewardPerUserPerDay < 0) {
    return NextResponse.json(
      { ok: false, error: "invalid_max_reward_per_user_per_day" },
      { status: 400 }
    );
  }
  if (maxRewardPerUser > 0 && maxRewardPerUserPerDay > maxRewardPerUser) {
    return NextResponse.json(
      { ok: false, error: "invalid_reward_limit_combination" },
      { status: 400 }
    );
  }

  let tagIds: mongoose.Types.ObjectId[] = [];
  try {
    const arr = JSON.parse(tagIdsRaw) as unknown;
    if (Array.isArray(arr)) {
      tagIds = arr
        .filter((id) => mongoose.Types.ObjectId.isValid(String(id)))
        .map((id) => new mongoose.Types.ObjectId(String(id)));
    }
  } catch {
    tagIds = [];
  }

  const preview = form.get("previewImage");
  const previewFile =
    preview && typeof preview === "object" && "arrayBuffer" in preview
      ? (preview as File)
      : null;

  const campaignId = new mongoose.Types.ObjectId();

  let flexFileId = "";
  let imageUrls: string[] = [];

  try {
    await connectToDatabase();
    const sponsor = await Sponsor.findById(sponsorId).select("_id").lean();
    if (!sponsor) {
      return NextResponse.json({ ok: false, error: "sponsor_not_found" }, { status: 404 });
    }

    if (flexMessageJson.trim()) {
      try {
        const jsonBuf = parseAndStringifyFlexJson(flexMessageJson);
        flexFileId = await createFlexJsonOnDrive(sponsorId, String(campaignId), jsonBuf);
      } catch (e) {
        const code = e instanceof Error ? e.message : "";
        if (code === "invalid_flex_json") {
          return NextResponse.json({ ok: false, error: "invalid_flex_json" }, { status: 400 });
        }
        if (code === "flex_json_too_large") {
          return NextResponse.json({ ok: false, error: "flex_json_too_large" }, { status: 400 });
        }
        console.error("[campaigns:POST] flex upload", e);
        return NextResponse.json(
          { ok: false, error: mapDriveErr(e) },
          { status: 503 }
        );
      }
    }

    if (previewFile && previewFile.size > 0) {
      try {
        const buf = Buffer.from(await previewFile.arrayBuffer());
        const mime = previewFile.type || "image/jpeg";
        const url = await uploadPreviewImageOnDrive({
          sponsorId,
          campaignId: String(campaignId),
          buffer: buf,
          mimeType: mime,
        });
        imageUrls = [url];
      } catch (e) {
        const code = e instanceof Error ? e.message : "";
        if (code === "invalid_image_type") {
          return NextResponse.json({ ok: false, error: "invalid_image_type" }, { status: 400 });
        }
        if (code === "image_too_large") {
          return NextResponse.json({ ok: false, error: "image_too_large" }, { status: 400 });
        }
        console.error("[campaigns:POST] image upload", e);
        return NextResponse.json(
          { ok: false, error: mapDriveErr(e) },
          { status: 503 }
        );
      }
    }

    const rps = Number.isFinite(rewardPerShare) && rewardPerShare >= 0 ? rewardPerShare : 0;
    const maxPerUser =
      Number.isFinite(maxRewardPerUser) && maxRewardPerUser >= 0 ? maxRewardPerUser : 0;
    const maxPerUserPerDay =
      Number.isFinite(maxRewardPerUserPerDay) && maxRewardPerUserPerDay >= 0
        ? maxRewardPerUserPerDay
        : 0;
    const q = shareQuotaFromBudget(totalBudget, rps);

    await Campaign.create({
      _id: campaignId,
      sponsorId,
      name,
      description,
      totalBudget,
      usedBudget: 0,
      status,
      flexMessageJsonDriveFileId: flexFileId,
      shareAltText,
      rewardPerShare: rps,
      maxRewardPerUser: maxPerUser,
      maxRewardPerUserPerDay: maxPerUserPerDay,
      quota: q,
      imageUrls,
      tagIds,
    });

    return NextResponse.json({ ok: true, campaignId: String(campaignId) });
  } catch (e) {
    console.error("[api/cms/sponsors/.../campaigns:POST]", e);
    return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });
  }
}
