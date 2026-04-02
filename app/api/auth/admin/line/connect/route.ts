import { NextResponse } from "next/server";

import {
  ADMIN_LINE_CONNECT_STATE_COOKIE,
  ADMIN_LINE_CONNECT_TARGET_COOKIE
} from "@/lib/auth/admin-line-connect-cookies";
import { getLineOauthCookieOptions, LINE_OAUTH_TARGET_ADMIN_CONNECT } from "@/lib/auth/line-oauth-cookies";
import { signAdminLineConnectState } from "@/lib/auth/admin-line-connect-state";
import { requireAdminSession } from "@/lib/auth/require-admin-session";
import { getAppBaseUrl, getAdminLineConnectRedirectUri, getLineLoginConfig } from "@/lib/line-auth-config";

export async function GET() {
  const admin = await requireAdminSession();
  if (!admin.ok) {
    return NextResponse.redirect(new URL("/cms/login", getAdminLineConnectRedirectUri()));
  }

  const { channelId } = getLineLoginConfig();
  if (!channelId) {
    return NextResponse.redirect(
      new URL("/cms/profile?lineConnect=missing_config", getAdminLineConnectRedirectUri())
    );
  }

  const state = await signAdminLineConnectState(admin.id);
  const signInUrl = new URL("/api/auth/line", getAppBaseUrl());
  signInUrl.searchParams.set("callbackUrl", `${getAppBaseUrl()}/cms/profile`);

  const response = NextResponse.redirect(signInUrl);
  response.cookies.set(ADMIN_LINE_CONNECT_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 10,
  });
  response.cookies.set(
    ADMIN_LINE_CONNECT_TARGET_COOKIE,
    LINE_OAUTH_TARGET_ADMIN_CONNECT,
    getLineOauthCookieOptions()
  );
  return response;
}
