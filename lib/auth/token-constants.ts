/**
 * แยกชื่อที่เก็บโทเคนชัดเจน: แอดมิน vs ผู้ใช้
 *
 * - แอดมิน: HttpOnly cookie `flexshare_admin_token` (ตั้งจาก API login)
 * - พอร์ทัลสปอนเซอร์: `flexshare_sponsor_token` (ไอดี/รหัสผ่าน — แยกจาก LINE)
 * - ผู้ใช้แอป: NextAuth ใช้คุกกี้ชื่อตาม next-auth (เช่น next-auth.session-token)
 * - ถ้ามี API ฝั่งผู้ใช้ที่ออก JWT เอง: ใช้ USER_JWT_SECRET + คีย์เก็บ client ด้านล่าง
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
