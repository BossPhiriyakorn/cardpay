import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/auth/require-admin-session";
import { connectToDatabase } from "@/lib/mongodb";
import { AuditLog, BankAccount, Campaign, CmsAdmin, User, WithdrawalRequest } from "@/models";

/** GET — ข้อมูลสรุป dashboard CMS */
export async function GET() {
  const admin = await requireAdminSession();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    await connectToDatabase();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [memberCount, activeCampaignCount, onlineAdminCount, loginTodayCount, pendingWithdrawals, latestActivities] =
      await Promise.all([
        User.countDocuments({ role: { $in: ["user", "sponsor"] } }),
        Campaign.countDocuments({ status: "active" }),
        CmsAdmin.countDocuments({ isActive: true }),
        AuditLog.countDocuments({ category: "auth", createdAt: { $gte: today } }),
        WithdrawalRequest.find({ status: "pending" })
          .sort({ createdAt: -1 })
          .limit(6)
          .select("_id userId amount createdAt status"),
        AuditLog.find({})
          .sort({ createdAt: -1 })
          .limit(8)
          .select("action createdAt"),
      ]);

    const userIds = pendingWithdrawals.map((w) => String(w.userId));
    const users = await User.find({ _id: { $in: userIds } }).select("_id name");
    const userNameById = new Map(users.map((u) => [String(u._id), String(u.name ?? "")]));

    const pendingBankRows = await BankAccount.find({ status: "pending" })
      .sort({ updatedAt: -1 })
      .limit(8)
      .select("userId bankName accountHolderName updatedAt")
      .lean();
    const pendingBankUserIds = pendingBankRows.map((b) => String(b.userId ?? ""));
    const pendingBankUsers =
      pendingBankUserIds.length > 0
        ? await User.find({ _id: { $in: pendingBankUserIds } }).select("_id name lineDisplayId").lean()
        : [];
    const pendingBankUserById = new Map(
      pendingBankUsers.map((u) => [
        String(u._id),
        {
          name: String(u.name ?? "").trim(),
          lineDisplayId: String((u as { lineDisplayId?: string }).lineDisplayId ?? "").trim(),
        },
      ])
    );

    return NextResponse.json({
      ok: true,
      stats: {
        memberCount,
        activeCampaignCount,
        onlineAdminCount,
        loginTodayCount,
      },
      bankReviewAlerts: pendingBankRows.map((b) => ({
        id: String(b._id),
        userId: String(b.userId ?? ""),
        userName:
          pendingBankUserById.get(String(b.userId ?? ""))?.name ||
          pendingBankUserById.get(String(b.userId ?? ""))?.lineDisplayId ||
          `USER_${String(b.userId ?? "").slice(-6)}`,
        bankName: String((b as { bankName?: string }).bankName ?? ""),
        accountHolderName: String((b as { accountHolderName?: string }).accountHolderName ?? ""),
        requestedAt:
          b.updatedAt instanceof Date ? b.updatedAt.toISOString().slice(0, 16).replace("T", " ") : "-",
      })),
      withdrawalAlerts: pendingWithdrawals.map((w) => ({
        id: String(w._id),
        userId: userNameById.get(String(w.userId)) || `USER_${String(w.userId).slice(-6)}`,
        amount: Number(w.amount ?? 0),
        requestedAt: w.createdAt instanceof Date ? w.createdAt.toISOString().slice(0, 16).replace("T", " ") : "-",
        status: "รอดำเนินการ",
      })),
      activities: latestActivities.map((x) => ({
        id: String(x._id),
        action: String(x.action ?? ""),
        createdAt: x.createdAt instanceof Date ? x.createdAt.toISOString().slice(0, 16).replace("T", " ") : "-",
      })),
    });
  } catch (e) {
    console.error("[api/cms/dashboard]", e);
    return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });
  }
}
