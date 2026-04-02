import { Schema, model, models, type InferSchemaType } from "mongoose";

/** ประวัติการกระทำใน CMS (เมนูประวัติเข้าใช้งาน) */
const AuditLogSchema = new Schema(
  {
    actorUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
    },
    /** ข้อความสรุปการกระทำ เช่น "เข้าสู่ระบบ", "แก้ไขแคมเปญ" */
    action: { type: String, required: true, trim: true },
    /** จัดกลุ่มสำหรับแดชบอร์ด "กิจกรรมล่าสุด" และกรองใน /cms/logs */
    category: {
      type: String,
      enum: ["auth", "member", "sponsor", "campaign", "withdrawal", "system", "other"],
      default: "other",
      index: true,
    },
    targetType: { type: String, default: "", trim: true },
    targetId: { type: String, default: "", trim: true },
    device: { type: String, default: "" },
    location: { type: String, default: "" },
    ip: { type: String, default: "" },
  },
  { timestamps: true, versionKey: false }
);

AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ category: 1, createdAt: -1 });

export type AuditLogDocument = InferSchemaType<typeof AuditLogSchema>;

const AuditLog = models.AuditLog || model("AuditLog", AuditLogSchema);

export default AuditLog;
