import { SignJWT, jwtVerify } from "jose";

import { ADMIN_TOKEN_COOKIE } from "@/lib/auth/token-constants";

export { ADMIN_TOKEN_COOKIE };

function getSecretBytes(): Uint8Array {
  const s = process.env.ADMIN_JWT_SECRET;
  if (!s || s.length < 32) {
    throw new Error(
      "ADMIN_JWT_SECRET is missing or too short (use at least 32 characters)"
    );
  }
  return new TextEncoder().encode(s);
}

export type AdminJwtPayload = {
  sub: string;
  role: "admin" | "reviewer";
  typ: "admin";
};

const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

function getSecondsUntilNextBangkokMidnight(nowMs: number = Date.now()): number {
  const bangkokNow = new Date(nowMs + BANGKOK_OFFSET_MS);
  const y = bangkokNow.getUTCFullYear();
  const m = bangkokNow.getUTCMonth();
  const d = bangkokNow.getUTCDate();
  const nextBangkokMidnightUtcMs = Date.UTC(y, m, d + 1, 0, 0, 0) - BANGKOK_OFFSET_MS;
  return Math.max(60, Math.floor((nextBangkokMidnightUtcMs - nowMs) / 1000));
}

function parseDurationSeconds(raw: string): number | null {
  const m = /^(\d+)\s*([smhd])$/i.exec(raw.trim());
  if (!m) return null;
  const amount = Number(m[1]);
  const unit = m[2].toLowerCase();
  if (!Number.isFinite(amount) || amount <= 0) return null;
  if (unit === "s") return amount;
  if (unit === "m") return amount * 60;
  if (unit === "h") return amount * 60 * 60;
  if (unit === "d") return amount * 60 * 60 * 24;
  return null;
}

/**
 * jose `setExpirationTime(number)` = Unix timestamp (วินาที) ไม่ใช่ "จำนวนวินาทีจากตอนนี้"
 * ดังนั้นค่า default (วินาทีถึงเที่ยงคืนไทย) ต้องแปลงเป็น Date แทนการส่งตัวเลขดิบ
 */
function getAdminJwtExpirySetting(): string | Date {
  /**
   * ถ้าไม่ตั้ง ADMIN_JWT_EXPIRES: ให้หมดอายุเที่ยงคืนตามเวลาไทย (00:00 น.) ทุกวัน
   * ถ้าตั้ง ADMIN_JWT_EXPIRES: ใช้ค่าที่ตั้งไว้ตามปกติ เช่น 8h / 12h / 1d
   */
  const configured = process.env.ADMIN_JWT_EXPIRES?.trim();
  if (configured) {
    return configured;
  }
  const seconds = getSecondsUntilNextBangkokMidnight();
  return new Date(Date.now() + seconds * 1000);
}

export function getAdminCookieMaxAgeSeconds(): number {
  const configured = process.env.ADMIN_JWT_EXPIRES?.trim();
  if (configured) {
    const parsed = parseDurationSeconds(configured);
    if (parsed) return parsed;
    return 60 * 60 * 8;
  }
  return getSecondsUntilNextBangkokMidnight();
}

export async function signAdminAccessToken(
  username: string,
  role: AdminJwtPayload["role"]
): Promise<string> {
  const token = await new SignJWT({
    role,
    typ: "admin",
  } as AdminJwtPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(username)
    .setIssuedAt()
    .setExpirationTime(getAdminJwtExpirySetting())
    .sign(getSecretBytes());

  return token;
}

export async function verifyAdminAccessToken(token: string) {
  const { payload } = await jwtVerify(token, getSecretBytes(), {
    algorithms: ["HS256"],
  });
  if (
    payload.typ !== "admin" ||
    (payload.role !== "admin" && payload.role !== "reviewer")
  ) {
    throw new Error("Invalid admin token payload");
  }
  return payload;
}
