import { NextResponse } from "next/server";

import { requireAdminSession } from "@/lib/auth/require-admin-session";
import { connectToDatabase } from "@/lib/mongodb";
import { BankAccount, User } from "@/models";

function mapMemberStatus(status: string): "Active" | "Inactive" | "Banned" | "PendingTransfer" {
  if (status === "inactive") return "Inactive";
  if (status === "banned") return "Banned";
  if (status === "pending_transfer") return "PendingTransfer";
  return "Active";
}

/** GET — รายการสมาชิกสำหรับ CMS */
export async function GET() {
  const admin = await requireAdminSession();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    await connectToDatabase();
    const docs = await User.find({})
      .sort({ createdAt: -1 })
      .select(
        "name email phone lineDisplayId memberStatus pendingTransferAmount createdAt referralCode"
      )
      .lean();

    const userIds = docs.map((d) => d._id);
    const bankRows =
      userIds.length > 0
        ? await BankAccount.find({ userId: { $in: userIds } })
            .select("userId status reviewReason")
            .lean()
        : [];
    const bankByUserId = new Map(
      bankRows.map((b) => [
        String(b.userId),
        {
          status: String((b as { status?: string }).status ?? "pending"),
          reviewReason: String((b as { reviewReason?: string }).reviewReason ?? ""),
        },
      ])
    );

    const members = docs.map((doc) => ({
      id: String(doc._id),
      name: String(doc.name ?? ""),
      email: String(doc.email ?? ""),
      phone: String(doc.phone ?? ""),
      /** ไอดีที่ผู้ใช้กรอกตอนสมัคร (ไม่ใช่ MongoDB _id / LINE UID ภายใน) */
      lineDisplayId: String((doc as { lineDisplayId?: string }).lineDisplayId ?? "").trim(),
      referralCode: String((doc as { referralCode?: string }).referralCode ?? "").trim().toUpperCase(),
      hasReferralCode: Boolean(String((doc as { referralCode?: string }).referralCode ?? "").trim()),
      status: mapMemberStatus(String(doc.memberStatus ?? "active")),
      joined: doc.createdAt instanceof Date ? doc.createdAt.toISOString().slice(0, 10) : "-",
      pendingTransferAmount: Number(doc.pendingTransferAmount ?? 0),
      bankVerificationStatus:
        bankByUserId.get(String(doc._id))?.status === "verified"
          ? "verified"
          : bankByUserId.get(String(doc._id))?.status === "rejected"
            ? "rejected"
            : bankByUserId.get(String(doc._id))?.status === "pending"
              ? "pending"
              : "none",
      bankReviewReason: bankByUserId.get(String(doc._id))?.reviewReason ?? "",
    }));

    return NextResponse.json({ ok: true, members });
  } catch (e) {
    console.error("[api/cms/members]", e);
    return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });
  }
}
