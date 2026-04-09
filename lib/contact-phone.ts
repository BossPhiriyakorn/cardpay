/**
 * แปลงค่าจากฟอร์มให้เก็บเป็น URI สำหรับปุ่มโทรบน Flex
 * - ว่าง → ""
 * - ขึ้นต้น tel: → คงรูปแบบ (รองรับ CMS / ข้อมูลเดิม)
 * - ตัวเลขพอดี 10 หลัก (เช่น 0812345678) → tel:+66812345678
 */
export function normalizeContactPhoneForStorage(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (/^tel:/i.test(t)) return t;
  if (/^\d{10}$/.test(t)) {
    return `tel:+66${t.slice(1)}`;
  }
  return t;
}

/**
 * แปลง URI ลิงก์ติดต่อ / ลิงก์ทั่วไปให้ LINE Flex รองรับ
 * LINE Flex message ต้องการ URI ที่มี scheme เสมอ เช่น https:// / http:// / tel: / line://
 * ถ้าไม่มี scheme → LINE จะ reject ทั้งการ์ดแบบ silent (ขึ้นสำเร็จแต่ไม่มีอะไรส่งไป)
 *
 * กรณีที่รองรับ:
 * - "www.facebook.com/xxx" → "https://www.facebook.com/xxx"
 * - "facebook.com/xxx"     → "https://facebook.com/xxx"
 * - "m.me/xxx"             → "https://m.me/xxx"
 * - "line.me/xxx"          → "https://line.me/xxx"
 * - "http://..."           → คงเดิม
 * - "https://..."          → คงเดิม
 * - "tel:..."              → คงเดิม
 * - "line://..."           → คงเดิม
 * - ""                     → ""
 */
export function normalizeContactLinkUri(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (/^(https?|tel|line|mailto):\/?\/?/i.test(t)) return t;
  if (/^www\./i.test(t)) return `https://${t}`;
  if (/^[a-zA-Z0-9][\w.-]+\.[a-zA-Z]{2,}(\/|$)/.test(t)) return `https://${t}`;
  return t;
}

/**
 * แปลง URI ทุกชนิดที่จะฝังใน Flex JSON ให้ LINE รับได้
 * ครอบคลุมทั้ง phone + link + อื่นๆ
 */
export function normalizeFlexActionUri(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  if (/^tel:/i.test(t)) return t;
  if (/^\d{10}$/.test(t)) return `tel:+66${t.slice(1)}`;
  return normalizeContactLinkUri(t);
}
