import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role: "user" | "sponsor" | "admin";
      lineUid: string;
      /** false = ต้องไปหน้าสมัครสมาชิก */
      registrationCompleted: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    role?: "user" | "sponsor" | "admin";
    lineUid?: string;
    registrationCompleted?: boolean;
    picture?: string;
    /** OAuth access token จาก LINE Login — ใช้ดึงรูปโปรไฟล์ล่าสุด (ไม่ส่งให้ client) */
    lineAccessToken?: string;
  }
}
