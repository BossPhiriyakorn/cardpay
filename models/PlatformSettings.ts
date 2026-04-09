import { Schema, model, models, type InferSchemaType } from "mongoose";

/** การตั้งค่าแพลตฟอร์มแบบเอกสารเดียว (singleton) */
const PlatformSettingsSchema = new Schema(
  {
    singletonKey: {
      type: String,
      required: true,
      unique: true,
      default: "default",
      immutable: true,
    },
    /** นโยบายความเป็นส่วนตัว — แสดงหน้าสมัคร (ว่าง = ใช้ข้อความเริ่มต้นในระบบ) */
    privacyPolicyText: { type: String, default: "" },
    /** ข้อกำหนดการใช้บริการ — แสดงหน้าสมัคร */
    termsOfServiceText: { type: String, default: "" },
    /** ยอดถอนขั้นต่ำ (บาท) ทุกผู้ใช้ — 0 = ไม่กำหนด */
    minWithdrawalAmount: { type: Number, default: 0, min: 0 },
    /** รางวัลต่อการแชร์ 1 ครั้ง (บาท) — ใช้ทั้งแพลตฟอร์ม; 0 = ใช้ค่าที่บันทึกในแคมเปญ (โหมดเดิม) */
    campaignRewardPerShare: { type: Number, default: 0, min: 0 },
    /** เพดานเงินที่ผู้ใช้รับได้ต่อวันต่อแคมเปญ (บาท) — 0 = ไม่จำกัด */
    campaignMaxEarnPerUserPerDay: { type: Number, default: 0, min: 0 },
    /** @deprecated เลิกใช้ — บันทึกเป็น 0 เสมอ; จำกัดต่อคนใช้เพดานเงินที่ระดับแคมเปญ (maxRewardPerUser) */
    campaignMaxSharesPerUserPerCampaign: { type: Number, default: 0, min: 0 },
    /**
     * ลิงก์ปุ่ม "ติดต่อแอดมิน / เติมเงิน" ในพอร์ทัลสปอนเซอร์ (https / tel / mailto)
     * ว่าง = ใช้ NEXT_PUBLIC_SPONSOR_SUPPORT_URL ถ้ามี
     */
    sponsorPortalSupportUrl: { type: String, default: "", trim: true, maxlength: 2048 },
    /** เทมเพลต Flex ที่ใช้บังคับตอนสปอนเซอร์สร้างแคมเปญ (ทีละหนึ่งเทมเพลต) */
    activeSponsorFlexTemplateId: {
      type: Schema.Types.ObjectId,
      ref: "FlexCampaignTemplate",
      default: null,
    },
  },
  { timestamps: true, versionKey: false }
);

export type PlatformSettingsDocument = InferSchemaType<typeof PlatformSettingsSchema>;

const PlatformSettings =
  models.PlatformSettings || model("PlatformSettings", PlatformSettingsSchema);

export default PlatformSettings;
