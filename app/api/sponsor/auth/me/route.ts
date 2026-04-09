import { NextResponse } from "next/server";

import { requireSponsorSession } from "@/lib/auth/require-sponsor-session";
import { connectToDatabase } from "@/lib/mongodb";
import Sponsor from "@/models/Sponsor";

export async function GET() {
  const session = await requireSponsorSession();
  if (!session.ok) {
    return NextResponse.json({ ok: false, authenticated: false }, { status: 401 });
  }

  try {
    await connectToDatabase();
    const sponsor = await Sponsor.findById(session.sponsorId)
      .select("companyName status portalUsername advertisingTotalBudget")
      .lean();
    if (!sponsor || sponsor.status !== "active") {
      return NextResponse.json({ ok: false, authenticated: false }, { status: 401 });
    }
    const advTotal = Math.max(
      0,
      Number((sponsor as { advertisingTotalBudget?: number }).advertisingTotalBudget ?? 0)
    );
    return NextResponse.json({
      ok: true,
      authenticated: true,
      sponsorId: String(sponsor._id),
      companyName: String(sponsor.companyName ?? ""),
      username: String(sponsor.portalUsername ?? ""),
      advertisingTotalBudget: advTotal,
    });
  } catch (e) {
    console.error("[sponsor/auth/me]", e);
    return NextResponse.json({ ok: false, authenticated: false }, { status: 503 });
  }
}
