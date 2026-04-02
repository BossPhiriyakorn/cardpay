import { Schema, model, models, type InferSchemaType } from "mongoose";

/** ยอดแชร์และรายได้รายวันต่อผู้ใช้ต่อแคมเปญ ใช้สำหรับคุมลิมิตรายวันของแต่ละคน */
const CampaignUserDailyStatSchema = new Schema(
  {
    campaignId: {
      type: Schema.Types.ObjectId,
      ref: "Campaign",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    day: { type: Date, required: true },
    shareCount: { type: Number, default: 0, min: 0 },
    ownEarnedAmount: { type: Number, default: 0, min: 0 },
    referralEarnedAmount: { type: Number, default: 0, min: 0 },
    earnedAmount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: false, versionKey: false }
);

CampaignUserDailyStatSchema.index({ campaignId: 1, userId: 1, day: 1 }, { unique: true });

export type CampaignUserDailyStatDocument = InferSchemaType<typeof CampaignUserDailyStatSchema>;

const CampaignUserDailyStat =
  models.CampaignUserDailyStat || model("CampaignUserDailyStat", CampaignUserDailyStatSchema);

export default CampaignUserDailyStat;
