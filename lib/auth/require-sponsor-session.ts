import { cookies } from "next/headers";

import { verifySponsorAccessToken } from "@/lib/auth/sponsor-jwt";
import { SPONSOR_TOKEN_COOKIE } from "@/lib/auth/token-constants";

/** ใช้ใน Route Handler ของพอร์ทัลสปอนเซอร์ (จัดการโฆษณา) */
export async function requireSponsorSession(): Promise<
  { ok: true; sponsorId: string } | { ok: false }
> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SPONSOR_TOKEN_COOKIE)?.value;
  if (!token) {
    return { ok: false };
  }
  try {
    const payload = await verifySponsorAccessToken(token);
    const sponsorId = typeof payload.sub === "string" ? payload.sub : "";
    if (!sponsorId) return { ok: false };
    return { ok: true, sponsorId };
  } catch {
    return { ok: false };
  }
}
