import Campaign from "@/models/Campaign";
import CampaignTag from "@/models/CampaignTag";
import Sponsor from "@/models/Sponsor";
import { connectToDatabase } from "@/lib/mongodb";
import { shareQuotaFromBudget } from "@/lib/share-quota";
import type {
  CmsCampaignRow,
  CmsCampaignStatus,
  CmsCampaignTagBrief,
} from "@/lib/cms/types";

async function mapTagIdsToBriefs(
  tagIds: unknown[] | undefined
): Promise<CmsCampaignTagBrief[]> {
  const ids = (tagIds ?? [])
    .filter(Boolean)
    .map((id) => String(id));
  if (ids.length === 0) return [];
  const tags = await CampaignTag.find({ _id: { $in: ids } })
    .select({ slug: 1, nameTh: 1 })
    .lean();
  return tags.map((t) => ({
    id: String(t._id),
    slug: t.slug as string,
    nameTh: t.nameTh as string,
  }));
}

export type ListCmsCampaignsLoadError = "missing_mongodb_uri" | "database_error";

/**
 * รายการแคมเปญสำหรับ CMS — ดึงจาก MongoDB เท่านั้น
 * `loadError` เมื่อไม่มี URI หรือ query ล้มเหลว (เดิมคืน [] เงียบๆ ทำให้เข้าใจผิดว่าไม่มีแคมเปญ)
 */
export async function listCmsCampaigns(): Promise<{
  source: "database";
  campaigns: CmsCampaignRow[];
  loadError?: ListCmsCampaignsLoadError;
}> {
  if (!process.env.MONGODB_URI?.trim()) {
    return {
      source: "database",
      campaigns: [],
      loadError: "missing_mongodb_uri",
    };
  }

  try {
    await connectToDatabase();
    const docs = await Campaign.find().sort({ updatedAt: -1 }).lean();
    const sponsorIds = [...new Set(docs.map((d) => String(d.sponsorId)))];
    const sponsorDocs = await Sponsor.find({
      _id: { $in: sponsorIds },
    }).lean();
    const sponsorMap = new Map(
      sponsorDocs.map((s) => [String(s._id), s.companyName as string])
    );

    const allTagIdStrings = [
      ...new Set(
        docs.flatMap((d) =>
          ((d as { tagIds?: unknown[] }).tagIds ?? []).map((x) => String(x))
        )
      ),
    ];
    const tagDocs =
      allTagIdStrings.length > 0
        ? await CampaignTag.find({ _id: { $in: allTagIdStrings } })
            .select({ slug: 1, nameTh: 1 })
            .lean()
        : [];
    const tagBriefById = new Map(
      tagDocs.map((t) => [
        String(t._id),
        {
          id: String(t._id),
          slug: t.slug as string,
          nameTh: t.nameTh as string,
        } satisfies CmsCampaignTagBrief,
      ])
    );

    const campaigns: CmsCampaignRow[] = docs.map((d) => {
      const rawTagIds = (d as { tagIds?: unknown[] }).tagIds ?? [];
      const tags = rawTagIds
        .map((tid) => tagBriefById.get(String(tid)))
        .filter((x): x is CmsCampaignTagBrief => x != null);

      return {
        id: String(d._id),
        sponsorId: String(d.sponsorId),
        sponsorName: sponsorMap.get(String(d.sponsorId)) ?? "—",
        name: d.name,
        totalBudget: d.totalBudget,
        usedBudget: d.usedBudget ?? 0,
        status: d.status as CmsCampaignStatus,
        tags,
      };
    });

    return { source: "database", campaigns };
  } catch (err) {
    console.error("[cms] listCmsCampaigns:", err);
    return {
      source: "database",
      campaigns: [],
      loadError: "database_error",
    };
  }
}

export function computeCmsCampaignStats(campaigns: CmsCampaignRow[]) {
  const total = campaigns.length;
  const active = campaigns.filter((c) => c.status === "active").length;
  const inactive = total - active;
  return { total, active, inactive };
}

/** ดึงแคมเปญเดียวจาก DB สำหรับหน้ารายละเอียด (ใช้เมื่อรหัสเป็น ObjectId) */
export async function getCmsCampaignById(
  campaignId: string
): Promise<{ campaign: CmsCampaignRow; source: "database" } | null> {
  if (!process.env.MONGODB_URI) return null;

  try {
    const mongoose = await import("mongoose");
    if (!mongoose.default.Types.ObjectId.isValid(campaignId)) return null;

    await connectToDatabase();
    const doc = await Campaign.findById(campaignId).lean();
    if (!doc) return null;

    const sponsor = await Sponsor.findById(doc.sponsorId).lean();
    const tags = await mapTagIdsToBriefs(
      (doc as { tagIds?: unknown[] }).tagIds
    );
    const d = doc as {
      description?: string;
      flexMessageJsonDriveFileId?: string;
      shareAltText?: string;
      rewardPerShare?: number;
      maxRewardPerUser?: number;
      maxRewardPerUserPerDay?: number;
      quota?: number;
      imageUrls?: unknown;
    };
    const rawImages = Array.isArray(d.imageUrls) ? d.imageUrls : [];
    const imageUrls = rawImages.map((u) => String(u ?? "").trim()).filter(Boolean);
    const row: CmsCampaignRow = {
      id: String(doc._id),
      sponsorId: String(doc.sponsorId),
      sponsorName: sponsor?.companyName ?? "—",
      name: doc.name,
      totalBudget: doc.totalBudget,
      usedBudget: doc.usedBudget ?? 0,
      status: doc.status as CmsCampaignStatus,
      tags,
      description: String(d.description ?? ""),
      flexMessageJsonDriveFileId: String(d.flexMessageJsonDriveFileId ?? ""),
      shareAltText: String(d.shareAltText ?? ""),
      rewardPerShare: typeof d.rewardPerShare === "number" ? d.rewardPerShare : 0,
      maxRewardPerUser: typeof d.maxRewardPerUser === "number" ? d.maxRewardPerUser : 0,
      maxRewardPerUserPerDay:
        typeof d.maxRewardPerUserPerDay === "number" ? d.maxRewardPerUserPerDay : 0,
      quota: shareQuotaFromBudget(doc.totalBudget, typeof d.rewardPerShare === "number" ? d.rewardPerShare : 0),
      imageUrls,
    };
    return { campaign: row, source: "database" };
  } catch (err) {
    console.error("[cms] getCmsCampaignById:", err);
    return null;
  }
}
