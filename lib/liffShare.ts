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

/**
 * บังคับให้ลิงก์ LIFF ใน payload ตรงกับ campaignId ของคำขอ
 * (แก้เทมเพลตที่ค้างรหัสแคมเปญเก่า / ไม่ได้แทนที่ลิงก์ตอนสร้าง — ทำให้ record-share ไปคนละแคมเปญกับที่สปอนเซอร์ดูในแดชบอร์ด)
 */
export function rewriteLiffShareUriForCampaign(uri: string, campaignId: string): string {
  const s = uri.trim();
  if (!s.includes("liff.line.me")) return uri;
  const includesShare = liffEndpointAlreadyIncludesSharePath();
  const encoded = encodeURIComponent(campaignId);
  const shareSeg = liffPathAfterId();
  try {
    const u = new URL(s);
    if (u.hostname !== "liff.line.me") return uri;
    const parts = u.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return uri;
    if (includesShare) {
      parts[parts.length - 1] = encoded;
    } else {
      const si = parts.indexOf(shareSeg);
      if (si >= 0 && si + 1 < parts.length) {
        parts[si + 1] = encoded;
      } else if (parts.length >= 2) {
        const liff = parts[0];
        parts.length = 0;
        parts.push(liff, shareSeg, encoded);
      }
    }
    u.pathname = "/" + parts.join("/");
    return u.toString();
  } catch {
    return uri;
  }
}

/** แก้ทุกสตริงในโครง Flex ที่เป็นลิงก์ liff.line.me */
export function rewriteFlexPayloadLiffCampaignIdsDeep(
  value: unknown,
  campaignId: string
): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    return rewriteLiffShareUriForCampaign(value, campaignId);
  }
  if (Array.isArray(value)) {
    return value.map((item) => rewriteFlexPayloadLiffCampaignIdsDeep(item, campaignId));
  }
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o)) {
      out[k] = rewriteFlexPayloadLiffCampaignIdsDeep(v, campaignId);
    }
    return out;
  }
  return value;
}
