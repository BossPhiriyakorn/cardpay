import { Schema, model, models, type InferSchemaType } from "mongoose";

/**
 * แท็กหมวดแคมเปญ (ใช้ฟิลเตอร์หน้าแอป / CMS)
 *
 * คอลเลกชัน: `campaigntags`
 * อ้างอิงจาก `campaigns.tagIds`
 */
const CampaignTagSchema = new Schema(
  {
    slug: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    nameTh: { type: String, required: true, trim: true },
    nameEn: { type: String, default: "", trim: true },
    sortOrder: { type: Number, default: 0, index: true },
    /** ปิดใช้งานใน UI โดยไม่ลบ slug (ป้องกันลิงก์เก่าหัก) */
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, versionKey: false }
);

export type CampaignTagDocument = InferSchemaType<typeof CampaignTagSchema>;

const CampaignTag = models.CampaignTag || model("CampaignTag", CampaignTagSchema);

export default CampaignTag;
