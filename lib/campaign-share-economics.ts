/**
 * กฎรางวัลและเพดานต่อผู้ใช้ตอนแชร์แคมเปญ
 *
 * - เพดาน «ต่อคน» (สะสมในแคมเปญ / ต่อวันในแคมเปญ) ใช้สถิติตาม userId ใน CampaignMemberStat / CampaignUserDailyStat
 *   (แยกคนละไอดี — ไม่ใช่ขีดจำกัดรวมทั้งแคมเปญสำหรับผู้ใช้ทุกคน)
 * - โควต้าแชร์รวมทั้งแคมเปญ (quota vs currentShares) แยกต่างหาก — ใช้เมื่อ quota > 0 เท่านั้น
 * - แคมเปญที่สปอนเซอร์สร้าง vs แอดมินสร้าง ใช้ฟังก์ชันชุดเดียวกัน; ต่างกันที่ใครสร้าง/แก้เอกสารแคมเปญ
 */

import mongoose from "mongoose";

import { connectToDatabase } from "@/lib/mongodb";
import Campaign from "@/models/Campaign";
import PlatformSettings from "@/models/PlatformSettings";
import Sponsor from "@/models/Sponsor";

const SINGLETON_KEY = "default";

export type PlatformCampaignEconomics = {
  rewardPerShare: number;
  maxEarnPerUserPerDay: number;
};

export async function getPlatformCampaignEconomics(): Promise<PlatformCampaignEconomics> {
  await connectToDatabase();
  const doc = await PlatformSettings.findOne({ singletonKey: SINGLETON_KEY }).lean();
  const d = doc as {
    campaignRewardPerShare?: number;
    campaignMaxEarnPerUserPerDay?: number;
  } | null;
  return {
    rewardPerShare: Math.max(0, Number(d?.campaignRewardPerShare ?? 0)),
    maxEarnPerUserPerDay: Math.max(0, Number(d?.campaignMaxEarnPerUserPerDay ?? 0)),
  };
}

type CampaignLean = {
  totalBudget?: number;
  usedBudget?: number;
  rewardPerShare?: number;
  maxRewardPerUser?: number;
  maxRewardPerUserPerDay?: number;
  sponsorId?: unknown;
};

type SponsorLean = {
  advertisingTotalBudget?: number;
  advertisingUsedBudget?: number;
};

/**
 * ค่าที่ใช้จริงตอนเช็ก/บันทึกแชร์ — ทุกแคมเปญใช้กฎเดียวกัน:
 * ถ้าแคมเปญกำหนดค่าในฟิลด์เอง (>0 สำหรับบาท) ใช้ค่าแคมเปญก่อน ไม่ให้ Platform Settings ทับ
 * ถ้าแคมเปญไม่กำหนด ค่อย fallback ไปค่าแพลตฟอร์ม (เช่น แคมเปญ CMS ที่ตั้ง reward ที่แพลตฟอร์มอย่างเดียว)
 */
export function resolveRewardPerShare(
  platform: PlatformCampaignEconomics,
  campaign: CampaignLean
): number {
  const campaignRps = Math.max(0, Number(campaign.rewardPerShare ?? 0));
  if (campaignRps > 0) return campaignRps;
  if (platform.rewardPerShare > 0) return platform.rewardPerShare;
  return 0;
}

export function resolveMaxEarnPerUserPerDay(
  platform: PlatformCampaignEconomics,
  campaign: CampaignLean
): number {
  const c = Math.max(0, Number(campaign.maxRewardPerUserPerDay ?? 0));
  if (c > 0) return c;
  if (platform.maxEarnPerUserPerDay > 0) return platform.maxEarnPerUserPerDay;
  return 0;
}

export function resolveMaxEarnPerUserCampaign(
  _platform: PlatformCampaignEconomics,
  campaign: CampaignLean,
  _rewardPerShare: number
): number {
  return Math.max(0, Number(campaign.maxRewardPerUser ?? 0));
}

export function sponsorBudgetSnapshot(sponsor: SponsorLean | null | undefined): {
  total: number;
  used: number;
} {
  return {
    total: Math.max(0, Number(sponsor?.advertisingTotalBudget ?? 0)),
    used: Math.max(0, Number(sponsor?.advertisingUsedBudget ?? 0)),
  };
}

export async function loadCampaignAndSponsorForShare(campaignId: string): Promise<{
  campaign: CampaignLean & { _id: unknown; status?: string; currentShares?: number; quota?: number };
  sponsor: SponsorLean & { _id: unknown } | null;
} | null> {
  if (!mongoose.Types.ObjectId.isValid(campaignId)) return null;
  await connectToDatabase();
  const oid = new mongoose.Types.ObjectId(campaignId);
  const raw = await Campaign.findById(oid).lean();
  if (!raw) return null;
  const c = raw as CampaignLean & {
    _id: unknown;
    status?: string;
    currentShares?: number;
    quota?: number;
  };
  const sid = c.sponsorId;
  if (!sid) return { campaign: c, sponsor: null };
  const sp = await Sponsor.findById(sid).lean();
  return { campaign: c, sponsor: (sp as SponsorLean & { _id: unknown }) ?? null };
}
