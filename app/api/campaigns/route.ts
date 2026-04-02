import { NextResponse } from "next/server";

import { connectToDatabase } from "@/lib/mongodb";
import { shareQuotaFromBudget } from "@/lib/share-quota";
import Campaign from "@/models/Campaign";

type CampaignTagLean = {
  _id: unknown;
  slug?: string;
  nameEn?: string;
};

type SponsorLean = {
  companyName?: string;
};

function normalizeImageUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => String(v ?? "").trim())
    .filter(Boolean);
}

/** GET — ฟีดแคมเปญสำหรับแอปผู้ใช้จากฐานข้อมูล */
export async function GET() {
  try {
    await connectToDatabase();

    const docs = await Campaign.find({ status: "active" })
      .sort({ isPopular: -1, createdAt: -1 })
      .populate("sponsorId", "companyName")
      .populate("tagIds", "slug nameEn")
      .lean();

    const campaigns = (docs as Array<Record<string, unknown>>).map((doc) => {
      const imageUrls = normalizeImageUrls((doc as { imageUrls?: unknown }).imageUrls);
      const tags = Array.isArray((doc as { tagIds?: CampaignTagLean[] }).tagIds)
        ? ((doc as { tagIds?: CampaignTagLean[] }).tagIds ?? [])
            .map((t) => String(t.slug ?? t.nameEn ?? "").trim().toLowerCase())
            .filter(Boolean)
        : [];

      const totalBudget = Number((doc as { totalBudget?: unknown }).totalBudget ?? 0);
      const rewardPerShare = Number((doc as { rewardPerShare?: unknown }).rewardPerShare ?? 0);
      return {
        id: String(doc._id),
        title: String((doc as { name?: unknown }).name ?? ""),
        description: String((doc as { description?: unknown }).description ?? ""),
        totalBudget,
        usedBudget: Number((doc as { usedBudget?: unknown }).usedBudget ?? 0),
        reward: rewardPerShare,
        maxRewardPerUser: Number((doc as { maxRewardPerUser?: unknown }).maxRewardPerUser ?? 0),
        maxRewardPerUserPerDay: Number(
          (doc as { maxRewardPerUserPerDay?: unknown }).maxRewardPerUserPerDay ?? 0
        ),
        quota: shareQuotaFromBudget(totalBudget, rewardPerShare),
        current: Number((doc as { currentShares?: unknown }).currentShares ?? 0),
        images: imageUrls,
        brand: String(
          ((doc as { sponsorId?: SponsorLean }).sponsorId as SponsorLean | undefined)
            ?.companyName ?? ""
        ),
        popular: Boolean((doc as { isPopular?: unknown }).isPopular ?? false),
        categories: tags,
      };
    });

    return NextResponse.json({ ok: true, campaigns });
  } catch (e) {
    console.error("[api/campaigns]", e);
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message.includes("MONGODB_URI")) {
      return NextResponse.json(
        { ok: false, error: "database_not_configured" },
        { status: 503 }
      );
    }
    return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });
  }
}
