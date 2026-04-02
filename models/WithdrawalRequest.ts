import { Schema, model, models, type InferSchemaType } from "mongoose";

/** คำขอถอน / รายการโอน (แจ้งเตือนถอนแดชบอร์ด + ประวัติโอนในรายละเอียดสมาชิก) */
const WithdrawalRequestSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    bankAccountId: {
      type: Schema.Types.ObjectId,
      ref: "BankAccount",
    },
    amount: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["pending", "completed", "cancelled"],
      default: "pending",
      index: true,
    },
    note: { type: String, default: "" },
    completedAt: { type: Date },
    /** แอดมินที่กดยืนยันโอน (CMS รายละเอียดสมาชิก) */
    processedByUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true, versionKey: false }
);

WithdrawalRequestSchema.index({ status: 1, createdAt: -1 });

export type WithdrawalRequestDocument = InferSchemaType<typeof WithdrawalRequestSchema>;

const WithdrawalRequest =
  models.WithdrawalRequest || model("WithdrawalRequest", WithdrawalRequestSchema);

export default WithdrawalRequest;
