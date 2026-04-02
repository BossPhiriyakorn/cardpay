/**
 * แยกชื่อที่เก็บโทเคนชัดเจน: แอดมิน vs ผู้ใช้
 *
 * LINE Login (channel เดียว — client id/secret/callback URL เดียวกัน):
 * - ผู้ใช้แอป: `/api/auth/line` → callback ตั้ง `flexshare_user_token` (ลงนามด้วย USER_JWT_SECRET)
 * - เชื่อม LINE แจ้งเตือนแอดมิน: `/api/auth/admin/line/connect` → callback สาขา admin — อัปเดต Mongo
 *   ไม่สร้าง user JWT; ต้องล็อกอิน CMS ด้วยรหัสผ่านก่อน (`flexshare_admin_token` = ADMIN_JWT_SECRET)
 *
 * - พอร์ทัลสปอนเซอร์: `flexshare_sponsor_token` (ไอดี/รหัสผ่าน — แยกจาก LINE)
 * - NextAuth ยังมีในโปรเจกต์ (เช่น SessionProvider / provider อื่น) — session ผู้ใช้หลักของแอป LINE ใช้ JWT ด้านล่าง
 */

/** คุกกี้ JWT แอดมิน (HttpOnly — middleware อ่านได้) */
export const ADMIN_TOKEN_COOKIE = "flexshare_admin_token";

/** คุกกี้ JWT ผู้ใช้แอป (HttpOnly — middleware อ่านได้) */
export const USER_TOKEN_COOKIE = "flexshare_user_token";

/** คุกกี้ access token จาก LINE สำหรับเรียก profile API ซ้ำ */
export const USER_LINE_ACCESS_TOKEN_COOKIE = "flexshare_user_line_access_token";

/** คุกกี้ JWT พอร์ทัลสปอนเซอร์ (จัดการโฆษณา — ไอดี/รหัสผ่าน แยกจาก LINE) */
export const SPONSOR_TOKEN_COOKIE = "flexshare_sponsor_token";

/** ชื่อ localStorage สำหรับโทเคนผู้ใช้ (เช่น SPA / mobile) — แยกจากแอดมิน */
export const USER_ACCESS_TOKEN_STORAGE_KEY = "flexshare_user_access_token";

/** ชื่อ sessionStorage ทางเลือกสำหรับโทเคนชั่วคราวผู้ใช้ */
export const USER_ACCESS_TOKEN_SESSION_KEY = "flexshare_user_access_token_session";
