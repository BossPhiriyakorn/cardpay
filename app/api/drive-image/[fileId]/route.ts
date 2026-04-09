import { NextResponse } from "next/server";

import { getGoogleDriveClient } from "@/lib/googleDrive";
import { isValidGoogleDriveFileId } from "@/lib/drive-image-url";

export const dynamic = "force-dynamic";

const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

const CACHE_MAX_AGE = 60 * 60 * 24 * 7; // 7 วัน

/**
 * Proxy รูปจาก Google Drive — ให้ LINE Flex hero.url ชี้มาที่นี่แทน Drive URL ตรง
 * GET /api/drive-image/{fileId}
 *
 * LINE server ต้องการ URL รูปที่คืน Content-Type: image/* ทันทีโดยไม่ redirect/HTML
 * drive.google.com/thumbnail หรือ uc?export=view มักได้ HTML หรือ redirect หลายชั้น
 * จึงต้องผ่าน proxy นี้เพื่อให้ LINE และแอปโหลดได้เสมอ
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ fileId: string }> }
) {
  try {
    const { fileId } = await context.params;

    if (!fileId || !isValidGoogleDriveFileId(fileId)) {
      return new NextResponse("Invalid file id", { status: 400 });
    }

    const drive = getGoogleDriveClient();

    const meta = await drive.files.get({
      fileId,
      fields: "mimeType,size",
      supportsAllDrives: true,
    });

    const mimeType = meta.data.mimeType ?? "image/jpeg";

    if (!ALLOWED_MIME.has(mimeType)) {
      return new NextResponse("Not an image", { status: 415 });
    }

    const res = await drive.files.get(
      { fileId, alt: "media", supportsAllDrives: true },
      { responseType: "arraybuffer" }
    );

    const buf = Buffer.from(res.data as ArrayBuffer);

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(buf.length),
        "Cache-Control": `public, max-age=${CACHE_MAX_AGE}, immutable`,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (
      msg.includes("File not found") ||
      msg.includes("404") ||
      (e as { code?: number })?.code === 404
    ) {
      return new NextResponse("Image not found", { status: 404 });
    }
    console.error("[drive-image proxy]", e);
    return new NextResponse("Error fetching image", { status: 502 });
  }
}
