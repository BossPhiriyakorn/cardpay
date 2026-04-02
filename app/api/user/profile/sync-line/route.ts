import { NextResponse } from "next/server";

import { getUserLineAccessToken, getUserSession } from "@/lib/auth/require-user-session";
import { connectToDatabase } from "@/lib/mongodb";
import User from "@/models/User";

type LineProfileApi = {
  pictureUrl?: string;
};

export async function POST(request: Request) {
  const session = await getUserSession();
  const userId = session?.userId;
  const lineAccessToken = await getUserLineAccessToken();

  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  if (!lineAccessToken) {
    return NextResponse.json(
      {
        ok: false,
        error: "line_token_missing",
        message: "ไม่พบโทเคน LINE — กรุณาออกจากระบบแล้วล็อกอินด้วย LINE ใหม่",
      },
      { status: 400 }
    );
  }

  let lineRes: Response;
  try {
    lineRes = await fetch("https://api.line.me/v2/profile", {
      headers: { Authorization: `Bearer ${lineAccessToken}` },
      cache: "no-store",
    });
  } catch (e) {
    console.error("[sync-line] fetch profile:", e);
    return NextResponse.json(
      { ok: false, error: "line_unreachable" },
      { status: 502 }
    );
  }

  if (!lineRes.ok) {
    if (lineRes.status === 401) {
      return NextResponse.json(
        {
          ok: false,
          error: "line_unauthorized",
          message: "โทเคน LINE หมดอายุ — กรุณาล็อกอินใหม่",
        },
        { status: 401 }
      );
    }
    return NextResponse.json(
      { ok: false, error: "line_profile_failed" },
      { status: 502 }
    );
  }

  let lineProfile: LineProfileApi;
  try {
    lineProfile = (await lineRes.json()) as LineProfileApi;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_line_response" }, { status: 502 });
  }

  const pictureUrl = lineProfile.pictureUrl?.trim();
  if (!pictureUrl) {
    return NextResponse.json(
      { ok: false, error: "no_picture" },
      { status: 422 }
    );
  }

  try {
    await connectToDatabase();
    await User.findByIdAndUpdate(userId, {
      $set: { image: pictureUrl },
    });
  } catch (e) {
    console.error("[sync-line] db:", e);
    return NextResponse.json(
      { ok: false, error: "database_unavailable" },
      { status: 503 }
    );
  }

  return NextResponse.json({ ok: true, avatarUrl: pictureUrl });
}
