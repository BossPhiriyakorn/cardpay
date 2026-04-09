import mongoose from "mongoose";

import {
  buildCampaignFlexBubbleMessage,
  canBuildInlineFlexCampaign,
} from "@/lib/build-campaign-flex-bubble";
import {
  MAX_FLEX_JSON_BYTES,
  createFlexJsonOnDrive,
  parseAndStringifyFlexJson,
  uploadPreviewImageOnDrive,
} from "@/lib/cms/campaign-drive";
import {
  applyFlexTemplatePlaceholders,
  parseFlexTemplateFieldsSpec,
  parseTemplateValuesJsonFromForm,
  SPONSOR_FALLBACK_TEMPLATE_IMAGE_KEY,
  SPONSOR_TEMPLATE_INJECTED_KEYS,
} from "@/lib/flex-template-sponsor";
import {
  clampSponsorButtonLabel,
  normalizeSponsorLinkButtonColor,
  SPONSOR_LINK_BUTTON_STYLE_LOCKED,
  SPONSOR_PHONE_BUTTON_COLOR_LOCKED,
  SPONSOR_PHONE_BUTTON_STYLE_LOCKED,
} from "@/lib/sponsor-flex-button-options";
import { normalizeContactLinkUri, normalizeContactPhoneForStorage } from "@/lib/contact-phone";
import { connectToDatabase } from "@/lib/mongodb";
import { buildCampaignShareLiffUrl } from "@/lib/liffShare";
import { getActiveSponsorFlexTemplateId } from "@/lib/platform-settings";
import { shareQuotaFromBudget } from "@/lib/share-quota";
import Campaign from "@/models/Campaign";
import FlexCampaignTemplate from "@/models/FlexCampaignTemplate";
import Sponsor from "@/models/Sponsor";

const MAX_ALT = 400;

export type CreateCampaignFromFormResult =
  | { ok: true; campaignId: string }
  | { ok: false; status: number; error: string };

function clampShareAltText(v: unknown): string {
  const s = String(v ?? "").trim();
  return s.slice(0, MAX_ALT);
}

function flexMessageObjectToBuffer(msg: {
  type: string;
  altText: string;
  contents: Record<string, unknown>;
}): Buffer {
  const pretty = JSON.stringify(msg, null, 2);
  const buf = Buffer.from(pretty, "utf8");
  if (buf.length > MAX_FLEX_JSON_BYTES) {
    throw new Error("flex_json_too_large");
  }
  return buf;
}

function mapDriveErr(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes("Missing GOOGLE_SERVICE_ACCOUNT_FILE") || msg.includes("not found at:")) {
    return "drive_not_configured";
  }
  if (msg.includes("Missing Google Drive folder ID")) {
    return "drive_folder_not_configured";
  }
  return "drive_upload_failed";
}

export type CreateCampaignFromFormOptions = {
  /** `sponsor` = บังคับใช้เทมเพลตที่แอดมินตั้งเป็นค่าใช้งานเท่านั้น */
  createdBy?: "cms" | "sponsor";
};

/**
 * สร้างแคมเปญจาก multipart FormData (ใช้ร่วม CMS และพอร์ทัลสปอนเซอร์)
 */
export async function createCampaignFromFormData(
  sponsorId: string,
  form: FormData,
  options?: CreateCampaignFromFormOptions
): Promise<CreateCampaignFromFormResult> {
  const createdBy = options?.createdBy ?? "cms";

  if (!mongoose.Types.ObjectId.isValid(sponsorId)) {
    return { ok: false, status: 400, error: "invalid_sponsor_id" };
  }

  const name = String(form.get("name") ?? "").trim();
  /** หัวข้อบนการ์ด (สปอนเซอร์) — เว้นว่างจะใช้ name แทนในเทมเพลต */
  const cardHeadline = String(form.get("cardHeadline") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const appFeedDescription = String(form.get("appFeedDescription") ?? "")
    .trim()
    .slice(0, 800);
  const shareAltText = clampShareAltText(form.get("shareAltText"));
  const statusRaw = String(form.get("status") ?? "active");
  const status =
    statusRaw === "paused" || statusRaw === "completed" ? statusRaw : "active";
  const numOrZero = (key: string): number => {
    const v = form.get(key);
    if (v === null || v === "") return 0;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : NaN;
  };
  const rewardPerShare = numOrZero("rewardPerShare");
  const maxRewardPerUser = numOrZero("maxRewardPerUser");
  const maxRewardPerUserPerDay = numOrZero("maxRewardPerUserPerDay");
  const flexMessageJson = String(form.get("flexMessageJson") ?? "");
  const tagIdsRaw = String(form.get("tagIds") ?? "[]");
  const shareHeadline = String(form.get("shareHeadline") ?? "").trim();
  const shareBody = String(form.get("shareBody") ?? "").trim();
  const contactPhoneRaw = String(form.get("contactPhoneUri") ?? "").trim();
  const sponsorTenDigitPhone = String(form.get("sponsorTenDigitPhone") ?? "") === "1";
  if (sponsorTenDigitPhone && contactPhoneRaw !== "" && !/^\d{10}$/.test(contactPhoneRaw)) {
    return { ok: false, status: 400, error: "invalid_sponsor_phone" };
  }
  const contactPhoneUri = normalizeContactPhoneForStorage(contactPhoneRaw);
  const contactChannelUri = normalizeContactLinkUri(
    String(form.get("contactChannelUri") ?? "")
  );
  const requirePreviewImage =
    createdBy === "sponsor"
      ? false
      : String(form.get("requirePreviewImage") ?? "") === "1";
  const requireShareAltForSponsor = String(form.get("requireShareAltForSponsor") ?? "") === "1";
  const flexPrimaryButtonLabel = String(form.get("flexPrimaryButtonLabel") ?? "").trim();
  const flexSecondaryButtonLabel = String(form.get("flexSecondaryButtonLabel") ?? "").trim();

  if (!name) {
    return { ok: false, status: 400, error: "missing_name" };
  }
  if (requireShareAltForSponsor && !shareAltText.trim()) {
    return { ok: false, status: 400, error: "missing_share_alt" };
  }
  if (!Number.isFinite(rewardPerShare) || rewardPerShare < 0) {
    return { ok: false, status: 400, error: "invalid_reward_per_share" };
  }
  if (!Number.isFinite(maxRewardPerUser) || maxRewardPerUser < 0) {
    return { ok: false, status: 400, error: "invalid_max_reward_per_user" };
  }
  if (!Number.isFinite(maxRewardPerUserPerDay) || maxRewardPerUserPerDay < 0) {
    return { ok: false, status: 400, error: "invalid_max_reward_per_user_per_day" };
  }
  if (maxRewardPerUser > 0 && maxRewardPerUserPerDay > maxRewardPerUser) {
    return { ok: false, status: 400, error: "invalid_reward_limit_combination" };
  }

  let tagIds: mongoose.Types.ObjectId[] = [];
  try {
    const arr = JSON.parse(tagIdsRaw) as unknown;
    if (Array.isArray(arr)) {
      tagIds = arr
        .filter((id) => mongoose.Types.ObjectId.isValid(String(id)))
        .map((id) => new mongoose.Types.ObjectId(String(id)));
    }
  } catch {
    tagIds = [];
  }

  const preview = form.get("previewImage");
  const previewFile =
    preview && typeof preview === "object" && "arrayBuffer" in preview
      ? (preview as File)
      : null;

  if (requirePreviewImage && (!previewFile || previewFile.size === 0)) {
    return { ok: false, status: 400, error: "missing_preview_image" };
  }

  const campaignId = new mongoose.Types.ObjectId();

  let flexFileId = "";
  let imageUrls: string[] = [];

  try {
    await connectToDatabase();
    const sponsor = await Sponsor.findById(sponsorId).select("_id").lean();
    if (!sponsor) {
      return { ok: false, status: 404, error: "sponsor_not_found" };
    }

    const rps = rewardPerShare;
    const maxPerUser = maxRewardPerUser;
    const maxPerUserPerDay = maxRewardPerUserPerDay;
    /** งบไม่แยกตามแคมเปญ — โควตาแชร์จากงบแคมเปญไม่ใช้ (ใช้งบรวมสปอนเซอร์แทน) */
    const q = shareQuotaFromBudget(0, rps);

    if (createdBy === "sponsor") {
      if (flexMessageJson.trim()) {
        return { ok: false, status: 400, error: "sponsor_flex_json_forbidden" };
      }
      const activeTplId = await getActiveSponsorFlexTemplateId();
      if (!activeTplId) {
        return { ok: false, status: 403, error: "no_active_flex_template" };
      }
      const tplDoc = await FlexCampaignTemplate.findById(activeTplId).lean();
      if (!tplDoc) {
        return { ok: false, status: 403, error: "no_active_flex_template" };
      }
      const fields = parseFlexTemplateFieldsSpec(String(tplDoc.fieldsSpecJson ?? "[]"));
      const textVals = parseTemplateValuesJsonFromForm(String(form.get("templateValuesJson") ?? "{}"));
      if (!textVals) {
        return { ok: false, status: 400, error: "invalid_template_values_json" };
      }
      const hasSpecImageField = fields.some(
        (f) => f.type === "image" && !SPONSOR_TEMPLATE_INJECTED_KEYS.has(f.key),
      );
      const valueMap: Record<string, string> = {};
      const collectedImageUrls: string[] = [];

      for (const f of fields) {
        if (SPONSOR_TEMPLATE_INJECTED_KEYS.has(f.key)) continue;
        if (f.type === "image") {
          const img = form.get(`templateImage__${f.key}`);
          const imgFile =
            img && typeof img === "object" && "arrayBuffer" in img ? (img as File) : null;
          if (f.required && (!imgFile || imgFile.size === 0)) {
            return { ok: false, status: 400, error: "missing_template_image" };
          }
          if (!imgFile || imgFile.size === 0) {
            valueMap[f.key] = "";
            continue;
          }
          try {
            const buf = Buffer.from(await imgFile.arrayBuffer());
            const mime = imgFile.type || "image/jpeg";
            const url = await uploadPreviewImageOnDrive({
              sponsorId,
              campaignId: String(campaignId),
              buffer: buf,
              mimeType: mime,
            });
            valueMap[f.key] = url;
            collectedImageUrls.push(url);
          } catch (e) {
            const code = e instanceof Error ? e.message : "";
            if (code === "invalid_image_type") {
              return { ok: false, status: 400, error: "invalid_image_type" };
            }
            if (code === "image_too_large") {
              return { ok: false, status: 400, error: "image_too_large" };
            }
            console.error("[createCampaignFromFormData] template image upload", e);
            return { ok: false, status: 503, error: mapDriveErr(e) };
          }
        } else {
          const v = String(textVals[f.key] ?? "").trim();
          if (f.required && !v) {
            return { ok: false, status: 400, error: "missing_template_field" };
          }
          valueMap[f.key] = v;
        }
      }

      if (!hasSpecImageField) {
        const fbKey = SPONSOR_FALLBACK_TEMPLATE_IMAGE_KEY;
        const img = form.get(`templateImage__${fbKey}`);
        const imgFile =
          img && typeof img === "object" && "arrayBuffer" in img ? (img as File) : null;
        if (imgFile && imgFile.size > 0) {
          try {
            const buf = Buffer.from(await imgFile.arrayBuffer());
            const mime = imgFile.type || "image/jpeg";
            const url = await uploadPreviewImageOnDrive({
              sponsorId,
              campaignId: String(campaignId),
              buffer: buf,
              mimeType: mime,
            });
            valueMap[fbKey] = url;
            collectedImageUrls.push(url);
          } catch (e) {
            const code = e instanceof Error ? e.message : "";
            if (code === "invalid_image_type") {
              return { ok: false, status: 400, error: "invalid_image_type" };
            }
            if (code === "image_too_large") {
              return { ok: false, status: 400, error: "image_too_large" };
            }
            console.error("[createCampaignFromFormData] sponsor fallback card image", e);
            return { ok: false, status: 503, error: mapDriveErr(e) };
          }
        } else {
          valueMap[fbKey] = "";
        }
      }

      valueMap.campaign_name = cardHeadline || name;
      valueMap.share_alt = shareAltText;
      valueMap.campaign_description = description;
      valueMap.contact_phone = contactPhoneUri;
      valueMap.contact_link = contactChannelUri;

      const phoneUriTrim = contactPhoneUri.trim();
      const channelUriTrim = contactChannelUri.trim();
      const phoneBtnLabelRaw = clampSponsorButtonLabel(
        String(form.get("contactPhoneButtonLabel") ?? "")
      );
      const linkBtnLabelRaw = clampSponsorButtonLabel(
        String(form.get("contactLinkButtonLabel") ?? "")
      );
      valueMap.contact_phone_button_label =
        phoneBtnLabelRaw || (phoneUriTrim ? "โทรศัพท์" : "");
      valueMap.contact_phone_button_style = SPONSOR_PHONE_BUTTON_STYLE_LOCKED;
      valueMap.contact_phone_button_color = SPONSOR_PHONE_BUTTON_COLOR_LOCKED;
      valueMap.contact_link_button_label =
        linkBtnLabelRaw || (channelUriTrim ? "ช่องทางติดต่อ" : "");
      valueMap.contact_link_button_style = SPONSOR_LINK_BUTTON_STYLE_LOCKED;
      valueMap.contact_link_button_color = normalizeSponsorLinkButtonColor(
        String(form.get("contactLinkButtonColor") ?? "")
      );

      const liffId =
        process.env.NEXT_PUBLIC_LIFF_ID?.trim() || process.env.LIFF_ID?.trim() || "";
      const shareEndpointIncludesShare =
        process.env.NEXT_PUBLIC_LIFF_ENDPOINT_INCLUDES_SHARE === "1";
      valueMap.campaign_id = String(campaignId);
      const builtShareUrl = liffId
        ? buildCampaignShareLiffUrl(liffId, String(campaignId), 1, {
            endpointIncludesShare: shareEndpointIncludesShare,
          })
        : "";
      valueMap.share_liff_url = builtShareUrl;
      valueMap.liff_url = builtShareUrl;

      const applied = applyFlexTemplatePlaceholders(
        String(tplDoc.flexSkeletonJson ?? "{}"),
        valueMap
      );
      if (!applied.ok) {
        const err =
          applied.error === "template_unfilled_placeholder"
            ? "template_unfilled_placeholder"
            : applied.error === "template_json_parse_failed"
              ? "template_invalid_json"
              : applied.error === "template_must_be_flex_wrapper_or_bubble_or_carousel"
                ? "template_invalid_shape"
                : "template_apply_failed";
        return { ok: false, status: 400, error: err };
      }
      let jsonStrOut = applied.jsonStr;
      if (liffId) {
        jsonStrOut = jsonStrOut.split("{liff_url}").join(builtShareUrl);
      }
      /**
       * ไม่ parse/stringify ซ้ำหลังแทนที่ placeholder — เทมเพลตควรใส่ {{contact_link_button_color}}
       * (และ {{contact_phone_button_color}} ถ้าต้องการสีปุ่มโทร) ใน JSON โดยตรง
       */
      const jsonBuf = Buffer.from(jsonStrOut, "utf8");
      if (jsonBuf.length > MAX_FLEX_JSON_BYTES) {
        return { ok: false, status: 400, error: "flex_json_too_large" };
      }
      try {
        flexFileId = await createFlexJsonOnDrive(sponsorId, String(campaignId), jsonBuf);
      } catch (e) {
        console.error("[createCampaignFromFormData] sponsor template flex upload", e);
        return { ok: false, status: 503, error: mapDriveErr(e) };
      }
      imageUrls = collectedImageUrls;
    } else {
      if (previewFile && previewFile.size > 0) {
        try {
          const buf = Buffer.from(await previewFile.arrayBuffer());
          const mime = previewFile.type || "image/jpeg";
          const url = await uploadPreviewImageOnDrive({
            sponsorId,
            campaignId: String(campaignId),
            buffer: buf,
            mimeType: mime,
          });
          imageUrls = [url];
        } catch (e) {
          const code = e instanceof Error ? e.message : "";
          if (code === "invalid_image_type") {
            return { ok: false, status: 400, error: "invalid_image_type" };
          }
          if (code === "image_too_large") {
            return { ok: false, status: 400, error: "image_too_large" };
          }
          console.error("[createCampaignFromFormData] image upload", e);
          return { ok: false, status: 503, error: mapDriveErr(e) };
        }
      }

      if (flexMessageJson.trim()) {
        try {
          const jsonBuf = parseAndStringifyFlexJson(flexMessageJson);
          flexFileId = await createFlexJsonOnDrive(sponsorId, String(campaignId), jsonBuf);
        } catch (e) {
          const code = e instanceof Error ? e.message : "";
          if (code === "invalid_flex_json") {
            return { ok: false, status: 400, error: "invalid_flex_json" };
          }
          if (code === "flex_json_too_large") {
            return { ok: false, status: 400, error: "flex_json_too_large" };
          }
          console.error("[createCampaignFromFormData] flex upload", e);
          return { ok: false, status: 503, error: mapDriveErr(e) };
        }
      } else {
        if (
          !canBuildInlineFlexCampaign({
            name,
            description,
            imageUrls,
            shareHeadline,
            shareBody,
            contactPhoneUri,
            contactChannelUri,
            shareAltText,
          })
        ) {
          return { ok: false, status: 400, error: "missing_flex_or_card_fields" };
        }
        try {
          const bubbleBtn =
            flexPrimaryButtonLabel || flexSecondaryButtonLabel
              ? {
                  primary: flexPrimaryButtonLabel || undefined,
                  secondary: flexSecondaryButtonLabel || undefined,
                }
              : undefined;
          const flexMsg = buildCampaignFlexBubbleMessage(
            {
              name,
              description,
              imageUrls,
              shareHeadline,
              shareBody,
              contactPhoneUri,
              contactChannelUri,
              shareAltText,
            },
            bubbleBtn
          );
          const jsonBuf = flexMessageObjectToBuffer(flexMsg);
          flexFileId = await createFlexJsonOnDrive(sponsorId, String(campaignId), jsonBuf);
        } catch (e) {
          const code = e instanceof Error ? e.message : "";
          if (code === "flex_json_too_large") {
            return { ok: false, status: 400, error: "flex_json_too_large" };
          }
          console.error("[createCampaignFromFormData] generated flex upload", e);
          return { ok: false, status: 503, error: mapDriveErr(e) };
        }
      }
    }

    await Campaign.create({
      _id: campaignId,
      sponsorId,
      name,
      description,
      appFeedDescription,
      totalBudget: 0,
      usedBudget: 0,
      status,
      flexMessageJsonDriveFileId: flexFileId,
      shareAltText,
      rewardPerShare: rps,
      maxRewardPerUser: maxPerUser,
      maxRewardPerUserPerDay: maxPerUserPerDay,
      quota: q,
      currentShares: 0,
      imageUrls,
      shareHeadline,
      shareBody,
      contactPhoneUri,
      contactChannelUri,
      tagIds,
    });

    return { ok: true, campaignId: String(campaignId) };
  } catch (e) {
    console.error("[createCampaignFromFormData]", e);
    return { ok: false, status: 503, error: "database_unavailable" };
  }
}
