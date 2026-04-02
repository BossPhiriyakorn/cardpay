import mongoose from "mongoose";
import { NextResponse } from "next/server";

import { createAuditLog } from "@/lib/audit-log";
import { canApproveFinance } from "@/lib/auth/cms-admin-permissions";
import { requireAdminSession } from "@/lib/auth/require-admin-session";
import { connectToDatabase } from "@/lib/mongodb";
import {
  getUserNotifyRecipientId,
  notifyUserBankAccountRejected,
  notifyUserBankAccountVerified,
} from "@/lib/line-notify";
import { BankAccount, Campaign, CampaignMemberStat, User, WithdrawalRequest } from "@/models";

function asObjectIdString(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value instanceof mongoose.Types.ObjectId) return value.toString();
  return String(value);
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ memberId: string }> }
) {
  const admin = await requireAdminSession();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const { memberId } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(memberId)) {
    return NextResponse.json({ ok: false, error: "invalid_member_id" }, { status: 400 });
  }

  try {
    await connectToDatabase();
    const [member, linkedBank, rawStats, rawTransfers] = await Promise.all([
      User.findById(memberId).select(
        [
          "name",
          "email",
          "phone",
          "lineDisplayId",
          "image",
          "role",
          "createdAt",
          "totalEarnedAllTime",
          "pendingTransferAmount",
          "referralCode",
          "referredByUserId",
          "referredByCode",
        ].join(" ")
      ),
      BankAccount.findOne({ userId: memberId }).select(
        "bankName accountNumber accountHolderName status reviewReason reviewedAt reviewedBy idCardDriveFileId bankBookDriveFileId"
      ),
      CampaignMemberStat.find({ userId: memberId })
        .select("campaignId shareCount ownShareEarned referralEarned totalEarned")
        .sort({ totalEarned: -1 }),
      WithdrawalRequest.find({ userId: memberId })
        .select("_id createdAt amount status note")
        .sort({ createdAt: -1 }),
    ]);

    if (!member) {
      return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    }

    const referredByUserId = asObjectIdString(
      (member as { referredByUserId?: mongoose.Types.ObjectId | string | null }).referredByUserId
    );

    const [referrer, referredUsers] = await Promise.all([
      referredByUserId
        ? User.findById(referredByUserId).select("name referralCode").lean()
        : Promise.resolve(null),
      User.find({ referredByUserId: member._id })
        .select("name referralCode referralRewardClaimedAt referralRewardClaimedCampaignId")
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    const campaignIdSet = new Set(
      rawStats
        .map((s) => asObjectIdString(s.campaignId))
        .filter(Boolean)
    );
    for (const referredUser of referredUsers) {
      const claimedCampaignId = asObjectIdString(
        (referredUser as { referralRewardClaimedCampaignId?: mongoose.Types.ObjectId | string | null })
          .referralRewardClaimedCampaignId
      );
      if (claimedCampaignId) {
        campaignIdSet.add(claimedCampaignId);
      }
    }

    const campaigns = await Campaign.find({ _id: { $in: Array.from(campaignIdSet) } })
      .select("name rewardPerShare")
      .lean();
    const campaignNameById = new Map(campaigns.map((c) => [String(c._id), String(c.name ?? "")]));
    const campaignRewardById = new Map(campaigns.map((c) => [String(c._id), Number(c.rewardPerShare ?? 0)]));

    const referredFriendRewards = referredUsers.map((row) => {
      const claimedAt =
        (row as { referralRewardClaimedAt?: Date | null }).referralRewardClaimedAt instanceof Date
          ? (row as { referralRewardClaimedAt?: Date | null }).referralRewardClaimedAt!.toISOString()
          : null;
      const claimedCampaignId = asObjectIdString(
        (row as { referralRewardClaimedCampaignId?: mongoose.Types.ObjectId | string | null })
          .referralRewardClaimedCampaignId
      );

      return {
        id: String(row._id),
        name: String(row.name ?? ""),
        referralCode: String((row as { referralCode?: string }).referralCode ?? "").trim().toUpperCase(),
        rewardClaimed: Boolean(claimedAt),
        rewardClaimedAt: claimedAt,
        rewardCampaignId: claimedCampaignId,
        rewardCampaignName: claimedCampaignId
          ? campaignNameById.get(claimedCampaignId) ?? "แคมเปญที่ถูกลบ"
          : "",
        rewardAmount: claimedCampaignId ? Number(campaignRewardById.get(claimedCampaignId) ?? 0) : 0,
      };
    });

    return NextResponse.json({
      ok: true,
      member: {
        id: String(member._id),
        name: String(member.name ?? ""),
        email: String(member.email ?? ""),
        phone: String(member.phone ?? ""),
        lineDisplayId: String(
          (member as { lineDisplayId?: string }).lineDisplayId ?? ""
        ).trim(),
        avatar: String(member.image ?? ""),
        role: String(member.role ?? "user"),
        joinedAt: member.createdAt instanceof Date ? member.createdAt.toISOString().slice(0, 10) : "-",
        totalEarnedAllTime: Number(member.totalEarnedAllTime ?? 0),
        latestTransferableAmount: Number(member.pendingTransferAmount ?? 0),
        referralCode: String(
          (member as { referralCode?: string }).referralCode ?? ""
        ).trim().toUpperCase(),
        referredBy: referredByUserId
          ? {
              userId: referredByUserId,
              code: String(
                (member as { referredByCode?: string }).referredByCode ?? ""
              ).trim().toUpperCase(),
              name: String((referrer as { name?: string } | null)?.name ?? ""),
            }
          : null,
        referredFriends: referredFriendRewards,
        linkedBankAccount: linkedBank
          ? {
              id: String(linkedBank._id),
              bankName: String(linkedBank.bankName ?? ""),
              accountNumber: String(linkedBank.accountNumber ?? ""),
              accountHolderName: String(linkedBank.accountHolderName ?? ""),
              status: String(linkedBank.status ?? "pending"),
              reviewReason: String((linkedBank as { reviewReason?: string }).reviewReason ?? ""),
              idCardDriveFileId: String(
                (linkedBank as { idCardDriveFileId?: string }).idCardDriveFileId ?? ""
              ),
              bankBookDriveFileId: String(
                (linkedBank as { bankBookDriveFileId?: string }).bankBookDriveFileId ?? ""
              ),
              reviewedAt:
                (linkedBank as { reviewedAt?: Date }).reviewedAt instanceof Date
                  ? (linkedBank as { reviewedAt?: Date }).reviewedAt!.toISOString()
                  : null,
            }
          : null,
        campaignShares: rawStats.map((row) => {
          const shareCount = Number(row.shareCount ?? 0);
          const totalEarned = Number(row.totalEarned ?? 0);
          const ownShareEarned = Number((row as { ownShareEarned?: number }).ownShareEarned ?? 0);
          const referralEarned = Number((row as { referralEarned?: number }).referralEarned ?? 0);
          const hasExplicitBreakdown = ownShareEarned > 0 || referralEarned > 0;

          return {
            campaignId: asObjectIdString(row.campaignId),
            campaignName: campaignNameById.get(asObjectIdString(row.campaignId)) ?? "แคมเปญที่ถูกลบ",
            shareCount,
            ownShareEarned: hasExplicitBreakdown ? ownShareEarned : shareCount > 0 ? totalEarned : 0,
            referralEarned: hasExplicitBreakdown ? referralEarned : shareCount === 0 ? totalEarned : 0,
            totalEarned,
          };
        }),
        transfers: rawTransfers.map((row) => ({
          id: String(row._id),
          date: row.createdAt instanceof Date ? row.createdAt.toISOString().slice(0, 16).replace("T", " ") : "-",
          amount: Number(row.amount ?? 0),
          status: String(row.status ?? "pending") === "completed" ? "Completed" : "Pending",
          note: String(row.note ?? ""),
        })),
      },
    });
  } catch (e) {
    console.error("[api/cms/members/:memberId]", e);
    return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ memberId: string }> }
) {
  const admin = await requireAdminSession();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!canApproveFinance(admin.role)) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const { memberId } = await context.params;
  if (!mongoose.Types.ObjectId.isValid(memberId)) {
    return NextResponse.json({ ok: false, error: "invalid_member_id" }, { status: 400 });
  }

  let body: { action?: "approve" | "reject"; reason?: string };
  try {
    body = (await request.json()) as { action?: "approve" | "reject"; reason?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const action = body.action;
  const reason = String(body.reason ?? "").trim();
  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ ok: false, error: "invalid_action" }, { status: 400 });
  }
  if (action === "reject" && !reason) {
    return NextResponse.json({ ok: false, error: "missing_reject_reason" }, { status: 400 });
  }

  try {
    await connectToDatabase();

    const update =
      action === "approve"
        ? {
            $set: {
              status: "verified",
              reviewReason: "",
              reviewedAt: new Date(),
              reviewedBy: admin.username,
            },
          }
        : {
            $set: {
              status: "rejected",
              reviewReason: reason,
              reviewedAt: new Date(),
              reviewedBy: admin.username,
            },
          };

    const updated = await BankAccount.findOneAndUpdate(
      { userId: memberId },
      update,
      { returnDocument: "after" }
    )
      .select("status reviewReason reviewedAt reviewedBy")
      .lean();

    if (!updated) {
      return NextResponse.json({ ok: false, error: "bank_account_not_found" }, { status: 404 });
    }

    await createAuditLog({
      action:
        action === "approve"
          ? `approve member bank account: ${memberId} by ${admin.username}`
          : `reject member bank account: ${memberId} by ${admin.username}`,
      category: "member",
      targetType: "bank_account",
      targetId: memberId,
    });

    if (action === "approve" || action === "reject") {
      const memberUser = await User.findById(memberId)
        .select("lineNotifyEnabled lineNotifyUserId lineUid")
        .lean();
      const recipientId = getUserNotifyRecipientId(
        (memberUser ?? {}) as {
          lineNotifyEnabled?: boolean | null;
          lineNotifyUserId?: string | null;
          lineUid?: string | null;
        }
      );
      if (recipientId) {
        if (action === "approve") {
          void notifyUserBankAccountVerified({ recipientId }).catch((notifyError) => {
            console.error("[api/cms/members/:memberId:user-notify-bank-verified]", notifyError);
          });
        } else {
          void notifyUserBankAccountRejected({
            recipientId,
            reason: String((updated as { reviewReason?: string }).reviewReason ?? ""),
          }).catch((notifyError) => {
            console.error("[api/cms/members/:memberId:user-notify-bank-rejected]", notifyError);
          });
        }
      }
    }

    return NextResponse.json({
      ok: true,
      bankAccount: {
        status: String(updated.status ?? "pending"),
        reviewReason: String((updated as { reviewReason?: string }).reviewReason ?? ""),
        reviewedAt:
          (updated as { reviewedAt?: Date }).reviewedAt instanceof Date
            ? (updated as { reviewedAt?: Date }).reviewedAt!.toISOString()
            : null,
        reviewedBy: String((updated as { reviewedBy?: string }).reviewedBy ?? ""),
      },
    });
  } catch (e) {
    console.error("[api/cms/members/:memberId:PATCH]", e);
    return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });
  }
}
