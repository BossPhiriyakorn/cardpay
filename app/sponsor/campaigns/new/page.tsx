"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { ArrowLeft, Loader2 } from "lucide-react";

import { SponsorFlexButtonColorPicker } from "@/components/SponsorFlexButtonColorPicker";
import { SPONSOR_FALLBACK_TEMPLATE_IMAGE_KEY } from "@/lib/flex-template-sponsor";
import {
  SPONSOR_LINK_BUTTON_BRAND_COLORS,
  SPONSOR_LINK_BUTTON_STYLE_LOCKED,
  SPONSOR_PHONE_BUTTON_COLOR_LOCKED,
  SPONSOR_PHONE_BUTTON_STYLE_LOCKED,
  normalizeSponsorLinkButtonColor,
} from "@/lib/sponsor-flex-button-options";

function parseNonNegativeNumber(value: string): number | null {
  const n = Number.parseFloat(value.replace(/,/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

type SponsorTemplateField = {
  key: string;
  type: "text" | "textarea" | "image";
  labelTh: string;
  required?: boolean;
  order: number;
};

type ActiveTemplatePayload = {
  id: string;
  name: string;
  slug: string;
  fields: SponsorTemplateField[];
  injectedKeysHintTh?: string;
};

const inputClass =
  "w-full rounded-2xl border border-[#e1bee7] bg-white px-4 py-3 text-sm text-[#4a148c] placeholder:text-[#6a1b9a]/40 focus:outline-none focus:border-[#8e24aa]/50";
const labelClass = "block text-xs font-black uppercase tracking-wider text-[#6a1b9a]/70 mb-1.5";
function mapApiError(code: string | undefined): string {
  switch (code) {
    case "invalid_flex_json":
      return "JSON ไม่ถูกต้อง — ตรวจสอบรูปแบบ";
    case "flex_json_too_large":
      return "ไฟล์ JSON ใหญ่เกินกำหนด";
    case "invalid_image_type":
      return "รองรับเฉพาะรูป JPEG, PNG, WebP, GIF";
    case "image_too_large":
      return "ไฟล์รูปใหญ่เกินกำหนด";
    case "drive_not_configured":
      return "ยังไม่ตั้งค่า Google Service Account บนเซิร์ฟเวอร์";
    case "drive_folder_not_configured":
      return "ยังไม่ตั้ง GOOGLE_DRIVE_JSON_FOLDER_ID / GOOGLE_DRIVE_IMAGE_FOLDER_ID";
    case "drive_upload_failed":
      return "อัปโหลด Google Drive ไม่สำเร็จ — ตรวจสิทธิ์โฟลเดอร์";
    case "missing_flex_or_card_fields":
      return "กรุณากรอกชื่อแคมเปญ ข้อความตอนแชร์ และอัปโหลดรูป (หรือกรอกลิงก์อย่างน้อยหนึ่งช่อง)";
    case "missing_preview_image":
      return "กรุณาอัปโหลดรูปแคมเปญ";
    case "missing_share_alt":
      return "กรุณากรอกข้อความตอนแชร์";
    case "missing_name":
      return "กรุณากรอกชื่อแคมเปญ";
    case "invalid_reward_limit_combination":
      return "เพดานต่อวันต้องไม่มากกว่าเพดานต่อคนทั้งแคมเปญ";
    case "invalid_reward_per_share":
      return "ค่าตอบแทนต่อแชร์ไม่ถูกต้อง";
    case "invalid_max_reward_per_user":
      return "เพดานต่อคนต่อแคมเปญไม่ถูกต้อง";
    case "invalid_max_reward_per_user_per_day":
      return "เพดานต่อคนต่อวันไม่ถูกต้อง";
    case "invalid_sponsor_phone":
      return "เบอร์โทรต้องเป็นตัวเลข 10 หลัก หรือเว้นว่าง";
    case "no_active_flex_template":
      return "แอดมินยังไม่ตั้งเทมเพลตที่ใช้งาน — แจ้งแอดมินที่หน้าจัดการแคมเปญ CMS";
    case "sponsor_flex_json_forbidden":
      return "ไม่อนุญาตให้ส่ง JSON Flex เอง";
    case "invalid_template_values_json":
      return "ข้อมูลฟิลด์เทมเพลตไม่ถูกต้อง — รีเฟรชหน้าแล้วลองใหม่";
    case "missing_template_field":
      return "กรุณากรอกฟิลด์ที่เทมเพลตกำหนดให้ครบ";
    case "missing_template_image":
      return "กรุณาอัปโหลดรูปตามที่เทมเพลตกำหนด";
    case "template_unfilled_placeholder":
      return "เทมเพลตยังมีตัวแปรที่ไม่ได้เติมค่า — แจ้งแอดมินตรวจสอบเทมเพลต";
    case "template_invalid_json":
    case "template_invalid_shape":
    case "template_apply_failed":
      return "สร้างการ์ดจากเทมเพลตไม่สำเร็จ — แจ้งแอดมิน";
    default:
      return code ?? "บันทึกไม่สำเร็จ";
  }
}

export default function SponsorCreateCampaignPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [companyName, setCompanyName] = useState("");

  const [name, setName] = useState("");
  const [cardHeadline, setCardHeadline] = useState("");
  const [description, setDescription] = useState("");
  const [appFeedDescription, setAppFeedDescription] = useState("");
  const [shareAltText, setShareAltText] = useState("");
  const [contactPhoneDigits, setContactPhoneDigits] = useState("");
  const [link2, setLink2] = useState("");
  const [phoneButtonLabel, setPhoneButtonLabel] = useState("");
  const [linkButtonLabel, setLinkButtonLabel] = useState("");
  const [linkButtonColor, setLinkButtonColor] = useState(
    SPONSOR_LINK_BUTTON_BRAND_COLORS[0].value,
  );
  const [rewardPerShare, setRewardPerShare] = useState("");
  const [maxRewardPerUser, setMaxRewardPerUser] = useState("");
  const [maxRewardPerUserPerDay, setMaxRewardPerUserPerDay] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [templateLoading, setTemplateLoading] = useState(true);
  const [activeTemplate, setActiveTemplate] = useState<ActiveTemplatePayload | null>(null);
  /** ข้อความจาก API เมื่อยังไม่มีเทมเพลตที่ใช้งาน (เช่น แนะนำให้แอดมินตั้งค่า) */
  const [templateHintTh, setTemplateHintTh] = useState("");
  const [templateTextValues, setTemplateTextValues] = useState<Record<string, string>>({});
  const [templateImageFiles, setTemplateImageFiles] = useState<Record<string, File | null>>({});
  const [templateImagePreviewUrls, setTemplateImagePreviewUrls] = useState<Record<string, string | null>>(
    {},
  );

  const perUserShareLimit = useMemo(() => {
    const max = parseNonNegativeNumber(maxRewardPerUser);
    const rps = parseNonNegativeNumber(rewardPerShare);
    if (max == null || rps == null || rps <= 0 || max <= 0) return null;
    return Math.floor(max / rps);
  }, [maxRewardPerUser, rewardPerShare]);

  const perUserDailyShareLimit = useMemo(() => {
    const max = parseNonNegativeNumber(maxRewardPerUserPerDay);
    const rps = parseNonNegativeNumber(rewardPerShare);
    if (max == null || rps == null || rps <= 0 || max <= 0) return null;
    return Math.floor(max / rps);
  }, [maxRewardPerUserPerDay, rewardPerShare]);

  const templateFieldsSorted = useMemo(() => {
    if (!activeTemplate?.fields?.length) return [];
    return [...activeTemplate.fields].sort(
      (a, b) => a.order - b.order || a.key.localeCompare(b.key),
    );
  }, [activeTemplate]);

  const templateImageFields = useMemo(
    () => templateFieldsSorted.filter((f) => f.type === "image"),
    [templateFieldsSorted],
  );
  const templateTextFields = useMemo(
    () => templateFieldsSorted.filter((f) => f.type !== "image"),
    [templateFieldsSorted],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/sponsor/auth/me", { cache: "no-store" });
        const data = (await res.json()) as {
          ok?: boolean;
          authenticated?: boolean;
          companyName?: string;
        };
        if (!cancelled) {
          setAuthed(res.ok && data.ok === true && data.authenticated === true);
          setCompanyName(String(data.companyName ?? ""));
        }
      } catch {
        if (!cancelled) setAuthed(false);
      } finally {
        if (!cancelled) setAuthChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/sponsor/campaign-template", { cache: "no-store" });
        const data = (await res.json()) as {
          ok?: boolean;
          activeTemplate?: ActiveTemplatePayload | null;
          hintTh?: string;
        };
        if (cancelled) return;
        if (res.ok && data.ok) {
          if (data.activeTemplate) {
            setActiveTemplate(data.activeTemplate);
            setTemplateHintTh("");
          } else {
            setActiveTemplate(null);
            setTemplateHintTh(String(data.hintTh ?? "").trim());
          }
        } else {
          setActiveTemplate(null);
          setTemplateHintTh("");
        }
      } catch {
        if (!cancelled) {
          setActiveTemplate(null);
          setTemplateHintTh("");
        }
      } finally {
        if (!cancelled) setTemplateLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!activeTemplate?.fields) return;
    setTemplateTextValues((prev) => {
      const next = { ...prev };
      for (const f of activeTemplate.fields) {
        if (f.type === "image") continue;
        if (next[f.key] === undefined) next[f.key] = "";
      }
      return next;
    });
  }, [activeTemplate]);

  useEffect(() => {
    return () => {
      for (const u of Object.values(templateImagePreviewUrls)) {
        if (u) URL.revokeObjectURL(u);
      }
    };
  }, [templateImagePreviewUrls]);

  function handleTemplateImageChange(key: string, file: File | null) {
    setTemplateImagePreviewUrls((prev) => {
      const old = prev[key];
      if (old) URL.revokeObjectURL(old);
      const next = { ...prev, [key]: file ? URL.createObjectURL(file) : null };
      return next;
    });
    setTemplateImageFiles((prev) => ({ ...prev, [key]: file }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!authed) {
      setError("กรุณาเข้าสู่ระบบพอร์ทัลสปอนเซอร์ก่อน");
      return;
    }
    if (!name.trim()) {
      setError("กรุณากรอกชื่อแคมเปญ");
      return;
    }
    if (!shareAltText.trim()) {
      setError("กรุณากรอกข้อความตอนแชร์");
      return;
    }
    if (!activeTemplate) {
      setError("ยังไม่สามารถสร้างแคมเปญได้ — รอแอดมินตั้งเทมเพลตที่ใช้งาน");
      return;
    }
    for (const f of activeTemplate.fields) {
      if (f.type === "image") {
        const file = templateImageFiles[f.key];
        if (f.required && (!file || file.size === 0)) {
          setError(`กรุณาอัปโหลดรูป: ${f.labelTh}`);
          return;
        }
      } else {
        const v = String(templateTextValues[f.key] ?? "").trim();
        if (f.required && !v) {
          setError(`กรุณากรอก: ${f.labelTh}`);
          return;
        }
      }
    }
    const rps = rewardPerShare.trim() === "" ? 0 : parseNonNegativeNumber(rewardPerShare);
    const maxPerUser =
      maxRewardPerUser.trim() === "" ? 0 : parseNonNegativeNumber(maxRewardPerUser);
    const maxPerUserPerDay =
      maxRewardPerUserPerDay.trim() === "" ? 0 : parseNonNegativeNumber(maxRewardPerUserPerDay);
    if (rps == null) {
      setError("กรุณากรอกค่าตอบแทนต่อแชร์เป็นตัวเลขที่ถูกต้อง");
      return;
    }
    if (maxPerUser == null) {
      setError("กรุณากรอกเพดานต่อคนต่อแคมเปญเป็นตัวเลขที่ถูกต้อง");
      return;
    }
    if (maxPerUserPerDay == null) {
      setError("กรุณากรอกเพดานต่อคนต่อวันเป็นตัวเลขที่ถูกต้อง");
      return;
    }
    if (maxPerUser > 0 && maxPerUserPerDay > maxPerUser) {
      setError("เพดานต่อวันต้องไม่มากกว่าเพดานต่อคนทั้งแคมเปญ");
      return;
    }
    const phoneDigits = contactPhoneDigits.replace(/\D/g, "");
    if (phoneDigits.length > 0 && phoneDigits.length !== 10) {
      setError("เบอร์โทรต้องเป็นตัวเลขครบ 10 หลัก หรือเว้นว่างไม่ใส่");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const form = new FormData();
      form.set("name", name.trim());
      form.set("cardHeadline", cardHeadline.trim());
      form.set("description", description.trim());
      form.set("appFeedDescription", appFeedDescription.trim().slice(0, 800));
      form.set("shareAltText", shareAltText.trim());
      form.set("contactPhoneUri", phoneDigits);
      form.set("sponsorTenDigitPhone", "1");
      form.set("contactChannelUri", link2.trim());
      form.set("status", "active");
      form.set("rewardPerShare", String(rps));
      form.set("maxRewardPerUser", String(maxPerUser));
      form.set("maxRewardPerUserPerDay", String(maxPerUserPerDay));
      form.set("tagIds", "[]");
      form.set("flexMessageJson", "");
      form.set("shareHeadline", "");
      form.set("shareBody", "");
      form.set("requirePreviewImage", "0");
      form.set("requireShareAltForSponsor", "1");
      form.set("flexPrimaryButtonLabel", "โทรศัพท์");
      form.set("flexSecondaryButtonLabel", "ช่องทางติดต่อ");
      form.set("contactPhoneButtonLabel", phoneButtonLabel.trim());
      form.set("contactPhoneButtonStyle", SPONSOR_PHONE_BUTTON_STYLE_LOCKED);
      form.set("contactPhoneButtonColor", SPONSOR_PHONE_BUTTON_COLOR_LOCKED);
      form.set("contactLinkButtonLabel", linkButtonLabel.trim());
      form.set("contactLinkButtonStyle", SPONSOR_LINK_BUTTON_STYLE_LOCKED);
      form.set("contactLinkButtonColor", normalizeSponsorLinkButtonColor(linkButtonColor));

      const textPayload: Record<string, string> = {};
      for (const f of activeTemplate.fields) {
        if (f.type === "image") continue;
        textPayload[f.key] = String(templateTextValues[f.key] ?? "").trim();
      }
      form.set("templateValuesJson", JSON.stringify(textPayload));
      for (const f of activeTemplate.fields) {
        if (f.type !== "image") continue;
        const file = templateImageFiles[f.key];
        if (file && file.size > 0) {
          form.set(`templateImage__${f.key}`, file);
        }
      }
      if (templateImageFields.length === 0) {
        const fb = templateImageFiles[SPONSOR_FALLBACK_TEMPLATE_IMAGE_KEY];
        if (fb && fb.size > 0) {
          form.set(`templateImage__${SPONSOR_FALLBACK_TEMPLATE_IMAGE_KEY}`, fb);
        }
      }

      const res = await fetch("/api/sponsor/campaigns", {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as { ok?: boolean; campaignId?: string; error?: string };
      if (!res.ok || !data.ok || !data.campaignId) {
        throw new Error(mapApiError(data.error));
      }
      router.push("/sponsor/campaigns");
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  if (!authChecked || templateLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center font-prompt bg-gradient-to-b from-[#e1bee7]/25 to-white">
        <Loader2 className="w-8 h-8 text-[#8e24aa] animate-spin" aria-hidden />
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="min-h-screen font-prompt px-4 py-10 bg-gradient-to-b from-[#e1bee7]/25 to-white">
        <div className="max-w-md mx-auto rounded-3xl border border-[#e1bee7] bg-white p-8 text-center text-[#4a148c]">
          <p className="font-black text-lg">กรุณาเข้าสู่ระบบ</p>
          <p className="text-sm text-[#6a1b9a]/80 mt-2">สร้างแคมเปญได้หลังล็อกอินพอร์ทัลสปอนเซอร์</p>
          <Link
            href="/sponsor"
            className="mt-6 inline-flex rounded-2xl bg-[#8e24aa] px-6 py-3 text-sm font-black text-white hover:brightness-110"
          >
            ไปหน้าเข้าสู่ระบบ
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-prompt pb-10 bg-gradient-to-b from-[#e1bee7]/20 to-white">
      <div className="max-w-3xl mx-auto px-4 pt-6 space-y-6">
        <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-[#6a1b9a]/65 uppercase tracking-wider">
          <Link
            href="/sponsor/campaigns"
            className="inline-flex items-center gap-2 hover:text-[#8e24aa] transition-colors"
          >
            <ArrowLeft size={14} />
            กลับรายการแคมเปญ
          </Link>
        </div>

        <div className="bg-white border border-[#e1bee7] rounded-3xl p-5 md:p-6 shadow-sm">
          <h1 className="text-2xl md:text-3xl font-black text-[#4a148c]">สร้างแคมเปญ</h1>
          {companyName ? (
            <p className="text-sm text-[#6a1b9a]/70 mt-1">{companyName}</p>
          ) : null}

          {activeTemplate ? (
            <p className="mt-3 text-xs font-bold text-[#6a1b9a]/75">
              ใช้เทมเพลต: <span className="text-[#4a148c]">{activeTemplate.name}</span> ({activeTemplate.slug})
            </p>
          ) : (
            <div
              role="status"
              className="mt-4 rounded-2xl border border-amber-400/50 bg-amber-50 px-4 py-3 text-sm text-amber-950 space-y-2"
            >
              <p className="font-black leading-snug">
                ยังกดสร้างแคมเปญไม่ได้ — ยังไม่มีเทมเพลตที่ &quot;ใช้งาน&quot; สำหรับพอร์ทัลสปอนเซอร์
              </p>
              <p className="text-[13px] text-amber-950/90 leading-relaxed">
                การเพิ่มเทมเพลตในหน้า «เทมเพลต Flex แคมเปญ» ยังไม่เท่ากับเปิดใช้งาน แอดมินต้องไปที่{" "}
                <strong>CMS → จัดการแคมเปญ</strong> ในตารางเทมเพลตด้านบน แล้วกดปุ่ม{" "}
                <strong>ใช้งานนี้</strong> ที่แถวเทมเพลตที่ต้องการ จากนั้นกลับมารีเฟรชหน้านี้
              </p>
              {templateHintTh ? (
                <p className="text-xs text-amber-900/85 border-t border-amber-200/80 pt-2 mt-1">
                  {templateHintTh}
                </p>
              ) : null}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            <div>
              <label className={labelClass} htmlFor="sponsor-campaign-name">
                ชื่อแคมเปญ *
              </label>
              <input
                id="sponsor-campaign-name"
                className={inputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="ชื่อเรียกในแพลตฟอร์ม (รายการแคมเปญของคุณ)"
              />
            </div>

            {activeTemplate && templateImageFields.length > 0 ? (
              templateImageFields.map((f) => (
                <div key={f.key}>
                  <label className={labelClass} htmlFor={`sponsor-tpl-img-${f.key}`}>
                    {f.labelTh}
                    {f.required ? " *" : ""}
                  </label>
                  <input
                    id={`sponsor-tpl-img-${f.key}`}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    required={f.required}
                    className="block w-full text-sm text-[#6a1b9a] file:mr-3 file:rounded-xl file:border-0 file:bg-[#f3e5f5] file:px-4 file:py-2 file:text-sm file:font-bold file:text-[#4a148c]"
                    onChange={(e) => handleTemplateImageChange(f.key, e.target.files?.[0] ?? null)}
                  />
                  {templateImagePreviewUrls[f.key] ? (
                    <div className="mt-3 relative w-full max-w-xs aspect-[4/3] rounded-2xl border border-[#e1bee7] overflow-hidden bg-[#faf5fc]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={templateImagePreviewUrls[f.key]!}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : null}
                </div>
              ))
            ) : (
              <div>
                <label className={labelClass} htmlFor="sponsor-fallback-card-image">
                  อัปโหลดรูปภาพ (การ์ดแชร์ + รายการแคมเปญในแอป)
                </label>
                <input
                  id="sponsor-fallback-card-image"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="block w-full text-sm text-[#6a1b9a] file:mr-3 file:rounded-xl file:border-0 file:bg-[#f3e5f5] file:px-4 file:py-2 file:text-sm file:font-bold file:text-[#4a148c]"
                  onChange={(e) =>
                    handleTemplateImageChange(
                      SPONSOR_FALLBACK_TEMPLATE_IMAGE_KEY,
                      e.target.files?.[0] ?? null,
                    )
                  }
                />
                {templateImagePreviewUrls[SPONSOR_FALLBACK_TEMPLATE_IMAGE_KEY] ? (
                  <div className="mt-3 relative w-full max-w-xs aspect-[4/3] rounded-2xl border border-[#e1bee7] overflow-hidden bg-[#faf5fc]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={templateImagePreviewUrls[SPONSOR_FALLBACK_TEMPLATE_IMAGE_KEY]!}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : null}
                <p className="text-[11px] text-[#6a1b9a]/55 mt-1 leading-relaxed">
                  รูปชุดเดียวกันนี้ใช้ทั้งบนการ์ด Flex และหน้ารายการแคมเปญ / หน้าแรกในแอป
                </p>
              </div>
            )}

            <div>
              <label className={labelClass} htmlFor="sponsor-card-headline">
                หัวข้อการ์ด
              </label>
              <input
                id="sponsor-card-headline"
                className={inputClass}
                value={cardHeadline}
                onChange={(e) => setCardHeadline(e.target.value)}
                placeholder="ข้อความหัวข้อที่แสดงบนการ์ด"
              />
              <p className="text-[11px] text-[#6a1b9a]/55 mt-1">
                เว้นว่างระบบจะใช้ชื่อแคมเปญด้านบนแทน
              </p>
            </div>

            <div>
              <label className={labelClass} htmlFor="sponsor-campaign-description">
                คำอธิบายบนการ์ด Flex
              </label>
              <textarea
                id="sponsor-campaign-description"
                className={`${inputClass} min-h-[100px] resize-y`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
                placeholder="ข้อความที่แสดงบนการ์ดแชร์"
              />
            </div>

            <div>
              <label className={labelClass} htmlFor="sponsor-app-feed-description">
                คำอธิบายในแอป (หน้าแรก / รายการแคมเปญ)
              </label>
              <textarea
                id="sponsor-app-feed-description"
                className={`${inputClass} min-h-[88px] resize-y`}
                value={appFeedDescription}
                onChange={(e) => setAppFeedDescription(e.target.value.slice(0, 800))}
                rows={3}
                maxLength={800}
                placeholder="สั้นๆ สำหรับผู้ใช้ทั่วไปในแอป (คนละส่วนกับคำอธิบายบนการ์ด)"
              />
              <p className="text-[11px] text-[#6a1b9a]/55 mt-1">
                ชื่อแคมเปญและจำนวนรางวัลแสดงอัตโนมัติ — ช่องนี้เฉพาะข้อความเสริมในรายการ
              </p>
            </div>

            {templateTextFields.map((f) =>
              f.type === "textarea" ? (
                <div key={f.key}>
                  <label className={labelClass} htmlFor={`sponsor-tpl-ta-${f.key}`}>
                    {f.labelTh}
                    {f.required ? " *" : ""}
                  </label>
                  <textarea
                    id={`sponsor-tpl-ta-${f.key}`}
                    className={`${inputClass} min-h-[88px] resize-y`}
                    value={templateTextValues[f.key] ?? ""}
                    onChange={(e) =>
                      setTemplateTextValues((prev) => ({ ...prev, [f.key]: e.target.value }))
                    }
                    required={f.required}
                    rows={4}
                  />
                </div>
              ) : (
                <div key={f.key}>
                  <label className={labelClass} htmlFor={`sponsor-tpl-txt-${f.key}`}>
                    {f.labelTh}
                    {f.required ? " *" : ""}
                  </label>
                  <input
                    id={`sponsor-tpl-txt-${f.key}`}
                    className={inputClass}
                    value={templateTextValues[f.key] ?? ""}
                    onChange={(e) =>
                      setTemplateTextValues((prev) => ({ ...prev, [f.key]: e.target.value }))
                    }
                    required={f.required}
                  />
                </div>
              ),
            )}

            <p className="text-xs font-black uppercase tracking-wider text-[#6a1b9a]/70 pt-1">
              ปุ่มโทรบนการ์ด
            </p>
            <div>
              <label className={labelClass} htmlFor="sponsor-contact-phone">
                เบอร์โทร
              </label>
              <input
                id="sponsor-contact-phone"
                className={inputClass}
                value={contactPhoneDigits}
                onChange={(e) =>
                  setContactPhoneDigits(e.target.value.replace(/\D/g, "").slice(0, 10))
                }
                placeholder="0812345678"
                inputMode="numeric"
                autoComplete="tel"
                maxLength={10}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="sponsor-phone-btn-label">
                ชื่อปุ่มโทร
              </label>
              <input
                id="sponsor-phone-btn-label"
                className={inputClass}
                value={phoneButtonLabel}
                onChange={(e) => setPhoneButtonLabel(e.target.value.slice(0, 40))}
                placeholder="เว้นว่าง = โทรศัพท์"
                maxLength={40}
              />
            </div>

            <p className="text-xs font-black uppercase tracking-wider text-[#6a1b9a]/70 pt-1">
              ปุ่มลิงก์บนการ์ด
            </p>
            <div>
              <label className={labelClass} htmlFor="sponsor-contact-link">
                ลิงค์
              </label>
              <input
                id="sponsor-contact-link"
                className={inputClass}
                value={link2}
                onChange={(e) => setLink2(e.target.value)}
                placeholder="เช่น https://facebook.com/... หรือ https://line.me/R/ti/p/..."
                inputMode="url"
                autoComplete="url"
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="sponsor-link-btn-label">
                ชื่อปุ่มลิงก์
              </label>
              <input
                id="sponsor-link-btn-label"
                className={inputClass}
                value={linkButtonLabel}
                onChange={(e) => setLinkButtonLabel(e.target.value.slice(0, 40))}
                placeholder="เว้นว่าง = ช่องทางติดต่อ"
                maxLength={40}
              />
            </div>
            <div className="relative z-10 min-w-0">
              <SponsorFlexButtonColorPicker
                idPrefix="sponsor-link-btn"
                value={linkButtonColor}
                onChange={setLinkButtonColor}
                labelClass={labelClass}
                inputClass={inputClass}
                presetColors={SPONSOR_LINK_BUTTON_BRAND_COLORS}
                normalizeColor={normalizeSponsorLinkButtonColor}
              />
            </div>

            <div>
              <label className={labelClass} htmlFor="sponsor-share-alt">
                ข้อความตอนแชร์ *
              </label>
              <textarea
                id="sponsor-share-alt"
                className={`${inputClass} min-h-[80px] resize-y`}
                value={shareAltText}
                onChange={(e) => setShareAltText(e.target.value.slice(0, 400))}
                rows={3}
                maxLength={400}
                required
                placeholder="ข้อความที่ผู้ใช้เห็นก่อนเปิดการ์ดเมื่อแชร์"
              />
              <p className="text-[11px] text-[#6a1b9a]/55 mt-1">{shareAltText.length}/400</p>
            </div>

            <p className="text-xs font-black uppercase tracking-wider text-[#6a1b9a]/70 pt-1">
              ตั้งค่าการ์ด
            </p>
            <div>
              <label className={labelClass} htmlFor="sponsor-reward-per-share">
                รางวัลต่อการแชร์ (บาท)
              </label>
              <input
                id="sponsor-reward-per-share"
                className={inputClass}
                value={rewardPerShare}
                onChange={(e) => setRewardPerShare(e.target.value)}
                inputMode="decimal"
                placeholder="0"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass} htmlFor="sponsor-max-per-user">
                  เพดานรางวัลต่อคนทั้งแคมเปญ (บาท)
                </label>
                <input
                  id="sponsor-max-per-user"
                  className={inputClass}
                  value={maxRewardPerUser}
                  onChange={(e) => setMaxRewardPerUser(e.target.value)}
                  inputMode="decimal"
                  placeholder="0 = ไม่จำกัด"
                />
                <p className="text-[11px] text-[#6a1b9a]/55 mt-1.5 leading-relaxed">
                  {perUserShareLimit != null
                    ? `ประมาณ ${perUserShareLimit.toLocaleString("th-TH")} ครั้งแชร์ต่อคนตลอดแคมเปญ`
                    : "จำกัดยอดเงินรางวัลสูงสุดที่ 1 คนรับได้ทั้งแคมเปญ"}
                </p>
              </div>
              <div>
                <label className={labelClass} htmlFor="sponsor-max-per-day">
                  เพดานรางวัลต่อคนต่อวัน (บาท)
                </label>
                <input
                  id="sponsor-max-per-day"
                  className={inputClass}
                  value={maxRewardPerUserPerDay}
                  onChange={(e) => setMaxRewardPerUserPerDay(e.target.value)}
                  inputMode="decimal"
                  placeholder="0 = ไม่จำกัด"
                />
                <p className="text-[11px] text-[#6a1b9a]/55 mt-1.5 leading-relaxed">
                  {perUserDailyShareLimit != null
                    ? `ประมาณ ${perUserDailyShareLimit.toLocaleString("th-TH")} ครั้งแชร์ต่อคนต่อวัน`
                    : "จำกัดยอดเงินรางวัลสูงสุดที่ 1 คนรับได้ในแต่ละวัน"}
                </p>
              </div>
            </div>

            {error ? <p className="text-sm text-red-600 font-medium">{error}</p> : null}

            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-2xl bg-[#7b1fa2] px-6 py-3 text-sm font-black text-white hover:bg-[#6a1b9a] disabled:opacity-50"
              >
                {saving ? "กำลังอัปโหลด…" : "สร้างแคมเปญ"}
              </button>
              <Link
                href="/sponsor/campaigns"
                className="inline-flex items-center rounded-2xl border border-[#e1bee7] px-6 py-3 text-sm font-bold text-[#6a1b9a] hover:border-[#8e24aa]/50"
              >
                ยกเลิก
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
