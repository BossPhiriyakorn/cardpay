import { NextRequest, NextResponse } from "next/server";

import { ADMIN_LINE_CONNECT_STATE_COOKIE, ADMIN_LINE_CONNECT_TARGET_COOKIE } from "@/lib/auth/admin-line-connect-cookies";
import { verifyAdminLineConnectState } from "@/lib/auth/admin-line-connect-state";
import { clearNextAuthCookies } from "@/lib/auth/nextauth-cookie-utils";
import CmsAdmin from "@/models/CmsAdmin";
import { verifySignedLineOAuthState } from "@/lib/auth/line-oauth-state";
import {
  LINE_OAUTH_CALLBACK_URL_COOKIE,
  LINE_OAUTH_STATE_COOKIE,
  LINE_OAUTH_TARGET_ADMIN_CONNECT,
  LINE_OAUTH_TARGET_COOKIE,
} from "@/lib/auth/line-oauth-cookies";
import { requireAdminSession } from "@/lib/auth/require-admin-session";
import { USER_LINE_ACCESS_TOKEN_COOKIE, USER_TOKEN_COOKIE } from "@/lib/auth/token-constants";
import {
  clearUserAuthCookies,
  getUserCookieOptions,
  getUserLineAccessTokenCookieOptions,
  signUserAccessToken,
} from "@/lib/auth/user-jwt";
import { getAppBaseUrl, getLineLoginConfig, getLineLoginRedirectUri } from "@/lib/line-auth-config";
import { connectToDatabase } from "@/lib/mongodb";
import { generateUniqueReferralCode } from "@/lib/referral-code";
import User from "@/models/User";

type LineTokenResponse = {
  access_token?: string;
  id_token?: string;
};

type LineProfile = {
  userId?: string;
  displayName?: string;
  pictureUrl?: string;
};

function redirectWithCleanup(path: string, request: NextRequest) {
  const response = NextResponse.redirect(new URL(path, getAppBaseUrl() || request.url));
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.cookies.delete(LINE_OAUTH_STATE_COOKIE);
  response.cookies.delete(LINE_OAUTH_TARGET_COOKIE);
  response.cookies.delete(LINE_OAUTH_CALLBACK_URL_COOKIE);
  response.cookies.delete(ADMIN_LINE_CONNECT_STATE_COOKIE);
  response.cookies.delete(ADMIN_LINE_CONNECT_TARGET_COOKIE);
  clearNextAuthCookies(response);
  return response;
}

function sanitizeCallbackUrl(value: string | undefined) {
  const fallback = `${getAppBaseUrl()}/user`;
  if (!value?.trim()) {
    return fallback;
  }

  try {
    const url = new URL(value, getAppBaseUrl());
    if (url.origin !== new URL(getAppBaseUrl()).origin) {
      return fallback;
    }
    return url.toString();
  } catch {
    return fallback;
  }
}

async function exchangeCodeForToken(code: string) {
  const { channelId, channelSecret } = getLineLoginConfig();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: getLineLoginRedirectUri(),
    client_id: channelId,
    client_secret: channelSecret,
  });

  const tokenRes = await fetch("https://api.line.me/oauth2/v2.1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  if (!tokenRes.ok) {
    throw new Error(`line_token_exchange_failed:${tokenRes.status}`);
  }

  return (await tokenRes.json()) as LineTokenResponse;
}

async function fetchLineProfile(accessToken: string) {
  const profileRes = await fetch("https://api.line.me/v2/profile", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!profileRes.ok) {
    throw new Error(`line_profile_failed:${profileRes.status}`);
  }

  return (await profileRes.json()) as LineProfile;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code")?.trim() ?? "";
  const state = request.nextUrl.searchParams.get("state")?.trim() ?? "";
  const target = request.cookies.get(LINE_OAUTH_TARGET_COOKIE)?.value ?? "";
  const callbackUrl = request.cookies.get(LINE_OAUTH_CALLBACK_URL_COOKIE)?.value;

  if (!code || !state) {
    return redirectWithCleanup("/register?error=line_callback_missing", request);
  }

  try {
    if (target === LINE_OAUTH_TARGET_ADMIN_CONNECT) {
      const cookieState = request.cookies.get(ADMIN_LINE_CONNECT_STATE_COOKIE)?.value ?? "";
      if (!cookieState || cookieState !== state) {
        return redirectWithCleanup("/cms/profile?lineConnect=state_mismatch", request);
      }

      const verifiedAdminId = await verifyAdminLineConnectState(cookieState);
      const adminSession = await requireAdminSession();
      if (!verifiedAdminId || !adminSession.ok || adminSession.id !== verifiedAdminId) {
        return redirectWithCleanup("/cms/profile?lineConnect=session_expired", request);
      }

      const tokenData = await exchangeCodeForToken(code);
      const accessToken = tokenData.access_token?.trim() ?? "";
      if (!accessToken) {
        return redirectWithCleanup("/cms/profile?lineConnect=failed", request);
      }

      const profile = await fetchLineProfile(accessToken);
      const lineUid = profile.userId?.trim() ?? "";
      if (!lineUid) {
        return redirectWithCleanup("/cms/profile?lineConnect=invalid_profile", request);
      }

      await connectToDatabase();
      const duplicate = await CmsAdmin.findOne({
        _id: { $ne: adminSession.id },
        lineNotifyUserId: lineUid,
      })
        .select("_id")
        .lean();

      if (duplicate) {
        return redirectWithCleanup("/cms/profile?lineConnect=duplicate", request);
      }

      await CmsAdmin.findByIdAndUpdate(adminSession.id, {
        $set: {
          lineNotifyUserId: lineUid,
          lineNotifyEnabled: true,
        },
      });

      return redirectWithCleanup("/cms/profile?lineConnect=success", request);
    }

    const cookieState = request.cookies.get(LINE_OAUTH_STATE_COOKIE)?.value ?? "";
    const stateOk =
      verifySignedLineOAuthState(state) ||
      (!!cookieState && cookieState === state);
    if (!stateOk) {
      return redirectWithCleanup("/register?error=line_state_mismatch", request);
    }

    const tokenData = await exchangeCodeForToken(code);
    const accessToken = tokenData.access_token?.trim() ?? "";
    if (!accessToken) {
      return redirectWithCleanup("/register?error=line_access_token_missing", request);
    }

    const profile = await fetchLineProfile(accessToken);
    const lineUid = profile.userId?.trim() ?? "";
    if (!lineUid) {
      return redirectWithCleanup("/register?error=line_profile_invalid", request);
    }

    await connectToDatabase();

    let user = await User.findOne({ lineUid })
      .select("_id registrationCompleted name image firstName lastName")
      .lean();

    if (!user) {
      user = await User.create({
        lineUid,
        name: profile.displayName?.trim() ?? "",
        image: profile.pictureUrl?.trim() ?? "",
        role: "user",
        walletBalance: 0,
        lineNotifyEnabled: true,
        referralCode: await generateUniqueReferralCode(),
        registrationCompleted: false,
        lastLoginAt: new Date(),
      });
    } else {
      const updateSet: Record<string, unknown> = {
        lastLoginAt: new Date(),
      };
      const picture = profile.pictureUrl?.trim();
      const displayName = profile.displayName?.trim();
      if (picture) {
        updateSet.image = picture;
      }
      if (displayName && !String(user.name ?? "").trim()) {
        updateSet.name = displayName;
      }
      await User.findByIdAndUpdate(user._id, { $set: updateSet });
    }

    const userToken = await signUserAccessToken(
      String(user._id),
      "user",
      user.registrationCompleted !== false
    );
    const response = redirectWithCleanup(
      user.registrationCompleted === false
        ? "/register"
        : new URL(sanitizeCallbackUrl(callbackUrl), getAppBaseUrl()).pathname +
            new URL(sanitizeCallbackUrl(callbackUrl), getAppBaseUrl()).search,
      request
    );

    response.cookies.set(USER_TOKEN_COOKIE, userToken, getUserCookieOptions());
    response.cookies.set(
      USER_LINE_ACCESS_TOKEN_COOKIE,
      accessToken,
      getUserLineAccessTokenCookieOptions()
    );
    return response;
  } catch (error) {
    console.error("[api/auth/line/callback]", error);
    const failurePath =
      target === LINE_OAUTH_TARGET_ADMIN_CONNECT
        ? "/cms/profile?lineConnect=failed"
        : "/register?error=line_auth_failed";
    const response = redirectWithCleanup(failurePath, request);
    clearUserAuthCookies(response);
    return response;
  }
}
