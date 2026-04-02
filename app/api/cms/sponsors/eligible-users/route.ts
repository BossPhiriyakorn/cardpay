import { NextResponse } from "next/server";

import { canManageSponsors } from "@/lib/auth/cms-admin-permissions";
import { requireAdminSession } from "@/lib/auth/require-admin-session";
import { connectToDatabase } from "@/lib/mongodb";
import { Sponsor, User } from "@/models";

/** GET — ผู้ใช้ที่ยังไม่ได้เป็น sponsor */
export async function GET() {
  const admin = await requireAdminSession();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!canManageSponsors(admin.role)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  try {
    await connectToDatabase();
    const sponsorRows = await Sponsor.find({}).select("userId").lean();
    const sponsorUserIds = sponsorRows
      .map((s) => s.userId)
      .filter((id): id is NonNullable<typeof id> => id != null);
    const users = await User.find({ _id: { $nin: sponsorUserIds } })
      .select("_id name")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return NextResponse.json({
      ok: true,
      users: users.map((u) => ({ userId: String(u._id), name: String(u.name ?? "") })),
    });
  } catch (e) {
    console.error("[api/cms/sponsors/eligible-users]", e);
    return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });
  }
}
