import { NextResponse } from "next/server";

import { getUserSession } from "@/lib/auth/require-user-session";
import { nowBangkokDayKey, startOfBangkokDayFromKey } from "@/lib/bangkok-day";
import { connectToDatabase } from "@/lib/mongodb";
import { User, UserDailyStat } from "@/models";

/** GET — ข้อมูลสรุปสำหรับการ์ดหน้าแอปผู้ใช้ */
export async function GET() {
  const session = await getUserSession();
  const userId = session?.userId;
  if (!userId) {
    return NextResponse.json(
      {
        ok: true,
        authenticated: false,
        summary: { walletBalance: 0, sharesToday: 0, earnedToday: 0 },
      },
      { status: 200 }
    );
  }

  try {
    await connectToDatabase();

    const user = await User.findById(userId).select("walletBalance");
    if (!user) {
      return NextResponse.json(
        {
          ok: true,
          authenticated: false,
          summary: { walletBalance: 0, sharesToday: 0, earnedToday: 0 },
        },
        { status: 200 }
      );
    }

    const dayStart = startOfBangkokDayFromKey(nowBangkokDayKey());

    const daily = await UserDailyStat.findOne({ userId, day: dayStart }).select(
      "shareCount earnedAmount"
    );

    return NextResponse.json({
      ok: true,
      authenticated: true,
      summary: {
        walletBalance: Number(user.walletBalance ?? 0),
        sharesToday: Number(daily?.shareCount ?? 0),
        earnedToday: Number(daily?.earnedAmount ?? 0),
      },
    });
  } catch (e) {
    console.error("[api/user/summary]", e);
    return NextResponse.json(
      { ok: false, error: "database_unavailable" },
      { status: 503 }
    );
  }
}
