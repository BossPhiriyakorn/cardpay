import { cookies } from "next/headers";

import { USER_LINE_ACCESS_TOKEN_COOKIE, USER_TOKEN_COOKIE } from "@/lib/auth/token-constants";
import { verifyUserAccessToken } from "@/lib/auth/user-jwt";

export async function getUserSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(USER_TOKEN_COOKIE)?.value;
  if (!token) {
    return null;
  }

  try {
    const payload = await verifyUserAccessToken(token);
    return {
      userId: String(payload.sub ?? ""),
      role: String(payload.role ?? "user"),
    };
  } catch {
    return null;
  }
}

export async function getUserLineAccessToken() {
  const cookieStore = await cookies();
  return cookieStore.get(USER_LINE_ACCESS_TOKEN_COOKIE)?.value ?? "";
}
