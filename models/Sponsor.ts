import { Schema, model, models, type InferSchemaType } from "mongoose";

/**
 * สปอนเซอร์ / ลูกค้า
 * - แบบผูก LINE: มี `userId` (แอดมิน CMS สร้าง) อาจไม่มีรหัสพอร์ทัล
 * - แบบพอร์ทัลจัดการโฆษณา: มี `portalUsername` + `portalPasswordHash` ไม่มี `userId`
 */
const SponsorSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: false,
      unique: true,
      sparse: true,
    },
    companyName: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
      index: true,
    },
    /** ไอดีเข้าพอร์ทัลสปอนเซอร์ (แยกจาก LINE / User) */
    portalUsername: {
      type: String,
      lowercase: true,
      trim: true,
      sparse: true,
      unique: true,
    },
    portalPasswordHash: { type: String, select: false },
    /** อีเมลติดต่อจากฟอร์มสมัครพอร์ทัล (ไม่บังคับ) */
    contactEmail: { type: String, default: "", trim: true },
  },
  { timestamps: true, versionKey: false }
);

export type SponsorDocument = InferSchemaType<typeof SponsorSchema>;

const Sponsor = models.Sponsor || model("Sponsor", SponsorSchema);

export default Sponsor;
