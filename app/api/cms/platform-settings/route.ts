import { NextResponse } from "next/server";

import { canManageAdmins } from "@/lib/auth/cms-admin-permissions";
import { requireAdminSession } from "@/lib/auth/require-admin-session";
import {
  getPlatformSettingsForCmsEdit,
  upsertPlatformSettings,
} from "@/lib/platform-settings";

export const dynamic = "force-dynamic";

export async function GET() {
  const admin = await requireAdminSession();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!canManageAdmins(admin.role)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  try {
    const row = await getPlatformSettingsForCmsEdit();
    return NextResponse.json({ ok: true, settings: row });
  } catch (e) {
    console.error("[api/cms/platform-settings:GET]", e);
    return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const admin = await requireAdminSession();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!canManageAdmins(admin.role)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  let body: {
    privacyPolicyText?: string;
    termsOfServiceText?: string;
    minWithdrawalAmount?: number;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const privacyPolicyText = String(body.privacyPolicyText ?? "");
  const termsOfServiceText = String(body.termsOfServiceText ?? "");
  const minWithdrawalAmount = Math.max(
    0,
    Math.floor(Number(body.minWithdrawalAmount ?? 0))
  );

  if (!Number.isFinite(minWithdrawalAmount)) {
    return NextResponse.json({ ok: false, error: "invalid_min_withdrawal" }, { status: 400 });
  }

  try {
    await upsertPlatformSettings({
      privacyPolicyText,
      termsOfServiceText,
      minWithdrawalAmount,
    });
    const row = await getPlatformSettingsForCmsEdit();
    return NextResponse.json({ ok: true, settings: row });
  } catch (e) {
    console.error("[api/cms/platform-settings:PATCH]", e);
    return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });
  }
}
