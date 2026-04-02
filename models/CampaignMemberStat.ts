import { Schema, model, models, type InferSchemaType } from "mongoose";

/** สถิติรายบุคคลต่อแคมเปญ (ตารางสมาชิกที่แชร์ในรายละเอียดแคมเปญ + ตารางแคมเปญในรายละเอียดสมาชิก) */
const CampaignMemberStatSchema = new Schema(
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
    shareCount: { type: Number, default: 0, min: 0 },
    ownShareEarned: { type: Number, default: 0, min: 0 },
    referralEarned: { type: Number, default: 0, min: 0 },
    totalEarned: { type: Number, default: 0, min: 0 },
    totalClicks: { type: Number, default: 0, min: 0 },
    totalLeads: { type: Number, default: 0, min: 0 },
    lastSharedAt: { type: Date },
  },
  { timestamps: true, versionKey: false }
);

CampaignMemberStatSchema.index({ campaignId: 1, userId: 1 }, { unique: true });

export type CampaignMemberStatDocument = InferSchemaType<typeof CampaignMemberStatSchema>;

const CampaignMemberStat =
  models.CampaignMemberStat || model("CampaignMemberStat", CampaignMemberStatSchema);

export default CampaignMemberStat;
