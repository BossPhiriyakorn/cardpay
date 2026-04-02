import { NextResponse } from "next/server";
import mongoose from "mongoose";

import { verifyLineIdToken } from "@/lib/line/verify-id-token";
import { connectToDatabase } from "@/lib/mongodb";
import { checkCampaignShareEligibility } from "@/lib/record-campaign-share";

type Params = { params: Promise<{ campaignId: string }> };

function statusForCode(code: string): number {
  switch (code) {
    case "invalid_campaign":
    case "invalid_user":
      return 400;
    case "inactive":
    case "quota_exhausted":
    case "budget_exhausted":
    case "campaign_user_reward_limit_reached":
    case "campaign_user_daily_reward_limit_reached":
      return 409;
    case "not_found":
      return 404;
    default:
      return 400;
  }
}

export async function POST(request: Request, context: Params) {
  const { campaignId } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(campaignId)) {
    return NextResponse.json({ ok: false, error: "invalid_campaign_id" }, { status: 400 });
  }

  let body: { idToken?: string } = {};
  try {
    body = (await request.json()) as { idToken?: string };
  } catch {
    body = {};
  }

  try {
    await connectToDatabase();
    const idToken = String(body.idToken ?? "").trim();
    if (!idToken) {
      return NextResponse.json(
        { ok: false, error: "missing_auth", message: "ต้องส่ง idToken เพื่อเช็กสิทธิ์แชร์" },
        { status: 401 }
      );
    }

    const profile = await verifyLineIdToken(idToken);
    const result = await checkCampaignShareEligibility({
      campaignId,
      lineUid: profile.sub,
    });

    if (!result.ok) {
      return NextResponse.json(
        { ok: false, error: result.code, message: result.message },
        { status: statusForCode(result.code) }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("line_verify_failed") || msg.includes("LINE_CLIENT_ID")) {
      return NextResponse.json(
        { ok: false, error: "invalid_token", message: "ไม่สามารถยืนยัน LINE token" },
        { status: 401 }
      );
    }
    console.error("[share-eligibility]", e);
    return NextResponse.json(
      { ok: false, error: "server_error", message: msg },
      { status: 500 }
    );
  }
}
