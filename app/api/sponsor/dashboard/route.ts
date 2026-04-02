import { NextResponse } from "next/server";
import mongoose from "mongoose";

import { requireSponsorSession } from "@/lib/auth/require-sponsor-session";
import { connectToDatabase } from "@/lib/mongodb";
import {
  buildChartForPeriod,
  type SponsorDashboardChartPeriod,
} from "@/lib/sponsor/dashboard-chart";
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
    const sponsor = await Sponsor.findById(auth.sponsorId).select("companyName status").lean();

    if (!sponsor) {
      return NextResponse.json({ ok: false, error: "sponsor_not_found" }, { status: 404 });
    }
    if (sponsor.status !== "active") {
      return NextResponse.json({ ok: false, error: "sponsor_inactive" }, { status: 403 });
    }

    const campaignDocs = await Campaign.find({ sponsorId: sponsor._id })
      .sort({ updatedAt: -1 })
      .select("name currentShares totalBudget usedBudget")
      .lean();

    const campaigns = campaignDocs.map((c) => {
      const total = Number(c.totalBudget ?? 0);
      const used = Number(c.usedBudget ?? 0);
      return {
        id: String(c._id),
        name: String(c.name ?? ""),
        currentShares: Number(c.currentShares ?? 0),
        remainingBudget: Math.max(0, total - used),
        totalBudget: total,
        usedBudget: used,
      };
    });

    const totalSharesAllCampaigns = campaigns.reduce(
      (s, c) => s + c.currentShares,
      0
    );

    const url = new URL(request.url);
    const period = parsePeriod(url.searchParams.get("period"));
    const requestedCampaignId = url.searchParams.get("campaignId")?.trim() ?? "";

    const allowedIds = new Set(campaigns.map((c) => c.id));
    const selectedCampaignId =
      requestedCampaignId && allowedIds.has(requestedCampaignId)
        ? requestedCampaignId
        : campaigns[0]?.id ?? null;

    const points =
      selectedCampaignId && mongoose.Types.ObjectId.isValid(selectedCampaignId)
        ? await buildChartForPeriod(selectedCampaignId, period)
        : [];

    return NextResponse.json({
      ok: true,
      hasSponsorProfile: true,
      companyName: String(sponsor.companyName ?? ""),
      campaigns,
      totalSharesAllCampaigns,
      selectedCampaignId,
      chart: { period, points },
    });
  } catch (e) {
    console.error("[api/sponsor/dashboard]", e);
    return NextResponse.json(
      { ok: false, error: "database_unavailable" },
      { status: 503 }
    );
  }
}
