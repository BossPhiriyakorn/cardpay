"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useCmsAdminMe } from "@/hooks/useCmsAdminMe";

type TagRow = { id: string; nameTh: string; slug: string };

type SponsorOption = { id: string; clientName: string };

const inputClass =
  "w-full rounded-2xl border border-[#e1bee7] bg-white px-4 py-3 text-sm text-[#4a148c] placeholder:text-[#6a1b9a]/40 focus:outline-none focus:border-[#8e24aa]/50";
const labelClass = "block text-xs font-black uppercase tracking-wider text-[#6a1b9a]/70 mb-1.5";
const codeAreaClass = `${inputClass} font-mono text-xs min-h-[200px] resize-y leading-relaxed`;

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
    case "invalid_reward_limit_combination":
      return "เพดานต่อวันต้องไม่มากกว่าเพดานต่อคนทั้งแคมเปญ";
    case "missing_flex_or_card_fields":
      return "ต้องมี JSON Flex หรือกรอกข้อมูลการ์ด (รูป/หัวข้อ/เนื้อหา/ลิงก์ติดต่อ) อย่างน้อยหนึ่งส่วน";
    default:
      return code ?? "บันทึกไม่สำเร็จ";
  }
}

function parseNonNegativeNumber(value: string): number | null {
  const n = Number.parseFloat(value.replace(/,/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export default function CreateCampaignFromAdsPage() {
  const { isAdmin } = useCmsAdminMe();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sponsors, setSponsors] = useState<SponsorOption[]>([]);
  const [sponsorId, setSponsorId] = useState("");
  const [tags, setTags] = useState<TagRow[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [flexJson, setFlexJson] = useState("");
  const [shareAltText, setShareAltText] = useState("");
  const [rewardPerShare, setRewardPerShare] = useState("");
  const [maxRewardPerUser, setMaxRewardPerUser] = useState("");
  const [maxRewardPerUserPerDay, setMaxRewardPerUserPerDay] = useState("");
  const [status, setStatus] = useState<"active" | "paused" | "completed">("active");
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [previewObjectUrl, setPreviewObjectUrl] = useState<string | null>(null);
  const [shareHeadline, setShareHeadline] = useState("");
  const [shareBody, setShareBody] = useState("");
  const [contactPhoneUri, setContactPhoneUri] = useState("");
  const [contactChannelUri, setContactChannelUri] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const previewDisplayUrl = useMemo(() => previewObjectUrl, [previewObjectUrl]);

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

  useEffect(() => {
    const q = searchParams.get("sponsorId");
    if (q) setSponsorId(q);
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/cms/sponsors", { cache: "no-store" });
        const data = (await res.json()) as { ok?: boolean; sponsors?: SponsorOption[] };
        if (res.ok && data.ok && data.sponsors && !cancelled) {
          setSponsors(
            data.sponsors.map((s) => ({
              id: String(s.id),
              clientName: String(s.clientName ?? ""),
            }))
          );
        }
      } catch {
        /* ignore */
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
        const res = await fetch("/api/cms/campaign-tags", { cache: "no-store" });
        const data = (await res.json()) as { ok?: boolean; tags?: TagRow[] };
        if (res.ok && data.ok && data.tags && !cancelled) {
          setTags(
            data.tags.map((t) => ({
              id: String(t.id),
              nameTh: t.nameTh,
              slug: t.slug,
            }))
          );
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isAdmin) {
      setError("สิทธิ์ตรวจสอบไม่สามารถสร้างแคมเปญได้");
      return;
    }
    if (!sponsorId.trim()) {
      setError("กรุณาเลือกสปอนเซอร์");
      return;
    }
    setError(null);
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
    setSaving(true);
    try {
      const form = new FormData();
      form.set("name", name.trim());
      form.set("description", description.trim());
      form.set("totalBudget", "0");
      form.set("shareAltText", shareAltText.trim());
      form.set("shareHeadline", shareHeadline.trim());
      form.set("shareBody", shareBody.trim());
      form.set("contactPhoneUri", contactPhoneUri.trim());
      form.set("contactChannelUri", contactChannelUri.trim());
      form.set("status", status);
      form.set("rewardPerShare", String(rps));
      form.set("maxRewardPerUser", String(maxPerUser));
      form.set("maxRewardPerUserPerDay", String(maxPerUserPerDay));
      form.set("flexMessageJson", flexJson);
      form.set("tagIds", JSON.stringify([...selectedTagIds]));
      if (previewFile) {
        form.set("previewImage", previewFile);
      }

      const res = await fetch(`/api/cms/sponsors/${sponsorId}/campaigns`, {
        method: "POST",
        body: form,
      });
      const data = (await res.json()) as { ok?: boolean; campaignId?: string; error?: string };
      if (!res.ok || !data.ok || !data.campaignId) {
        throw new Error(mapApiError(data.error));
      }
      router.push(`/cms/sponsors/${sponsorId}/campaigns/${data.campaignId}/analytics`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  function toggleTag(id: string) {
    setSelectedTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-[#6a1b9a]/65 uppercase tracking-wider">
        <Link
          href="/cms/ads"
          className="inline-flex items-center gap-2 hover:text-[#8e24aa] transition-colors"
        >
          <ArrowLeft size={14} />
          กลับจัดการโฆษณา
        </Link>
      </div>

      <div className="bg-white border border-[#e1bee7] rounded-3xl p-5 md:p-6">
        <h1 className="text-2xl md:text-3xl font-black text-[#4a148c]">สร้างแคมเปญ</h1>
        <p className="text-sm text-[#6a1b9a]/70 mt-2">
          เลือกสปอนเซอร์ แล้วอัปโหลดรูป / กรอกข้อมูลการ์ดหรือ JSON Flex — ไฟล์จะอยู่ในโฟลเดอร์ย่อยตามรหัสสปอนเซอร์บน Google Drive
        </p>
        <div className="mt-3 rounded-2xl border border-[#ce93d8] bg-[#f3e5f5] px-4 py-3 text-sm font-bold text-[#4a148c]">
          งบโฆษณาอยู่ระดับสปอนเซอร์เท่านั้น — ไม่มีการตั้งงบในแคมเปญ
        </div>
        {!isAdmin ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
            สิทธิ์ตรวจสอบไม่สามารถสร้างแคมเปญใหม่ได้
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div>
            <label className={labelClass}>สปอนเซอร์ *</label>
            <select
              className={inputClass}
              value={sponsorId}
              onChange={(e) => setSponsorId(e.target.value)}
              required
            >
              <option value="">— เลือก —</option>
              {sponsors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.clientName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>ชื่อแคมเปญ *</label>
            <input
              className={inputClass}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="เช่น แคมเปญ Summer sale"
            />
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
          <div>
            <label className={labelClass}>โค้ด JSON Flex (LINE)</label>
            <textarea
              className={codeAreaClass}
              value={flexJson}
              onChange={(e) => setFlexJson(e.target.value)}
              rows={12}
              spellCheck={false}
              placeholder='วาง JSON ทั้งก้อน — เว้นว่างได้ถ้าสร้างการ์ดจากฟิลด์ด้านล่าง'
            />
            <p className="text-[11px] text-[#6a1b9a]/55 mt-1.5 leading-relaxed">
              โฟลเดอร์บน Drive ใช้รหัสสปอนเซอร์ที่เลือก — เว้น JSON ได้หากมีรูป/หัวข้อ/เนื้อหา/ลิงก์ครบอย่างใดอย่างหนึ่ง
            </p>
          </div>
          <div>
            <label className={labelClass}>รูปตัวอย่างแคมเปญ (ไม่บังคับ)</label>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="block w-full text-sm text-[#6a1b9a] file:mr-3 file:rounded-xl file:border-0 file:bg-[#f3e5f5] file:px-4 file:py-2 file:text-sm file:font-bold file:text-[#4a148c]"
              onChange={(e) => setPreviewFile(e.target.files?.[0] ?? null)}
            />
            {previewDisplayUrl ? (
              <div className="mt-3 relative w-full max-w-xs aspect-[4/3] rounded-2xl border border-[#e1bee7] overflow-hidden bg-[#faf5fc]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewDisplayUrl} alt="ตัวอย่าง" className="w-full h-full object-cover" />
              </div>
            ) : null}
          </div>
          <div>
            <label className={labelClass}>ข้อความแจ้งเตือนเมื่อแชร์ (altText / linemsg)</label>
            <textarea
              className={`${inputClass} min-h-[72px] resize-y`}
              value={shareAltText}
              onChange={(e) => setShareAltText(e.target.value.slice(0, 400))}
              rows={2}
              maxLength={400}
              placeholder="ข้อความที่ผู้รับเห็นก่อนเปิดการ์ด"
            />
            <p className="text-[11px] text-[#6a1b9a]/55 mt-1">
              สูงสุด 400 ตัวอักษร — {shareAltText.length}/400
            </p>
          </div>
          <div>
            <label className={labelClass}>หัวข้อบนการ์ด (แชร์ใน LINE)</label>
            <input
              className={inputClass}
              value={shareHeadline}
              onChange={(e) => setShareHeadline(e.target.value)}
              placeholder="ถ้าว่างจะใช้ชื่อแคมเปญ"
            />
          </div>
          <div>
            <label className={labelClass}>เนื้อหาบนการ์ด</label>
            <textarea
              className={`${inputClass} min-h-[88px] resize-y`}
              value={shareBody}
              onChange={(e) => setShareBody(e.target.value)}
              rows={3}
              placeholder="ถ้าว่างจะใช้รายละเอียดแคมเปญ"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>ลิงก์ปุ่มโทร (URI)</label>
              <input
                className={inputClass}
                value={contactPhoneUri}
                onChange={(e) => setContactPhoneUri(e.target.value)}
                placeholder="เช่น tel:0812345678"
              />
            </div>
            <div>
              <label className={labelClass}>ลิงก์ปุ่มช่องทางติดต่อ (URI)</label>
              <input
                className={inputClass}
                value={contactChannelUri}
                onChange={(e) => setContactChannelUri(e.target.value)}
                placeholder="เช่น https://line.me/ti/p/~xxx"
              />
            </div>
          </div>
          <div>
            <label className={labelClass}>ค่าตอบแทนต่อแชร์ (บาท)</label>
            <input
              className={inputClass}
              value={rewardPerShare}
              onChange={(e) => setRewardPerShare(e.target.value)}
              inputMode="decimal"
              placeholder="0"
            />
            <p className="text-[11px] text-[#6a1b9a]/55 mt-1.5 leading-relaxed">
              งบจำกัดจากงบรวมสปอนเซอร์ — เพดานครั้ง/วันตามตั้งค่าแพลตฟอร์ม
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
                  : "กำหนดจำนวนเงินสูงสุดที่ผู้ใช้ 1 คนจะรับได้จากแคมเปญนี้"}
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
                  : "ครบเพดานวันนี้แล้ว ผู้ใช้จะต้องรอวันถัดไปจึงแชร์ได้อีก"}
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
                    onClick={() => toggleTag(t.id)}
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

          {error ? <p className="text-sm text-red-600 font-medium">{error}</p> : null}

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="submit"
              disabled={saving || !isAdmin}
              className="rounded-2xl bg-[#7b1fa2] px-6 py-3 text-sm font-black text-white hover:bg-[#6a1b9a] disabled:opacity-50"
            >
              {saving ? "กำลังอัปโหลดและบันทึก…" : "สร้างแคมเปญ"}
            </button>
            <Link
              href="/cms/ads"
              className="inline-flex items-center rounded-2xl border border-[#e1bee7] px-6 py-3 text-sm font-bold text-[#6a1b9a] hover:border-[#8e24aa]/50"
            >
              ยกเลิก
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
