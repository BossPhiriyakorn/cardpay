import {
  deleteDriveFileIfPossible,
  driveImageViewUrl,
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
  return driveImageViewUrl(fileId);
}
