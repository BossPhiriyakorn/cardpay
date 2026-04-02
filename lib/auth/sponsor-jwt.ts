import { SignJWT, jwtVerify } from "jose";

import { SPONSOR_TOKEN_COOKIE } from "@/lib/auth/token-constants";

export { SPONSOR_TOKEN_COOKIE };

function getSecretBytes(): Uint8Array {
  const s = process.env.SPONSOR_JWT_SECRET;
  if (!s || s.length < 32) {
    throw new Error(
      "SPONSOR_JWT_SECRET is missing or too short (use at least 32 characters)"
    );
  }
  return new TextEncoder().encode(s);
}

export type SponsorJwtPayload = {
  sub: string;
  role: "sponsor";
  typ: "sponsor";
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

function getSponsorJwtExpirySetting(): string | Date {
  const configured = process.env.SPONSOR_JWT_EXPIRES?.trim();
  if (configured) {
    return configured;
  }
  const seconds = getSecondsUntilNextBangkokMidnight();
  return new Date(Date.now() + seconds * 1000);
}

export function getSponsorCookieMaxAgeSeconds(): number {
  const configured = process.env.SPONSOR_JWT_EXPIRES?.trim();
  if (configured) {
    const parsed = parseDurationSeconds(configured);
    if (parsed) return parsed;
    return 60 * 60 * 8;
  }
  return getSecondsUntilNextBangkokMidnight();
}

/** `sub` = MongoDB `_id` ของเอกสาร Sponsor */
export async function signSponsorAccessToken(sponsorId: string): Promise<string> {
  const token = await new SignJWT({
    role: "sponsor",
    typ: "sponsor",
  } as SponsorJwtPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(sponsorId)
    .setIssuedAt()
    .setExpirationTime(getSponsorJwtExpirySetting())
    .sign(getSecretBytes());

  return token;
}

export async function verifySponsorAccessToken(token: string) {
  const { payload } = await jwtVerify(token, getSecretBytes(), {
    algorithms: ["HS256"],
  });
  if (payload.typ !== "sponsor" || payload.role !== "sponsor") {
    throw new Error("Invalid sponsor token payload");
  }
  return payload;
}
