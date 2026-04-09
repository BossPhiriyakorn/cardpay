"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";

const inputClass =
  "w-full rounded-2xl border border-[#e1bee7] bg-white px-4 py-3 text-sm text-[#4a148c] placeholder:text-[#6a1b9a]/40 focus:outline-none focus:border-[#8e24aa]/50";
const labelClass = "block text-xs font-black uppercase tracking-wider text-[#6a1b9a]/70 mb-1.5";

function parseNonNegativeNumber(value: string): number | null {
  const n = Number.parseFloat(value.replace(/,/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function mapApiError(code: string | undefined): string {
  switch (code) {
    case "invalid_reward_limit_combination":
      return "เพดานต่อวันต้องไม่มากกว่าเพดานต่อคนทั้งแคมเปญ";
    case "invalid_reward_per_share":
      return "ค่าตอบแทนต่อแชร์ไม่ถูกต้อง";
    case "invalid_max_reward_per_user":
      return "เพดานต่อคนต่อแคมเปญไม่ถูกต้อง";
    case "invalid_max_reward_per_user_per_day":
      return "เพดานต่อคนต่อวันไม่ถูกต้อง";
    case "invalid_status":
      return "สถานะไม่ถูกต้อง";
    case "campaign_not_found":
      return "ไม่พบแคมเปญ";
    case "campaign_archived":
      return "แคมเปญนี้ถูกลบแล้ว ไม่สามารถแก้ไขได้";
    case "reward_fields_required_together":
      return "ต้องส่งค่าตอบแทนและเพดานทั้ง 3 ช่องพร้อมกัน";
    default:
      return code ?? "บันทึกไม่สำเร็จ";
  }
}

export default function SponsorEditCampaignPage() {
  const router = useRouter();
  const params = useParams();
  const campaignId = typeof params?.campaignId === "string" ? params.campaignId : "";

  const [authChecked, setAuthChecked] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [campaignName, setCampaignName] = useState("");
  const [rewardPerShare, setRewardPerShare] = useState("");
  const [maxRewardPerUser, setMaxRewardPerUser] = useState("");
  const [maxRewardPerUserPerDay, setMaxRewardPerUserPerDay] = useState("");
  const [status, setStatus] = useState<"active" | "paused" | "completed" | "archived">("active");
  const [isArchived, setIsArchived] = useState(false);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const loadCampaign = useCallback(async () => {
    if (!campaignId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/sponsor/campaigns/${campaignId}`, { cache: "no-store" });
      const data = (await res.json()) as {
        ok?: boolean;
        campaign?: {
          name?: string;
          status?: string;
          rewardPerShare?: number;
          maxRewardPerUser?: number;
          maxRewardPerUserPerDay?: number;
        };
        error?: string;
      };
      if (!res.ok || !data.ok || !data.campaign) {
        throw new Error(mapApiError(data.error));
      }
      const c = data.campaign;
      setCampaignName(String(c.name ?? ""));
      setRewardPerShare(String(Number(c.rewardPerShare ?? 0)));
      setMaxRewardPerUser(String(Number(c.maxRewardPerUser ?? 0)));
      setMaxRewardPerUserPerDay(String(Number(c.maxRewardPerUserPerDay ?? 0)));
      const st =
        c.status === "paused" || c.status === "completed" || c.status === "archived"
          ? c.status
          : "active";
      setStatus(st);
      setIsArchived(st === "archived");
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "โหลดไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/sponsor/auth/me", { cache: "no-store" });
        const data = (await res.json()) as { ok?: boolean; authenticated?: boolean };
        if (!cancelled) {
          setAuthed(res.ok && data.ok === true && data.authenticated === true);
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
    if (!authed || !campaignId) return;
    void loadCampaign();
  }, [authed, campaignId, loadCampaign]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!campaignId || isArchived) return;
    if (status === "archived") return;
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

    const patchStatus: "active" | "paused" =
      status === "completed" ? "paused" : status;

    setSaving(true);
    try {
      const res = await fetch(`/api/sponsor/campaigns/${campaignId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rewardPerShare: rps,
          maxRewardPerUser: maxPerUser,
          maxRewardPerUserPerDay: maxPerUserPerDay,
          status: patchStatus,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(mapApiError(data.error));
      }
      router.push("/sponsor/campaigns");
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!campaignId || isArchived) return;
    const ok = window.confirm(
      "ลบแคมเปญนี้หรือไม่? ไฟล์ Flex และรูปบน Google Drive ของแคมเปญนี้จะถูกลบ — สถิติการแชร์ในระบบยังดูย้อนหลังได้ แคมเปญจะไม่สามารถแชร์เพื่อรับรางวัลได้อีก และงบที่ใช้ไปแล้วจะไม่ถูกคืน"
    );
    if (!ok) return;
    setError(null);
    setDeleting(true);
    try {
      const res = await fetch(`/api/sponsor/campaigns/${campaignId}`, { method: "DELETE" });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(mapApiError(data.error));
      }
      router.push("/sponsor/campaigns");
    } catch (err) {
      setError(err instanceof Error ? err.message : "ลบไม่สำเร็จ");
    } finally {
      setDeleting(false);
    }
  }

  if (!authChecked) {
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

  if (!campaignId) {
    return (
      <div className="min-h-screen font-prompt px-4 py-10 bg-gradient-to-b from-[#e1bee7]/25 to-white">
        <p className="text-center text-[#4a148c]">ลิงก์แคมเปญไม่ถูกต้อง</p>
        <Link href="/sponsor/campaigns" className="mt-4 block text-center text-[#8e24aa] font-bold">
          กลับรายการแคมเปญ
        </Link>
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
          <h1 className="text-2xl md:text-3xl font-black text-[#4a148c]">ตั้งค่าแคมเปญ</h1>
          {loading ? (
            <div className="mt-10 flex justify-center py-8">
              <Loader2 className="w-8 h-8 text-[#8e24aa] animate-spin" aria-hidden />
            </div>
          ) : loadError ? (
            <p className="mt-6 text-sm text-red-600 font-medium">{loadError}</p>
          ) : (
            <>
              <p className="text-sm font-bold text-[#6a1b9a]/80 mt-2">{campaignName}</p>

              {isArchived ? (
                <div className="mt-6 rounded-2xl border border-violet-200 bg-violet-50/90 px-4 py-3 text-sm text-[#4a148c] leading-relaxed">
                  <p className="font-black">แคมเปญนี้ถูกลบแล้ว</p>
                  <p className="mt-1 text-[#6a1b9a]/90">
                    ไม่สามารถแก้ไข แชร์เพื่อรับรางวัล หรือย้ายซ้ำได้ — ยังดูสถิติย้อนหลังได้จากแดชบอร์ดและเมนูจัดการแคมเปญ
                  </p>
                </div>
              ) : null}

              <form onSubmit={handleSubmit} className="mt-8 space-y-6">
                <div className="rounded-2xl border border-[#e1bee7]/90 bg-[#faf8fc]/70 p-4 sm:p-5 space-y-5">
                  <h2 className="text-sm font-black text-[#4a148c] tracking-tight">ค่าตอบแทนและเพดาน</h2>
                  <div>
                    <label className={labelClass}>ค่าตอบแทนต่อแชร์ (บาท)</label>
                    <input
                      className={inputClass}
                      value={rewardPerShare}
                      onChange={(e) => setRewardPerShare(e.target.value)}
                      inputMode="decimal"
                      placeholder="0"
                      disabled={isArchived}
                    />
                    <p className="text-[11px] text-[#6a1b9a]/55 mt-1.5 leading-relaxed">
                      งบโฆษณาและโควต้าแชร์รวมอยู่ที่สปอนเซอร์ — แคมเปญไม่มีงบแยก
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
                        disabled={isArchived}
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
                        disabled={isArchived}
                      />
                      <p className="text-[11px] text-[#6a1b9a]/55 mt-1.5 leading-relaxed">
                        {perUserDailyShareLimit != null
                          ? `ประมาณ ${perUserDailyShareLimit.toLocaleString("th-TH")} แชร์ต่อคนต่อวัน`
                          : "ครบเพดานวันนี้แล้ว ผู้ใช้จะต้องรอวันถัดไปจึงแชร์ได้อีก"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#f3e5f5] bg-white p-4 sm:p-5 space-y-3">
                  <h2 className="text-sm font-black text-[#4a148c] tracking-tight">การจัดการแคมเปญ</h2>
                  <p className="text-[11px] text-[#6a1b9a]/60 leading-relaxed">
                    เปิดหรือหยุดแคมเปญจะบันทึกพร้อมกับค่าด้านบนเมื่อกดปุ่มบันทึก — การลบแคมเปญแยกเป็นปุ่มด้านล่าง
                  </p>
                  <div>
                    <label className={labelClass}>สถานะแคมเปญ</label>
                  {isArchived ? (
                    <p className="text-sm text-[#6a1b9a]/80 py-2">ลบแล้ว</p>
                  ) : status === "completed" ? (
                    <p className="text-sm text-[#6a1b9a]/80 py-2">
                      แคมเปญนี้สิ้นสุดแล้ว — ติดต่อแอดมินหากต้องการเปิดใช้งานอีกครั้ง
                    </p>
                  ) : (
                    <select
                      className={inputClass}
                      value={status === "paused" ? "paused" : "active"}
                      onChange={(e) => setStatus(e.target.value as "active" | "paused")}
                      disabled={isArchived}
                    >
                      <option value="active">เปิดใช้งาน</option>
                      <option value="paused">หยุดชั่วคราว</option>
                    </select>
                  )}
                </div>
                </div>

                {error ? <p className="text-sm text-red-600 font-medium">{error}</p> : null}

                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={saving || status === "completed" || isArchived}
                    className="rounded-2xl bg-[#7b1fa2] px-6 py-3 text-sm font-black text-white hover:bg-[#6a1b9a] disabled:opacity-50"
                  >
                    {saving ? "กำลังบันทึก…" : "บันทึกค่าตอบแทน เพดาน และสถานะ"}
                  </button>
                  <Link
                    href="/sponsor"
                    className="inline-flex items-center rounded-2xl border border-[#e1bee7] px-6 py-3 text-sm font-bold text-[#6a1b9a] hover:border-[#8e24aa]/50"
                  >
                    ยกเลิก
                  </Link>
                  <button
                    type="button"
                    onClick={() => void handleDelete()}
                    disabled={deleting || isArchived}
                    className="rounded-2xl border border-red-200 bg-red-50 px-6 py-3 text-sm font-black text-red-700 hover:bg-red-100 disabled:opacity-50 ml-auto sm:ml-0"
                  >
                    {deleting ? "กำลังดำเนินการ…" : isArchived ? "ลบแล้ว" : "ลบ"}
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
