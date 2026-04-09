import { driveImageProxyUrl, isValidGoogleDriveFileId, parseGoogleDriveFileId } from "@/lib/drive-image-url";
import { downloadDriveFileAsUtf8 } from "@/lib/googleDrive";
import {
  deleteDriveFileIfPossible,
  getOrCreateSponsorSubfolder,
  parseDriveFileIdFromViewUrl,
  updateDriveFileContent,
  uploadBufferToFolder,
} from "@/lib/googleDriveUpload";

export const MAX_FLEX_JSON_BYTES = 1_500_000;
export const MAX_PREVIEW_BYTES = 5_000_000;

const ALLOWED_PREVIEW = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

export function parseAndStringifyFlexJson(text: string): Buffer {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new Error("empty_flex_json");
  }
  let obj: unknown;
  try {
    obj = JSON.parse(trimmed);
  } catch {
    throw new Error("invalid_flex_json");
  }
  const pretty = JSON.stringify(obj, null, 2);
  const buf = Buffer.from(pretty, "utf8");
  if (buf.length > MAX_FLEX_JSON_BYTES) {
    throw new Error("flex_json_too_large");
  }
  return buf;
}

/** สร้างไฟล์ Flex JSON ใหม่ในโฟลเดอร์ของ sponsor */
export async function createFlexJsonOnDrive(
  sponsorId: string,
  campaignId: string,
  jsonBuffer: Buffer
): Promise<string> {
  const folder = await getOrCreateSponsorSubfolder("json", sponsorId);
  const fileName = `flex-${campaignId}.json`;
  return uploadBufferToFolder({
    parentFolderId: folder,
    fileName,
    mimeType: "application/json",
    body: jsonBuffer,
  });
}

/** อัปเดตเนื้อหาไฟล์เดิม ถ้าไม่ได้ให้สร้างไฟล์ใหม่ */
export async function upsertFlexJsonOnDrive(
  sponsorId: string,
  campaignId: string,
  jsonBuffer: Buffer,
  existingFileId: string | undefined
): Promise<string> {
  if (existingFileId) {
    try {
      await updateDriveFileContent(existingFileId, "application/json", jsonBuffer);
      return existingFileId;
    } catch {
      /* สร้างใหม่ */
    }
  }
  return createFlexJsonOnDrive(sponsorId, campaignId, jsonBuffer);
}

export async function uploadPreviewImageOnDrive(params: {
  sponsorId: string;
  campaignId: string;
  buffer: Buffer;
  mimeType: string;
  previousImageUrl?: string;
}): Promise<string> {
  if (!ALLOWED_PREVIEW.has(params.mimeType)) {
    throw new Error("invalid_image_type");
  }
  if (params.buffer.length > MAX_PREVIEW_BYTES) {
    throw new Error("image_too_large");
  }

  const prevId = params.previousImageUrl
    ? parseDriveFileIdFromViewUrl(params.previousImageUrl)
    : null;
  if (prevId) {
    await deleteDriveFileIfPossible(prevId);
  }

  const folder = await getOrCreateSponsorSubfolder("images", params.sponsorId);
  const ext =
    params.mimeType === "image/png"
      ? "png"
      : params.mimeType === "image/webp"
        ? "webp"
        : params.mimeType === "image/gif"
          ? "gif"
          : "jpg";
  const fileName = `preview-${params.campaignId}-${Date.now()}.${ext}`;
  const fileId = await uploadBufferToFolder({
    parentFolderId: folder,
    fileName,
    mimeType: params.mimeType,
    body: params.buffer,
    makeAnyoneReader: true,
  });
  /**
   * คืน proxy URL แทน Drive thumbnail URL โดยตรง
   * LINE server ต้องการ URL ที่คืน Content-Type: image/* ทันที ไม่ผ่าน redirect/HTML
   * drive.google.com/thumbnail ทำให้การ์ดไม่ส่ง/ไม่แสดงใน LINE แม้ picker สำเร็จ
   */
  return driveImageProxyUrl(fileId);
}

function collectDriveFileIdsFromUnknown(value: unknown, out: Set<string>): void {
  if (value === null || value === undefined) return;
  if (typeof value === "string") {
    const id = parseGoogleDriveFileId(value);
    if (id && isValidGoogleDriveFileId(id)) out.add(id);
    return;
  }
  if (Array.isArray(value)) {
    for (const v of value) collectDriveFileIdsFromUnknown(v, out);
    return;
  }
  if (typeof value === "object") {
    for (const v of Object.values(value as Record<string, unknown>)) {
      collectDriveFileIdsFromUnknown(v, out);
    }
  }
}

/** ดึง id จาก URL ที่ฝังในสตริง JSON (กรณี parse เป็น object ไม่ครบทุกจุด) */
function collectDriveFileIdsFromJsonRawText(text: string, out: Set<string>): void {
  const chunks = text.match(/https?:\/\/[^"'\s\\\]]+/gi) ?? [];
  for (const seg of chunks) {
    const id = parseGoogleDriveFileId(seg);
    if (id && isValidGoogleDriveFileId(id)) out.add(id);
  }
}

/**
 * ลบไฟล์ Flex JSON + รูปบน Drive ที่อ้างอิงจากแคมเปญ (best-effort — ไม่ throw)
 * - ดึงเนื้อหาไฟล์ Flex ก่อนลบ เพื่อหา file id ของรูปที่อยู่ใน JSON แต่ไม่อยู่ใน imageUrls
 * - ลบรูป/ไฟล์ที่อ้างอิงก่อน แล้วค่อยลบไฟล์ Flex ท้ายสุด
 */
export async function deleteCampaignDriveFilesBestEffort(params: {
  flexMessageJsonDriveFileId?: string;
  imageUrls?: unknown;
}): Promise<void> {
  const flexRaw = String(params.flexMessageJsonDriveFileId ?? "").trim();
  const flexFileId = flexRaw ? parseGoogleDriveFileId(flexRaw) : null;

  const toDelete = new Set<string>();

  const urls = Array.isArray(params.imageUrls) ? params.imageUrls : [];
  for (const item of urls) {
    const u = String(item ?? "").trim();
    if (!u) continue;
    const fid = parseGoogleDriveFileId(u);
    if (fid && isValidGoogleDriveFileId(fid)) toDelete.add(fid);
  }

  if (flexFileId) {
    try {
      const text = await downloadDriveFileAsUtf8(flexFileId);
      collectDriveFileIdsFromJsonRawText(text, toDelete);
      try {
        const obj = JSON.parse(text) as unknown;
        collectDriveFileIdsFromUnknown(obj, toDelete);
      } catch {
        /* ไม่ใช่ JSON สมบูรณ์ — ใช้ regex ด้านบนอย่างเดียว */
      }
    } catch (e) {
      console.warn("[campaign-drive] download flex JSON before delete failed", flexFileId, e);
    }
  }

  /** ลบไฟล์อื่นก่อน แล้วค่อยลบไฟล์ Flex ท้ายสุด */
  toDelete.delete(flexFileId ?? "");

  for (const fid of toDelete) {
    if (fid && isValidGoogleDriveFileId(fid)) await deleteDriveFileIfPossible(fid);
  }

  if (flexFileId && isValidGoogleDriveFileId(flexFileId)) {
    await deleteDriveFileIfPossible(flexFileId);
  }
}
