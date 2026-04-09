import { NextResponse } from "next/server";
import mongoose from "mongoose";

import { getUserSession } from "@/lib/auth/require-user-session";
import { verifyLineIdToken } from "@/lib/line/verify-id-token";
import { connectToDatabase } from "@/lib/mongodb";
import { recordCampaignShare } from "@/lib/record-campaign-share";
import User from "@/models/User";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ campaignId: string }> };

function statusForCode(code: string): number {
  switch (code) {
    case "invalid_campaign":
    case "invalid_user":
      return 400;
    case "inactive":
    case "quota_exhausted":
    case "budget_exhausted":
    case "sponsor_budget_not_configured":
    case "concurrent_update":
    case "campaign_user_reward_limit_reached":
    case "campaign_user_daily_reward_limit_reached":
      return 409;
    case "not_found":
      return 404;
    default:
      return 400;
  }
}

/**
 * POST — บันทึกการแชร์ 1 ครั้งหลัง shareTargetPicker สำเร็จ
 * Body: { idToken?: string } — ยืนยันด้วย LIFF ID token (แนะนำ) หรือใช้ NextAuth session (ถ้ามีคุกกี้)
 */
export async function POST(request: Request, context: Params) {
  const { campaignId } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(campaignId)) {
    return NextResponse.json(
      { ok: false, error: "invalid_campaign_id" },
      { status: 400 }
    );
  }

  let body: { idToken?: string } = {};
  try {
    body = (await request.json()) as { idToken?: string };
  } catch {
    body = {};
  }

  try {
    await connectToDatabase();

    let lineUid = "";
    let lineName: string | undefined;
    let linePicture: string | undefined;

    const idToken = String(body.idToken ?? "").trim();
    if (idToken) {
      const profile = await verifyLineIdToken(idToken);
      lineUid = profile.sub;
      lineName = profile.name;
      linePicture = profile.picture;
    } else {
      const session = await getUserSession();
      const uid = session?.userId;
      if (!uid) {
        return NextResponse.json(
          { ok: false, error: "missing_auth", message: "ต้องส่ง idToken หรือล็อกอินแอป" },
          { status: 401 }
        );
      }
      const u = await User.findById(uid).select("lineUid name image").lean();
      if (!u?.lineUid) {
        return NextResponse.json(
          { ok: false, error: "missing_line_uid", message: "บัญชีไม่มี LINE UID" },
          { status: 401 }
        );
      }
      lineUid = String(u.lineUid);
      lineName = String(u.name ?? "");
      linePicture = String(u.image ?? "");
    }

    const result = await recordCampaignShare({
      campaignId,
      lineUid,
      lineName,
      linePicture,
    });

    if (!result.ok) {
      const st = statusForCode(result.code);
      return NextResponse.json(
        {
          ok: false,
          error: result.code,
          message: result.message,
        },
        { status: st }
      );
    }

    return NextResponse.json({
      ok: true,
      rewardApplied: result.rewardApplied,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("line_verify_failed") || msg.includes("LINE_CLIENT_ID")) {
      return NextResponse.json(
        { ok: false, error: "invalid_token", message: "ไม่สามารถยืนยัน LINE token" },
        { status: 401 }
      );
    }
    console.error("[record-share]", e);
    return NextResponse.json(
      { ok: false, error: "server_error", message: msg },
      { status: 500 }
    );
  }
}
