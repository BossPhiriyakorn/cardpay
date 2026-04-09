/** สถานะแคมเปญตาม schema MongoDB (ตัวพิมพ์เล็ก) */
export type CmsCampaignStatus = "active" | "paused" | "completed" | "archived";

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
  /** งบกลางสปอนเซอร์ (0 = ใช้โหมดงบต่อแคมเปญ) */
  sponsorAdvertisingTotalBudget: number;
  sponsorAdvertisingUsedBudget: number;
  name: string;
  totalBudget: number;
  usedBudget: number;
  /** จำนวนครั้งแชร์สะสมของแคมเปญนี้ */
  currentShares: number;
  status: CmsCampaignStatus;
  /** ว่างได้ถ้ายังไม่ผูกแท็ก */
  tags: CmsCampaignTagBrief[];
  /** รายละเอียดเต็ม — มีเมื่อโหลดแคมเปญรายการเดียว (บนการ์ด Flex) */
  description?: string;
  /** คำอธิบายในแอป (หน้าแรก / รายการแคมเปญ) แยกจาก description */
  appFeedDescription?: string;
  flexMessageJsonDriveFileId?: string;
  /** ข้อความแจ้งเตือนเมื่อแชร์ (altText / เทียบเท่า linemsg) */
  shareAltText?: string;
  rewardPerShare?: number;
  maxRewardPerUser?: number;
  maxRewardPerUserPerDay?: number;
  /** โควต้าแชร์จากฟิลด์แคมเปญ (โหมดงบรวมสปอนเซอร์มักเป็น 0) */
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

/** แถวในตารางเทมเพลต Flex หน้าจัดการแคมเปญ */
export type CmsFlexTemplateTableRow = {
  id: string;
  name: string;
  slug: string;
  updatedAt: string | null;
};
