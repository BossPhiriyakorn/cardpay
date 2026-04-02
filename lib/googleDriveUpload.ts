import { Readable } from "node:stream";

import {
  driveImageViewUrl,
  parseDriveFileIdFromViewUrl,
} from "@/lib/drive-image-url";
import { getGoogleDriveClient, getGoogleDriveFolderId, type GoogleDriveFolderType } from "@/lib/googleDrive";

export {
  driveImageThumbnailUrl,
  driveImageViewUrl,
  parseDriveFileIdFromViewUrl,
  parseGoogleDriveFileId,
  resolveDriveImageSrcForPreview,
} from "@/lib/drive-image-url";

/** โฟลเดอร์ย่อยชื่อ = sponsorId (ObjectId) ภายใต้ root ที่ตั้งใน env */
export async function getOrCreateSponsorSubfolder(
  folderType: GoogleDriveFolderType,
  sponsorId: string
): Promise<string> {
  const rootId = getGoogleDriveFolderId(folderType);
  const drive = getGoogleDriveClient();
  const safeName = sponsorId.replace(/'/g, "\\'");
  const q = `'${rootId}' in parents and name='${safeName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const list = await drive.files.list({
    q,
    fields: "files(id)",
    pageSize: 5,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });
  const found = list.data.files?.[0]?.id;
  if (found) return found;

  const created = await drive.files.create({
    requestBody: {
      name: sponsorId,
      mimeType: "application/vnd.google-apps.folder",
      parents: [rootId],
    },
    fields: "id",
    supportsAllDrives: true,
  });
  const id = created.data.id;
  if (!id) throw new Error("Failed to create sponsor folder on Drive");
  return id;
}

async function uploadBufferToFolder(params: {
  parentFolderId: string;
  fileName: string;
  mimeType: string;
  body: Buffer;
  makeAnyoneReader?: boolean;
}): Promise<string> {
  const drive = getGoogleDriveClient();
  const res = await drive.files.create({
    requestBody: {
      name: params.fileName,
      parents: [params.parentFolderId],
    },
    media: {
      mimeType: params.mimeType,
      body: Readable.from(params.body),
    },
    fields: "id",
    supportsAllDrives: true,
  });
  const id = res.data.id;
  if (!id) throw new Error("Drive upload failed");

  if (params.makeAnyoneReader) {
    await drive.permissions.create({
      fileId: id,
      requestBody: { type: "anyone", role: "reader" },
      supportsAllDrives: true,
    });
  }
  return id;
}

export async function updateDriveFileContent(
  fileId: string,
  mimeType: string,
  body: Buffer
): Promise<void> {
  const drive = getGoogleDriveClient();
  await drive.files.update({
    fileId,
    media: { mimeType, body: Readable.from(body) },
    supportsAllDrives: true,
  });
}

export async function deleteDriveFileIfPossible(fileId: string): Promise<void> {
  if (!fileId) return;
  try {
    const drive = getGoogleDriveClient();
    await drive.files.delete({ fileId, supportsAllDrives: true });
  } catch {
    /* ignore */
  }
}

export { uploadBufferToFolder };
