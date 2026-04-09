/**
 * แปลงลิงก์/รหัส Google Drive เป็น URL สำหรับ <img> — ไม่มี dependency ฝั่ง Node
 * (ใช้ใน client components ได้; อย่า import จากไฟล์ที่ดึง googleapis)
 */

export function driveImageViewUrl(fileId: string): string {
  return `https://drive.google.com/uc?export=view&id=${fileId}`;
}

/** แสดงรูปใน <img> — thumbnail มักใช้งานได้ดีกว่า uc?export=view ที่มักได้ HTML/redirect */
export function driveImageThumbnailUrl(fileId: string, maxWidth = 1600): string {
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w${maxWidth}`;
}

/**
 * Proxy URL สำหรับ LINE Flex hero.url — ใช้แทน Drive URL ตรงทุกรูปแบบ
 * LINE server ต้องการ URL ที่คืน Content-Type: image/* ทันทีโดยไม่ redirect/HTML
 * drive.google.com/thumbnail และ uc?export=view มักได้ HTML/redirect ทำให้การ์ดไม่แสดง
 *
 * APP_URL ต้องเป็น https:// ที่ LINE เรียกได้ (ไม่ใช่ localhost)
 */
export function driveImageProxyUrl(fileId: string): string {
  const base = (process.env.APP_URL ?? process.env.NEXTAUTH_URL ?? "").replace(/\/+$/, "");
  return `${base}/api/drive-image/${encodeURIComponent(fileId)}`;
}

export function parseDriveFileIdFromViewUrl(url: string): string | null {
  const m = /[?&]id=([^&]+)/.exec(url.trim());
  return m?.[1] ? decodeURIComponent(m[1]) : null;
}

/**
 * ตรวจว่าเป็นค่า file id ของ Google Drive ที่น่าเชื่อถือ (กรอง false positive เช่น ?id=1 หรือตัวเลขยาวจาก LINE)
 */
export function isValidGoogleDriveFileId(id: string): boolean {
  const t = id.trim();
  if (!t) return false;
  if (t.length < 20 || t.length > 128) return false;
  if (!/^[a-zA-Z0-9_-]+$/.test(t)) return false;
  if (/^\d+$/.test(t)) return false;
  return true;
}

/** ดึง file id จากลิงก์ Drive หลายรูปแบบ หรือค่าที่บันทึกเป็นแค่ id */
export function parseGoogleDriveFileId(input: string): string | null {
  const t = input.trim();
  if (!t) return null;
  if (t.startsWith("blob:") || t.startsWith("data:")) return null;
  const fromQuery = parseDriveFileIdFromViewUrl(t);
  if (fromQuery && isValidGoogleDriveFileId(fromQuery)) return fromQuery.trim();
  const open = /\/open\?id=([a-zA-Z0-9_-]+)/.exec(t);
  if (open?.[1] && isValidGoogleDriveFileId(open[1])) return open[1];
  const fileD = /\/file\/d\/([a-zA-Z0-9_-]+)/.exec(t);
  if (fileD?.[1] && isValidGoogleDriveFileId(fileD[1])) return fileD[1];
  if (/^[a-zA-Z0-9_-]+$/.test(t) && isValidGoogleDriveFileId(t)) return t;
  return null;
}

/**
 * ค่าที่เก็บใน imageUrls หรือ blob: สำหรับพรีวิว — คืน src ที่เหมาะกับแท็ก img
 */
export function resolveDriveImageSrcForPreview(stored: string): string {
  const t = stored.trim();
  if (!t) return t;
  if (t.startsWith("blob:") || t.startsWith("data:")) return t;
  if (!/^https?:\/\//i.test(t)) {
    const id = parseGoogleDriveFileId(t);
    if (id) return driveImageThumbnailUrl(id);
    return t;
  }
  const lower = t.toLowerCase();
  if (lower.includes("drive.google.com") || lower.includes("googleusercontent.com")) {
    const id = parseGoogleDriveFileId(t);
    if (id) return driveImageThumbnailUrl(id);
  }
  return t;
}

/**
 * แปลง Drive URL ทุกรูปแบบ → proxy URL ของเซิร์ฟเวอร์เราเพื่อให้ LINE โหลดรูปได้เสมอ
 * - drive.google.com/uc?...&id=xxx → /api/drive-image/xxx
 * - drive.google.com/thumbnail?id=xxx → /api/drive-image/xxx
 * - drive.google.com/file/d/xxx → /api/drive-image/xxx
 * LINE server ต้องการ URL ที่คืน Content-Type: image/* ทันทีโดยไม่ redirect/HTML
 */
export function rewriteGoogleDriveImageUrlForLineClients(url: string): string {
  const t = url.trim();
  if (!t || !/^https?:\/\//i.test(t)) return t;
  const lower = t.toLowerCase();
  if (!lower.includes("drive.google.com")) return t;
  const id = parseGoogleDriveFileId(t);
  if (!id) return t;
  return driveImageProxyUrl(id);
}

/** แทนที่ URL รูป Drive แบบ uc ในทุกสตริงของโครง Flex (JSON จาก Drive / template) */
export function rewriteGoogleDriveFlexImageUrlsDeep(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    return rewriteGoogleDriveImageUrlForLineClients(value);
  }
  if (Array.isArray(value)) {
    return value.map((item) => rewriteGoogleDriveFlexImageUrlsDeep(item));
  }
  if (typeof value === "object") {
    const o = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(o)) {
      out[k] = rewriteGoogleDriveFlexImageUrlsDeep(v);
    }
    return out;
  }
  return value;
}
