import { NextResponse } from "next/server";
import mongoose from "mongoose";

import { downloadDriveFileAsUtf8 } from "@/lib/googleDrive";
import { connectToDatabase } from "@/lib/mongodb";
import Campaign from "@/models/Campaign";

export const dynamic = "force-dynamic";

/**
 * ดึง JSON Flex ของแคมเปญจาก Google Drive ตาม flexMessageJsonDriveFileId
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ campaignId: string }> }
) {
  try {
    const { campaignId } = await context.params;
    if (!mongoose.Types.ObjectId.isValid(campaignId)) {
      return NextResponse.json({ error: "Invalid campaign id" }, { status: 400 });
    }

    await connectToDatabase();
    const campaign = await Campaign.findById(campaignId).lean();
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    const fileId = String(campaign.flexMessageJsonDriveFileId ?? "").trim();
    if (!fileId) {
      return NextResponse.json(
        { error: "Campaign has no flexMessageJsonDriveFileId" },
        { status: 404 }
      );
    }

    const text = await downloadDriveFileAsUtf8(fileId);
    let payload: unknown;
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      return NextResponse.json({ error: "Flex JSON file is not valid JSON" }, { status: 502 });
    }

    const shareAltText = String(
      (campaign as { shareAltText?: string }).shareAltText ?? ""
    ).trim();

    return NextResponse.json({
      success: true,
      payload,
      ...(shareAltText ? { shareAltText } : {}),
    });
  } catch (e) {
    console.error("[flex-json]", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    if (
      msg.includes("Missing GOOGLE_SERVICE_ACCOUNT_FILE") ||
      msg.includes("Google service account file not found")
    ) {
      return NextResponse.json(
        { error: "Google Drive is not configured on the server" },
        { status: 503 }
      );
    }
    if (msg.includes("File not found") || msg.includes("404")) {
      return NextResponse.json({ error: "Flex JSON file not found on Drive" }, { status: 404 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
