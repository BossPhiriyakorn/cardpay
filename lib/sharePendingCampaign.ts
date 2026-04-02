/**
 * เก็บ campaignId ชั่วคราวก่อน liff.login() / นำทาง LIFF — สอดคล้องกับ line_flex_tem ที่ใช้ localStorage กับ name/id
 * เพราะหลัง login LINE มัก redirect กลับมาโดย URL ไม่มี ?campaignId= ครบ
 */

const KEY_CAMPAIGN = "flexshare_pending_campaign_id";
const KEY_TEMPLATE = "flexshare_pending_template_id";

export function setPendingShareCampaign(
  campaignId: string,
  templateIndex = 1
): void {
  if (typeof window === "undefined" || !campaignId.trim()) return;
  try {
    const id = campaignId.trim();
    const t = String(Math.max(1, Math.floor(templateIndex)) || 1);
    sessionStorage.setItem(KEY_CAMPAIGN, id);
    localStorage.setItem(KEY_CAMPAIGN, id);
    sessionStorage.setItem(KEY_TEMPLATE, t);
    localStorage.setItem(KEY_TEMPLATE, t);
  } catch {
    /* ignore */
  }
}

export function getPendingShareCampaign(): {
  campaignId: string;
  templateIndex: number;
} {
  if (typeof window === "undefined") {
    return { campaignId: "", templateIndex: 1 };
  }
  try {
    const raw =
      sessionStorage.getItem(KEY_CAMPAIGN)?.trim() ||
      localStorage.getItem(KEY_CAMPAIGN)?.trim() ||
      "";
    const rawTpl =
      sessionStorage.getItem(KEY_TEMPLATE) ||
      localStorage.getItem(KEY_TEMPLATE) ||
      "1";
    const templateIndex = Math.max(1, Number.parseInt(rawTpl, 10) || 1);
    return { campaignId: raw, templateIndex };
  } catch {
    return { campaignId: "", templateIndex: 1 };
  }
}

export function clearPendingShareCampaign(): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(KEY_CAMPAIGN);
    localStorage.removeItem(KEY_CAMPAIGN);
    sessionStorage.removeItem(KEY_TEMPLATE);
    localStorage.removeItem(KEY_TEMPLATE);
  } catch {
    /* ignore */
  }
}
