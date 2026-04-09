/**
 * แปลง JSON ที่เก็บบน Drive (tectony1 หรือ Flex มาตรฐาน) เป็นรูปแบบที่ liff.shareTargetPicker ใช้ได้
 */

import type { FlexBubble, FlexCarousel, FlexMessage } from "@line/bot-sdk";

export type FlexShareMessage = FlexMessage;

/** ลิงก์ปลอดภัยเมื่อต้องแทนที่ action ที่ LINE ไม่อนุญาตใน share target picker */
const LIFF_SHARE_FALLBACK_URI = "https://line.me/";

function normalizeUriFlexAction(act: unknown): Record<string, unknown> | undefined {
  if (!act || typeof act !== "object") return undefined;
  const a = act as Record<string, unknown>;
  if (a.type !== "uri") return undefined;
  const uri = String(a.uri ?? "").trim();
  if (!uri) return undefined;
  const out: Record<string, unknown> = { type: "uri", uri };
  if (typeof a.label === "string" && a.label.trim()) {
    out.label = a.label.trim().slice(0, 40);
  }
  if (typeof a.altUri === "string" && a.altUri.trim()) {
    out.altUri = a.altUri.trim().slice(0, 1000);
  }
  return out;
}

/** รองรับ JSON จากเทมเพลตที่พิมพ์ type ไม่ตรงมาตรฐาน — ถ้าไม่ถือว่าเป็นปุ่ม จะถูกลบ postback/message action แล้วปุ่มจะไม่ valid */
function isFlexButtonNode(o: Record<string, unknown>): boolean {
  const t = o.type;
  return t === "button" || (typeof t === "string" && t.trim().toLowerCase() === "button");
}

/** ปุ่ม Flex ต้องมี action — ถ้าไม่ใช่ uri ให้แทนที่ด้วย uri ปลอดภัย */
function coerceRequiredButtonAction(act: unknown): Record<string, unknown> {
  const ok = normalizeUriFlexAction(act);
  if (ok) {
    /** Share Target Picker บางเวอร์ชัน/เทมเพลตถ้า uri ไม่มี label อาจไม่ส่งการ์ด — เติมเมื่อว่าง */
    if (!ok.label || !String(ok.label).trim()) {
      ok.label = "เปิด";
    }
    return ok;
  }
  const prev = act && typeof act === "object" ? (act as Record<string, unknown>) : {};
  const label =
    typeof prev.label === "string" && prev.label.trim()
      ? prev.label.trim().slice(0, 40)
      : "เปิด";
  return { type: "uri", uri: LIFF_SHARE_FALLBACK_URI, label };
}

/**
 * เตรียม Flex สำหรับ liff.shareTargetPicker / sendMessages
 * - เสมอ: ลบ quickReply / sender / quote* ระดับข้อความ (LIFF share มักไม่รองรับ)
 * - walk contents: บังคับปุ่มเป็น uri + label, แก้ action ที่ไม่ใช่ uri — จำเป็นทั้งเทมเพลต uri ล้วน (เดิมข้าม walk ทำให้ label ปุ่มว่างไม่ถูกเติม)
 */
export function prepareFlexMessageForShareTargetPicker(msg: FlexShareMessage): FlexShareMessage {
  const raw = JSON.parse(JSON.stringify(msg)) as Record<string, unknown>;
  delete raw.quickReply;
  delete raw.sender;
  delete raw.quoteToken;
  delete raw.quoteText;

  function walkCoerce(node: unknown): void {
    if (node === null || node === undefined) return;
    if (Array.isArray(node)) {
      for (const item of node) walkCoerce(item);
      return;
    }
    if (typeof node !== "object") return;
    const o = node as Record<string, unknown>;

    if (isFlexButtonNode(o)) {
      o.type = "button";
      o.action = coerceRequiredButtonAction(o.action);
    } else {
      if ("action" in o && o.action !== undefined) {
        const fixed = normalizeUriFlexAction(o.action);
        if (fixed) o.action = fixed;
        else delete o.action;
      }
      if ("defaultAction" in o && o.defaultAction !== undefined) {
        const fixed = normalizeUriFlexAction(o.defaultAction);
        if (fixed) o.defaultAction = fixed;
        else delete o.defaultAction;
      }
    }

    for (const v of Object.values(o)) walkCoerce(v);
  }

  /**
   * เดิม walk เฉพาะเมื่อมี action ไม่ใช่ uri — แต่เทมเพลตที่เป็น URI ล้วนจะไม่ถูก walk
   * ทำให้ปุ่มที่ label ว่าง (หรือโดนแทนที่เป็นสตริงว่าง) ไม่ถูก coerceRequiredButtonAction
   * ซึ่ง LIFF shareTargetPicker บางเวอร์ชัน/แพลตฟอร์มจะส่งสำเร็จแต่การ์ดไม่ไปแชท
   */
  if (raw.type === "flex" && raw.contents) {
    walkCoerce(raw.contents);
  }

  return raw as FlexShareMessage;
}

/**
 * ประกอบ Flex แบบเดียวกับ line_flex_tem Share.jsx: shallow copy ที่ระดับ bubble/carousel แล้วค่อย sanitize
 * (ไม่ deep-clone ทั้ง contents ก่อน — ลดความต่างจากโปรเจกต์อ้างอิงที่แชร์ได้)
 */
export function buildFlexShareMessageForLiff(
  normalized: FlexShareMessage
): FlexShareMessage {
  const c = normalized.contents as unknown;
  if (!c || typeof c !== "object" || Array.isArray(c)) {
    return normalized;
  }
  return {
    type: "flex",
    altText: normalized.altText,
    contents: { ...(c as Record<string, unknown>) },
  } as FlexShareMessage;
}

const UNFILLED_PLACEHOLDER_RE = /\{\{[a-zA-Z_][a-zA-Z0-9_]*\}\}/;

function assertFlexTreeNoEmptyImageUrls(node: unknown): void {
  if (node === null || node === undefined) return;
  if (Array.isArray(node)) {
    for (const item of node) assertFlexTreeNoEmptyImageUrls(item);
    return;
  }
  if (typeof node !== "object") return;
  const o = node as Record<string, unknown>;
  const t = o.type;
  if (t === "image" || (typeof t === "string" && t.trim().toLowerCase() === "image")) {
    const url = String(o.url ?? "").trim();
    if (!url) {
      throw new Error(
        "รูปบนการ์ดมี URL ว่าง — อัปโหลดรูปแคมเปญหรือตรวจว่า {{card_image}} ถูกแทนที่แล้ว"
      );
    }
    if (!/^https:\/\//i.test(url)) {
      throw new Error(
        "URL รูปต้องเป็น https:// — ตรวจลิงก์รูปที่บันทึกในแคมเปญ (LINE ไม่รองรับ http/รูปแบบอื่นสำหรับ hero)"
      );
    }
  }
  for (const v of Object.values(o)) assertFlexTreeNoEmptyImageUrls(v);
}

/** ตรวจก่อน liff.shareTargetPicker — ลดกรณี LINE แสดงสำเร็จแต่การ์ดไม่ถูกส่ง/ว่าง */
export function assertFlexShareMessageReady(msg: FlexShareMessage): void {
  if (!msg || msg.type !== "flex") {
    throw new Error("ข้อมูลการ์ดไม่ครบ — ไม่ใช่ Flex message");
  }
  const alt = String(msg.altText ?? "").trim();
  if (!alt) {
    throw new Error("ไม่มีข้อความแจ้งเตือน (altText) สำหรับการ์ด");
  }
  const c = msg.contents as unknown;
  if (!c || typeof c !== "object") {
    throw new Error("โครงการ์ด (contents) ไม่ถูกต้อง");
  }

  try {
    const serialized = JSON.stringify(msg);
    if (UNFILLED_PLACEHOLDER_RE.test(serialized)) {
      throw new Error(
        "ใน JSON การ์ดยังมี {{placeholder}} ไม่ครบ — ตรวจเทมเพลต/ข้อมูลแคมเปญแล้วสร้างการ์ดใหม่"
      );
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("placeholder")) throw e;
    /* circular / stringify edge — ข้ามการตรวจ placeholder */
  }

  assertFlexTreeNoEmptyImageUrls(c);
}

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
