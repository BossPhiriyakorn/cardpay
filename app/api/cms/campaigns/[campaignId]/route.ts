import { NextResponse } from "next/server";
import mongoose from "mongoose";

import { canEditCampaigns } from "@/lib/auth/cms-admin-permissions";
import { requireAdminSession } from "@/lib/auth/require-admin-session";
import {
  parseAndStringifyFlexJson,
  upsertFlexJsonOnDrive,
  uploadPreviewImageOnDrive,
} from "@/lib/cms/campaign-drive";
import { getCmsCampaignById } from "@/lib/cms/campaigns-repository";
import { connectToDatabase } from "@/lib/mongodb";
import { shareQuotaFromBudget } from "@/lib/share-quota";
import Campaign from "@/models/Campaign";

type Params = { params: Promise<{ campaignId: string }> };

const MAX_ALT = 400;

function clampShareAltText(v: unknown): string {
  return String(v ?? "").trim().slice(0, MAX_ALT);
}

/** GET — รายละเอียดแคมเปญจาก MongoDB (ใช้เมื่อ campaignId เป็น ObjectId) */
export async function GET(_request: Request, { params }: Params) {
  const admin = await requireAdminSession();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { campaignId } = await params;
  const result = await getCmsCampaignById(campaignId);
  if (!result) {
    return NextResponse.json(
      { ok: false, error: "ไม่พบแคมเปญ" },
      { status: 404 }
    );
  }
  return NextResponse.json({
    ok: true,
    source: result.source,
    campaign: result.campaign,
  });
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

/** PATCH — JSON (ฟิลด์เดิม) หรือ multipart/form-data (อัปโหลด JSON Flex + รูปตัวอย่าง) */
export async function PATCH(request: Request, { params }: Params) {
  const admin = await requireAdminSession();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!canEditCampaigns(admin.role)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const { campaignId } = await params;
  if (!mongoose.Types.ObjectId.isValid(campaignId)) {
    return NextResponse.json({ ok: false, error: "invalid_campaign_id" }, { status: 400 });
  }

  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return NextResponse.json({ ok: false, error: "invalid_form" }, { status: 400 });
    }

    const sponsorId = String(form.get("sponsorId") ?? "").trim();
    if (!sponsorId || !mongoose.Types.ObjectId.isValid(sponsorId)) {
      return NextResponse.json({ ok: false, error: "invalid_sponsor_id" }, { status: 400 });
    }

    try {
      await connectToDatabase();
      const existing = await Campaign.findById(campaignId).lean();
      if (!existing) {
        return NextResponse.json({ ok: false, error: "ไม่พบแคมเปญ" }, { status: 404 });
      }
      if (String(existing.sponsorId) !== sponsorId) {
        return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
      }

      const name = String(form.get("name") ?? "").trim();
      if (!name) {
        return NextResponse.json({ ok: false, error: "invalid_name" }, { status: 400 });
      }
      const totalBudget = Number(String(form.get("totalBudget") ?? "").replace(/,/g, ""));
      const usedBudget = Number(String(form.get("usedBudget") ?? "").replace(/,/g, ""));
      if (!Number.isFinite(totalBudget) || totalBudget < 0) {
        return NextResponse.json({ ok: false, error: "invalid_total_budget" }, { status: 400 });
      }
      if (!Number.isFinite(usedBudget) || usedBudget < 0) {
        return NextResponse.json({ ok: false, error: "invalid_used_budget" }, { status: 400 });
      }

      const statusRaw = String(form.get("status") ?? "active");
      const status =
        statusRaw === "paused" || statusRaw === "completed" ? statusRaw : "active";
      const rewardPerShare = Number(form.get("rewardPerShare"));
      const maxRewardPerUser = Number(form.get("maxRewardPerUser"));
      const maxRewardPerUserPerDay = Number(form.get("maxRewardPerUserPerDay"));
      const rps = Number.isFinite(rewardPerShare) && rewardPerShare >= 0 ? rewardPerShare : 0;
      const maxPerUser =
        Number.isFinite(maxRewardPerUser) && maxRewardPerUser >= 0 ? maxRewardPerUser : 0;
      const maxPerUserPerDay =
        Number.isFinite(maxRewardPerUserPerDay) && maxRewardPerUserPerDay >= 0
          ? maxRewardPerUserPerDay
          : 0;
      if (maxPerUser > 0 && maxPerUserPerDay > maxPerUser) {
        return NextResponse.json(
          { ok: false, error: "invalid_reward_limit_combination" },
          { status: 400 }
        );
      }
      const q = shareQuotaFromBudget(totalBudget, rps);

      let tagIds: mongoose.Types.ObjectId[] = [];
      try {
        const arr = JSON.parse(String(form.get("tagIds") ?? "[]")) as unknown;
        if (Array.isArray(arr)) {
          tagIds = arr
            .filter((id) => mongoose.Types.ObjectId.isValid(String(id)))
            .map((id) => new mongoose.Types.ObjectId(String(id)));
        }
      } catch {
        tagIds = [];
      }

      const $set: Record<string, unknown> = {
        name,
        description: String(form.get("description") ?? "").trim(),
        totalBudget,
        usedBudget,
        shareAltText: clampShareAltText(form.get("shareAltText")),
        status,
        rewardPerShare: rps,
        maxRewardPerUser: maxPerUser,
        maxRewardPerUserPerDay: maxPerUserPerDay,
        quota: q,
        tagIds,
      };

      const flexRaw = String(form.get("flexMessageJson") ?? "");
      if (flexRaw.trim()) {
        try {
          const buf = parseAndStringifyFlexJson(flexRaw);
          const fid = String(
            (existing as { flexMessageJsonDriveFileId?: string }).flexMessageJsonDriveFileId ??
              ""
          ).trim();
          const newFlexId = await upsertFlexJsonOnDrive(
            sponsorId,
            campaignId,
            buf,
            fid || undefined
          );
          $set.flexMessageJsonDriveFileId = newFlexId;
        } catch (e) {
          const code = e instanceof Error ? e.message : "";
          if (code === "invalid_flex_json") {
            return NextResponse.json({ ok: false, error: "invalid_flex_json" }, { status: 400 });
          }
          if (code === "flex_json_too_large") {
            return NextResponse.json({ ok: false, error: "flex_json_too_large" }, { status: 400 });
          }
          console.error("[campaigns:PATCH] flex", e);
          return NextResponse.json({ ok: false, error: mapDriveErr(e) }, { status: 503 });
        }
      }

      const preview = form.get("previewImage");
      const previewFile =
        preview && typeof preview === "object" && "arrayBuffer" in preview
          ? (preview as File)
          : null;
      if (previewFile && previewFile.size > 0) {
        try {
          const buf = Buffer.from(await previewFile.arrayBuffer());
          const mime = previewFile.type || "image/jpeg";
          const prevUrls = Array.isArray((existing as { imageUrls?: string[] }).imageUrls)
            ? (existing as { imageUrls: string[] }).imageUrls
            : [];
          const prevUrl = prevUrls[0];
          const url = await uploadPreviewImageOnDrive({
            sponsorId,
            campaignId,
            buffer: buf,
            mimeType: mime,
            previousImageUrl: prevUrl,
          });
          $set.imageUrls = [url];
        } catch (e) {
          const code = e instanceof Error ? e.message : "";
          if (code === "invalid_image_type") {
            return NextResponse.json({ ok: false, error: "invalid_image_type" }, { status: 400 });
          }
          if (code === "image_too_large") {
            return NextResponse.json({ ok: false, error: "image_too_large" }, { status: 400 });
          }
          console.error("[campaigns:PATCH] image", e);
          return NextResponse.json({ ok: false, error: mapDriveErr(e) }, { status: 503 });
        }
      }

      await Campaign.findByIdAndUpdate(campaignId, { $set });
      return NextResponse.json({ ok: true });
    } catch (e) {
      console.error("[api/cms/campaigns/:id PATCH multipart]", e);
      return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });
    }
  }

  let body: {
    name?: string;
    description?: string;
    totalBudget?: number;
    usedBudget?: number;
    flexMessageJsonDriveFileId?: string;
    shareAltText?: string;
    status?: "active" | "paused" | "completed";
    rewardPerShare?: number;
    maxRewardPerUser?: number;
    maxRewardPerUserPerDay?: number;
    tagIds?: string[];
    imageUrls?: string[];
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
  if (body.description !== undefined) {
    $set.description = String(body.description).trim();
  }
  if (body.totalBudget !== undefined) {
    const n = Number(body.totalBudget);
    if (!Number.isFinite(n) || n < 0) {
      return NextResponse.json({ ok: false, error: "invalid_total_budget" }, { status: 400 });
    }
    $set.totalBudget = n;
  }
  if (body.usedBudget !== undefined) {
    const n = Number(body.usedBudget);
    if (!Number.isFinite(n) || n < 0) {
      return NextResponse.json({ ok: false, error: "invalid_used_budget" }, { status: 400 });
    }
    $set.usedBudget = n;
  }
  if (body.flexMessageJsonDriveFileId !== undefined) {
    $set.flexMessageJsonDriveFileId = String(body.flexMessageJsonDriveFileId).trim();
  }
  if (body.shareAltText !== undefined) {
    $set.shareAltText = clampShareAltText(body.shareAltText);
  }
  if (body.status !== undefined) {
    if (!["active", "paused", "completed"].includes(body.status)) {
      return NextResponse.json({ ok: false, error: "invalid_status" }, { status: 400 });
    }
    $set.status = body.status;
  }
  if (body.rewardPerShare !== undefined) {
    const n = Number(body.rewardPerShare);
    if (!Number.isFinite(n) || n < 0) {
      return NextResponse.json({ ok: false, error: "invalid_reward_per_share" }, { status: 400 });
    }
    $set.rewardPerShare = n;
  }
  if (body.maxRewardPerUser !== undefined) {
    const n = Number(body.maxRewardPerUser);
    if (!Number.isFinite(n) || n < 0) {
      return NextResponse.json(
        { ok: false, error: "invalid_max_reward_per_user" },
        { status: 400 }
      );
    }
    $set.maxRewardPerUser = n;
  }
  if (body.maxRewardPerUserPerDay !== undefined) {
    const n = Number(body.maxRewardPerUserPerDay);
    if (!Number.isFinite(n) || n < 0) {
      return NextResponse.json(
        { ok: false, error: "invalid_max_reward_per_user_per_day" },
        { status: 400 }
      );
    }
    $set.maxRewardPerUserPerDay = n;
  }
  if (body.tagIds !== undefined) {
    const ids = Array.isArray(body.tagIds) ? body.tagIds : [];
    $set.tagIds = ids
      .filter((id) => mongoose.Types.ObjectId.isValid(id))
      .map((id) => new mongoose.Types.ObjectId(id));
  }
  if (body.imageUrls !== undefined) {
    $set.imageUrls = Array.isArray(body.imageUrls)
      ? body.imageUrls.map((u) => String(u ?? "").trim()).filter(Boolean)
      : [];
  }

  if (Object.keys($set).length === 0) {
    return NextResponse.json({ ok: false, error: "no_fields_to_update" }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const existing = await Campaign.findById(campaignId).lean();
    if (!existing) {
      return NextResponse.json({ ok: false, error: "ไม่พบแคมเปญ" }, { status: 404 });
    }
    const ex = existing as {
      totalBudget?: number;
      rewardPerShare?: number;
    };
    const tb =
      $set.totalBudget !== undefined ? Number($set.totalBudget) : Number(ex.totalBudget ?? 0);
    const rps =
      $set.rewardPerShare !== undefined
        ? Number($set.rewardPerShare)
        : Number(ex.rewardPerShare ?? 0);
    const maxPerUser =
      $set.maxRewardPerUser !== undefined
        ? Number($set.maxRewardPerUser)
        : Number((existing as { maxRewardPerUser?: number }).maxRewardPerUser ?? 0);
    const maxPerUserPerDay =
      $set.maxRewardPerUserPerDay !== undefined
        ? Number($set.maxRewardPerUserPerDay)
        : Number((existing as { maxRewardPerUserPerDay?: number }).maxRewardPerUserPerDay ?? 0);
    if (maxPerUser > 0 && maxPerUserPerDay > maxPerUser) {
      return NextResponse.json(
        { ok: false, error: "invalid_reward_limit_combination" },
        { status: 400 }
      );
    }
    $set.quota = shareQuotaFromBudget(tb, rps);

    await Campaign.findByIdAndUpdate(campaignId, { $set });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[api/cms/campaigns/:id PATCH]", e);
    return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });
  }
}
