/**
 * สร้างตัวอย่างข้อมูลใน MongoDB (optional) — ใช้หลังตั้ง MONGODB_URI
 *
 * รัน: npm run seed
 */

import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

import { connectToDatabase } from "../lib/mongodb";
import { shareQuotaFromBudget } from "../lib/share-quota";
import {
  User,
  BankAccount,
  Sponsor,
  Campaign,
  CampaignTag,
  CampaignMemberStat,
  WithdrawalRequest,
  AuditLog,
} from "../models";

async function main() {
  await connectToDatabase();

  const count = await User.countDocuments();
  if (count > 0) {
    console.log("ข้าม seed: มี users ในฐานข้อมูลแล้ว (ลบข้อมูลก่อนหากต้องการ seed ใหม่)");
    process.exit(0);
  }

  const member = await User.create({
    lineUid: "seed-line-member-001",
    name: "สมาชิกทดสอบ",
    image: "",
    role: "user",
    walletBalance: 150,
    totalEarnedAllTime: 10450,
    pendingTransferAmount: 450,
    email: "member@example.com",
    phone: "0800000000",
    lineDisplayId: "seed.member",
    memberStatus: "pending_transfer",
  });

  const bank = await BankAccount.create({
    userId: member._id,
    bankName: "ธนาคารกสิกรไทย",
    accountNumber: "1234567890",
    accountHolderName: "สมาชิกทดสอบ",
    status: "verified",
  });

  const sponsorUser = await User.create({
    lineUid: "seed-line-sponsor-001",
    name: "สปอนเซอร์ทดสอบ",
    image: "",
    role: "sponsor",
    walletBalance: 0,
    email: "sponsor@example.com",
    phone: "0811111111",
    memberStatus: "active",
  });

  const sponsor = await Sponsor.create({
    userId: sponsorUser._id,
    companyName: "บริษัททดสอบ จำกัด",
    status: "active",
  });

  const defaultTags = [
    { slug: "tech", nameTh: "ไอที", nameEn: "Tech", sortOrder: 0 },
    { slug: "beauty", nameTh: "ความงาม", nameEn: "Beauty", sortOrder: 1 },
    { slug: "food", nameTh: "อาหาร", nameEn: "Food", sortOrder: 2 },
  ];
  for (const t of defaultTags) {
    await CampaignTag.updateOne(
      { slug: t.slug },
      {
        $setOnInsert: {
          slug: t.slug,
          nameTh: t.nameTh,
          nameEn: t.nameEn,
          sortOrder: t.sortOrder,
          isActive: true,
        },
      },
      { upsert: true }
    );
  }

  const techTag = await CampaignTag.findOne({ slug: "tech" }).lean();

  const campaign = await Campaign.create({
    sponsorId: sponsor._id,
    name: "แคมเปญทดสอบ",
    description: "รายละเอียดแคมเปญตัวอย่าง",
    totalBudget: 100000,
    usedBudget: 25000,
    status: "active",
    rewardPerShare: 1.5,
    quota: shareQuotaFromBudget(100000, 1.5),
    currentShares: 100,
    imageUrls: [],
    isPopular: true,
    tagIds: techTag ? [techTag._id] : [],
  });

  await CampaignMemberStat.create({
    campaignId: campaign._id,
    userId: member._id,
    shareCount: 12,
    totalEarned: 900,
    totalClicks: 400,
    totalLeads: 20,
    lastSharedAt: new Date(),
  });

  await WithdrawalRequest.create({
    userId: member._id,
    bankAccountId: bank._id,
    amount: 450,
    status: "pending",
    note: "คำขอถอนจาก seed",
  });

  await AuditLog.create({
    actorUserId: member._id,
    action: "seed: สร้างข้อมูลตัวอย่าง",
    category: "system",
    targetType: "system",
    targetId: "seed",
    device: "script",
    location: "local",
    ip: "127.0.0.1",
  });

  console.log("Seed สำเร็จ: user, bank, sponsor, campaign, stats, withdrawal, audit log");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
