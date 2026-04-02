import crypto from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { ADMIN_LINE_CONNECT_STATE_COOKIE, ADMIN_LINE_CONNECT_TARGET_COOKIE } from "@/lib/auth/admin-line-connect-cookies";
import {
  getLineOauthCookieOptions,
  LINE_OAUTH_CALLBACK_URL_COOKIE,
  LINE_OAUTH_STATE_COOKIE,
  LINE_OAUTH_TARGET_ADMIN_CONNECT,
  LINE_OAUTH_TARGET_COOKIE,
  LINE_OAUTH_TARGET_USER_LOGIN,
} from "@/lib/auth/line-oauth-cookies";
import { getAppBaseUrl, getLineLoginConfig, getLineLoginRedirectUri } from "@/lib/line-auth-config";

function sanitizeCallbackUrl(value: string | null, request: NextRequest) {
  const fallback = `${getAppBaseUrl()}/user`;
  if (!value?.trim()) {
    return fallback;
  }

  try {
    const url = new URL(value, getAppBaseUrl());
    const requestOrigin = new URL(request.url).origin;
    const appOrigin = new URL(getAppBaseUrl()).origin;
    if (url.origin !== appOrigin && url.origin !== requestOrigin) {
      return fallback;
    }
    return url.toString();
  } catch {
    return fallback;
  }
}

export async function GET(request: NextRequest) {
  const { channelId } = getLineLoginConfig();
  if (!channelId) {
    return NextResponse.redirect(new URL("/register?error=line_config_missing", getAppBaseUrl()));
  }

  const adminTarget = request.cookies.get(ADMIN_LINE_CONNECT_TARGET_COOKIE)?.value;
  const adminState = request.cookies.get(ADMIN_LINE_CONNECT_STATE_COOKIE)?.value;
  const isAdminConnect = adminTarget === LINE_OAUTH_TARGET_ADMIN_CONNECT && !!adminState;
  const state = isAdminConnect ? adminState : crypto.randomUUID();
  const callbackUrl = sanitizeCallbackUrl(
    request.nextUrl.searchParams.get("callbackUrl"),
    request
  );

  const authorizeUrl = new URL("https://access.line.me/oauth2/v2.1/authorize");
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", channelId);
  authorizeUrl.searchParams.set("redirect_uri", getLineLoginRedirectUri());
  authorizeUrl.searchParams.set("state", state);
  authorizeUrl.searchParams.set("scope", "profile openid");

  const response = NextResponse.redirect(authorizeUrl);
  if (!isAdminConnect) {
    response.cookies.set(LINE_OAUTH_STATE_COOKIE, state, getLineOauthCookieOptions());
  }
  response.cookies.set(
    LINE_OAUTH_TARGET_COOKIE,
    isAdminConnect ? LINE_OAUTH_TARGET_ADMIN_CONNECT : LINE_OAUTH_TARGET_USER_LOGIN,
    getLineOauthCookieOptions()
  );
  response.cookies.set(
    LINE_OAUTH_CALLBACK_URL_COOKIE,
    callbackUrl,
    getLineOauthCookieOptions()
  );
  return response;
}
