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
  },
  { timestamps: true, versionKey: false }
);

export type PlatformSettingsDocument = InferSchemaType<typeof PlatformSettingsSchema>;

const PlatformSettings =
  models.PlatformSettings || model("PlatformSettings", PlatformSettingsSchema);

export default PlatformSettings;
