/**
 * แปลง JSON ที่เก็บบน Drive (tectony1 หรือ Flex มาตรฐาน) เป็นรูปแบบที่ liff.shareTargetPicker ใช้ได้
 */

import type { FlexBubble, FlexCarousel, FlexMessage } from "@line/bot-sdk";

export type FlexShareMessage = FlexMessage;

function isBubbleOrCarousel(v: unknown): v is FlexBubble | FlexCarousel {
  if (!v || typeof v !== "object") return false;
  const t = (v as { type?: unknown }).type;
  return t === "bubble" || t === "carousel";
}

/**
 * @param raw — วัตถุที่ parse จาก JSON
 * @param templateIndex — ตรงกับ query `id` ใน LIFF (ค่าเริ่มต้น 1) — index ใน tectony1 สำหรับ bubble/carousel
 * @param altTextOverride — ถ้ากรอก จะใช้เป็น altText แทนค่าจาก JSON (เช่น จากฟิลด์แคมเปญ shareAltText)
 */
export function normalizeFlexForShare(
  raw: unknown,
  templateIndex: number,
  altTextOverride?: string | null
): FlexShareMessage {
  const override =
    typeof altTextOverride === "string" && altTextOverride.trim().length > 0
      ? altTextOverride.trim().slice(0, 400)
      : null;

  const finalize = (msg: FlexShareMessage): FlexShareMessage =>
    override ? { ...msg, altText: override } : msg;

  if (!raw || typeof raw !== "object") {
    throw new Error("Flex JSON ไม่ถูกต้อง: ต้องเป็น object");
  }
  const obj = raw as Record<string, unknown>;

  if (obj.type === "flex" && isBubbleOrCarousel(obj.contents)) {
    return finalize({
      type: "flex",
      altText:
        typeof obj.altText === "string" && obj.altText.length > 0
          ? obj.altText.slice(0, 400)
          : "Flex Message",
      contents: obj.contents,
    });
  }

  const tectony = obj.tectony1;
  if (Array.isArray(tectony) && tectony.length >= 2) {
    const meta = tectony[0];
    const altFromMeta =
      meta && typeof meta === "object" && typeof (meta as { linemsg?: unknown }).linemsg === "string"
        ? String((meta as { linemsg: string }).linemsg).slice(0, 400)
        : "Flex Message";

    let idx =
      Number.isFinite(templateIndex) && templateIndex >= 0
        ? Math.min(Math.floor(templateIndex), tectony.length - 1)
        : 1;
    if (idx === 0) {
      idx = 1;
    }
    let picked = tectony[idx];
    if (!isBubbleOrCarousel(picked) && tectony.length > 1) {
      picked = tectony[1];
    }
    if (!isBubbleOrCarousel(picked)) {
      throw new Error(
        "Flex JSON (tectony1): ต้องมี bubble หรือ carousel ที่ index ≥ 1"
      );
    }
    return finalize({
      type: "flex",
      altText: altFromMeta,
      contents: picked,
    });
  }

  if (isBubbleOrCarousel(obj)) {
    return finalize({
      type: "flex",
      altText: "Flex Message",
      contents: obj,
    });
  }

  throw new Error(
    "ไม่รู้จักรูปแบบ Flex JSON — ใช้ tectony1[], { type, altText, contents } หรือ bubble/carousel ที่ราก"
  );
}
