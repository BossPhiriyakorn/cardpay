import { NextResponse } from "next/server";

import { getUserSession } from "@/lib/auth/require-user-session";
import { clearUserAuthCookies } from "@/lib/auth/user-jwt";
import { connectToDatabase } from "@/lib/mongodb";
import { ensureUserReferralCode } from "@/lib/referral-code";
import { getResolvedPlatformSettings } from "@/lib/platform-settings";
import { isValidThaiPhoneDigits, sanitizeThaiPhoneInput } from "@/lib/thai-phone";
import { BankAccount, User, WithdrawalRequest } from "@/models";

function mapBankStatus(status: string | undefined): "รอตรวจสอบ" | "อนุมัติแล้ว" | "ไม่อนุมัติ" {
  if (status === "verified") return "อนุมัติแล้ว";
  if (status === "rejected") return "ไม่อนุมัติ";
  return "รอตรวจสอบ";
}

function toIsoDate(value: unknown): string {
  const d = value instanceof Date ? value : new Date(String(value ?? ""));
  return Number.isNaN(d.getTime()) ? "-" : d.toISOString().slice(0, 10);
}

async function getSessionUserId(): Promise<string | null> {
  const session = await getUserSession();
  return session?.userId ?? null;
}

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    await connectToDatabase();
    const [user, bank, withdrawals] = await Promise.all([
      User.findById(userId).select("name lineDisplayId email phone image walletBalance referralCode"),
      BankAccount.findOne({ userId }).select(
        "bankName accountNumber accountHolderName status reviewReason"
      ),
      WithdrawalRequest.find({ userId })
        .sort({ createdAt: -1 })
        .limit(10)
        .select("amount status createdAt"),
    ]);

    if (!user) {
      return clearUserAuthCookies(
        NextResponse.json({ ok: false, error: "stale_session" }, { status: 401 })
      );
    }

    const ensuredReferralCode = await ensureUserReferralCode(userId);
    const platform = await getResolvedPlatformSettings();

    return NextResponse.json({
      ok: true,
      minWithdrawalAmount: platform.minWithdrawalAmount,
      profile: {
        name: String(user.name ?? ""),
        lineId: String(user.lineDisplayId ?? ""),
        email: String(user.email ?? ""),
        phone: String(user.phone ?? ""),
        avatarUrl: String(user.image ?? ""),
        walletBalance: Number(user.walletBalance ?? 0),
        referralCode: String(user.referralCode ?? ensuredReferralCode ?? ""),
      },
      linkedBank: bank
        ? {
            bankName: String(bank.bankName ?? ""),
            accountNumber: String(bank.accountNumber ?? ""),
            accountName: String(bank.accountHolderName ?? ""),
            status: mapBankStatus(String(bank.status ?? "")),
            reviewReason: String((bank as { reviewReason?: string }).reviewReason ?? ""),
          }
        : null,
      withdrawals: withdrawals.map((w) => ({
        id: String(w._id),
        date: toIsoDate(w.createdAt),
        amount: Number(w.amount ?? 0),
        status: String(w.status ?? "pending"),
      })),
    });
  } catch (e) {
    console.error("[api/user/profile:get]", e);
    return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });
  }
}

export async function PATCH(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body:
    | {
        name?: string;
        lineId?: string;
        email?: string;
        phone?: string;
      }
    | undefined;
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const phoneDigits = sanitizeThaiPhoneInput(String(body?.phone ?? ""));
    if (!isValidThaiPhoneDigits(phoneDigits)) {
      return NextResponse.json({ ok: false, error: "invalid_phone" }, { status: 400 });
    }

    const update = {
      name: String(body?.name ?? "").trim(),
      lineDisplayId: String(body?.lineId ?? "").trim(),
      email: String(body?.email ?? "").trim(),
      phone: phoneDigits,
    };

    await User.findByIdAndUpdate(userId, { $set: update });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[api/user/profile:patch]", e);
    return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });
  }
}
