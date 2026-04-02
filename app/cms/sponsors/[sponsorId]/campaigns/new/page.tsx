"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { shareQuotaFromBudget } from "@/lib/share-quota";
import { useCmsAdminMe } from "@/hooks/useCmsAdminMe";

type Props = { params: Promise<{ sponsorId: string }> };

type TagRow = { id: string; nameTh: string; slug: string };

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
    default:
      return code ?? "บันทึกไม่สำเร็จ";
  }
}

function parseNonNegativeNumber(value: string): number | null {
  const n = Number.parseFloat(value.replace(/,/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export default function NewCampaignPage({ params }: Props) {
  const { isAdmin } = useCmsAdminMe();
  const { sponsorId } = use(params);
  const router = useRouter();
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
  const [error, setError] = useState<string | null>(null);

  const previewDisplayUrl = useMemo(() => previewObjectUrl, [previewObjectUrl]);

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
    setError(null);
    const budget = parseNonNegativeNumber(totalBudget);
    if (budget == null) {
      setError("กรุณากรอกงบรวมเป็นตัวเลขที่ถูกต้อง");
      return;
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
    setSaving(true);
    try {
      const form = new FormData();
      form.set("name", name.trim());
      form.set("description", description.trim());
      form.set("totalBudget", String(budget));
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
          href={`/cms/sponsors/${sponsorId}`}
          className="inline-flex items-center gap-2 hover:text-[#8e24aa] transition-colors"
        >
          <ArrowLeft size={14} />
          กลับไปหน้าสปอนเซอร์
        </Link>
      </div>

      <div className="bg-white border border-[#e1bee7] rounded-3xl p-5 md:p-6">
        <h1 className="text-2xl md:text-3xl font-black text-[#4a148c]">เพิ่มแคมเปญ</h1>
        <p className="text-sm text-[#6a1b9a]/70 mt-2">
          Sponsor ID: {sponsorId} — ไฟล์ Flex JSON และรูปตัวอย่างจะถูกอัปโหลดไปยังโฟลเดอร์ย่อยชื่อรหัสนี้บน Google Drive
        </p>
        {!isAdmin ? (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
            สิทธิ์ตรวจสอบไม่สามารถสร้างแคมเปญใหม่ได้
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
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
            <label className={labelClass}>งบรวม (บาท) *</label>
            <input
              className={inputClass}
              value={totalBudget}
              onChange={(e) => setTotalBudget(e.target.value)}
              required
              inputMode="decimal"
              placeholder="0"
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
              placeholder='วาง JSON ทั้งก้อน (เช่น tectony1 หรือ { "type": "flex", ... }) — เว้นว่างได้ถ้ายังไม่พร้อม'
            />
            <p className="text-[11px] text-[#6a1b9a]/55 mt-1.5 leading-relaxed">
              เมื่อกดสร้างแคมเปญ ระบบจะตรวจสอบความถูกต้องของ JSON แล้วอัปโหลดเป็นไฟล์ .json ใน Drive ภายใต้โฟลเดอร์{" "}
              <span className="font-mono text-[#4a148c]/80">{sponsorId}</span> / โฟลเดอร์ JSON หลักที่ตั้งใน env
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
            <p className="text-[11px] text-[#6a1b9a]/55 mt-1">
              อัปโหลดไปยังโฟลเดอร์รูปบน Drive ภายใต้รหัสสปอนเซอร์เดียวกัน — ใช้แสดงในแอป (ลิงก์เปิดดูได้แบบ public read)
            </p>
          </div>
          <div>
            <label className={labelClass}>ข้อความแจ้งเตือนเมื่อแชร์ (altText / linemsg)</label>
            <textarea
              className={`${inputClass} min-h-[72px] resize-y`}
              value={shareAltText}
              onChange={(e) => setShareAltText(e.target.value.slice(0, 400))}
              rows={2}
              maxLength={400}
              placeholder="ข้อความที่ผู้รับเห็นก่อนเปิดการ์ด — ถ้าว่างจะใช้จาก JSON บน Drive (เช่น tectony1[0].linemsg)"
            />
            <p className="text-[11px] text-[#6a1b9a]/55 mt-1">
              สูงสุด 400 ตัวอักษรตามข้อจำกัด LINE — {shareAltText.length}/400
            </p>
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
              href={`/cms/sponsors/${sponsorId}`}
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
