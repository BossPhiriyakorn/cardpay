import { Schema, model, models, type InferSchemaType } from "mongoose";

/**
 * แคมเปญแชร์ (ฟีดผู้ใช้ + รายละเอียดสปอนเซอร์/แคมเปญใน CMS)
 *
 * คอลเลกชัน: `campaigns`
 * - `sponsorId` → `sponsors._id`
 * - `tagIds` → หลาย `campaigntags._id` (กรองหมวด / ฟีดแอป)
 */
const CampaignSchema = new Schema(
  {
    sponsorId: {
      type: Schema.Types.ObjectId,
      ref: "Sponsor",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    totalBudget: { type: Number, required: true, min: 0 },
    usedBudget: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ["active", "paused", "completed"],
      default: "active",
      index: true,
    },
    /** ค่าตอบแทนต่อการแชร์ (บาท) — ตรงกับการ์ดแคมเปญ */
    rewardPerShare: { type: Number, default: 0, min: 0 },
    /** เพดานรายได้สะสมสูงสุดต่อผู้ใช้ในแคมเปญนี้ (บาท) */
    maxRewardPerUser: { type: Number, default: 0, min: 0 },
    /** เพดานรายได้สูงสุดต่อผู้ใช้ต่อวันในแคมเปญนี้ (บาท) */
    maxRewardPerUserPerDay: { type: Number, default: 0, min: 0 },
    quota: { type: Number, default: 0, min: 0 },
    currentShares: { type: Number, default: 0, min: 0 },
    imageUrls: [{ type: String }],
    /** อ้างอิงไฟล์ JSON Flex บน Drive หรือเก็บ path */
    flexMessageJsonDriveFileId: { type: String, default: "" },
    /**
     * ข้อความแจ้งเตือน (altText) เมื่อแชร์ Flex ผ่าน LINE — ทับค่า linemsg ใน JSON บน Drive ถ้ากรอก
     * จำกัดความยาวตาม LINE (สูงสุด 400 ตัวอักษร)
     */
    shareAltText: { type: String, default: "", maxlength: 400 },
    isPopular: { type: Boolean, default: false },
    /** แท็กหมวด (อ้างอิง `campaigntags`) — ใช้ฟิลเตอร์หน้าแคมเปญทั้งหมด */
    tagIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "CampaignTag" }],
      default: [],
    },
  },
  { timestamps: true, versionKey: false }
);

CampaignSchema.index({ sponsorId: 1, status: 1 });
/** ค้นหาแคมเปญตามแท็ก (multikey) */
CampaignSchema.index({ tagIds: 1 });

export type CampaignDocument = InferSchemaType<typeof CampaignSchema>;

const Campaign = models.Campaign || model("Campaign", CampaignSchema);

export default Campaign;
