import { Schema, model, models, type InferSchemaType } from "mongoose";

/** สรุปยอดแชร์รายวันต่อแคมเปญ (กราฟวัน/สัปดาห์/เดือนในรายละเอียดแคมเปญ) — อาจเก็บจาก job aggregate */
const CampaignShareDailySchema = new Schema(
  {
    campaignId: {
      type: Schema.Types.ObjectId,
      ref: "Campaign",
      required: true,
      index: true,
    },
    /** เริ่มต้นวัน UTC หรือ timezone ไทยตามที่ทีมกำหนด */
    day: { type: Date, required: true },
    shareCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: false, versionKey: false }
);

CampaignShareDailySchema.index({ campaignId: 1, day: 1 }, { unique: true });

export type CampaignShareDailyDocument = InferSchemaType<typeof CampaignShareDailySchema>;

const CampaignShareDaily =
  models.CampaignShareDaily || model("CampaignShareDaily", CampaignShareDailySchema);

export default CampaignShareDaily;
