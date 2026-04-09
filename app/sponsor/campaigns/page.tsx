"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, Pencil, Plus, Table2, Trash2 } from "lucide-react";

type CampaignRow = {
  id: string;
  name: string;
  currentShares: number;
  usedBudget: number;
  status: "active" | "paused" | "completed" | "archived";
  rewardPerShare: number;
  maxRewardPerUser: number;
  maxRewardPerUserPerDay: number;
  updatedAt: string | null;
};

const currency = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  maximumFractionDigits: 0,
});

/** เพดานรายได้ต่อคน / ต่อวัน (บาท) — 0 หมายถึงไม่จำกัดในโค้ดแคมเปญ */
function formatRewardCapBaht(value: number): string {
  const n = Math.max(0, Number(value) || 0);
  return n > 0 ? currency.format(n) : "—";
}

export default function SponsorCampaignsListPage() {
  const [authChecked, setAuthChecked] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [sponsorBudget, setSponsorBudget] = useState<{
    total: number;
    used: number;
    remaining: number;
  } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [inactiveTab, setInactiveTab] = useState<"archived" | "paused">("archived");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/sponsor/campaigns", { cache: "no-store" });
      const data = (await res.json()) as {
        ok?: boolean;
        campaigns?: CampaignRow[];
        sponsorBudget?: { total: number; used: number; remaining: number };
        error?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "โหลดไม่สำเร็จ");
      }
      const rows = data.campaigns ?? [];
      setCampaigns(rows);
      setSponsorBudget(data.sponsorBudget ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "โหลดไม่สำเร็จ");
      setCampaigns([]);
      setSponsorBudget(null);
    } finally {
      setLoading(false);
    }
  }, []);

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
    if (!authed) return;
    void load();
  }, [authed, load]);

  const campaignsActive = useMemo(
    () => campaigns.filter((c) => c.status === "active"),
    [campaigns]
  );
  const campaignsArchivedOnly = useMemo(
    () => campaigns.filter((c) => c.status === "archived"),
    [campaigns]
  );
  const campaignsPausedOrEnded = useMemo(
    () => campaigns.filter((c) => c.status === "paused" || c.status === "completed"),
    [campaigns]
  );

  async function toggleEnabled(c: CampaignRow) {
    if (c.status === "archived" || c.status === "completed") return;
    const next: "active" | "paused" = c.status === "active" ? "paused" : "active";
    setBusyId(c.id);
    setError(null);
    try {
      const res = await fetch(`/api/sponsor/campaigns/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "อัปเดตไม่สำเร็จ");
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "อัปเดตสถานะไม่สำเร็จ");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (
      !window.confirm(
        `ลบแคมเปญ "${name}" หรือไม่?\n\nไฟล์ Flex และรูปบน Google Drive ของแคมเปญนี้จะถูกลบ — สถิติการแชร์ในระบบยังดูย้อนหลังได้ แคมเปญนี้จะไม่สามารถแชร์เพื่อรับรางวัลได้อีก และงบที่ใช้ไปแล้วจะไม่ถูกคืน`
      )
    ) {
      return;
    }
    setBusyId(id);
    try {
      const res = await fetch(`/api/sponsor/campaigns/${id}`, { method: "DELETE" });
      const data = (await res.json()) as { ok?: boolean };
      if (!res.ok || !data.ok) {
        throw new Error("ลบไม่สำเร็จ");
      }
      await load();
    } catch {
      setError("ลบแคมเปญไม่สำเร็จ");
    } finally {
      setBusyId(null);
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

  return (
    <div className="min-h-screen font-prompt pb-12 bg-gradient-to-b from-[#e1bee7]/20 to-white">
      <div className="max-w-5xl mx-auto px-4 pt-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/sponsor"
            className="inline-flex items-center gap-2 text-xs font-bold text-[#6a1b9a]/75 uppercase tracking-wider hover:text-[#8e24aa]"
          >
            <ArrowLeft size={14} />
            กลับแดชบอร์ด
          </Link>
          <Link
            href="/sponsor/campaigns/new"
            className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-br from-[#5e35b1] to-[#8e24aa] px-4 py-2.5 text-sm font-black text-white shadow-md hover:brightness-105"
          >
            <Plus size={18} />
            สร้างแคมเปญ
          </Link>
        </div>

        <div className="bg-white border border-[#e1bee7] rounded-3xl p-5 md:p-8 shadow-sm">
          <h1 className="text-2xl md:text-3xl font-black text-[#4a148c]">จัดการแคมเปญ</h1>

          {error ? <p className="mt-4 text-sm font-bold text-red-600">{error}</p> : null}

          {loading ? (
            <div className="mt-12 flex justify-center py-8">
              <Loader2 className="w-8 h-8 text-[#8e24aa] animate-spin" aria-hidden />
            </div>
          ) : campaigns.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-dashed border-[#e1bee7] bg-[#faf8fc] px-6 py-12 text-center">
              <p className="text-[#6a1b9a] font-bold">ยังไม่มีแคมเปญ</p>
              <Link
                href="/sponsor/campaigns/new"
                className="mt-4 inline-flex items-center gap-1 text-sm font-black text-[#8e24aa] hover:underline"
              >
                สร้างแคมเปญแรก
              </Link>
            </div>
          ) : (
            <>
              <div className="mt-6">
                <h2 className="text-lg font-black text-[#4a148c]">แคมเปญที่เปิดใช้งาน</h2>
                {sponsorBudget != null && sponsorBudget.total > 0 ? (
                  <p className="mt-2 text-xs leading-relaxed text-[#6a1b9a]/85">
                    งบโฆษณารวมคงเหลือประมาณ {currency.format(sponsorBudget.remaining)} (วงเงินรวม{" "}
                    {currency.format(sponsorBudget.total)} · ใช้ไปแล้ว {currency.format(sponsorBudget.used)})
                  </p>
                ) : null}
                {campaignsActive.length === 0 ? (
                  <p className="mt-3 text-sm font-bold text-[#6a1b9a]/80">ไม่มีแคมเปญสถานะ «เปิด»</p>
                ) : (
                  <div className="mt-4 overflow-x-auto rounded-2xl border border-[#f3e5f5]">
                    <table className="w-full min-w-[1020px] text-left text-sm">
                      <thead className="bg-[#faf8fc] border-b border-[#e1bee7]">
                        <tr>
                          <th className="px-4 py-3 text-xs font-black uppercase tracking-wider text-[#6a1b9a]">
                            แคมเปญ
                          </th>
                          <th className="px-4 py-3 text-xs font-black uppercase tracking-wider text-[#6a1b9a]">
                            สถานะ
                          </th>
                          <th className="px-4 py-3 text-xs font-black uppercase tracking-wider text-[#6a1b9a] tabular-nums">
                            แชร์
                          </th>
                          <th className="px-4 py-3 text-xs font-black uppercase tracking-wider text-[#6a1b9a] tabular-nums">
                            ต่อแชร์
                          </th>
                          <th className="px-4 py-3 text-xs font-black uppercase tracking-wider text-[#6a1b9a] tabular-nums">
                            จำกัดทั้งหมดต่อคน
                          </th>
                          <th className="px-4 py-3 text-xs font-black uppercase tracking-wider text-[#6a1b9a] tabular-nums">
                            จำกัดต่อวัน
                          </th>
                          <th className="px-4 py-3 text-xs font-black uppercase tracking-wider text-[#6a1b9a]">
                            เปิด/ปิด
                          </th>
                          <th className="px-4 py-3 text-right text-xs font-black uppercase tracking-wider text-[#6a1b9a]">
                            การทำงาน
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f3e5f5]">
                        {campaignsActive.map((c) => (
                          <tr key={c.id} className="hover:bg-[#faf8fc]/80">
                            <td className="px-4 py-3 font-bold text-[#4a148c]">{c.name || "—"}</td>
                            <td className="px-4 py-3">
                              <span className="inline-flex rounded-full border border-[#e1bee7] bg-white px-2.5 py-0.5 text-[11px] font-black uppercase text-[#6a1b9a]">
                                เปิด
                              </span>
                            </td>
                            <td className="px-4 py-3 tabular-nums text-[#4a148c]">
                              {c.currentShares.toLocaleString("th-TH")}
                            </td>
                            <td className="px-4 py-3 tabular-nums text-[#4a148c]">
                              {currency.format(c.rewardPerShare)}
                            </td>
                            <td
                              className="px-4 py-3 tabular-nums text-[#6a1b9a]/85"
                              title="เพดานรายได้สะสมสูงสุดต่อผู้ใช้ในแคมเปญนี้ (บาท)"
                            >
                              {formatRewardCapBaht(c.maxRewardPerUser)}
                            </td>
                            <td
                              className="px-4 py-3 tabular-nums text-[#6a1b9a]/85"
                              title="เพดานรายได้สูงสุดต่อผู้ใช้ต่อวันในแคมเปญนี้ (บาท)"
                            >
                              {formatRewardCapBaht(c.maxRewardPerUserPerDay)}
                            </td>
                            <td className="px-4 py-3">
                              <button
                                type="button"
                                role="switch"
                                aria-checked={c.status === "active"}
                                disabled={busyId === c.id}
                                onClick={() => void toggleEnabled(c)}
                                className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-[#8e24aa]/30 disabled:opacity-50 ${
                                  c.status === "active"
                                    ? "border-[#8e24aa]/50 bg-[#e1bee7]/90"
                                    : "border-[#e1bee7] bg-[#f3e5f5]/80"
                                }`}
                              >
                                <span
                                  className={`pointer-events-none inline-block h-6 w-6 translate-y-0 rounded-full bg-white shadow ring-1 ring-black/5 transition-transform mt-px ${
                                    c.status === "active" ? "translate-x-[1.35rem]" : "translate-x-0.5"
                                  }`}
                                />
                              </button>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="inline-flex flex-wrap items-center justify-end gap-2">
                                <Link
                                  href={`/sponsor/campaigns/${c.id}/edit`}
                                  className="inline-flex items-center gap-1 rounded-xl border border-[#e1bee7] bg-white px-3 py-2 text-xs font-black text-[#6a1b9a] hover:border-[#8e24aa]/40"
                                >
                                  <Pencil className="w-3.5 h-3.5" aria-hidden />
                                  แก้ไข
                                </Link>
                                <button
                                  type="button"
                                  disabled={busyId === c.id}
                                  onClick={() => void handleDelete(c.id, c.name)}
                                  className="inline-flex items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed"
                                  title="ลบแคมเปญ — ลบไฟล์บน Drive แต่เก็บสถิติ"
                                >
                                  <Trash2 className="w-3.5 h-3.5" aria-hidden />
                                  ลบ
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {campaignsArchivedOnly.length > 0 || campaignsPausedOrEnded.length > 0 ? (
                <div className="mt-10 rounded-3xl border border-[#e1bee7]/80 bg-[#faf8fc]/40 p-5 md:p-6">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="shrink-0 p-2.5 bg-[#f3e5f5] rounded-2xl text-[#8e24aa]">
                      <Table2 className="w-6 h-6" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-lg font-black text-[#4a148c]">แคมเปญที่ไม่ได้เปิดใช้งาน</h2>
                    </div>
                  </div>
                  <div className="mt-4 flex w-full max-w-md rounded-xl border border-[#e1bee7]/80 bg-white p-1">
                    <button
                      type="button"
                      onClick={() => setInactiveTab("archived")}
                      className={`min-h-[40px] flex-1 rounded-lg px-3 py-2 text-xs sm:text-sm font-black transition-all ${
                        inactiveTab === "archived"
                          ? "bg-[#f3e5f5] text-[#4a148c] ring-1 ring-[#e1bee7]"
                          : "text-slate-500 hover:text-[#4a148c]"
                      }`}
                    >
                      ลบแล้ว ({campaignsArchivedOnly.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setInactiveTab("paused")}
                      className={`min-h-[40px] flex-1 rounded-lg px-3 py-2 text-xs sm:text-sm font-black transition-all ${
                        inactiveTab === "paused"
                          ? "bg-[#f3e5f5] text-[#4a148c] ring-1 ring-[#e1bee7]"
                          : "text-slate-500 hover:text-[#4a148c]"
                      }`}
                    >
                      หยุด / จบแล้ว ({campaignsPausedOrEnded.length})
                    </button>
                  </div>
                  <div className="mt-4 overflow-x-auto rounded-2xl border border-[#f3e5f5] bg-white">
                    {inactiveTab === "archived" ? (
                      campaignsArchivedOnly.length === 0 ? (
                        <p className="p-8 text-center text-sm text-[#6a1b9a]/75">ไม่มีแคมเปญที่ลบแล้ว</p>
                      ) : (
                        <table className="w-full min-w-[720px] text-left text-sm">
                          <thead className="bg-[#faf8fc] border-b border-[#e1bee7]">
                            <tr>
                              <th className="px-4 py-3 text-xs font-black text-[#6a1b9a]">แคมเปญ</th>
                              <th className="px-4 py-3 text-xs font-black text-[#6a1b9a] tabular-nums">แชร์</th>
                              <th className="px-4 py-3 text-xs font-black text-[#6a1b9a] tabular-nums">งบที่ใช้</th>
                              <th className="px-4 py-3 text-right text-xs font-black text-[#6a1b9a]">การทำงาน</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[#f3e5f5]">
                            {campaignsArchivedOnly.map((c) => (
                              <tr key={c.id} className="hover:bg-[#faf8fc]/80">
                                <td className="px-4 py-3 font-bold text-[#4a148c]">{c.name || "—"}</td>
                                <td className="px-4 py-3 tabular-nums">{c.currentShares.toLocaleString("th-TH")}</td>
                                <td className="px-4 py-3 tabular-nums">{currency.format(c.usedBudget)}</td>
                                <td className="px-4 py-3 text-right">
                                  <Link
                                    href={`/sponsor/campaigns/${c.id}/edit`}
                                    className="inline-flex items-center gap-1 rounded-xl border border-[#e1bee7] bg-white px-3 py-2 text-xs font-black text-[#6a1b9a] opacity-80 hover:opacity-100"
                                  >
                                    <Pencil className="w-3.5 h-3.5" aria-hidden />
                                    ดู
                                  </Link>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )
                    ) : campaignsPausedOrEnded.length === 0 ? (
                      <p className="p-8 text-center text-sm text-[#6a1b9a]/75">ไม่มีแคมเปญที่หยุดหรือจบแล้ว</p>
                    ) : (
                      <table className="w-full min-w-[1020px] text-left text-sm">
                        <thead className="bg-[#faf8fc] border-b border-[#e1bee7]">
                          <tr>
                            <th className="px-4 py-3 text-xs font-black text-[#6a1b9a]">แคมเปญ</th>
                            <th className="px-4 py-3 text-xs font-black text-[#6a1b9a]">สถานะ</th>
                            <th className="px-4 py-3 text-xs font-black text-[#6a1b9a] tabular-nums">แชร์</th>
                            <th className="px-4 py-3 text-xs font-black text-[#6a1b9a] tabular-nums">ต่อแชร์</th>
                            <th className="px-4 py-3 text-xs font-black text-[#6a1b9a] tabular-nums">
                              จำกัดทั้งหมดต่อคน
                            </th>
                            <th className="px-4 py-3 text-xs font-black text-[#6a1b9a] tabular-nums">จำกัดต่อวัน</th>
                            <th className="px-4 py-3 text-xs font-black text-[#6a1b9a]">เปิด/ปิด</th>
                            <th className="px-4 py-3 text-right text-xs font-black text-[#6a1b9a]">การทำงาน</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#f3e5f5]">
                          {campaignsPausedOrEnded.map((c) => (
                            <tr key={c.id} className="hover:bg-[#faf8fc]/80">
                              <td className="px-4 py-3 font-bold text-[#4a148c]">{c.name || "—"}</td>
                              <td className="px-4 py-3">
                                <span className="inline-flex rounded-full border border-[#e1bee7] bg-white px-2.5 py-0.5 text-[11px] font-black text-[#6a1b9a]">
                                  {c.status === "completed" ? "จบแล้ว" : "หยุด"}
                                </span>
                              </td>
                              <td className="px-4 py-3 tabular-nums text-[#4a148c]">
                                {c.currentShares.toLocaleString("th-TH")}
                              </td>
                              <td className="px-4 py-3 tabular-nums text-[#4a148c]">
                                {currency.format(c.rewardPerShare)}
                              </td>
                              <td
                                className="px-4 py-3 tabular-nums text-[#6a1b9a]/85"
                                title="เพดานรายได้สะสมสูงสุดต่อผู้ใช้ในแคมเปญนี้ (บาท)"
                              >
                                {formatRewardCapBaht(c.maxRewardPerUser)}
                              </td>
                              <td
                                className="px-4 py-3 tabular-nums text-[#6a1b9a]/85"
                                title="เพดานรายได้สูงสุดต่อผู้ใช้ต่อวันในแคมเปญนี้ (บาท)"
                              >
                                {formatRewardCapBaht(c.maxRewardPerUserPerDay)}
                              </td>
                              <td className="px-4 py-3">
                                {c.status === "completed" ? (
                                  <span className="text-[11px] font-bold text-[#6a1b9a]/45">—</span>
                                ) : (
                                  <button
                                    type="button"
                                    role="switch"
                                    aria-checked={c.status === "active"}
                                    disabled={busyId === c.id}
                                    onClick={() => void toggleEnabled(c)}
                                    className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-[#8e24aa]/30 disabled:opacity-50 ${
                                      c.status === "active"
                                        ? "border-[#8e24aa]/50 bg-[#e1bee7]/90"
                                        : "border-[#e1bee7] bg-[#f3e5f5]/80"
                                    }`}
                                  >
                                    <span
                                      className={`pointer-events-none inline-block h-6 w-6 translate-y-0 rounded-full bg-white shadow ring-1 ring-black/5 transition-transform mt-px ${
                                        c.status === "active" ? "translate-x-[1.35rem]" : "translate-x-0.5"
                                      }`}
                                    />
                                  </button>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right">
                                <div className="inline-flex flex-wrap items-center justify-end gap-2">
                                  <Link
                                    href={`/sponsor/campaigns/${c.id}/edit`}
                                    className="inline-flex items-center gap-1 rounded-xl border border-[#e1bee7] bg-white px-3 py-2 text-xs font-black text-[#6a1b9a] hover:border-[#8e24aa]/40"
                                  >
                                    <Pencil className="w-3.5 h-3.5" aria-hidden />
                                    แก้ไข
                                  </Link>
                                  {c.status !== "completed" ? (
                                    <button
                                      type="button"
                                      disabled={busyId === c.id}
                                      onClick={() => void handleDelete(c.id, c.name)}
                                      className="inline-flex items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700 hover:bg-red-100 disabled:opacity-40"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" aria-hidden />
                                      ลบ
                                    </button>
                                  ) : null}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
