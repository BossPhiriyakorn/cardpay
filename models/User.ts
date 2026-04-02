import { Schema, model, models, type InferSchemaType } from "mongoose";

const UserSchema = new Schema(
  {
    lineUid: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      trim: true,
      default: "",
    },
    firstName: { type: String, default: "", trim: true },
    lastName: { type: String, default: "", trim: true },
    image: {
      type: String,
      default: "",
    },
    role: {
      type: String,
      enum: ["user", "sponsor", "admin"],
      default: "user",
    },
    /**
     * ยอดที่ถอนได้ / คงเหลือในกระเป๋า (ตาม business rule ของทีม)
     * ควร sync กับยอดที่ยังไม่ถอน + ประวัติ WithdrawalRequest
     */
    walletBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    /** ยอดรวมตลอดกาลที่เคยได้จากการแชร์ (แดชบอร์ด / โปรไฟล์ CMS) */
    totalEarnedAllTime: {
      type: Number,
      default: 0,
      min: 0,
    },
    /**
     * ยอดรวมที่รอโอน (cache สำหรับแสดงใน CMS)
     * แนะนำให้คำนวณจาก WithdrawalRequest สถานะ pending หรือ sync ด้วย transaction
     */
    pendingTransferAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    email: { type: String, default: "", trim: true },
    phone: { type: String, default: "", trim: true },
    /** LINE ID แสดงผล (ไม่ใช่ lineUid จาก provider) */
    lineDisplayId: { type: String, default: "", trim: true },
    /** LINE userId สำหรับส่งแจ้งเตือนผ่าน LINE OA (fallback ใช้ lineUid ถ้าอยู่ provider เดียวกัน) */
    lineNotifyUserId: { type: String, default: "", trim: true, index: true },
    lineNotifyEnabled: { type: Boolean, default: true, index: true },
    /** รหัสชวนเพื่อนของผู้ใช้แต่ละคน */
    referralCode: {
      type: String,
      unique: true,
      sparse: true,
      trim: true,
      uppercase: true,
      index: true,
    },
    /** ผู้ใช้ที่เป็นคนแนะนำตอนสมัครสมาชิก */
    referredByUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      index: true,
      default: null,
    },
    referredByCode: { type: String, default: "", trim: true, uppercase: true },
    /** จ่ายโบนัสแนะนำเพื่อนครั้งแรกแล้วหรือยัง */
    referralRewardClaimedAt: { type: Date, default: null },
    referralRewardClaimedCampaignId: {
      type: Schema.Types.ObjectId,
      ref: "Campaign",
      default: null,
    },
    memberStatus: {
      type: String,
      enum: ["active", "inactive", "banned", "pending_transfer"],
      default: "active",
      index: true,
    },
    /**
     * false = ยังไม่กรอกฟอร์มสมัครสมาชิกหลัง LINE login
     * undefined = เอกสารเก่าก่อนมีฟิลด์นี้ (ถือว่าสมัครแล้ว)
     */
    registrationCompleted: { type: Boolean },
    /** ยอมรับนโยบาย/ข้อกำหนดตอนสมัคร */
    termsAcceptedAt: { type: Date },
    /** ล็อกอินล่าสุด (ใช้ประกอบ CMS: แอดมินออนไลน์ / ล่าสุดในรายการแอดมิน) */
    lastLoginAt: { type: Date, index: true },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

export type UserDocument = InferSchemaType<typeof UserSchema>;

const User = models.User || model("User", UserSchema);

export default User;
