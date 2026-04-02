import { NextResponse } from "next/server";

import { getUserSession } from "@/lib/auth/require-user-session";
import { connectToDatabase } from "@/lib/mongodb";
import {
  deleteDriveFileIfPossible,
  getOrCreateSponsorSubfolder,
  uploadBufferToFolder,
} from "@/lib/googleDriveUpload";
import { notifyAdminsBankVerificationRequested } from "@/lib/line-notify";
import { BankAccount, User } from "@/models";

const MAX_BYTES = 12 * 1024 * 1024; // 12 MB per file
const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

function extFromMime(mime: string): string {
  if (mime === "image/jpeg") return ".jpg";
  if (mime === "image/png") return ".png";
  if (mime === "image/webp") return ".webp";
  if (mime === "application/pdf") return ".pdf";
  return "";
}

async function getSessionUserId(): Promise<string | null> {
  const session = await getUserSession();
  return session?.userId ?? null;
}

/** ผู้ใช้ส่งคำขอผูกบัญชี + อัปโหลดบัตร/สมุด — บันทึก MongoDB และอัปโหลดไปโฟลเดอร์ย่อยตาม userId ใต้ GOOGLE_DRIVE_USER_KYC_FOLDER_ID (ถ้ามี) */
export async function POST(request: Request) {
  const userId = await getSessionUserId();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_multipart" }, { status: 400 });
  }

  const bankName = String(form.get("bankName") ?? "").trim();
  const accountNumber = String(form.get("accountNumber") ?? "").replace(/\D/g, "").trim();
  const accountHolderName = String(form.get("accountName") ?? "").trim();

  if (!bankName || accountNumber.length < 10 || !accountHolderName) {
    return NextResponse.json({ ok: false, error: "invalid_fields" }, { status: 400 });
  }

  const idCard = form.get("idCard");
  const bankBook = form.get("bankBook");
  if (!(idCard instanceof File) || idCard.size === 0) {
    return NextResponse.json({ ok: false, error: "id_card_required" }, { status: 400 });
  }
  if (!(bankBook instanceof File) || bankBook.size === 0) {
    return NextResponse.json({ ok: false, error: "bank_book_required" }, { status: 400 });
  }

  const idMime = (idCard.type || "application/octet-stream").toLowerCase();
  const bookMime = (bankBook.type || "application/octet-stream").toLowerCase();
  if (!ALLOWED_MIME.has(idMime) || !ALLOWED_MIME.has(bookMime)) {
    return NextResponse.json({ ok: false, error: "invalid_file_type" }, { status: 400 });
  }
  if (idCard.size > MAX_BYTES || bankBook.size > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "file_too_large" }, { status: 400 });
  }

  try {
    await connectToDatabase();

    const existing = await BankAccount.findOne({ userId }).select(
      "idCardDriveFileId bankBookDriveFileId"
    );
    if (existing) {
      await deleteDriveFileIfPossible(String(existing.idCardDriveFileId ?? ""));
      await deleteDriveFileIfPossible(String(existing.bankBookDriveFileId ?? ""));
    }

    const folderId = await getOrCreateSponsorSubfolder("user_kyc", userId);
    const idExt = extFromMime(idMime);
    const bookExt = extFromMime(bookMime);

    const idBuf = Buffer.from(await idCard.arrayBuffer());
    const bookBuf = Buffer.from(await bankBook.arrayBuffer());

    const idCardDriveFileId = await uploadBufferToFolder({
      parentFolderId: folderId,
      fileName: `id-card-${Date.now()}${idExt}`,
      mimeType: idMime,
      body: idBuf,
      makeAnyoneReader: true,
    });
    const bankBookDriveFileId = await uploadBufferToFolder({
      parentFolderId: folderId,
      fileName: `bank-book-${Date.now()}${bookExt}`,
      mimeType: bookMime,
      body: bookBuf,
      makeAnyoneReader: true,
    });

    await BankAccount.findOneAndUpdate(
      { userId },
      {
        $set: {
          bankName,
          accountNumber,
          accountHolderName,
          status: "pending",
          idCardDriveFileId,
          bankBookDriveFileId,
          reviewReason: "",
        },
        $unset: { reviewedAt: 1, reviewedBy: 1 },
      },
      { upsert: true, new: true }
    );

    const u = await User.findById(userId).select("name lineDisplayId").lean();
    void notifyAdminsBankVerificationRequested({
      requesterName: String((u as { name?: string } | null)?.name ?? "").trim() || "-",
      requesterLineId: String((u as { lineDisplayId?: string } | null)?.lineDisplayId ?? "").trim(),
      userId,
      bankName,
      accountLast4: accountNumber,
    }).catch((notifyError) => {
      console.error("[api/user/bank-account:admin-notify]", notifyError);
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[api/user/bank-account:post]", e);
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("GOOGLE_SERVICE_ACCOUNT") || msg.includes("Google Drive")) {
      return NextResponse.json({ ok: false, error: "drive_unavailable" }, { status: 503 });
    }
    return NextResponse.json({ ok: false, error: "save_failed" }, { status: 503 });
  }
}
