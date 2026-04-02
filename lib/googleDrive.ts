import fs from "node:fs";
import path from "node:path";

import { google } from "googleapis";

type ServiceAccountCredentials = {
  client_email: string;
  private_key: string;
};

export type GoogleDriveFolderType = "images" | "json" | "user_kyc";

function getServiceAccountCredentials(): ServiceAccountCredentials {
  const fileName = process.env.GOOGLE_SERVICE_ACCOUNT_FILE;

  if (!fileName) {
    throw new Error("Missing GOOGLE_SERVICE_ACCOUNT_FILE in environment variables");
  }

  const filePath = path.join(process.cwd(), fileName);

  if (!fs.existsSync(filePath)) {
    throw new Error(`Google service account file not found at: ${filePath}`);
  }

  const fileContent = fs.readFileSync(filePath, "utf8");
  const parsed = JSON.parse(fileContent) as {
    client_email?: string;
    private_key?: string;
  };

  if (!parsed.client_email || !parsed.private_key) {
    throw new Error("Invalid Google service account JSON: missing client_email/private_key");
  }

  return {
    client_email: parsed.client_email,
    private_key: parsed.private_key,
  };
}

export function getGoogleDriveClient() {
  const credentials = getServiceAccountCredentials();

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });

  return google.drive({ version: "v3", auth });
}

export function getGoogleDriveFolderId(folderType: GoogleDriveFolderType): string {
  const imageFolderId = process.env.GOOGLE_DRIVE_IMAGE_FOLDER_ID;
  const jsonFolderId = process.env.GOOGLE_DRIVE_JSON_FOLDER_ID;
  const userKycFolderId = process.env.GOOGLE_DRIVE_USER_KYC_FOLDER_ID;
  const fallbackFolderId = process.env.GOOGLE_DRIVE_FOLDER_ID;

  const folderId =
    folderType === "images"
      ? imageFolderId
      : folderType === "json"
        ? jsonFolderId
        : userKycFolderId;

  if (folderId) {
    return folderId;
  }

  if (fallbackFolderId) {
    return fallbackFolderId;
  }

  throw new Error(
    `Missing Google Drive folder ID for "${folderType}". Set GOOGLE_DRIVE_${folderType.toUpperCase()}_FOLDER_ID or GOOGLE_DRIVE_FOLDER_ID.`
  );
}

/** ดึงเนื้อหาไฟล์จาก Drive เป็น UTF-8 (ใช้กับไฟล์ JSON Flex ที่อ้างอิงด้วย fileId) */
export async function downloadDriveFileAsUtf8(fileId: string): Promise<string> {
  const drive = getGoogleDriveClient();
  const res = await drive.files.get(
    {
      fileId,
      alt: "media",
      supportsAllDrives: true,
    },
    { responseType: "arraybuffer" }
  );
  const data = res.data as ArrayBuffer | string | undefined;
  if (data == null) {
    throw new Error("Empty response from Google Drive");
  }
  const buf = Buffer.isBuffer(data)
    ? data
    : typeof data === "string"
      ? Buffer.from(data, "utf8")
      : Buffer.from(new Uint8Array(data));
  return buf.toString("utf8");
}
