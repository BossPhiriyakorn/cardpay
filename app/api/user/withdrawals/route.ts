import { NextResponse } from "next/server";

import { getUserSession } from "@/lib/auth/require-user-session";
import { notifyAdminsWithdrawalRequested } from "@/lib/line-notify";
import { connectToDatabase } from "@/lib/mongodb";
import { getResolvedPlatformSettings } from "@/lib/platform-settings";
import { BankAccount, User, WithdrawalRequest } from "@/models";

export async function POST(request: Request) {
  const session = await getUserSession();
  const userId = session?.userId;
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: { amount?: number };
  try {
    body = (await request.json()) as { amount?: number };
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const amount = Number(body.amount ?? 0);
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ ok: false, error: "invalid_amount" }, { status: 400 });
  }

  try {
    await connectToDatabase();

    const platform = await getResolvedPlatformSettings();
    const minW = platform.minWithdrawalAmount;
    if (minW > 0 && amount < minW) {
      return NextResponse.json(
        { ok: false, error: "below_min_withdrawal", minWithdrawalAmount: minW },
        { status: 400 }
      );
    }

    const bank = await BankAccount.findOne({ userId }).select("_id status");
    if (!bank) {
      return NextResponse.json({ ok: false, error: "bank_not_linked" }, { status: 409 });
    }
    if (String(bank.status ?? "pending") !== "verified") {
      return NextResponse.json({ ok: false, error: "bank_not_verified" }, { status: 409 });
    }

    // Lock withdrawable balance immediately to prevent duplicate requests.
    const user = await User.findOneAndUpdate(
      { _id: userId, walletBalance: { $gte: amount } },
      {
        $inc: {
          walletBalance: -amount,
          pendingTransferAmount: amount,
        },
      },
      { returnDocument: "after" }
    )
      .select("walletBalance pendingTransferAmount")
      .lean();

    if (!user) {
      return NextResponse.json({ ok: false, error: "insufficient_balance" }, { status: 409 });
    }

    const withdrawal = await WithdrawalRequest.create({
      userId,
      bankAccountId: bank._id,
      amount,
      status: "pending",
      note: "",
    });

    const requester = await User.findById(userId)
      .select("name lineDisplayId")
      .lean();

    void notifyAdminsWithdrawalRequested({
      requesterName: String(requester?.name ?? "").trim() || "ผู้ใช้งาน",
      requesterLineId: String((requester as { lineDisplayId?: string } | null)?.lineDisplayId ?? ""),
      amount,
      withdrawalId: String(withdrawal._id),
    }).catch((notifyError) => {
      console.error("[api/user/withdrawals:admin-notify]", notifyError);
    });

    return NextResponse.json({
      ok: true,
      withdrawal: {
        id: String(withdrawal._id),
        date:
          withdrawal.createdAt instanceof Date
            ? withdrawal.createdAt.toISOString().slice(0, 10)
            : "-",
        amount: Number(withdrawal.amount ?? 0),
        status: String(withdrawal.status ?? "pending"),
      },
      walletBalance: Number((user as { walletBalance?: number }).walletBalance ?? 0),
      pendingTransferAmount: Number(
        (user as { pendingTransferAmount?: number }).pendingTransferAmount ?? 0
      ),
    });
  } catch (e) {
    console.error("[api/user/withdrawals:POST]", e);
    return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });
  }
}

