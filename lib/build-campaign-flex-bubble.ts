/**
 * สร้าง Flex Message แบบ bubble ง่าย ๆ เมื่อไม่มี JSON บน Drive
 */

import { rewriteGoogleDriveImageUrlForLineClients } from "@/lib/drive-image-url";

export type CampaignFlexSource = {
  shareAltText?: string;
  shareHeadline?: string;
  shareBody?: string;
  name?: string;
  description?: string;
  imageUrls?: string[];
  contactPhoneUri?: string;
  contactChannelUri?: string;
};

/** ป้ายปุ่ม URI ใน footer (ถ้าไม่ส่ง ใช้ "โทรศัพท์" / "ช่องทางติดต่อ") */
export type FlexBubbleButtonLabels = {
  primary?: string;
  secondary?: string;
};

export function canBuildInlineFlexCampaign(campaign: CampaignFlexSource): boolean {
  const img = String(campaign.imageUrls?.[0] ?? "").trim();
  const h = String(campaign.shareHeadline ?? campaign.name ?? "").trim();
  const b = String(campaign.shareBody ?? campaign.description ?? "").trim();
  const p = String(campaign.contactPhoneUri ?? "").trim();
  const c = String(campaign.contactChannelUri ?? "").trim();
  return Boolean(img || h || b || p || c);
}

/** คืน wrapper แบบเดียวกับที่ normalizeFlexForShare คาดหวัง (type flex + contents bubble) */
export function buildCampaignFlexBubbleMessage(
  campaign: CampaignFlexSource,
  buttonLabels?: FlexBubbleButtonLabels
): {
  type: "flex";
  altText: string;
  contents: Record<string, unknown>;
} {
  const headline =
    String(campaign.shareHeadline ?? "").trim() || String(campaign.name ?? "").trim() || "แคมเปญ";
  const body =
    String(campaign.shareBody ?? "").trim() ||
    String(campaign.description ?? "").trim() ||
    "แตะด้านล่างเพื่อติดต่อ";
  const altFromField = String(campaign.shareAltText ?? "").trim();
  const altText = (altFromField || headline).slice(0, 400);

  const imageUrl = rewriteGoogleDriveImageUrlForLineClients(
    String(campaign.imageUrls?.[0] ?? "").trim(),
  );
  const phone = String(campaign.contactPhoneUri ?? "").trim();
  const channel = String(campaign.contactChannelUri ?? "").trim();

  const hero = imageUrl
    ? {
        type: "image",
        url: imageUrl,
        size: "full",
        aspectRatio: "20:13",
        aspectMode: "cover",
      }
    : null;

  const footerContents: Record<string, unknown>[] = [];
  const primaryLabel = String(buttonLabels?.primary ?? "").trim() || "โทรศัพท์";
  const secondaryLabel = String(buttonLabels?.secondary ?? "").trim() || "ช่องทางติดต่อ";

  if (phone) {
    footerContents.push({
      type: "button",
      style: "primary",
      height: "sm",
      action: { type: "uri", label: primaryLabel, uri: phone },
    });
  }
  if (channel) {
    footerContents.push({
      type: "button",
      style: "secondary",
      height: "sm",
      action: { type: "uri", label: secondaryLabel, uri: channel },
    });
  }

  const bubble: Record<string, unknown> = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: headline,
          weight: "bold",
          size: "xl",
          wrap: true,
        },
        {
          type: "text",
          text: body,
          size: "sm",
          wrap: true,
          margin: "md",
          color: "#666666",
        },
      ],
    },
  };

  if (hero) bubble.hero = hero;
  if (footerContents.length > 0) {
    bubble.footer = {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: footerContents,
    };
  }

  return { type: "flex", altText, contents: bubble };
}
