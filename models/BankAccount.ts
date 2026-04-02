import { Schema, model, models, type InferSchemaType } from "mongoose";

/** บัญชีธนาคารที่ผู้ใช้ผูก — กฎ: 1 user ต่อ 1 เอกสาร (ดู unique index ที่ userId) */
const BankAccountSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
    },
    bankName: { type: String, required: true, trim: true },
    accountNumber: { type: String, required: true, trim: true },
    accountHolderName: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
      index: true,
    },
    /** เหตุผลที่แอดมินไม่อนุมัติ/หมายเหตุการตรวจสอบ */
    reviewReason: { type: String, default: "", trim: true },
    reviewedAt: { type: Date },
    reviewedBy: { type: String, default: "", trim: true },
    /** ไฟล์ใน Google Drive (หรือ URL) สำหรับ KYC */
    idCardDriveFileId: { type: String, default: "" },
    bankBookDriveFileId: { type: String, default: "" },
  },
  { timestamps: true, versionKey: false }
);

export type BankAccountDocument = InferSchemaType<typeof BankAccountSchema>;

const BankAccount = models.BankAccount || model("BankAccount", BankAccountSchema);

export default BankAccount;
