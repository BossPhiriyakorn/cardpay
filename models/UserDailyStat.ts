import { Schema, model, models, type InferSchemaType } from "mongoose";

/** สถิติรายวันต่อผู้ใช้ (แชร์วันนี้ / รายได้วันนี้ ในการ์ดยอดเงินสะสม) */
const UserDailyStatSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    day: { type: Date, required: true },
    shareCount: { type: Number, default: 0, min: 0 },
    earnedAmount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: false, versionKey: false }
);

UserDailyStatSchema.index({ userId: 1, day: 1 }, { unique: true });

export type UserDailyStatDocument = InferSchemaType<typeof UserDailyStatSchema>;

const UserDailyStat = models.UserDailyStat || model("UserDailyStat", UserDailyStatSchema);

export default UserDailyStat;
