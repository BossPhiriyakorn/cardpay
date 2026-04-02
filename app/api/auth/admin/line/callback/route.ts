import { NextResponse } from "next/server";

import { verifyAdminLineConnectState } from "@/lib/auth/admin-line-connect-state";
import { requireAdminSession } from "@/lib/auth/require-admin-session";
import { connectToDatabase } from "@/lib/mongodb";
import { getAdminLineConnectRedirectUri, getLineLoginConfig } from "@/lib/line-auth-config";
import { verifyLineIdToken } from "@/lib/line/verify-id-token";
import CmsAdmin from "@/models/CmsAdmin";

async function exchangeCodeForTokens(code: string) {
  const { channelId, channelSecret } = getLineLoginConfig();
  const redirectUri = getAdminLineConnectRedirectUri();

  if (!channelId || !channelSecret) {
    throw new Error("missing_line_login_config");
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: channelId,
    client_secret: channelSecret,
  });

  const res = await fetch("https://api.line.me/oauth2/v2.1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`line_token_exchange_failed:${res.status}:${text.slice(0, 200)}`);
  }

  return (await res.json()) as {
    access_token?: string;
    id_token?: string;
  };
}

export async function GET(request: Request) {
  const admin = await requireAdminSession();
  if (!admin.ok) {
    return NextResponse.redirect(new URL("/cms/login", getAdminLineConnectRedirectUri()));
  }

  const url = new URL(request.url);
  const code = url.searchParams.get("code")?.trim() ?? "";
  const state = url.searchParams.get("state")?.trim() ?? "";
  const lineError = url.searchParams.get("error")?.trim() ?? "";

  if (lineError) {
    return NextResponse.redirect(
      new URL(`/cms/profile?lineConnect=${encodeURIComponent(lineError)}`, getAdminLineConnectRedirectUri())
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/cms/profile?lineConnect=invalid_request", getAdminLineConnectRedirectUri())
    );
  }

  try {
    const stateAdminId = await verifyAdminLineConnectState(state);
    if (stateAdminId !== admin.id) {
      throw new Error("admin_mismatch");
    }

    const tokenData = await exchangeCodeForTokens(code);
    const idToken = String(tokenData.id_token ?? "").trim();
    if (!idToken) {
      throw new Error("missing_id_token");
    }

    const profile = await verifyLineIdToken(idToken);

    await connectToDatabase();
    await CmsAdmin.findByIdAndUpdate(admin.id, {
      $set: {
        lineNotifyUserId: profile.sub,
        lineNotifyEnabled: true,
      },
    });

    return NextResponse.redirect(
      new URL("/cms/profile?lineConnect=success", getAdminLineConnectRedirectUri())
    );
  } catch (e) {
    console.error("[admin/line/callback]", e);
    return NextResponse.redirect(
      new URL("/cms/profile?lineConnect=failed", getAdminLineConnectRedirectUri())
    );
  }
}
