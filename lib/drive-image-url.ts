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

export function parseDriveFileIdFromViewUrl(url: string): string | null {
  const m = /[?&]id=([^&]+)/.exec(url.trim());
  return m?.[1] ? decodeURIComponent(m[1]) : null;
}

/** ดึง file id จากลิงก์ Drive หลายรูปแบบ หรือค่าที่บันทึกเป็นแค่ id */
export function parseGoogleDriveFileId(input: string): string | null {
  const t = input.trim();
  if (!t) return null;
  if (t.startsWith("blob:") || t.startsWith("data:")) return null;
  const fromQuery = parseDriveFileIdFromViewUrl(t);
  if (fromQuery) return fromQuery;
  const open = /\/open\?id=([a-zA-Z0-9_-]+)/.exec(t);
  if (open?.[1]) return open[1];
  const fileD = /\/file\/d\/([a-zA-Z0-9_-]+)/.exec(t);
  if (fileD?.[1]) return fileD[1];
  if (/^[a-zA-Z0-9_-]+$/.test(t) && t.length >= 20 && t.length <= 128) return t;
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
