"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import type { CmsCampaignRow } from "@/lib/cms/types";
import { shareQuotaFromBudget } from "@/lib/share-quota";
import { useCmsAdminMe } from "@/hooks/useCmsAdminMe";
import {
  driveImageViewUrl,
  parseGoogleDriveFileId,
  resolveDriveImageSrcForPreview,
} from "@/lib/drive-image-url";

type Props = { params: Promise<{ sponsorId: string; campaignId: string }> };

type TagRow = { id: string; nameTh: string; slug: string };

const currencyFormatter = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  maximumFractionDigits: 0,
});

const inputClass =
  "w-full rounded-2xl border border-[#e1bee7] bg-white px-4 py-3 text-sm text-[#4a148c] placeholder:text-[#6a1b9a]/40 focus:outline-none focus:border-[#8e24aa]/50";
const labelClass = "block text-xs font-black uppercase tracking-wider text-[#6a1b9a]/70 mb-1.5";
const codeAreaClass = `${inputClass} font-mono text-xs min-h-[180px] resize-y leading-relaxed`;

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
    case "invalid_sponsor_id":
    case "forbidden":
      return "รหัสสปอนเซอร์ไม่ตรงกับแคมเปญ";
    case "invalid_reward_limit_combination":
      return "เพดานต่อวันต้องไม่มากกว่าเพดานต่อคนทั้งแคมเปญ";
    default:
      return code ?? "บันทึกไม่สำเร็จ";
  }
}

function parseNonNegativeNumber(value: string): number | null {
  const n = Number.parseFloat(value.replace(/,/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export default function CampaignDetailPage({ params }: Props) {
  const { isAdmin } = useCmsAdminMe();
  const { sponsorId, campaignId } = use(params);
  const [campaign, setCampaign] = useState<CmsCampaignRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tags, setTags] = useState<TagRow[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [totalBudget, setTotalBudget] = useState("");
  const [flexJson, setFlexJson] = useState("");
  const [shareAltText, setShareAltText] = useState("");
  const [rewardPerShare, setRewardPerShare] = useState("");
  const [maxRewardPerUser, setMaxRewardPerUser] = useState("");
  const [maxRewardPerUserPerDay, setMaxRewardPerUserPerDay] = useState("");
  const [status, setStatus] = useState<"active" | "paused" | "completed">("active");
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewObjectUrl, setPreviewObjectUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const storedPreviewUrl = campaign?.imageUrls?.[0] ?? null;
  const previewDisplayUrl = previewObjectUrl ?? storedPreviewUrl;

  const drivePreviewId =
    storedPreviewUrl && !previewObjectUrl
      ? parseGoogleDriveFileId(storedPreviewUrl)
      : null;
  const [useDriveUcFallback, setUseDriveUcFallback] = useState(false);

  const previewImgSrc = useMemo(() => {
    if (!previewDisplayUrl) return null;
    if (previewObjectUrl) return previewDisplayUrl;
    if (useDriveUcFallback && drivePreviewId) {
      return driveImageViewUrl(drivePreviewId);
    }
    return resolveDriveImageSrcForPreview(previewDisplayUrl);
  }, [previewDisplayUrl, previewObjectUrl, useDriveUcFallback, drivePreviewId]);

  useEffect(() => {
    setUseDriveUcFallback(false);
  }, [storedPreviewUrl, previewObjectUrl]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [campRes, tagRes] = await Promise.all([
          fetch(`/api/cms/campaigns/${campaignId}`, { cache: "no-store" }),
          fetch("/api/cms/campaign-tags", { cache: "no-store" }),
        ]);
        const data = (await campRes.json()) as { ok?: boolean; campaign?: CmsCampaignRow; error?: string };
        if (!campRes.ok || !data.ok || !data.campaign) {
          throw new Error(data.error ?? "load_failed");
        }
        const tagData = (await tagRes.json()) as { ok?: boolean; tags?: TagRow[] };
        if (!cancelled) {
          setCampaign(data.campaign);
          const c = data.campaign;
          setName(c.name);
          setDescription(c.description ?? "");
          setTotalBudget(String(c.totalBudget));
          setFlexJson("");
          setShareAltText(c.shareAltText ?? "");
          setRewardPerShare(String(c.rewardPerShare ?? 0));
          setMaxRewardPerUser(String(c.maxRewardPerUser ?? 0));
          setMaxRewardPerUserPerDay(String(c.maxRewardPerUserPerDay ?? 0));
          setStatus(c.status);
          setSelectedTagIds(new Set(c.tags.map((t) => t.id)));
          setPreviewFile(null);
          if (tagRes.ok && tagData.ok && tagData.tags) {
            setTags(
              tagData.tags.map((t) => ({
                id: String(t.id),
                nameTh: t.nameTh,
                slug: t.slug,
              }))
            );
          }
        }
      } catch {
        if (!cancelled) setError("ไม่สามารถโหลดรายละเอียดแคมเปญได้");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  useEffect(() => {
    if (!previewFile) {
      setPreviewObjectUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }
    const url = URL.createObjectURL(previewFile);
    setPreviewObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [previewFile]);

  const budgetInfo = useMemo(() => {
    if (!campaign) return { remaining: 0 };
    return { remaining: Math.max(campaign.totalBudget - campaign.usedBudget, 0) };
  }, [campaign]);

  const derivedMaxShares = useMemo(() => {
    const tb = parseNonNegativeNumber(totalBudget) ?? NaN;
    const rps = parseNonNegativeNumber(rewardPerShare) ?? NaN;
    if (!Number.isFinite(tb) || tb < 0 || !Number.isFinite(rps) || rps <= 0) return null;
    return shareQuotaFromBudget(tb, rps);
  }, [totalBudget, rewardPerShare]);

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

  if (loading) {
    return (
      <div className="rounded-2xl border border-[#e1bee7] bg-white p-6 text-[#4a148c]">
        กำลังโหลดข้อมูลแคมเปญ...
      </div>
    );
  }

  if (!campaign || campaign.sponsorId !== sponsorId) {
    return (
      <div className="rounded-2xl border border-[#e1bee7] bg-white p-6 text-[#4a148c]">
        {error ?? "ไม่พบข้อมูลแคมเปญ"}
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-bold text-[#6a1b9a]/65 uppercase tracking-wider">
        <Link
          href={`/cms/sponsors/${sponsorId}`}
          className="inline-flex items-center gap-2 hover:text-[#8e24aa] transition-colors"
        >
          <ArrowLeft size={14} />
          กลับไปหน้าสปอนเซอร์
        </Link>
        <Link
          href={`/cms/sponsors/${sponsorId}/campaigns/${campaignId}/analytics`}
          className="inline-flex items-center rounded-xl border border-[#e1bee7] px-3 py-2 text-[#8e24aa] hover:bg-[#f3e5f5] transition-colors"
        >
          ดูรายละเอียดแคมเปญ
        </Link>
      </div>

      <div className="bg-white border border-[#e1bee7] rounded-3xl p-5 md:p-6">
        <h1 className="text-2xl md:text-3xl font-black text-[#4a148c]">{campaign.name}</h1>
        <p className="text-sm text-[#6a1b9a]/70 mt-2">
          {campaign.sponsorName} • Campaign ID: {campaign.id}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
          <div className="rounded-2xl border border-[#e1bee7] bg-[#faf5fc] p-4">
            <p className="text-xs font-black tracking-wider uppercase text-[#6a1b9a]/70">งบรวม</p>
            <p className="text-xl font-black text-[#4a148c] mt-2">
              {currencyFormatter.format(campaign.totalBudget)}
            </p>
          </div>
          <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-4">
            <p className="text-xs font-black tracking-wider uppercase text-amber-700/70">ใช้ไปแล้ว</p>
            <p className="text-xl font-black text-amber-700 mt-2">
              {currencyFormatter.format(campaign.usedBudget)}
            </p>
          </div>
          <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 p-4">
            <p className="text-xs font-black tracking-wider uppercase text-emerald-700/70">คงเหลือ</p>
            <p className="text-xl font-black text-emerald-700 mt-2">
              {currencyFormatter.format(budgetInfo.remaining)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          <div className="rounded-2xl border border-[#e1bee7] bg-[#faf5fc] p-4">
            <p className="text-xs font-black tracking-wider uppercase text-[#6a1b9a]/70">
              เพดานต่อคนทั้งแคมเปญ
            </p>
            <p className="text-xl font-black text-[#4a148c] mt-2">
              {currencyFormatter.format(campaign.maxRewardPerUser ?? 0)}
            </p>
          </div>
          <div className="rounded-2xl border border-[#e1bee7] bg-[#faf5fc] p-4">
            <p className="text-xs font-black tracking-wider uppercase text-[#6a1b9a]/70">
              เพดานต่อคนต่อวัน
            </p>
            <p className="text-xl font-black text-[#4a148c] mt-2">
              {currencyFormatter.format(campaign.maxRewardPerUserPerDay ?? 0)}
            </p>
          </div>
        </div>

        <div className="mt-6">
          <p className="text-xs font-black tracking-wider uppercase text-[#6a1b9a]/70">แท็ก</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {campaign.tags.length > 0 ? (
              campaign.tags.map((tag) => (
                <span
                  key={tag.id}
                  className="rounded-lg border border-[#e1bee7] bg-[#f3e5f5]/90 px-2.5 py-1 text-[11px] font-bold text-[#6a1b9a]"
                >
                  {tag.nameTh}
                </span>
              ))
            ) : (
              <span className="text-sm text-[#6a1b9a]/55">ไม่มีแท็ก</span>
            )}
          </div>
        </div>

        <div className="mt-10 border-t border-[#e1bee7] pt-8">
          <h2 className="text-lg font-black text-[#4a148c]">แก้ไขแคมเปญ</h2>
          <p className="text-xs text-[#6a1b9a]/65 mt-1 mb-6">
            {isAdmin
              ? "ถ้าวาง JSON ใหม่แล้วบันทึก ระบบจะอัปเดตไฟล์ Flex บน Google Drive (โฟลเดอร์ย่อยตามรหัสสปอนเซอร์) — เว้นช่อง JSON ว่างจะไม่แตะไฟล์เดิม อัปโหลดรูปใหม่จะแทนที่รูปตัวอย่างเดิม"
              : "สิทธิ์ตรวจสอบดูรายละเอียดแคมเปญได้ แต่ไม่สามารถแก้ไขข้อมูลได้"}
          </p>
          <form
            className="space-y-5"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!isAdmin) {
                setSaveMessage("สิทธิ์ตรวจสอบไม่สามารถแก้ไขแคมเปญได้");
                return;
              }
              setSaveMessage(null);
              const tb = parseNonNegativeNumber(totalBudget);
              if (tb == null) {
                setSaveMessage("กรุณากรอกงบรวมเป็นตัวเลขที่ถูกต้อง");
                return;
              }
              const rps = rewardPerShare.trim() === "" ? 0 : parseNonNegativeNumber(rewardPerShare);
              const maxPerUser =
                maxRewardPerUser.trim() === "" ? 0 : parseNonNegativeNumber(maxRewardPerUser);
              const maxPerUserPerDay =
                maxRewardPerUserPerDay.trim() === ""
                  ? 0
                  : parseNonNegativeNumber(maxRewardPerUserPerDay);
              if (rps == null) {
                setSaveMessage("กรุณากรอกค่าตอบแทนต่อแชร์เป็นตัวเลขที่ถูกต้อง");
                return;
              }
              if (maxPerUser == null) {
                setSaveMessage("กรุณากรอกเพดานต่อคนต่อแคมเปญเป็นตัวเลขที่ถูกต้อง");
                return;
              }
              if (maxPerUserPerDay == null) {
                setSaveMessage("กรุณากรอกเพดานต่อคนต่อวันเป็นตัวเลขที่ถูกต้อง");
                return;
              }
              if (maxPerUser > 0 && maxPerUserPerDay > maxPerUser) {
                setSaveMessage("เพดานต่อวันต้องไม่มากกว่าเพดานต่อคนทั้งแคมเปญ");
                return;
              }
              const ub = Number(campaign?.usedBudget ?? 0);
              setSaving(true);
              try {
                const form = new FormData();
                form.set("sponsorId", sponsorId);
                form.set("name", name.trim());
                form.set("description", description.trim());
                form.set("totalBudget", String(tb));
                form.set("usedBudget", String(ub));
                form.set("shareAltText", shareAltText.trim());
                form.set("status", status);
                form.set("rewardPerShare", String(rps));
                form.set("maxRewardPerUser", String(maxPerUser));
                form.set("maxRewardPerUserPerDay", String(maxPerUserPerDay));
                form.set("flexMessageJson", flexJson);
                form.set("tagIds", JSON.stringify([...selectedTagIds]));
                if (previewFile) {
                  form.set("previewImage", previewFile);
                }

                const res = await fetch(`/api/cms/campaigns/${campaignId}`, {
                  method: "PATCH",
                  body: form,
                });
                const data = (await res.json()) as { ok?: boolean; error?: string };
                if (!res.ok || !data.ok) {
                  throw new Error(mapApiError(data.error));
                }
                setSaveMessage("บันทึกแล้ว");
                setFlexJson("");
                setPreviewFile(null);
                const refresh = await fetch(`/api/cms/campaigns/${campaignId}`, { cache: "no-store" });
                const rd = (await refresh.json()) as { campaign?: CmsCampaignRow };
                if (rd.campaign) {
                  setCampaign(rd.campaign);
                }
              } catch (err) {
                setSaveMessage(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
              } finally {
                setSaving(false);
              }
            }}
          >
            <div>
              <label className={labelClass}>ชื่อแคมเปญ</label>
              <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <label className={labelClass}>รายละเอียด</label>
              <textarea
                className={`${inputClass} min-h-[88px] resize-y`}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>งบรวม (บาท)</label>
                <input
                  className={inputClass}
                  value={totalBudget}
                  onChange={(e) => setTotalBudget(e.target.value)}
                  inputMode="decimal"
                />
              </div>
              <div>
                <label className={labelClass}>ใช้ไปแล้ว (บาท)</label>
                <input
                  className={`${inputClass} bg-gray-200 border-gray-300 text-gray-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-700`}
                  value={String(campaign.usedBudget ?? 0)}
                  disabled
                  inputMode="decimal"
                />
              </div>
            </div>
            <div>
              <label className={labelClass}>โค้ด JSON Flex (LINE)</label>
              <textarea
                className={codeAreaClass}
                value={flexJson}
                onChange={(e) => setFlexJson(e.target.value)}
                rows={10}
                spellCheck={false}
                placeholder="เว้นว่าง = คงไฟล์ Flex บน Drive เดิม — วาง JSON ใหม่เพื่ออัปเดตไฟล์"
              />
              {campaign.flexMessageJsonDriveFileId ? (
                <p className="text-[11px] text-[#6a1b9a]/55 mt-1.5 font-mono break-all">
                  ไฟล์ปัจจุบันบน Drive: {campaign.flexMessageJsonDriveFileId}
                </p>
              ) : (
                <p className="text-[11px] text-amber-700/80 mt-1.5">
                  ยังไม่มีไฟล์ Flex บน Drive — วาง JSON แล้วบันทึกเพื่อสร้างไฟล์
                </p>
              )}
            </div>
            <div>
              <label className={labelClass}>รูปตัวอย่างแคมเปญ</label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="block w-full text-sm text-[#6a1b9a] file:mr-3 file:rounded-xl file:border-0 file:bg-[#f3e5f5] file:px-4 file:py-2 file:text-sm file:font-bold file:text-[#4a148c]"
                onChange={(e) => setPreviewFile(e.target.files?.[0] ?? null)}
              />
              {previewImgSrc ? (
                <div className="mt-3 space-y-2">
                  <div className="relative w-full max-w-xs aspect-[4/3] rounded-2xl border border-[#e1bee7] overflow-hidden bg-[#faf5fc]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewImgSrc}
                      alt="ตัวอย่าง"
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                      onError={() => {
                        if (drivePreviewId && !useDriveUcFallback) {
                          setUseDriveUcFallback(true);
                        }
                      }}
                    />
                  </div>
                  {storedPreviewUrl && !previewObjectUrl ? (
                    <p className="text-[11px] text-[#6a1b9a]/55 max-w-xs leading-relaxed">
                      ถ้ารูปไม่ขึ้น ให้ตรวจสิทธิ์ไฟล์บน Drive (ต้องอ่านได้แบบลิงก์) หรืออัปโหลดรูปใหม่
                    </p>
                  ) : null}
                </div>
              ) : (
                <p className="text-[11px] text-[#6a1b9a]/50 mt-2">ยังไม่มีรูปตัวอย่าง — เลือกไฟล์เพื่ออัปโหลด</p>
              )}
            </div>
            <div>
              <label className={labelClass}>ข้อความแจ้งเตือนเมื่อแชร์ (altText / linemsg)</label>
              <textarea
                className={`${inputClass} min-h-[72px] resize-y`}
                value={shareAltText}
                onChange={(e) => setShareAltText(e.target.value.slice(0, 400))}
                maxLength={400}
                rows={2}
                placeholder="ทับข้อความจาก JSON ถ้ากรอก — ว่าง = ใช้จากไฟล์บน Drive"
              />
              <p className="text-[11px] text-[#6a1b9a]/55 mt-1">{shareAltText.length}/400</p>
            </div>
            <div>
              <label className={labelClass}>ค่าตอบแทนต่อแชร์ (บาท)</label>
              <input
                className={inputClass}
                value={rewardPerShare}
                onChange={(e) => setRewardPerShare(e.target.value)}
                inputMode="decimal"
              />
              <p className="text-[11px] text-[#6a1b9a]/55 mt-1.5 leading-relaxed">
                โควต้าแชร์สูงสุดคำนวณจากงบรวม ÷ ค่าตอบแทนต่อแชร์
                {derivedMaxShares != null
                  ? ` — ประมาณ ${derivedMaxShares.toLocaleString("th-TH")} ครั้ง`
                  : " — กรอกงบและค่าตอบแทนมากกว่า 0 เพื่อดูจำนวนครั้ง"}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>1 คนรับได้สูงสุดต่อแคมเปญ (บาท)</label>
                <input
                  className={inputClass}
                  value={maxRewardPerUser}
                  onChange={(e) => setMaxRewardPerUser(e.target.value)}
                  inputMode="decimal"
                  placeholder="0 = ไม่จำกัด"
                />
                <p className="text-[11px] text-[#6a1b9a]/55 mt-1.5 leading-relaxed">
                  {perUserShareLimit != null
                    ? `ประมาณ ${perUserShareLimit.toLocaleString("th-TH")} แชร์ต่อคนตลอดแคมเปญ`
                    : "กำหนดเพดานเงินสะสมสูงสุดที่ผู้ใช้ 1 คนจะรับได้จากแคมเปญนี้"}
                </p>
              </div>
              <div>
                <label className={labelClass}>1 คนรับได้สูงสุดต่อวัน (บาท)</label>
                <input
                  className={inputClass}
                  value={maxRewardPerUserPerDay}
                  onChange={(e) => setMaxRewardPerUserPerDay(e.target.value)}
                  inputMode="decimal"
                  placeholder="0 = ไม่จำกัด"
                />
                <p className="text-[11px] text-[#6a1b9a]/55 mt-1.5 leading-relaxed">
                  {perUserDailyShareLimit != null
                    ? `ประมาณ ${perUserDailyShareLimit.toLocaleString("th-TH")} แชร์ต่อคนต่อวัน`
                    : "ครบเพดานวันนี้แล้ว ผู้ใช้จะต้องรอวันถัดไปก่อนแชร์อีกครั้ง"}
                </p>
              </div>
            </div>
            <div>
              <label className={labelClass}>สถานะ</label>
              <select
                className={inputClass}
                value={status}
                onChange={(e) => setStatus(e.target.value as typeof status)}
              >
                <option value="active">active</option>
                <option value="paused">paused</option>
                <option value="completed">completed</option>
              </select>
            </div>
            {tags.length > 0 ? (
              <div>
                <p className={labelClass}>แท็ก</p>
                <div className="flex flex-wrap gap-2">
                  {tags.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setSelectedTagIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(t.id)) next.delete(t.id);
                          else next.add(t.id);
                          return next;
                        });
                      }}
                      className={`rounded-xl border px-3 py-1.5 text-xs font-bold transition-colors ${
                        selectedTagIds.has(t.id)
                          ? "border-[#8e24aa] bg-[#f3e5f5] text-[#4a148c]"
                          : "border-[#e1bee7] text-[#6a1b9a]/80 hover:border-[#8e24aa]/40"
                      }`}
                    >
                      {t.nameTh}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {saveMessage ? (
              <p
                className={`text-sm font-medium ${
                  saveMessage === "บันทึกแล้ว" ? "text-emerald-700" : "text-red-600"
                }`}
              >
                {saveMessage}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={saving || !isAdmin}
              className="rounded-2xl bg-[#7b1fa2] px-6 py-3 text-sm font-black text-white hover:bg-[#6a1b9a] disabled:opacity-50"
            >
              {saving ? "กำลังอัปโหลดและบันทึก…" : "บันทึกการแก้ไข"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
