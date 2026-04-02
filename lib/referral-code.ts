import crypto from "crypto";
import type { ClientSession } from "mongoose";

import User from "@/models/User";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const CODE_LENGTH = 8;

function randomReferralCode(): string {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return code;
}

export async function generateUniqueReferralCode(session?: ClientSession | null): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = randomReferralCode();
    let query = User.findOne({ referralCode: code }).select("_id");
    if (session) {
      query = query.session(session);
    }
    const exists = await query.lean();
    if (!exists?._id) {
      return code;
    }
  }
  throw new Error("unable_to_generate_unique_referral_code");
}

export async function ensureUserReferralCode(
  userId: string,
  session?: ClientSession | null
): Promise<string> {
  let query = User.findById(userId).select("referralCode");
  if (session) {
    query = query.session(session);
  }
  const user = await query.lean();
  const existing = String(user?.referralCode ?? "").trim().toUpperCase();
  if (existing) {
    return existing;
  }

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const code = await generateUniqueReferralCode(session);
    const updated = await User.findOneAndUpdate(
      { _id: userId, $or: [{ referralCode: { $exists: false } }, { referralCode: "" }, { referralCode: null }] },
      { $set: { referralCode: code } },
      { returnDocument: "after", ...(session ? { session } : {}) }
    )
      .select("referralCode")
      .lean();

    const finalCode = String(updated?.referralCode ?? "").trim().toUpperCase();
    if (finalCode) {
      return finalCode;
    }

    let retryQuery = User.findById(userId).select("referralCode");
    if (session) {
      retryQuery = retryQuery.session(session);
    }
    const retryUser = await retryQuery.lean();
    const retryCode = String(retryUser?.referralCode ?? "").trim().toUpperCase();
    if (retryCode) {
      return retryCode;
    }
  }

  throw new Error("unable_to_assign_referral_code");
}
