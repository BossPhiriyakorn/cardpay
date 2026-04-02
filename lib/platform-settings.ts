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
export async function getPlatformSettingsForCmsEdit(): Promise<{
  privacyPolicyText: string;
  termsOfServiceText: string;
  minWithdrawalAmount: number;
  updatedAt: string | null;
}> {
  await connectToDatabase();
  const doc = await PlatformSettings.findOne({ singletonKey: SINGLETON_KEY }).lean();
  if (!doc) {
    return {
      privacyPolicyText: "",
      termsOfServiceText: "",
      minWithdrawalAmount: 0,
      updatedAt: null,
    };
  }
  const d = doc as {
    privacyPolicyText?: string;
    termsOfServiceText?: string;
    minWithdrawalAmount?: number;
    updatedAt?: Date;
  };
  return {
    privacyPolicyText: String(d.privacyPolicyText ?? ""),
    termsOfServiceText: String(d.termsOfServiceText ?? ""),
    minWithdrawalAmount: Math.max(0, Math.floor(Number(d.minWithdrawalAmount ?? 0))),
    updatedAt: d.updatedAt instanceof Date ? d.updatedAt.toISOString() : null,
  };
}

export async function upsertPlatformSettings(params: {
  privacyPolicyText: string;
  termsOfServiceText: string;
  minWithdrawalAmount: number;
}): Promise<void> {
  await connectToDatabase();
  await PlatformSettings.findOneAndUpdate(
    { singletonKey: SINGLETON_KEY },
    {
      $set: {
        privacyPolicyText: params.privacyPolicyText,
        termsOfServiceText: params.termsOfServiceText,
        minWithdrawalAmount: params.minWithdrawalAmount,
      },
      $setOnInsert: { singletonKey: SINGLETON_KEY },
    },
    { upsert: true, new: true }
  );
}
