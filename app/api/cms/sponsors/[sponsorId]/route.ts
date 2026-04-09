import mongoose from "mongoose";
import { NextResponse } from "next/server";

import { canManageSponsors } from "@/lib/auth/cms-admin-permissions";
import { requireAdminSession } from "@/lib/auth/require-admin-session";
import { connectToDatabase } from "@/lib/mongodb";
import Sponsor from "@/models/Sponsor";

type Params = { params: Promise<{ sponsorId: string }> };

type SponsorLean = {
  companyName?: string;
  status?: string;
  advertisingTotalBudget?: number;
  advertisingUsedBudget?: number;
  portalUsername?: string;
  advertisingBudgetToppedUpAt?: Date | string | null;
};

/** GET — ข้อมูลสปอนเซอร์สำหรับฟอร์ม CMS (งบกลางโฆษณา ฯลฯ) */
export async function GET(_request: Request, { params }: Params) {
  const admin = await requireAdminSession();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { sponsorId } = await params;
  if (!mongoose.Types.ObjectId.isValid(sponsorId)) {
    return NextResponse.json({ ok: false, error: "invalid_sponsor_id" }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const s = (await Sponsor.findById(sponsorId)
      .select(
        "companyName status advertisingTotalBudget advertisingUsedBudget portalUsername advertisingBudgetToppedUpAt"
      )
      .lean()) as SponsorLean | null;
    if (!s) {
      return NextResponse.json({ ok: false, error: "sponsor_not_found" }, { status: 404 });
    }
    const toppedAt = s.advertisingBudgetToppedUpAt;
    return NextResponse.json({
      ok: true,
      sponsor: {
        id: String(sponsorId),
        companyName: String(s.companyName ?? ""),
        status: String(s.status ?? "inactive"),
        advertisingTotalBudget: Math.max(0, Number(s.advertisingTotalBudget ?? 0)),
        advertisingUsedBudget: Math.max(0, Number(s.advertisingUsedBudget ?? 0)),
        advertisingBudgetToppedUpAt: toppedAt ? new Date(toppedAt).toISOString() : null,
        portalUsername: String(s.portalUsername ?? ""),
      },
    });
  } catch (e) {
    console.error("[api/cms/sponsors/[sponsorId]:GET]", e);
    return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });
  }
}

/** PATCH — แก้งบกลางโฆษณา: เติมงบ (งบตั้งต้นใหม่ = งบคงเหลือ + ยอดเติม, รีเซ็ตงบที่ใช้เป็น 0) หรือตั้งยอดรวมแบบเดิม */
export async function PATCH(request: Request, { params }: Params) {
  const admin = await requireAdminSession();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!canManageSponsors(admin.role)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const { sponsorId } = await params;
  if (!mongoose.Types.ObjectId.isValid(sponsorId)) {
    return NextResponse.json({ ok: false, error: "invalid_sponsor_id" }, { status: 400 });
  }

  let body: { advertisingTopUpAmount?: number; advertisingTotalBudget?: number };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const hasTopUp = body.advertisingTopUpAmount !== undefined && body.advertisingTopUpAmount !== null;

  try {
    await connectToDatabase();
    const cur = (await Sponsor.findById(sponsorId)
      .select("advertisingTotalBudget advertisingUsedBudget")
      .lean()) as SponsorLean | null;
    if (!cur) {
      return NextResponse.json({ ok: false, error: "sponsor_not_found" }, { status: 404 });
    }

    const curTotal = Math.max(0, Number(cur.advertisingTotalBudget ?? 0));
    const curUsed = Math.max(0, Number(cur.advertisingUsedBudget ?? 0));
    const remaining = Math.max(0, curTotal - curUsed);

    if (hasTopUp) {
      const raw = Number(body.advertisingTopUpAmount);
      const topUp = Math.max(0, Math.floor(raw));
      if (!Number.isFinite(topUp) || topUp <= 0) {
        return NextResponse.json({ ok: false, error: "invalid_top_up_amount" }, { status: 400 });
      }
      const newTotal = remaining + topUp;
      const now = new Date();
      await Sponsor.findByIdAndUpdate(sponsorId, {
        $set: {
          advertisingTotalBudget: newTotal,
          advertisingUsedBudget: 0,
          advertisingBudgetToppedUpAt: now,
        },
      });
    } else {
      const nextTotal = Math.max(0, Number(body.advertisingTotalBudget ?? 0));
      if (!Number.isFinite(nextTotal)) {
        return NextResponse.json({ ok: false, error: "invalid_advertising_total" }, { status: 400 });
      }
      if (nextTotal < curUsed) {
        return NextResponse.json(
          { ok: false, error: "advertising_total_below_used", used: curUsed },
          { status: 400 }
        );
      }
      await Sponsor.findByIdAndUpdate(sponsorId, {
        $set: { advertisingTotalBudget: nextTotal },
      });
    }

    const s = (await Sponsor.findById(sponsorId)
      .select("companyName advertisingTotalBudget advertisingUsedBudget advertisingBudgetToppedUpAt")
      .lean()) as SponsorLean | null;
    const toppedAt = s?.advertisingBudgetToppedUpAt;
    return NextResponse.json({
      ok: true,
      sponsor: {
        id: sponsorId,
        companyName: String(s?.companyName ?? ""),
        advertisingTotalBudget: Math.max(0, Number(s?.advertisingTotalBudget ?? 0)),
        advertisingUsedBudget: Math.max(0, Number(s?.advertisingUsedBudget ?? 0)),
        advertisingBudgetToppedUpAt: toppedAt ? new Date(toppedAt).toISOString() : null,
      },
    });
  } catch (e) {
    console.error("[api/cms/sponsors/[sponsorId]:PATCH]", e);
    return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });
  }
}
