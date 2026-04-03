import { SignJWT, jwtVerify } from "jose";
import { NextResponse } from "next/server";

import { USER_LINE_ACCESS_TOKEN_COOKIE, USER_TOKEN_COOKIE } from "@/lib/auth/token-constants";

/**
 * JWT สำหรับผู้ใช้ทั่วไป (แยก secret จากแอดมิน)
 * ใช้เมื่อมี API ที่ออกโทเคนเอง — ไม่ใช่คุกกี้ NextAuth
 */

function getUserJwtSecret(): Uint8Array {
  const s = process.env.USER_JWT_SECRET;
  if (!s || s.length < 32) {
    throw new Error(
      "USER_JWT_SECRET is missing or too short (use at least 32 characters)"
    );
  }
  return new TextEncoder().encode(s);
}

/** reg: 1 = ลงทะเบียนครบแล้ว, 0 = ยังต้องไป /register — ถ้าไม่มีในโทเคนเก่าให้ถือว่าครบ (backward compatible) */
export type UserJwtPayload = {
  sub: string;
  role: "user" | "sponsor";
  typ: "user";
  reg?: 0 | 1;
};

/** สำหรับ middleware: ถ้าไม่มี secret ตอน build ให้ fallback ไป fetch /api/auth/me */
export function tryGetUserJwtSecretKey(): Uint8Array | null {
  const s = process.env.USER_JWT_SECRET?.trim();
  if (!s || s.length < 32) {
    return null;
  }
  return new TextEncoder().encode(s);
}

/**
 * ตรวจ JWT ผู้ใช้จากคุกกี้ — ใช้ใน middleware (Edge) ได้
 * โทเคนเก่าที่ไม่มี claim `reg` ถือว่า registrationCompleted = true
 */
export async function verifyUserSessionFromToken(
  token: string
): Promise<{ userId: string; registrationCompleted: boolean } | null> {
  const key = tryGetUserJwtSecretKey();
  if (!key) {
    return null;
  }
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
    if (payload.typ !== "user") {
      return null;
    }
    const userId = String(payload.sub ?? "").trim();
    if (!userId) {
      return null;
    }
    const reg = payload.reg as unknown;
    const registrationCompleted =
      reg === undefined || reg === null ? true : reg === 1 || reg === true;
    return { userId, registrationCompleted };
  } catch {
    return null;
  }
}

export async function signUserAccessToken(
  userId: string,
  role: "user" | "sponsor" = "user",
  registrationCompleted = true
): Promise<string> {
  const reg: 0 | 1 = registrationCompleted ? 1 : 0;
  return new SignJWT({
    role,
    typ: "user",
    reg,
  } as UserJwtPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(process.env.USER_JWT_EXPIRES ?? "3d")
    .sign(getUserJwtSecret());
}

export async function verifyUserAccessToken(token: string) {
  const { payload } = await jwtVerify(token, getUserJwtSecret(), {
    algorithms: ["HS256"],
  });
  if (payload.typ !== "user") {
    throw new Error("Invalid user token payload");
  }
  return payload;
}

function userAuthCookieSecureAndSameSite() {
  const secure = process.env.NODE_ENV === "production";
  return {
    secure,
    /** สอดคล้องกับโฟลว์หลักแบบ full-page navigation — ลดปัญหาคุกกี้ใน LINE / มือถือ เทียบเท่า Flora (lax + secure ใน prod) */
    sameSite: "lax" as const,
  };
}

export function getUserCookieOptions(maxAgeSec?: number) {
  const { secure, sameSite } = userAuthCookieSecureAndSameSite();
  return {
    httpOnly: true,
    secure,
    sameSite,
    path: "/",
    maxAge: maxAgeSec ?? 3 * 24 * 60 * 60,
  };
}

export function getUserLineAccessTokenCookieOptions(maxAgeSec?: number) {
  const { secure, sameSite } = userAuthCookieSecureAndSameSite();
  return {
    httpOnly: true,
    secure,
    sameSite,
    path: "/",
    maxAge: maxAgeSec ?? 3 * 24 * 60 * 60,
  };
}

export function clearUserAuthCookies(response: NextResponse) {
  response.cookies.set(USER_TOKEN_COOKIE, "", { ...getUserCookieOptions(0), maxAge: 0 });
  response.cookies.set(USER_LINE_ACCESS_TOKEN_COOKIE, "", {
    ...getUserLineAccessTokenCookieOptions(0),
    maxAge: 0,
  });
  return response;
}
