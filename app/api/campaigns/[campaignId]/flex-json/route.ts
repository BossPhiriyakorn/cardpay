import { NextResponse } from "next/server";
import mongoose from "mongoose";

import { buildCampaignFlexBubbleMessage, canBuildInlineFlexCampaign } from "@/lib/build-campaign-flex-bubble";
import { normalizeContactLinkUri } from "@/lib/contact-phone";
import { rewriteGoogleDriveFlexImageUrlsDeep } from "@/lib/drive-image-url";
import { rewriteFlexPayloadLiffCampaignIdsDeep } from "@/lib/liffShare";
import { downloadDriveFileAsUtf8 } from "@/lib/googleDrive";
import { connectToDatabase } from "@/lib/mongodb";
import Campaign from "@/models/Campaign";

export const dynamic = "force-dynamic";

/**
 * แก้ URI ที่ไม่มี scheme (เช่น www.facebook.com) ในทุก action.uri ของ Flex JSON
 * LINE Flex จะ silent-reject ทั้งการ์ดถ้ามี URI ที่ไม่มี scheme แม้แค่ตัวเดียว
 */
function fixFlexActionUrisDeep(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(fixFlexActionUrisDeep);
  if (typeof value !== "object") return value;
  const o = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) {
    if (k === "uri" && typeof v === "string") {
      out[k] = normalizeContactLinkUri(v);
    } else {
      out[k] = fixFlexActionUrisDeep(v);
    }
  }
  return out;
}

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

    const campaignStatus = String((campaign as { status?: string }).status ?? "active");
    if (campaignStatus !== "active") {
      return NextResponse.json(
        { error: "Campaign is not available for sharing" },
        { status: 403 }
      );
    }

    const fileId = String(campaign.flexMessageJsonDriveFileId ?? "").trim();
    const campaignData = campaign as { shareAltText?: string; name?: string };
    // ใช้ shareAltText → ชื่อแคมเปญ → "Flex Message" ตามลำดับ (altText ว่างทำให้ LINE อาจ reject)
    const shareAltText = (
      String(campaignData.shareAltText ?? "").trim() ||
      String(campaignData.name ?? "").trim().slice(0, 400)
    );

    if (!fileId) {
      const c = campaign as {
        shareHeadline?: string;
        shareBody?: string;
        name?: string;
        description?: string;
        imageUrls?: string[];
        contactPhoneUri?: string;
        contactChannelUri?: string;
      };
      if (!canBuildInlineFlexCampaign(c)) {
        return NextResponse.json(
          { error: "Campaign has no flex JSON and not enough fields for built-in card" },
          { status: 404 }
        );
      }
      const msg = buildCampaignFlexBubbleMessage(c);
      const withImages = rewriteGoogleDriveFlexImageUrlsDeep(msg);
      const withFixedUris = fixFlexActionUrisDeep(withImages);
      return NextResponse.json({
        success: true,
        payload: rewriteFlexPayloadLiffCampaignIdsDeep(withFixedUris, campaignId),
        ...(shareAltText ? { shareAltText } : {}),
      });
    }

    const textRaw = await downloadDriveFileAsUtf8(fileId);
    const text = textRaw.replace(/^\uFEFF/, "");
    let payload: unknown;
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      return NextResponse.json({ error: "Flex JSON file is not valid JSON" }, { status: 502 });
    }

    const withImages = rewriteGoogleDriveFlexImageUrlsDeep(payload);
    const withFixedUris = fixFlexActionUrisDeep(withImages);
    return NextResponse.json({
      success: true,
      payload: rewriteFlexPayloadLiffCampaignIdsDeep(withFixedUris, campaignId),
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
