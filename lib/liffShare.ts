/**
 * สร้างลิงก์ LIFF สำหรับแชร์แคมเปญ (CMS / template {liff_url} / ปุ่มแชร์ในแอป)
 *
 * ต้องเปิดผ่าน https://liff.line.me/{LIFF_ID}/... เพื่อให้ LINE ส่ง LIFF context
 * (liff.isInClient() = true) — การ client-side ไป /share อย่างเดียวจากหน้าอื่นใน WebView
 * บางเครื่อง/เวอร์ชันจะได้ isInClient = false
 */

/**
 * path หลัง LIFF ID (ก่อน campaignId) — ใช้เมื่อ Endpoint URL ใน LINE เป็นรากโดเมน เช่น https://domain.com
 * จะได้ลิงก์ …/liffId/share/{campaignId} → เปิดที่ /share/[campaignId]
 */
function liffPathAfterId(): string {
  const raw = process.env.NEXT_PUBLIC_LIFF_APP_PATH?.trim() || "share";
  const s = raw.replace(/^\/+/, "").replace(/\/+$/, "");
  return s || "share";
}

/** Endpoint URL ลงท้ายด้วย /share แล้ว — ไม่ใส่ segment "share" ซ้ำในลิงก์ LIFF */
function liffEndpointAlreadyIncludesSharePath(): boolean {
  return process.env.NEXT_PUBLIC_LIFF_ENDPOINT_INCLUDES_SHARE === "1";
}

export type BuildCampaignShareLiffUrlOptions = {
  /**
   * ส่งจาก /api/liff/config (runtime) — ใช้เมื่อ client bundle ถูก build โดยไม่มี env หรือค่าไม่ตรง production
   */
  endpointIncludesShare?: boolean;
};

/**
 * ลิงก์ที่ควรใช้เมื่อกดแชร์จากในแอป / ส่งต่อใน LINE
 * - Endpoint ราก: https://liff.line.me/{liffId}/share/{campaignId}?id=
 * - Endpoint ลงท้าย /share: ตั้ง NEXT_PUBLIC_LIFF_ENDPOINT_INCLUDES_SHARE=1 → …/{liffId}/{campaignId}?id=
 * ลิงก์แบบ ?campaignId= ยังใช้ได้ที่ /share
 */
export function buildCampaignShareLiffUrl(
  liffId: string,
  campaignId: string,
  templateIndex = 1,
  options?: BuildCampaignShareLiffUrlOptions
): string {
  const encoded = encodeURIComponent(campaignId);
  const includesShare =
    options?.endpointIncludesShare ?? liffEndpointAlreadyIncludesSharePath();
  const pathPart = includesShare
    ? encoded
    : `${liffPathAfterId()}/${encoded}`;
  const u = new URL(`https://liff.line.me/${liffId}/${pathPart}`);
  u.searchParams.set("id", String(templateIndex));
  return u.toString();
}
