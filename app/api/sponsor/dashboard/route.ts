import { NextResponse } from "next/server";
import mongoose from "mongoose";

import { requireSponsorSession } from "@/lib/auth/require-sponsor-session";
import { connectToDatabase } from "@/lib/mongodb";
import {
  buildChartForPeriod,
  type SponsorDashboardChartPeriod,
} from "@/lib/sponsor/dashboard-chart";
import { getSponsorPortalSupportContactUrl } from "@/lib/platform-settings";
import Campaign from "@/models/Campaign";
import Sponsor from "@/models/Sponsor";

export const dynamic = "force-dynamic";

function parsePeriod(v: string | null): SponsorDashboardChartPeriod {
  if (v === "week" || v === "month") return v;
  return "day";
}

/**
 * GET — แดชบอร์ดสปอนเซอร์ (แคมเปญ + กราฟแชร์รายวัน/สัปดาห์/เดือนจาก CampaignShareDaily)
 * Query: campaignId (optional), period=day|week|month
 */
export async function GET(request: Request) {
  const auth = await requireSponsorSession();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    await connectToDatabase();
    const sponsor = await Sponsor.findById(auth.sponsorId)
      .select("companyName status advertisingTotalBudget advertisingUsedBudget")
      .lean();

    if (!sponsor) {
      return NextResponse.json({ ok: false, error: "sponsor_not_found" }, { status: 404 });
    }
    if (sponsor.status !== "active") {
      return NextResponse.json({ ok: false, error: "sponsor_inactive" }, { status: 403 });
    }

    const campaignDocs = await Campaign.find({ sponsorId: sponsor._id })
      .sort({ updatedAt: -1 })
      .select("name currentShares usedBudget status")
      .lean();

    const advTotal = Math.max(
      0,
      Number((sponsor as { advertisingTotalBudget?: number }).advertisingTotalBudget ?? 0)
    );
    const advUsed = Math.max(
      0,
      Number((sponsor as { advertisingUsedBudget?: number }).advertisingUsedBudget ?? 0)
    );

    const campaigns = campaignDocs.map((c) => {
      const used = Number(c.usedBudget ?? 0);
      const st = String((c as { status?: string }).status ?? "active");
      const status =
        st === "paused" || st === "completed" || st === "archived" ? st : "active";
      return {
        id: String(c._id),
        name: String(c.name ?? ""),
        currentShares: Number(c.currentShares ?? 0),
        usedBudget: used,
        status,
      };
    });

    const totalSharesAllCampaigns = campaigns.reduce(
      (s, c) => s + c.currentShares,
      0
    );

    const url = new URL(request.url);
    const period = parsePeriod(url.searchParams.get("period"));
    const requestedCampaignId = url.searchParams.get("campaignId")?.trim() ?? "";

    /** กราฟ/ตัวเลือกแคมเปญในแดชบอร์ด — เฉพาะที่เปิดใช้งาน (active) */
    const activeCampaigns = campaigns.filter((c) => c.status === "active");
    const allowedActiveIds = new Set(activeCampaigns.map((c) => c.id));
    const selectedCampaignId =
      requestedCampaignId && allowedActiveIds.has(requestedCampaignId)
        ? requestedCampaignId
        : activeCampaigns[0]?.id ?? null;

    const points =
      selectedCampaignId && mongoose.Types.ObjectId.isValid(selectedCampaignId)
        ? await buildChartForPeriod(selectedCampaignId, period)
        : [];

    const supportContactUrl = await getSponsorPortalSupportContactUrl();

    return NextResponse.json({
      ok: true,
      hasSponsorProfile: true,
      companyName: String(sponsor.companyName ?? ""),
      campaigns,
      totalSharesAllCampaigns,
      selectedCampaignId,
      chart: { period, points },
      advertisingTotalBudget: advTotal,
      advertisingUsedBudget: advUsed,
      advertisingRemainingBudget: Math.max(0, advTotal - advUsed),
      supportContactUrl,
    });
  } catch (e) {
    console.error("[api/sponsor/dashboard]", e);
    return NextResponse.json(
      { ok: false, error: "database_unavailable" },
      { status: 503 }
    );
  }
}
