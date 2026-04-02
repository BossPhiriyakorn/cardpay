import mongoose from "mongoose";
import { NextResponse } from "next/server";

import { canApproveFinance } from "@/lib/auth/cms-admin-permissions";
import { getUserNotifyRecipientId, notifyUserWithdrawalCompleted } from "@/lib/line-notify";
import { requireAdminSession } from "@/lib/auth/require-admin-session";
import { connectToDatabase } from "@/lib/mongodb";
import { User, WithdrawalRequest } from "@/models";

/** POST — ยืนยันโอนคำขอถอน */
export async function POST(
  _request: Request,
  context: { params: Promise<{ withdrawalId: string }> }
) {
  const admin = await requireAdminSession();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!canApproveFinance(admin.role)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const { withdrawalId } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(withdrawalId)) {
    return NextResponse.json({ ok: false, error: "invalid_withdrawal_id" }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const withdrawal = await WithdrawalRequest.findById(withdrawalId);
    if (!withdrawal) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }
    if (withdrawal.status === "completed") {
      return NextResponse.json({ ok: true, alreadyCompleted: true });
    }

    withdrawal.status = "completed";
    withdrawal.completedAt = new Date();
    await withdrawal.save();

    await User.findByIdAndUpdate(withdrawal.userId, {
      $inc: { pendingTransferAmount: -Math.max(Number(withdrawal.amount ?? 0), 0) },
    });

    const user = await User.findById(withdrawal.userId)
      .select("lineUid lineNotifyUserId lineNotifyEnabled")
      .lean();
    const recipientId = getUserNotifyRecipientId({
      lineUid: user?.lineUid,
      lineNotifyUserId: (user as { lineNotifyUserId?: string } | null)?.lineNotifyUserId,
      lineNotifyEnabled: (user as { lineNotifyEnabled?: boolean } | null)?.lineNotifyEnabled,
    });

    void notifyUserWithdrawalCompleted({
      recipientId,
      amount: Number(withdrawal.amount ?? 0),
    }).catch((notifyError) => {
      console.error("[api/cms/withdrawals/:withdrawalId/confirm:user-notify]", notifyError);
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[api/cms/withdrawals/:withdrawalId/confirm]", e);
    return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });
  }
}
