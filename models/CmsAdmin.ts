import { Schema, model, models, type InferSchemaType } from "mongoose";

export const CMS_ADMIN_ROLES = ["admin", "reviewer"] as const;
export type CmsAdminRole = (typeof CMS_ADMIN_ROLES)[number];

/**
 * แอดมิน CMS — ล็อกอินชื่อผู้ใช้+รหัสผ่าน (รหัสเก็บเป็น hash ใน DB เท่านั้น)
 * คอลเลกชัน: `cmsadmins`
 */
const CmsAdminSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true, select: false },
    name: { type: String, default: "", trim: true },
    role: {
      type: String,
      enum: CMS_ADMIN_ROLES,
      default: "admin",
      index: true,
    },
    lineNotifyUserId: { type: String, default: "", trim: true, index: true },
    lineNotifyEnabled: { type: Boolean, default: false, index: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true, versionKey: false }
);

export type CmsAdminDocument = InferSchemaType<typeof CmsAdminSchema>;

const CmsAdmin = models.CmsAdmin || model("CmsAdmin", CmsAdminSchema);

export default CmsAdmin;
