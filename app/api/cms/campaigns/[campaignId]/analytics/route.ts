import { NextResponse } from "next/server";
import mongoose from "mongoose";

import { requireAdminSession } from "@/lib/auth/require-admin-session";
import { connectToDatabase } from "@/lib/mongodb";
import {
  buildChartForPeriod,
  type SponsorDashboardChartPeriod,
} from "@/lib/sponsor/dashboard-chart";
import Campaign from "@/models/Campaign";
import CampaignMemberStat from "@/models/CampaignMemberStat";
import Sponsor from "@/models/Sponsor";
/** ลงทะเบียน schema User ก่อน populate จาก CampaignMemberStat → User */
import "@/models/User";

type Params = { params: Promise<{ campaignId: string }> };

function userDisplayName(u: Record<string, unknown> | null | undefined): string {
  if (!u) return "ผู้ใช้ (ไม่พบข้อมูล)";
  const name = String(u.name ?? "").trim();
  if (name) return name;
  const fn = String(u.firstName ?? "").trim();
  const ln = String(u.lastName ?? "").trim();
  const combo = [fn, ln].filter(Boolean).join(" ");
  if (combo) return combo;
  const email = String(u.email ?? "").trim();
  if (email) return email;
  const line = String(u.lineDisplayId ?? "").trim();
  if (line) return line;
  return "ผู้ใช้";
}

/** GET — สรุปแคมเปญ + รายชื่อผู้แชร์ (CampaignMemberStat) สำหรับหน้า analytics CMS */
export async function GET(request: Request, { params }: Params) {
  const admin = await requireAdminSession();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { campaignId } = await params;
  if (!mongoose.Types.ObjectId.isValid(campaignId)) {
    return NextResponse.json({ ok: false, error: "invalid_campaign_id" }, { status: 400 });
  }

  const url = new URL(request.url);
  const sponsorId = url.searchParams.get("sponsorId")?.trim() ?? "";
  const periodRaw = url.searchParams.get("period")?.trim() ?? "day";
  const chartPeriod: SponsorDashboardChartPeriod =
    periodRaw === "week" || periodRaw === "month" ? periodRaw : "day";

  try {
    await connectToDatabase();
    const campaign = await Campaign.findById(campaignId).lean();
    if (!campaign) {
      return NextResponse.json({ ok: false, error: "ไม่พบแคมเปญ" }, { status: 404 });
    }
    if (sponsorId && String(campaign.sponsorId) !== sponsorId) {
      return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
    }

    const c = campaign as {
      _id: unknown;
      sponsorId: unknown;
      name: string;
      usedBudget?: number;
      status: string;
      currentShares?: number;
      maxRewardPerUser?: number;
      maxRewardPerUserPerDay?: number;
    };

    const stats = await CampaignMemberStat.find({
      campaignId: new mongoose.Types.ObjectId(campaignId),
    })
      .sort({ shareCount: -1, updatedAt: -1 })
      .populate("userId", "name firstName lastName email lineDisplayId lineUid image")
      .lean();

    const sharers = stats.map((row) => {
      const uid = row.userId as
        | (Record<string, unknown> & { _id?: unknown })
        | mongoose.Types.ObjectId
        | null
        | undefined;
      let userIdStr = "";
      let profile: Record<string, unknown> | null = null;
      if (uid && typeof uid === "object" && "_id" in uid) {
        profile = uid as Record<string, unknown>;
        userIdStr = String(profile._id ?? "");
      } else if (uid) {
        userIdStr = String(uid);
      }
      return {
        userId: userIdStr,
        displayName: profile ? userDisplayName(profile) : userIdStr || "—",
        shareCount: Number(row.shareCount ?? 0),
        totalEarned: Number(row.totalEarned ?? 0),
        lastSharedAt: row.lastSharedAt
          ? new Date(row.lastSharedAt as Date).toISOString()
          : null,
      };
    });

    const totalShareCountFromRows = sharers.reduce((s, r) => s + r.shareCount, 0);
    const currentShares = Number(c.currentShares ?? 0);

    const sponsorDoc = await Sponsor.findById(c.sponsorId).select("companyName").lean();
    const sponsorName = String(sponsorDoc?.companyName ?? "—");

    const chartPoints = await buildChartForPeriod(campaignId, chartPeriod);

    return NextResponse.json({
      ok: true,
      chart: {
        period: chartPeriod,
        points: chartPoints,
      },
      campaign: {
        id: String(c._id),
        sponsorId: String(c.sponsorId),
        sponsorName,
        name: c.name,
        usedBudget: c.usedBudget ?? 0,
        status: c.status,
        currentShares,
        maxRewardPerUser: Math.max(0, Number(c.maxRewardPerUser ?? 0)),
        maxRewardPerUserPerDay: Math.max(0, Number(c.maxRewardPerUserPerDay ?? 0)),
      },
      summary: {
        uniqueSharersInTable: sharers.length,
        sumShareCountRows: totalShareCountFromRows,
        currentSharesOnCampaign: currentShares,
      },
      sharers,
    });
  } catch (e) {
    console.error("[api/cms/campaigns/:id/analytics]", e);
    return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });
  }
}
