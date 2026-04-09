import mongoose from "mongoose";

import { connectToDatabase } from "@/lib/mongodb";
import PlatformSettings from "@/models/PlatformSettings";
import {
  DEFAULT_PRIVACY_POLICY_TEXT,
  DEFAULT_TERMS_OF_SERVICE_TEXT,
} from "@/lib/register-legal-defaults";

export {
  DEFAULT_PRIVACY_POLICY_TEXT,
  DEFAULT_TERMS_OF_SERVICE_TEXT,
} from "@/lib/register-legal-defaults";

const SINGLETON_KEY = "default";

export type ResolvedPlatformSettings = {
  privacyPolicyText: string;
  termsOfServiceText: string;
  minWithdrawalAmount: number;
};

/** สำหรับผู้ใช้/สาธารณะ — ข้อความว่างใน DB จะถูกแทนด้วยค่าเริ่มต้น */
export async function getResolvedPlatformSettings(): Promise<ResolvedPlatformSettings> {
  await connectToDatabase();
  const doc = await PlatformSettings.findOne({ singletonKey: SINGLETON_KEY }).lean();
  const privacy = String((doc as { privacyPolicyText?: string } | null)?.privacyPolicyText ?? "").trim();
  const terms = String((doc as { termsOfServiceText?: string } | null)?.termsOfServiceText ?? "").trim();
  const minW = Math.max(
    0,
    Math.floor(Number((doc as { minWithdrawalAmount?: number } | null)?.minWithdrawalAmount ?? 0))
  );
  return {
    privacyPolicyText: privacy || DEFAULT_PRIVACY_POLICY_TEXT,
    termsOfServiceText: terms || DEFAULT_TERMS_OF_SERVICE_TEXT,
    minWithdrawalAmount: minW,
  };
}

/** สำหรับฟอร์ม CMS — แสดงค่าที่บันทึกจริง (อาจว่าง) */
export async function getSponsorPortalSupportContactUrl(): Promise<string> {
  await connectToDatabase();
  const doc = await PlatformSettings.findOne({ singletonKey: SINGLETON_KEY })
    .select("sponsorPortalSupportUrl")
    .lean();
  return String(
    (doc as { sponsorPortalSupportUrl?: string } | null)?.sponsorPortalSupportUrl ?? ""
  ).trim();
}

export async function getPlatformSettingsForCmsEdit(): Promise<{
  privacyPolicyText: string;
  termsOfServiceText: string;
  minWithdrawalAmount: number;
  campaignRewardPerShare: number;
  campaignMaxEarnPerUserPerDay: number;
  sponsorPortalSupportUrl: string;
  updatedAt: string | null;
}> {
  await connectToDatabase();
  const doc = await PlatformSettings.findOne({ singletonKey: SINGLETON_KEY }).lean();
  if (!doc) {
    return {
      privacyPolicyText: "",
      termsOfServiceText: "",
      minWithdrawalAmount: 0,
      campaignRewardPerShare: 0,
      campaignMaxEarnPerUserPerDay: 0,
      sponsorPortalSupportUrl: "",
      updatedAt: null,
    };
  }
  const d = doc as {
    privacyPolicyText?: string;
    termsOfServiceText?: string;
    minWithdrawalAmount?: number;
    campaignRewardPerShare?: number;
    campaignMaxEarnPerUserPerDay?: number;
    sponsorPortalSupportUrl?: string;
    updatedAt?: Date;
  };
  return {
    privacyPolicyText: String(d.privacyPolicyText ?? ""),
    termsOfServiceText: String(d.termsOfServiceText ?? ""),
    minWithdrawalAmount: Math.max(0, Math.floor(Number(d.minWithdrawalAmount ?? 0))),
    campaignRewardPerShare: Math.max(0, Number(d.campaignRewardPerShare ?? 0)),
    campaignMaxEarnPerUserPerDay: Math.max(0, Number(d.campaignMaxEarnPerUserPerDay ?? 0)),
    sponsorPortalSupportUrl: String(d.sponsorPortalSupportUrl ?? "").trim().slice(0, 2048),
    updatedAt: d.updatedAt instanceof Date ? d.updatedAt.toISOString() : null,
  };
}

export async function upsertPlatformSettings(params: {
  privacyPolicyText: string;
  termsOfServiceText: string;
  minWithdrawalAmount: number;
  campaignRewardPerShare: number;
  campaignMaxEarnPerUserPerDay: number;
  sponsorPortalSupportUrl: string;
}): Promise<void> {
  await connectToDatabase();
  const supportUrl = String(params.sponsorPortalSupportUrl ?? "").trim().slice(0, 2048);
  await PlatformSettings.findOneAndUpdate(
    { singletonKey: SINGLETON_KEY },
    {
      $set: {
        privacyPolicyText: params.privacyPolicyText,
        termsOfServiceText: params.termsOfServiceText,
        minWithdrawalAmount: params.minWithdrawalAmount,
        campaignRewardPerShare: params.campaignRewardPerShare,
        campaignMaxEarnPerUserPerDay: params.campaignMaxEarnPerUserPerDay,
        /** เลิกใช้ใน UI — เคลียร์ค่าเก่าในฐานข้อมูล */
        campaignMaxSharesPerUserPerCampaign: 0,
        sponsorPortalSupportUrl: supportUrl,
      },
      $setOnInsert: { singletonKey: SINGLETON_KEY },
    },
    { upsert: true, new: true }
  );
}

/** เทมเพลตที่สปอนเซอร์ต้องใช้ตอนสร้างแคมเปญ — null = ยังไม่เปิดให้สร้าง */
export async function getActiveSponsorFlexTemplateId(): Promise<string | null> {
  await connectToDatabase();
  const doc = await PlatformSettings.findOne({ singletonKey: SINGLETON_KEY })
    .select("activeSponsorFlexTemplateId")
    .lean();
  const raw = (doc as { activeSponsorFlexTemplateId?: unknown } | null)?.activeSponsorFlexTemplateId;
  if (raw == null) return null;
  const s = String(raw);
  return mongoose.Types.ObjectId.isValid(s) ? s : null;
}

export async function setActiveSponsorFlexTemplateId(templateId: string | null): Promise<void> {
  await connectToDatabase();
  const setVal =
    templateId && mongoose.Types.ObjectId.isValid(templateId)
      ? new mongoose.Types.ObjectId(templateId)
      : null;
  await PlatformSettings.findOneAndUpdate(
    { singletonKey: SINGLETON_KEY },
    { $set: { activeSponsorFlexTemplateId: setVal } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}
