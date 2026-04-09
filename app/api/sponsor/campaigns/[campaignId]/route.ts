import { NextResponse } from "next/server";
import mongoose from "mongoose";

import { requireSponsorSession } from "@/lib/auth/require-sponsor-session";
import { deleteCampaignDriveFilesBestEffort } from "@/lib/cms/campaign-drive";
import { connectToDatabase } from "@/lib/mongodb";
import { shareQuotaFromBudget } from "@/lib/share-quota";
import Campaign from "@/models/Campaign";

export const dynamic = "force-dynamic";

async function loadOwnedCampaign(sponsorId: string, campaignId: string) {
  if (!mongoose.Types.ObjectId.isValid(campaignId)) {
    return { error: "invalid_campaign_id" as const };
  }
  await connectToDatabase();
  const doc = await Campaign.findOne({
    _id: new mongoose.Types.ObjectId(campaignId),
    sponsorId: new mongoose.Types.ObjectId(sponsorId),
  }).lean();
  if (!doc) {
    return { error: "campaign_not_found" as const };
  }
  return { doc };
}

/**
 * GET — รายละเอียดแคมเปญของสปอนเซอร์ (สำหรับหน้าแก้ไข)
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ campaignId: string }> }
) {
  const auth = await requireSponsorSession();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { campaignId } = await context.params;
  const result = await loadOwnedCampaign(auth.sponsorId, campaignId);
  if ("error" in result) {
    const status = result.error === "invalid_campaign_id" ? 400 : 404;
    return NextResponse.json({ ok: false, error: result.error }, { status });
  }

  const c = result.doc as {
    _id: mongoose.Types.ObjectId;
    name?: string;
    status?: string;
    archivedAt?: Date | null;
    rewardPerShare?: number;
    maxRewardPerUser?: number;
    maxRewardPerUserPerDay?: number;
  };

  const rawSt = String(c.status ?? "active");
  const status =
    rawSt === "paused" || rawSt === "completed" || rawSt === "archived" ? rawSt : "active";

  return NextResponse.json({
    ok: true,
    campaign: {
      id: String(c._id),
      name: String(c.name ?? ""),
      status,
      archivedAt: c.archivedAt instanceof Date ? c.archivedAt.toISOString() : null,
      rewardPerShare: Number(c.rewardPerShare ?? 0),
      maxRewardPerUser: Number(c.maxRewardPerUser ?? 0),
      maxRewardPerUserPerDay: Number(c.maxRewardPerUserPerDay ?? 0),
    },
  });
}

/**
 * PATCH — อัปเดตค่าตอบแทน / เพดาน / สถานะ (active | paused เท่านั้น)
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ campaignId: string }> }
) {
  const auth = await requireSponsorSession();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { campaignId } = await context.params;
  const result = await loadOwnedCampaign(auth.sponsorId, campaignId);
  if ("error" in result) {
    const status = result.error === "invalid_campaign_id" ? 400 : 404;
    return NextResponse.json({ ok: false, error: result.error }, { status });
  }

  const existingStatus = String((result.doc as { status?: string }).status ?? "");
  if (existingStatus === "archived") {
    return NextResponse.json(
      { ok: false, error: "campaign_archived", message: "แคมเปญนี้ถูกลบแล้ว ไม่สามารถแก้ไขได้" },
      { status: 403 }
    );
  }

  let body: {
    rewardPerShare?: number;
    maxRewardPerUser?: number;
    maxRewardPerUserPerDay?: number;
    status?: string;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const rewardFieldCount = [
    body.rewardPerShare !== undefined,
    body.maxRewardPerUser !== undefined,
    body.maxRewardPerUserPerDay !== undefined,
  ].filter(Boolean).length;
  if (rewardFieldCount > 0 && rewardFieldCount < 3) {
    return NextResponse.json(
      { ok: false, error: "reward_fields_required_together" },
      { status: 400 }
    );
  }

  const $set: Record<string, unknown> = {};
  const ex = result.doc as {
    totalBudget?: number;
    rewardPerShare?: number;
    maxRewardPerUser?: number;
    maxRewardPerUserPerDay?: number;
  };

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
  if (body.status !== undefined) {
    if (body.status !== "active" && body.status !== "paused") {
      return NextResponse.json({ ok: false, error: "invalid_status" }, { status: 400 });
    }
    $set.status = body.status;
  }

  if (Object.keys($set).length === 0) {
    return NextResponse.json({ ok: false, error: "no_fields_to_update" }, { status: 400 });
  }

  const tb = Number(ex.totalBudget ?? 0);
  const rps =
    $set.rewardPerShare !== undefined ? Number($set.rewardPerShare) : Number(ex.rewardPerShare ?? 0);
  const maxPerUser =
    $set.maxRewardPerUser !== undefined
      ? Number($set.maxRewardPerUser)
      : Number(ex.maxRewardPerUser ?? 0);
  const maxPerUserPerDay =
    $set.maxRewardPerUserPerDay !== undefined
      ? Number($set.maxRewardPerUserPerDay)
      : Number(ex.maxRewardPerUserPerDay ?? 0);

  if (maxPerUser > 0 && maxPerUserPerDay > maxPerUser) {
    return NextResponse.json(
      { ok: false, error: "invalid_reward_limit_combination" },
      { status: 400 }
    );
  }

  $set.quota = shareQuotaFromBudget(tb, rps);

  try {
    await Campaign.findByIdAndUpdate(campaignId, { $set });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[api/sponsor/campaigns/:id PATCH]", e);
    return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });
  }
}

/**
 * DELETE — ลบแคมเปญแบบ soft archive: ไม่ลบสถิติใน Mongo
 * ลบไฟล์ Flex JSON + รูปบน Google Drive ของแคมเปญนั้น (best-effort) แล้วเคลียร์อ้างอิงใน DB
 * งบสปอนเซอร์และยอดแชร์ที่เคยเกิดแล้วไม่ถูกคืน
 */
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ campaignId: string }> }
) {
  const auth = await requireSponsorSession();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { campaignId } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(campaignId)) {
    return NextResponse.json({ ok: false, error: "invalid_campaign_id" }, { status: 400 });
  }

  const oid = new mongoose.Types.ObjectId(campaignId);
  const sponsorOid = new mongoose.Types.ObjectId(auth.sponsorId);

  try {
    await connectToDatabase();
    const before = await Campaign.findOne({
      _id: oid,
      sponsorId: sponsorOid,
      status: { $ne: "archived" },
    })
      .select("flexMessageJsonDriveFileId imageUrls")
      .lean();

    if (!before) {
      const exists = await Campaign.findOne({ _id: oid, sponsorId: sponsorOid }).select("status").lean();
      if (!exists) {
        return NextResponse.json({ ok: false, error: "campaign_not_found" }, { status: 404 });
      }
      return NextResponse.json(
        { ok: false, error: "already_archived", message: "แคมเปญนี้ถูกลบแล้ว" },
        { status: 409 }
      );
    }

    const driveFields = before as {
      flexMessageJsonDriveFileId?: string;
      imageUrls?: unknown;
    };
    await deleteCampaignDriveFilesBestEffort({
      flexMessageJsonDriveFileId: driveFields.flexMessageJsonDriveFileId,
      imageUrls: driveFields.imageUrls,
    });

    const r = await Campaign.findOneAndUpdate(
      { _id: oid, sponsorId: sponsorOid, status: { $ne: "archived" } },
      {
        $set: {
          status: "archived",
          archivedAt: new Date(),
          flexMessageJsonDriveFileId: "",
          imageUrls: [],
        },
      },
      { returnDocument: "after" }
    ).lean();

    if (!r) {
      return NextResponse.json(
        { ok: false, error: "already_archived", message: "แคมเปญนี้ถูกลบแล้ว" },
        { status: 409 }
      );
    }

    return NextResponse.json({ ok: true, archived: true });
  } catch (e) {
    console.error("[api/sponsor/campaigns/:id DELETE]", e);
    return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });
  }
}
