import { NextResponse } from "next/server";
import mongoose from "mongoose";

import { requireSponsorSession } from "@/lib/auth/require-sponsor-session";
import { createCampaignFromFormData } from "@/lib/create-campaign-from-form";
import { connectToDatabase } from "@/lib/mongodb";
import Campaign from "@/models/Campaign";
import Sponsor from "@/models/Sponsor";

export const dynamic = "force-dynamic";

/**
 * GET — รายการแคมเปญของสปอนเซอร์ที่ล็อกอิน (เรียงอัปเดตล่าสุดก่อน)
 */
export async function GET() {
  const auth = await requireSponsorSession();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    await connectToDatabase();
    const sponsor = await Sponsor.findById(auth.sponsorId)
      .select("status advertisingTotalBudget advertisingUsedBudget")
      .lean();
    if (!sponsor) {
      return NextResponse.json({ ok: false, error: "sponsor_not_found" }, { status: 404 });
    }
    if (sponsor.status !== "active") {
      return NextResponse.json({ ok: false, error: "sponsor_inactive" }, { status: 403 });
    }

    const advTotal = Math.max(0, Number((sponsor as { advertisingTotalBudget?: number }).advertisingTotalBudget ?? 0));
    const advUsed = Math.max(0, Number((sponsor as { advertisingUsedBudget?: number }).advertisingUsedBudget ?? 0));
    const sponsorBudgetRemaining = Math.max(0, advTotal - advUsed);

    const sponsorOid = new mongoose.Types.ObjectId(auth.sponsorId);
    const docs = await Campaign.find({ sponsorId: sponsorOid })
      .sort({ updatedAt: -1 })
      .select(
        "name currentShares usedBudget status rewardPerShare maxRewardPerUser maxRewardPerUserPerDay updatedAt"
      )
      .lean();

    const campaigns = docs.map((c) => {
      const st = String((c as { status?: string }).status ?? "active");
      const status =
        st === "paused" || st === "completed" || st === "archived" ? st : "active";
      return {
        id: String(c._id),
        name: String((c as { name?: string }).name ?? ""),
        currentShares: Number((c as { currentShares?: number }).currentShares ?? 0),
        usedBudget: Number((c as { usedBudget?: number }).usedBudget ?? 0),
        status,
        rewardPerShare: Number((c as { rewardPerShare?: number }).rewardPerShare ?? 0),
        maxRewardPerUser: Number((c as { maxRewardPerUser?: number }).maxRewardPerUser ?? 0),
        maxRewardPerUserPerDay: Number((c as { maxRewardPerUserPerDay?: number }).maxRewardPerUserPerDay ?? 0),
        updatedAt: (c as { updatedAt?: Date }).updatedAt
          ? new Date((c as { updatedAt: Date }).updatedAt).toISOString()
          : null,
      };
    });

    return NextResponse.json({
      ok: true,
      campaigns,
      sponsorBudget: {
        total: advTotal,
        used: advUsed,
        remaining: sponsorBudgetRemaining,
      },
    });
  } catch (e) {
    console.error("[api/sponsor/campaigns GET]", e);
    return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });
  }
}

/**
 * POST — สปอนเซอร์สร้างแคมเปญของตนเอง (multipart เหมือน CMS)
 */
export async function POST(request: Request) {
  const auth = await requireSponsorSession();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_form" }, { status: 400 });
  }

  const result = await createCampaignFromFormData(auth.sponsorId, form, { createdBy: "sponsor" });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true, campaignId: result.campaignId });
}
