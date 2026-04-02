/** สถานะแคมเปญตาม schema MongoDB (ตัวพิมพ์เล็ก) */
export type CmsCampaignStatus = "active" | "paused" | "completed";

/** แท็กที่แนบกับแคมเปญ (อ่านจาก `campaigns.tagIds` + join `campaigntags`) */
export type CmsCampaignTagBrief = {
  id: string;
  slug: string;
  nameTh: string;
};

export type CmsCampaignRow = {
  id: string;
  sponsorId: string;
  sponsorName: string;
  name: string;
  totalBudget: number;
  usedBudget: number;
  status: CmsCampaignStatus;
  /** ว่างได้ถ้ายังไม่ผูกแท็ก */
  tags: CmsCampaignTagBrief[];
  /** รายละเอียดเต็ม — มีเมื่อโหลดแคมเปญรายการเดียว */
  description?: string;
  flexMessageJsonDriveFileId?: string;
  /** ข้อความแจ้งเตือนเมื่อแชร์ (altText / เทียบเท่า linemsg) */
  shareAltText?: string;
  rewardPerShare?: number;
  maxRewardPerUser?: number;
  maxRewardPerUserPerDay?: number;
  /** จำนวนแชร์สูงสุดที่คำนวณจาก งบรวม ÷ ค่าตอบแทนต่อแชร์ */
  quota?: number;
  /** URL รูปตัวอย่าง (เช่น จาก Google Drive หลังอัปโหลด) */
  imageUrls?: string[];
};

export type CmsCampaignTagRow = {
  id: string;
  slug: string;
  nameTh: string;
  nameEn: string;
  isActive: boolean;
};
