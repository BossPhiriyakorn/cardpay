import mongoose from "mongoose";
import { NextResponse } from "next/server";

import { canManageSponsors } from "@/lib/auth/cms-admin-permissions";
import { requireAdminSession } from "@/lib/auth/require-admin-session";
import { connectToDatabase } from "@/lib/mongodb";
import { Campaign, Sponsor, User } from "@/models";

type LeanUserLine = { lineUid?: string; lineDisplayId?: string };

function resolveSponsorSignupLogin(
  portalUsername: string | undefined,
  userId: unknown,
  userById: Map<string, LeanUserLine>
): { signupLoginId: string; signupLoginKind: "portal" | "line" | "" } {
  const portal = String(portalUsername ?? "").trim();
  if (portal) {
    return { signupLoginId: portal, signupLoginKind: "portal" };
  }
  if (userId) {
    const u = userById.get(String(userId));
    if (u) {
      const display = String(u.lineDisplayId ?? "").trim();
      const lineUid = String(u.lineUid ?? "").trim();
      const id = display || lineUid;
      if (id) return { signupLoginId: id, signupLoginKind: "line" };
    }
  }
  return { signupLoginId: "", signupLoginKind: "" };
}

/** GET — รายการสปอนเซอร์ใน CMS */
export async function GET() {
  const admin = await requireAdminSession();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    await connectToDatabase();

    const sponsors = await Sponsor.find({})
      .select("userId companyName status portalUsername")
      .lean();
    const sponsorIds = sponsors.map((s) => s._id);

    const linkedUserIds = sponsors
      .map((s) => s.userId)
      .filter((id): id is mongoose.Types.ObjectId => Boolean(id));
    const userRows =
      linkedUserIds.length > 0
        ? await User.find({ _id: { $in: linkedUserIds } })
            .select("lineUid lineDisplayId")
            .lean()
        : [];
    const userById = new Map<string, LeanUserLine>(
      userRows.map((u) => [String(u._id), u as LeanUserLine])
    );

    const campaignAgg = await Campaign.aggregate<{
      _id: unknown;
      campaignCount: number;
      totalBudget: number;
    }>([
      { $match: { sponsorId: { $in: sponsorIds } } },
      {
        $group: {
          _id: "$sponsorId",
          campaignCount: { $sum: 1 },
          totalBudget: { $sum: "$totalBudget" },
        },
      },
    ]);

    const bySponsorId = new Map(
      campaignAgg.map((x) => [String(x._id), { campaignCount: x.campaignCount, totalBudget: x.totalBudget }])
    );

    return NextResponse.json({
      ok: true,
      sponsors: sponsors.map((s) => {
        const { signupLoginId, signupLoginKind } = resolveSponsorSignupLogin(
          s.portalUsername as string | undefined,
          s.userId,
          userById
        );
        return {
          id: String(s._id),
          userId: s.userId ? String(s.userId) : "",
          clientName: String(s.companyName ?? ""),
          status: String(s.status ?? "inactive") === "active" ? "Active" : "Inactive",
          activeCampaigns: bySponsorId.get(String(s._id))?.campaignCount ?? 0,
          totalBudget: bySponsorId.get(String(s._id))?.totalBudget ?? 0,
          signupLoginId,
          signupLoginKind,
        };
      }),
    });
  } catch (e) {
    console.error("[api/cms/sponsors]", e);
    return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });
  }
}

/** POST — เพิ่ม user เป็น sponsor */
export async function POST(request: Request) {
  const admin = await requireAdminSession();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!canManageSponsors(admin.role)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  let body: { userId?: string; companyName?: string };
  try {
    body = (await request.json()) as { userId?: string; companyName?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const userId = String(body.userId ?? "").trim();
  const companyName = String(body.companyName ?? "").trim();
  if (!userId || !companyName) {
    return NextResponse.json({ ok: false, error: "missing_required_fields" }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const user = await User.findById(userId).select("_id");
    if (!user) {
      return NextResponse.json({ ok: false, error: "user_not_found" }, { status: 404 });
    }

    const sponsor = await Sponsor.findOneAndUpdate(
      { userId },
      { $set: { companyName, status: "active" } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await User.findByIdAndUpdate(userId, { $set: { role: "sponsor" } });
    return NextResponse.json({ ok: true, sponsorId: String(sponsor._id) });
  } catch (e) {
    console.error("[api/cms/sponsors:create]", e);
    return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });
  }
}
