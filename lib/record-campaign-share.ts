/**
 * แนะนำเพื่อน: ผู้ถูกแนะนำแชร์สำเร็จ «ครั้งแรก» (แคมเปญใดก็ได้) ผู้แนะนำได้รับเงินเท่ากับ rewardPerShare ของครั้งนั้น
 * ครั้งเดียว — หลังบันทึกแล้วจะไม่จ่ายรางวัลแนะนำอีกแม้แชร์แคมเปญเดิม/ใหม่
 * ถ้าครั้งแรกเป็นแคมเปญที่ rewardPerShare = 0 จะไม่จ่ายให้ผู้แนะนำ แต่สิทธิ์ครั้งเดียวถูกใช้แล้ว (ไม่จ่ายในครั้งถัดไป)
 */
import type { ClientSession } from "mongoose";
import mongoose from "mongoose";

import {
  getPlatformCampaignEconomics,
  resolveMaxEarnPerUserCampaign,
  resolveMaxEarnPerUserPerDay,
  resolveRewardPerShare,
  sponsorBudgetSnapshot,
} from "@/lib/campaign-share-economics";
import { nowBangkokDayKey, startOfBangkokDayFromKey } from "@/lib/bangkok-day";
import Campaign from "@/models/Campaign";
import CampaignMemberStat from "@/models/CampaignMemberStat";
import CampaignShareDaily from "@/models/CampaignShareDaily";
import CampaignUserDailyStat from "@/models/CampaignUserDailyStat";
import Sponsor from "@/models/Sponsor";
import User from "@/models/User";
import UserDailyStat from "@/models/UserDailyStat";
import { ensureUserReferralCode } from "@/lib/referral-code";

export type RecordShareResult =
  | { ok: true; rewardApplied: number }
  | { ok: false; code: string; message: string };

export type ShareEligibilityResult =
  | { ok: true }
  | { ok: false; code: string; message: string };

function isReplicaSetTransactionError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return (
    msg.includes("Transaction numbers are only allowed") ||
    msg.includes("replica set") ||
    msg.includes("Transaction with")
  );
}

function optSession(session: ClientSession | null | undefined) {
  return session ? { session } : {};
}

type ReferralRewardContext = {
  referrerUserId: mongoose.Types.ObjectId;
  rewardAmount: number;
};

export async function checkCampaignShareEligibility(params: {
  campaignId: string;
  lineUid: string;
}): Promise<ShareEligibilityResult> {
  const { campaignId, lineUid } = params;

  if (!mongoose.Types.ObjectId.isValid(campaignId)) {
    return { ok: false, code: "invalid_campaign", message: "รหัสแคมเปญไม่ถูกต้อง" };
  }
  if (!lineUid.trim()) {
    return { ok: false, code: "invalid_user", message: "ไม่พบ LINE user" };
  }

  const campaignOid = new mongoose.Types.ObjectId(campaignId);
  const bangkokDay = startOfBangkokDayFromKey(nowBangkokDayKey());

  const raw = await Campaign.findById(campaignOid).lean();
  if (!raw) {
    return { ok: false, code: "not_found", message: "ไม่พบแคมเปญ" };
  }

  const c = raw as {
    status?: string;
    totalBudget?: number;
    usedBudget?: number;
    currentShares?: number;
    quota?: number;
    rewardPerShare?: number;
    maxRewardPerUser?: number;
    maxRewardPerUserPerDay?: number;
    sponsorId?: unknown;
  };

  if (c.status !== "active") {
    return { ok: false, code: "inactive", message: "แคมเปญไม่เปิดรับการแชร์" };
  }

  const platform = await getPlatformCampaignEconomics();
  const rewardPerShare = resolveRewardPerShare(platform, c);
  const maxRewardPerUserPerDay = resolveMaxEarnPerUserPerDay(platform, c);
  const maxRewardPerUser = resolveMaxEarnPerUserCampaign(platform, c, rewardPerShare);

  const currentShares = Number(c.currentShares ?? 0);
  const quota = Number(c.quota ?? 0);
  if (quota > 0 && currentShares >= quota) {
    return { ok: false, code: "quota_exhausted", message: "โควตาแชร์เต็มแล้ว" };
  }

  const user = await User.findOne({ lineUid })
    .select("_id referredByUserId referralRewardClaimedAt")
    .lean();

  let referralRewardAmount = 0;
  if (rewardPerShare > 0 && user?._id && user.referredByUserId && !user.referralRewardClaimedAt) {
    const referrer = await User.findById(user.referredByUserId).select("_id").lean();
    if (referrer?._id && String(referrer._id) !== String(user._id)) {
      referralRewardAmount = rewardPerShare;
    }
  }

  const totalCost = rewardPerShare + referralRewardAmount;
  const sponsorDoc = c.sponsorId
    ? await Sponsor.findById(c.sponsorId as mongoose.Types.ObjectId).lean()
    : null;
  if (rewardPerShare > 0 && totalCost > 0) {
    const { total, used } = sponsorBudgetSnapshot(sponsorDoc);
    if (total <= 0) {
      return {
        ok: false,
        code: "sponsor_budget_not_configured",
        message: "ยังไม่ได้ตั้งงบโฆษณารวมของสปอนเซอร์ — ติดต่อแอดมิน",
      };
    }
    if (used + totalCost > total) {
      return { ok: false, code: "budget_exhausted", message: "งบโฆษณาของสปอนเซอร์ไม่เพียงพอ" };
    }
  }

  if (!user?._id) {
    return { ok: true };
  }

  const userId = user._id as mongoose.Types.ObjectId;
  const [memberStat, dailyCampaignStat] = await Promise.all([
    CampaignMemberStat.findOne({ campaignId: campaignOid, userId }).lean(),
    CampaignUserDailyStat.findOne({ campaignId: campaignOid, userId, day: bangkokDay }).lean(),
  ]);

  const ownEarnedInCampaign =
    Number((memberStat as { ownShareEarned?: number } | null)?.ownShareEarned ?? 0);
  const ownEarnedTodayInCampaign = Number(
    (dailyCampaignStat as { ownEarnedAmount?: number } | null)?.ownEarnedAmount ??
      ((dailyCampaignStat?.shareCount ?? 0) > 0 ? Number(dailyCampaignStat?.shareCount ?? 0) * rewardPerShare : 0)
  );

  if (
    rewardPerShare > 0 &&
    maxRewardPerUser > 0 &&
    ownEarnedInCampaign + rewardPerShare > maxRewardPerUser
  ) {
    return {
      ok: false,
      code: "campaign_user_reward_limit_reached",
      message: "ผู้ใช้รับเงินจากแคมเปญนี้ครบตามกำหนดแล้ว",
    };
  }

  if (
    rewardPerShare > 0 &&
    maxRewardPerUserPerDay > 0 &&
    ownEarnedTodayInCampaign + rewardPerShare > maxRewardPerUserPerDay
  ) {
    return {
      ok: false,
      code: "campaign_user_daily_reward_limit_reached",
      message: "ผู้ใช้รับเงินจากแคมเปญนี้ครบตามกำหนดของวันนี้แล้ว",
    };
  }

  return { ok: true };
}

async function runRecordCore(
  params: {
    campaignId: string;
    lineUid: string;
    lineName?: string;
    linePicture?: string;
  },
  session: ClientSession | null
): Promise<RecordShareResult> {
  const { campaignId, lineUid, lineName, linePicture } = params;

  const campaignOid = new mongoose.Types.ObjectId(campaignId);
  const bangkokDay = startOfBangkokDayFromKey(nowBangkokDayKey());
  const sess = session ?? undefined;

  let campaignQuery = Campaign.findById(campaignOid);
  if (sess) campaignQuery = campaignQuery.session(sess);
  const raw = await campaignQuery.lean();
  if (!raw) {
    return { ok: false, code: "not_found", message: "ไม่พบแคมเปญ" };
  }

  const c = raw as {
    status?: string;
    totalBudget?: number;
    usedBudget?: number;
    currentShares?: number;
    quota?: number;
    rewardPerShare?: number;
    maxRewardPerUser?: number;
    maxRewardPerUserPerDay?: number;
    sponsorId?: unknown;
  };

  if (c.status !== "active") {
    return { ok: false, code: "inactive", message: "แคมเปญไม่เปิดรับการแชร์" };
  }

  const platform = await getPlatformCampaignEconomics();
  const rewardPerShare = resolveRewardPerShare(platform, c);
  const maxRewardPerUserPerDay = resolveMaxEarnPerUserPerDay(platform, c);
  const maxRewardPerUser = resolveMaxEarnPerUserCampaign(platform, c, rewardPerShare);

  const usedBudget = Number(c.usedBudget ?? 0);
  const currentShares = Number(c.currentShares ?? 0);
  const quota = Number(c.quota ?? 0);

  if (quota > 0 && currentShares >= quota) {
    return { ok: false, code: "quota_exhausted", message: "โควตาแชร์เต็มแล้ว" };
  }

  const sponsorOid =
    c.sponsorId && mongoose.Types.ObjectId.isValid(String(c.sponsorId))
      ? new mongoose.Types.ObjectId(String(c.sponsorId))
      : null;
  let sponsorQuery = sponsorOid ? Sponsor.findById(sponsorOid) : null;
  if (sponsorQuery && sess) sponsorQuery = sponsorQuery.session(sess);
  const sponsorRaw = sponsorQuery ? await sponsorQuery.lean() : null;

  /* ห้ามใส่ name/image ทั้งใน $setOnInsert และ $set — MongoDB จะ error ConflictingUpdateOperators */
  const profileSet: Record<string, string> = {};
  if (lineName?.trim()) profileSet.name = lineName.trim();
  if (linePicture?.trim()) profileSet.image = linePicture.trim();

  const userUpdate: {
    $setOnInsert: Record<string, unknown>;
    $set?: Record<string, string>;
  } = {
    $setOnInsert: {
      role: "user",
      walletBalance: 0,
      totalEarnedAllTime: 0,
      registrationCompleted: false,
    },
  };
  if (Object.keys(profileSet).length > 0) {
    userUpdate.$set = profileSet;
  }

  const user = await User.findOneAndUpdate({ lineUid }, userUpdate, {
    upsert: true,
    returnDocument: "after",
    ...optSession(sess),
  }).select("_id referredByUserId referralRewardClaimedAt");

  if (!user?._id) {
    return { ok: false, code: "user_error", message: "ไม่สามารถสร้าง/โหลดผู้ใช้" };
  }

  const userId = user._id as mongoose.Types.ObjectId;
  await ensureUserReferralCode(String(userId), sess ?? null);
  let referralReward: ReferralRewardContext | null = null;
  let eligibleReferrerId: mongoose.Types.ObjectId | null = null;
  if (
    user.referredByUserId &&
    !user.referralRewardClaimedAt &&
    String(user.referredByUserId) !== String(userId)
  ) {
    let referrerQuery = User.findById(user.referredByUserId).select("_id");
    if (sess) {
      referrerQuery = referrerQuery.session(sess);
    }
    const referrer = await referrerQuery.lean();
    if (referrer?._id) {
      eligibleReferrerId = referrer._id as mongoose.Types.ObjectId;
      if (rewardPerShare > 0) {
        referralReward = {
          referrerUserId: eligibleReferrerId,
          rewardAmount: rewardPerShare,
        };
      }
    }
  }

  const totalBudgetToApply = rewardPerShare + Number(referralReward?.rewardAmount ?? 0);
  if (rewardPerShare > 0 && totalBudgetToApply > 0) {
    const { total: st, used: su } = sponsorBudgetSnapshot(sponsorRaw);
    if (st <= 0) {
      return {
        ok: false,
        code: "sponsor_budget_not_configured",
        message: "ยังไม่ได้ตั้งงบโฆษณารวมของสปอนเซอร์ — ติดต่อแอดมิน",
      };
    }
    if (su + totalBudgetToApply > st) {
      return { ok: false, code: "budget_exhausted", message: "งบโฆษณาของสปอนเซอร์ไม่เพียงพอ" };
    }
  }

  let memberQuery = CampaignMemberStat.findOne({ campaignId: campaignOid, userId });
  let dailyCampaignQuery = CampaignUserDailyStat.findOne({
    campaignId: campaignOid,
    userId,
    day: bangkokDay,
  });
  if (sess) {
    memberQuery = memberQuery.session(sess);
    dailyCampaignQuery = dailyCampaignQuery.session(sess);
  }

  const [memberStat, dailyCampaignStat] = await Promise.all([memberQuery.lean(), dailyCampaignQuery.lean()]);

  const ownEarnedInCampaign =
    Number((memberStat as { ownShareEarned?: number } | null)?.ownShareEarned ?? 0);
  const ownEarnedTodayInCampaign = Number(
    (dailyCampaignStat as { ownEarnedAmount?: number } | null)?.ownEarnedAmount ??
      ((dailyCampaignStat?.shareCount ?? 0) > 0 ? Number(dailyCampaignStat?.shareCount ?? 0) * rewardPerShare : 0)
  );

  if (
    rewardPerShare > 0 &&
    maxRewardPerUser > 0 &&
    ownEarnedInCampaign + rewardPerShare > maxRewardPerUser
  ) {
    return {
      ok: false,
      code: "campaign_user_reward_limit_reached",
      message: "ผู้ใช้รับเงินจากแคมเปญนี้ครบตามกำหนดแล้ว",
    };
  }

  if (
    rewardPerShare > 0 &&
    maxRewardPerUserPerDay > 0 &&
    ownEarnedTodayInCampaign + rewardPerShare > maxRewardPerUserPerDay
  ) {
    return {
      ok: false,
      code: "campaign_user_daily_reward_limit_reached",
      message: "ผู้ใช้รับเงินจากแคมเปญนี้ครบตามกำหนดของวันนี้แล้ว",
    };
  }

  if (sponsorOid && totalBudgetToApply > 0) {
    /**
     * อย่าใช้เงื่อนไข advertisingUsedBudget เท่ากับค่าที่อ่านมา — ใน MongoDB ฟิลด์ที่ไม่มีในเอกสาร
     * จะไม่ match กับ 0 ทำให้อัปเดตล้มทุกครั้ง (ขึ้น concurrent_update ทั้งที่ไม่มีใครแก้งบ)
     * ใช้ $expr ตรวจว่าหลังบวกแล้วยังไม่เกินงบรวม (อะตอมิกกับ $inc)
     */
    const sponsorUpdated = await Sponsor.findOneAndUpdate(
      {
        _id: sponsorOid,
        $expr: {
          $lte: [
            {
              $add: [
                { $ifNull: ["$advertisingUsedBudget", 0] },
                totalBudgetToApply,
              ],
            },
            { $ifNull: ["$advertisingTotalBudget", 0] },
          ],
        },
      },
      { $inc: { advertisingUsedBudget: totalBudgetToApply } },
      { returnDocument: "after", ...optSession(sess) }
    );
    if (!sponsorUpdated) {
      return {
        ok: false,
        code: "budget_exhausted",
        message:
          "งบโฆษณาของสปอนเซอร์ไม่เพียงพอ หรือมีผู้แชร์พร้อมกันจนงบถึงขีดจำกัด — ลองอีกครั้งภายหลัง",
      };
    }
  }

  const inc: Record<string, number> = { currentShares: 1 };
  if (totalBudgetToApply > 0) {
    inc.usedBudget = totalBudgetToApply;
  }

  const campaignFilter: Record<string, unknown> = {
    _id: campaignOid,
    status: "active",
  };
  if (quota > 0) {
    campaignFilter.$expr = {
      $lt: [{ $ifNull: ["$currentShares", 0] }, quota],
    };
  }

  const updated = await Campaign.findOneAndUpdate(
    campaignFilter,
    { $inc: inc },
    { returnDocument: "after", ...optSession(sess) }
  );

  if (!updated) {
    if (quota > 0) {
      return {
        ok: false,
        code: "quota_exhausted",
        message: "โควตาแชร์เต็มแล้ว",
      };
    }
    return {
      ok: false,
      code: "inactive",
      message: "แคมเปญไม่เปิดรับการแชร์",
    };
  }

  await CampaignMemberStat.findOneAndUpdate(
    { campaignId: campaignOid, userId },
    {
      $inc: {
        shareCount: 1,
        ...(rewardPerShare > 0
          ? {
              ownShareEarned: rewardPerShare,
              totalEarned: rewardPerShare,
            }
          : {}),
      },
      $set: { lastSharedAt: new Date() },
    },
    { upsert: true, ...optSession(sess) }
  );

  await CampaignShareDaily.findOneAndUpdate(
    { campaignId: campaignOid, day: bangkokDay },
    { $inc: { shareCount: 1 } },
    { upsert: true, ...optSession(sess) }
  );

  await CampaignUserDailyStat.findOneAndUpdate(
    { campaignId: campaignOid, userId, day: bangkokDay },
    {
      $inc: {
        shareCount: 1,
        ...(rewardPerShare > 0
          ? { ownEarnedAmount: rewardPerShare, earnedAmount: rewardPerShare }
          : {}),
      },
    },
    { upsert: true, ...optSession(sess) }
  );

  if (rewardPerShare > 0) {
    await User.findByIdAndUpdate(
      userId,
      {
        $inc: {
          walletBalance: rewardPerShare,
          totalEarnedAllTime: rewardPerShare,
        },
      },
      optSession(sess)
    );
  }

  if (referralReward && referralReward.rewardAmount > 0) {
    await User.findByIdAndUpdate(
      referralReward.referrerUserId,
      {
        $inc: {
          walletBalance: referralReward.rewardAmount,
          totalEarnedAllTime: referralReward.rewardAmount,
        },
      },
      optSession(sess)
    );

    await CampaignMemberStat.findOneAndUpdate(
      { campaignId: campaignOid, userId: referralReward.referrerUserId },
      {
        $inc: {
          referralEarned: referralReward.rewardAmount,
          totalEarned: referralReward.rewardAmount,
        },
      },
      { upsert: true, ...optSession(sess) }
    );

    await CampaignUserDailyStat.findOneAndUpdate(
      { campaignId: campaignOid, userId: referralReward.referrerUserId, day: bangkokDay },
      {
        $inc: {
          referralEarnedAmount: referralReward.rewardAmount,
          earnedAmount: referralReward.rewardAmount,
        },
      },
      { upsert: true, ...optSession(sess) }
    );

    await UserDailyStat.findOneAndUpdate(
      { userId: referralReward.referrerUserId, day: bangkokDay },
      {
        $inc: { earnedAmount: referralReward.rewardAmount },
      },
      { upsert: true, ...optSession(sess) }
    );

  }

  const shouldConsumeReferralSlot =
    Boolean(eligibleReferrerId) && !user.referralRewardClaimedAt;
  if (shouldConsumeReferralSlot) {
    await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          referralRewardClaimedAt: new Date(),
          referralRewardClaimedCampaignId: campaignOid,
        },
      },
      optSession(sess)
    );
  }

  await UserDailyStat.findOneAndUpdate(
    { userId, day: bangkokDay },
    {
      $inc: {
        shareCount: 1,
        ...(rewardPerShare > 0 ? { earnedAmount: rewardPerShare } : {}),
      },
    },
    { upsert: true, ...optSession(sess) }
  );

  return { ok: true, rewardApplied: rewardPerShare };
}

/**
 * บันทึกการแชร์ 1 ครั้งหลัง shareTargetPicker สำเร็จ — อัปเดตโควตา กระเป๋า สถิติ CMS/สปอนเซอร์
 */
export async function recordCampaignShare(params: {
  campaignId: string;
  lineUid: string;
  lineName?: string;
  linePicture?: string;
}): Promise<RecordShareResult> {
  const { campaignId, lineUid } = params;

  const eligibility = await checkCampaignShareEligibility({ campaignId, lineUid });
  if (!eligibility.ok) {
    return eligibility;
  }

  const session = await mongoose.startSession();

  try {
    session.startTransaction();
    const out = await runRecordCore(params, session);
    if (!out.ok) {
      await session.abortTransaction();
      return out;
    }
    await session.commitTransaction();
    return out;
  } catch (e) {
    await session.abortTransaction().catch(() => {});
    if (isReplicaSetTransactionError(e)) {
      try {
        return await runRecordCore(params, null);
      } catch (e2) {
        console.error("[recordCampaignShare:fallback]", e2);
        return {
          ok: false,
          code: "server_error",
          message: e2 instanceof Error ? e2.message : String(e2),
        };
      }
    }
    console.error("[recordCampaignShare]", e);
    return {
      ok: false,
      code: "server_error",
      message: e instanceof Error ? e.message : String(e),
    };
  } finally {
    await session.endSession();
  }
}
