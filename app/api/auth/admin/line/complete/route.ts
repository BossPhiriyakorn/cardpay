import { NextRequest, NextResponse } from "next/server";

import {
  ADMIN_LINE_CONNECT_STATE_COOKIE,
  ADMIN_LINE_CONNECT_TARGET_COOKIE,
} from "@/lib/auth/admin-line-connect-cookies";
import { getAppBaseUrl } from "@/lib/line-auth-config";

const statusToProfileValue: Record<string, string> = {
  success: "success",
  failed: "failed",
  duplicate: "duplicate",
  state_mismatch: "state_mismatch",
  session_expired: "session_expired",
  invalid_profile: "invalid_profile",
};

export async function GET(request: NextRequest) {
  const status = request.nextUrl.searchParams.get("status")?.trim() ?? "failed";
  const profileStatus = statusToProfileValue[status] ?? "failed";
  const redirectUrl = new URL("/cms/profile", getAppBaseUrl());
  redirectUrl.searchParams.set("lineConnect", profileStatus);

  const response = NextResponse.redirect(redirectUrl);
  response.cookies.delete(ADMIN_LINE_CONNECT_STATE_COOKIE);
  response.cookies.delete(ADMIN_LINE_CONNECT_TARGET_COOKIE);
  return response;
}
