import { NextResponse } from "next/server";

import { getUserSession } from "@/lib/auth/require-user-session";
import { connectToDatabase } from "@/lib/mongodb";
import { ensureUserReferralCode } from "@/lib/referral-code";
import { isValidThaiPhoneDigits, sanitizeThaiPhoneInput } from "@/lib/thai-phone";
import User from "@/models/User";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  const session = await getUserSession();
  const userId = session?.userId;
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
    lineDisplayId?: string;
    referralCode?: string;
    termsAccepted?: boolean;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const firstName = String(body.firstName ?? "").trim();
  const lastName = String(body.lastName ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const phone = sanitizeThaiPhoneInput(String(body.phone ?? ""));
  const lineDisplayId = String(body.lineDisplayId ?? "").trim();
  const referralCode = String(body.referralCode ?? "").trim().toUpperCase();

  if (!firstName || !lastName) {
    return NextResponse.json({ ok: false, error: "missing_name" }, { status: 400 });
  }
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: "invalid_email" }, { status: 400 });
  }
  if (!isValidThaiPhoneDigits(phone)) {
    return NextResponse.json({ ok: false, error: "invalid_phone" }, { status: 400 });
  }
  if (!lineDisplayId) {
    return NextResponse.json({ ok: false, error: "missing_line_id" }, { status: 400 });
  }
  if (body.termsAccepted !== true) {
    return NextResponse.json({ ok: false, error: "terms_required" }, { status: 400 });
  }

  const displayName = `${firstName} ${lastName}`.trim();

  try {
    await connectToDatabase();
    const currentUser = await User.findById(userId).select("_id referredByUserId referredByCode referralCode");
    if (!currentUser?._id) {
      return NextResponse.json({ ok: false, error: "user_not_found" }, { status: 404 });
    }

    await ensureUserReferralCode(String(currentUser._id));

    let referredByUserId = currentUser.referredByUserId ?? null;
    let referredByCode = String(currentUser.referredByCode ?? "").trim().toUpperCase();
    if (referralCode) {
      const ownCode = String(currentUser.referralCode ?? "").trim().toUpperCase();
      if (ownCode && referralCode === ownCode) {
        return NextResponse.json({ ok: false, error: "invalid_referral_code" }, { status: 400 });
      }
      const referrer = await User.findOne({ referralCode }).select("_id referralCode").lean();
      if (!referrer?._id) {
        return NextResponse.json({ ok: false, error: "invalid_referral_code" }, { status: 400 });
      }
      referredByUserId = referrer._id;
      referredByCode = String(referrer.referralCode ?? referralCode).trim().toUpperCase();
    }

    const updated = await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          firstName,
          lastName,
          name: displayName,
          email,
          phone,
          lineDisplayId,
          referredByUserId,
          referredByCode,
          registrationCompleted: true,
          termsAcceptedAt: new Date(),
        },
      },
      { new: true }
    ).select("_id");

    if (!updated) {
      return NextResponse.json({ ok: false, error: "user_not_found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[api/user/register:post]", e);
    return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });
  }
}
