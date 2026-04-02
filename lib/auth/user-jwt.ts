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

export type UserJwtPayload = {
  sub: string;
  role: "user" | "sponsor";
  typ: "user";
};

export async function signUserAccessToken(
  userId: string,
  role: "user" | "sponsor" = "user"
): Promise<string> {
  return new SignJWT({
    role,
    typ: "user",
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

export function getUserCookieOptions(maxAgeSec?: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSec ?? 3 * 24 * 60 * 60,
  };
}

export function getUserLineAccessTokenCookieOptions(maxAgeSec?: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
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
