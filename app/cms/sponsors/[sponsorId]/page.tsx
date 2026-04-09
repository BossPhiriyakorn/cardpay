"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Search, Table2, Wallet } from "lucide-react";
import { useCmsAdminMe } from "@/hooks/useCmsAdminMe";

type Props = { params: Promise<{ sponsorId: string }> };

type SponsorRow = {
  id: string;
  clientName: string;
  status: "Active" | "Inactive";
  activeCampaigns: number;
  totalBudget: number;
  advertisingTotalBudget?: number;
  advertisingUsedBudget?: number;
  advertisingBudgetToppedUpAt?: string | null;
  /** ไอดีที่ใช้สมัคร/ล็อกอินพอร์ทัล หรือไอดี LINE จากบัญชีที่ผูก */
  signupLoginId?: string;
  signupLoginKind?: "portal" | "line" | "";
};

type CampaignRow = {
  id: string;
  sponsorId: string;
  name: string;
  usedBudget: number;
  currentShares?: number;
  status: "active" | "paused" | "completed" | "archived";
};

const currencyFormatter = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  maximumFractionDigits: 0,
});

function cmsCampaignStatusLabel(status: CampaignRow["status"]): string {
  switch (status) {
    case "active":
      return "เปิดใช้งาน";
    case "paused":
      return "หยุดชั่วคราว";
    case "completed":
      return "จบแล้ว";
    case "archived":
      return "ลบแล้ว";
    default:
      return status;
  }
}

function formatBudgetToppedUpAt(iso: string | null | undefined): string {
  if (!iso) return "ยังไม่มีบันทึกการเติมงบ";
  try {
    return new Intl.DateTimeFormat("th-TH", {
      dateStyle: "long",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return "—";
  }
}

export default function SponsorDetailPage({ params }: Props) {
  const { isAdmin, isReviewer } = useCmsAdminMe();
  const { sponsorId } = use(params);
  const [sponsors, setSponsors] = useState<SponsorRow[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [topUpModalOpen, setTopUpModalOpen] = useState(false);
  const [topUpAmountInput, setTopUpAmountInput] = useState("");
  const [topUpSaving, setTopUpSaving] = useState(false);
  const [topUpError, setTopUpError] = useState<string | null>(null);
  const [inactiveTab, setInactiveTab] = useState<"archived" | "paused">("archived");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [sponsorRes, campaignsRes] = await Promise.all([
          fetch("/api/cms/sponsors", { cache: "no-store" }),
          fetch("/api/cms/campaigns", { cache: "no-store" }),
        ]);
        const sponsorData = (await sponsorRes.json()) as { ok?: boolean; sponsors?: SponsorRow[] };
        const campaignData = (await campaignsRes.json()) as {
          ok?: boolean;
          campaigns?: CampaignRow[];
        };
        if (!sponsorRes.ok || !campaignsRes.ok || !sponsorData.ok || !campaignData.ok) {
          throw new Error("load_failed");
        }
        if (!cancelled) {
          setSponsors(sponsorData.sponsors ?? []);
          setCampaigns(campaignData.campaigns ?? []);
        }
      } catch {
        if (!cancelled) setError("โหลดข้อมูลสปอนเซอร์ไม่สำเร็จ");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const sponsor = sponsors.find((x) => x.id === sponsorId) ?? null;

  const sponsorCampaigns = useMemo(() => {
    const bySponsor = campaigns.filter((x) => x.sponsorId === sponsorId);
    const keyword = search.trim().toLowerCase();
    if (!keyword) return bySponsor;
    return bySponsor.filter((c) => [c.id, c.name].some((v) => v.toLowerCase().includes(keyword)));
  }, [campaigns, sponsorId, search]);

  const sponsorCampaignsActive = useMemo(
    () => sponsorCampaigns.filter((c) => c.status === "active"),
    [sponsorCampaigns]
  );
  const sponsorCampaignsArchived = useMemo(
    () => sponsorCampaigns.filter((c) => c.status === "archived"),
    [sponsorCampaigns]
  );
  const sponsorCampaignsPausedOrEnded = useMemo(
    () => sponsorCampaigns.filter((c) => c.status === "paused" || c.status === "completed"),
    [sponsorCampaigns]
  );

  if (loading) {
    return (
      <div className="rounded-2xl border border-[#e1bee7] bg-white p-6 text-[#6a1b9a]/70 shadow-sm">
        กำลังโหลดข้อมูล...
      </div>
    );
  }

  if (!sponsor) {
    return (
      <div className="rounded-2xl border border-[#e1bee7] bg-white p-6 text-[#6a1b9a]/70 shadow-sm">
        {error ?? "ไม่พบสปอนเซอร์"}
      </div>
    );
  }

  const advInitial = Math.max(0, sponsor.advertisingTotalBudget ?? 0);
  const advUsed = Math.max(0, sponsor.advertisingUsedBudget ?? 0);
  const advRemaining = Math.max(0, advInitial - advUsed);

  function openTopUpModal() {
    setTopUpError(null);
    setTopUpAmountInput("");
    setTopUpModalOpen(true);
  }

  async function confirmTopUp(e: React.FormEvent) {
    e.preventDefault();
    if (!isAdmin) return;
    setTopUpError(null);
    const n = Math.max(0, Math.floor(Number(String(topUpAmountInput).replace(/,/g, "")) || 0));
    if (!Number.isFinite(n) || n <= 0) {
      setTopUpError("กรุณากรอกจำนวนเงินที่เติม (มากกว่า 0)");
      return;
    }
    setTopUpSaving(true);
    try {
      const res = await fetch(`/api/cms/sponsors/${sponsorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ advertisingTopUpAmount: n }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        if (data.error === "invalid_top_up_amount") {
          setTopUpError("จำนวนเงินเติมไม่ถูกต้อง");
        } else {
          setTopUpError("เติมงบไม่สำเร็จ");
        }
        return;
      }
      const sponsorRes = await fetch("/api/cms/sponsors", { cache: "no-store" });
      const sponsorData = (await sponsorRes.json()) as { ok?: boolean; sponsors?: SponsorRow[] };
      if (sponsorRes.ok && sponsorData.ok && sponsorData.sponsors) {
        setSponsors(sponsorData.sponsors);
      }
      setTopUpModalOpen(false);
      setTopUpAmountInput("");
    } catch {
      setTopUpError("เติมงบไม่สำเร็จ");
    } finally {
      setTopUpSaving(false);
    }
  }

  const signupLabel =
    sponsor.signupLoginKind === "portal"
      ? "ไอดีที่ใช้สมัคร/เข้าพอร์ทัล"
      : sponsor.signupLoginKind === "line"
        ? "ไอดี LINE (บัญชีที่ผูก)"
        : null;

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3 text-xs font-bold uppercase tracking-wider text-[#6a1b9a]/70">
          <Link
            href="/cms/sponsors"
            className="inline-flex items-center gap-2 rounded-xl border border-[#e1bee7] bg-white px-3 py-2 text-[#6a1b9a] shadow-sm hover:border-[#8e24aa]/50 hover:text-[#8e24aa] transition-colors"
          >
            <ArrowLeft size={14} />
            กลับหน้ารายการสปอนเซอร์
          </Link>
        </div>
        <div className="text-[11px] font-mono normal-case text-[#6a1b9a]/55 space-y-0.5 sm:text-right">
          {signupLabel && sponsor.signupLoginId ? (
            <p className="text-[#4a148c] font-sans font-semibold tracking-normal">
              <span className="text-[#6a1b9a]/65">{signupLabel}: </span>
              {sponsor.signupLoginId}
            </p>
          ) : null}
          <p>
            <span className="text-[#6a1b9a]/55">รหัสอ้างอิงระบบ: </span>
            {sponsor.id}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        <div className="lg:col-span-2 rounded-3xl border border-[#d7bde2] bg-[linear-gradient(135deg,#7d6b8d_0%,#6f5f80_100%)] p-5 md:p-6 text-white shadow-sm">
          <h1 className="text-xl md:text-2xl font-black text-white">{sponsor.clientName}</h1>
          {signupLabel && sponsor.signupLoginId ? (
            <p className="mt-2 text-sm text-white/90">
              <span className="text-white/65">{signupLabel}: </span>
              <span className="font-semibold text-white">{sponsor.signupLoginId}</span>
            </p>
          ) : (
            <p className="mt-2 text-sm text-white/65">ยังไม่มีไอดีสมัครพอร์ทัลหรือบัญชี LINE ที่ผูก</p>
          )}
          <p className="mt-2 text-[11px] text-white/60">รหัสอ้างอิงในระบบ: {sponsor.id}</p>
        </div>
        <div className="rounded-3xl border border-[#d7bde2] bg-[linear-gradient(135deg,#7d6b8d_0%,#6f5f80_100%)] p-5 md:p-6 text-white shadow-sm flex flex-col">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-white/70">งบโฆษณารวม (สปอนเซอร์)</p>
              <p className="mt-1 text-[11px] text-white/55 leading-relaxed max-w-[240px]">
                งบอยู่ระดับสปอนเซอร์ — แคมเปญไม่มีงบแยก แชร์ที่มีรางวัลหักจากกองนี้
              </p>
            </div>
            {isAdmin ? (
              <button
                type="button"
                onClick={openTopUpModal}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-2xl border border-white/25 bg-white/10 px-3 py-2 text-xs font-black text-white hover:bg-white/15 transition-colors"
              >
                <Wallet size={14} />
                เติมงบ
              </button>
            ) : null}
          </div>

          <div className="mt-4 space-y-3 border-t border-white/10 pt-4">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs text-white/65">งบตั้งต้น</span>
              <span className="text-lg font-black tabular-nums text-white">{currencyFormatter.format(advInitial)}</span>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs text-white/65">งบที่ใช้ไป</span>
              <span className="text-lg font-black tabular-nums text-[#ff73c6]">{currencyFormatter.format(advUsed)}</span>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs text-white/65">งบคงเหลือ</span>
              <span className="text-xl font-black tabular-nums text-[#e9d5ff]">{currencyFormatter.format(advRemaining)}</span>
            </div>
          </div>

          <p className="mt-4 text-[11px] text-white/50 border-t border-white/10 pt-3 leading-relaxed">
            เติมงบล่าสุด:{" "}
            <span className="font-semibold text-white/75">
              {formatBudgetToppedUpAt(sponsor.advertisingBudgetToppedUpAt ?? null)}
            </span>
          </p>
        </div>
      </div>

      {topUpModalOpen && isAdmin ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          role="presentation"
          onClick={() => !topUpSaving && setTopUpModalOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="topup-modal-title"
            className="w-full max-w-md rounded-3xl border border-[#e1bee7] bg-white p-6 shadow-xl text-[#4a148c]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="topup-modal-title" className="text-lg font-black text-[#4a148c]">
              เติมงบโฆษณา
            </h2>
            <p className="mt-2 text-xs text-[#6a1b9a]/80 leading-relaxed">
              ยืนยันแล้ว งบตั้งต้นใหม่ = งบคงเหลือปัจจุบัน + จำนวนที่เติม และงบที่ใช้ไปจะถูกรีเป็น 0 (มุมมองรวมของกองนี้)
            </p>
            <div className="mt-4 rounded-2xl bg-[#f3e5f5]/60 border border-[#e1bee7] px-4 py-3">
              <p className="text-[11px] font-bold text-[#6a1b9a]/75">งบคงเหลือตอนนี้</p>
              <p className="text-xl font-black tabular-nums text-[#4a148c] mt-0.5">
                {currencyFormatter.format(advRemaining)}
              </p>
            </div>
            <form onSubmit={(e) => void confirmTopUp(e)} className="mt-4 space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-[#6a1b9a]/75 mb-1">จำนวนเงินที่จะเติม (บาท)</label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoFocus
                  value={topUpAmountInput}
                  onChange={(e) => setTopUpAmountInput(e.target.value)}
                  placeholder="เช่น 5000"
                  className="w-full rounded-2xl border border-[#e1bee7] bg-[#faf5fc] px-4 py-3 text-sm font-bold text-[#4a148c] focus:outline-none focus:border-[#8e24aa]/50"
                />
              </div>
              {topUpError ? <p className="text-xs font-bold text-red-600">{topUpError}</p> : null}
              <div className="flex flex-wrap justify-end gap-2 pt-1">
                <button
                  type="button"
                  disabled={topUpSaving}
                  onClick={() => setTopUpModalOpen(false)}
                  className="rounded-2xl border border-[#e1bee7] px-4 py-2.5 text-sm font-bold text-[#6a1b9a] hover:bg-[#faf5fc] disabled:opacity-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="submit"
                  disabled={topUpSaving}
                  className="rounded-2xl bg-[#8e24aa] px-5 py-2.5 text-sm font-black text-white hover:brightness-110 disabled:opacity-60"
                >
                  {topUpSaving ? "กำลังบันทึก…" : "ยืนยันเติมงบ"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-3xl border border-[#d7bde2] bg-[linear-gradient(180deg,#7d6b8d_0%,#746482_100%)] text-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-white/10 p-5 md:p-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full md:max-w-sm">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/35" size={18} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ค้นหาแคมเปญ..."
              className="w-full rounded-2xl border border-white/10 bg-[#111827] px-4 py-3 pl-11 text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-[#d946ef]/50"
            />
          </div>
          {isAdmin ? (
            <Link
              href={`/cms/sponsors/${sponsorId}/campaigns/new`}
              className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-[#c026d3] px-4 py-3 text-xs font-black uppercase tracking-wide text-white shadow-[0_10px_24px_rgba(192,38,211,0.28)] hover:bg-[#a21caf] transition-colors"
            >
              เพิ่มแคมเปญ
            </Link>
          ) : (
            <div className="text-[11px] font-bold text-white/75">
              สิทธิ์ตรวจสอบดูแคมเปญได้อย่างเดียว
            </div>
          )}
        </div>

        <div className="border-b border-white/10 px-5 py-4 md:px-6">
          <p className="text-sm font-black text-white">แคมเปญที่เปิดใช้งาน</p>
          <p className="mt-1 text-[11px] text-white/60 leading-relaxed">
            จัดการและดูยอดเฉพาะแคมเปญสถานะ «เปิด» — แคมเปญหยุดหรือลบแล้วอยู่การ์ดถัดไป
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead className="border-b border-white/10 bg-white/5">
              <tr>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-white/90">Campaign</th>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-white/90">แชร์แล้ว</th>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-white/90">จ่ายผ่านแคมเปญนี้</th>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-white/90">สถานะ</th>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-white/90 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {sponsorCampaignsActive.map((campaign) => (
                <tr key={campaign.id} className="hover:bg-white/[0.04] transition-colors">
                  <td className="px-6 py-4 text-sm font-bold text-white">{campaign.name}</td>
                  <td className="px-6 py-4 text-sm text-white/85 tabular-nums">
                    {(campaign.currentShares ?? 0).toLocaleString("th-TH")}
                  </td>
                  <td className="px-6 py-4 text-sm text-white/85">{currencyFormatter.format(campaign.usedBudget)}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex rounded-full border border-emerald-400/35 bg-emerald-500/15 px-3 py-1 text-[11px] font-black tracking-wider text-emerald-100">
                      {cmsCampaignStatusLabel(campaign.status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/cms/sponsors/${sponsor.id}/campaigns/${campaign.id}/analytics`}
                      title="ดูการแชร์ ยอดจ่ายผ่านแคมเปญ และผู้แชร์ — แก้ไขแคมเปญจากหน้าแก้ไข"
                      className="inline-flex items-center rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-bold text-white/90 hover:border-[#f0abfc]/50 hover:text-[#f5d0fe] transition-colors"
                    >
                      {isReviewer ? "ดู" : "จัดการ"}
                    </Link>
                  </td>
                </tr>
              ))}
              {sponsorCampaignsActive.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-sm text-white/60">
                    {sponsorCampaigns.length === 0
                      ? "ไม่พบแคมเปญสำหรับสปอนเซอร์รายนี้"
                      : "ไม่มีแคมเปญที่เปิดใช้งาน — ดูรายการในการ์ดด้านล่าง"}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      {sponsorCampaignsArchived.length > 0 || sponsorCampaignsPausedOrEnded.length > 0 ? (
        <div className="overflow-hidden rounded-3xl border border-[#d7bde2] bg-[linear-gradient(180deg,#5b4d68_0%,#4a3f56_100%)] text-white shadow-sm">
          <div className="flex flex-wrap items-start gap-3 border-b border-white/10 p-5 md:p-6">
            <div className="shrink-0 rounded-2xl bg-white/10 p-3 text-[#f5d0fe]">
              <Table2 className="h-6 w-6" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-black text-white">แคมเปญที่ไม่ได้เปิดใช้งาน</h2>
              <p className="mt-1 text-[11px] text-white/65 leading-relaxed">
                ตารางสรุป — ไม่มีกราฟ — แยกดูแคมเปญที่ลบแล้ว กับแคมเปญที่หยุดหรือจบแล้ว
              </p>
            </div>
          </div>
          <div className="flex w-full max-w-md gap-1 border-b border-white/10 px-5 py-3 md:px-6">
            <button
              type="button"
              onClick={() => setInactiveTab("archived")}
              className={`min-h-[40px] flex-1 rounded-xl px-3 py-2 text-xs font-black transition-colors sm:text-sm ${
                inactiveTab === "archived"
                  ? "bg-white/15 text-white ring-1 ring-white/25"
                  : "text-white/55 hover:text-white"
              }`}
            >
              ลบแล้ว ({sponsorCampaignsArchived.length})
            </button>
            <button
              type="button"
              onClick={() => setInactiveTab("paused")}
              className={`min-h-[40px] flex-1 rounded-xl px-3 py-2 text-xs font-black transition-colors sm:text-sm ${
                inactiveTab === "paused"
                  ? "bg-white/15 text-white ring-1 ring-white/25"
                  : "text-white/55 hover:text-white"
              }`}
            >
              หยุด / จบแล้ว ({sponsorCampaignsPausedOrEnded.length})
            </button>
          </div>
          <div className="overflow-x-auto">
            {inactiveTab === "archived" ? (
              sponsorCampaignsArchived.length === 0 ? (
                <p className="px-6 py-10 text-center text-sm text-white/55">ไม่มีแคมเปญที่ลบแล้ว</p>
              ) : (
                <table className="w-full min-w-[680px] text-left">
                  <thead className="border-b border-white/10 bg-white/5">
                    <tr>
                      <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-white/90">Campaign</th>
                      <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-white/90">แชร์แล้ว</th>
                      <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-white/90">จ่ายผ่านแคมเปญนี้</th>
                      <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-white/90">สถานะ</th>
                      <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-white/90 text-right">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {sponsorCampaignsArchived.map((campaign) => (
                      <tr key={campaign.id} className="hover:bg-white/[0.04] transition-colors">
                        <td className="px-6 py-4 text-sm font-bold text-white">{campaign.name}</td>
                        <td className="px-6 py-4 text-sm text-white/85 tabular-nums">
                          {(campaign.currentShares ?? 0).toLocaleString("th-TH")}
                        </td>
                        <td className="px-6 py-4 text-sm text-white/85">
                          {currencyFormatter.format(campaign.usedBudget)}
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex rounded-full border border-violet-300/35 bg-violet-500/15 px-3 py-1 text-[11px] font-black text-violet-100">
                            {cmsCampaignStatusLabel(campaign.status)}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Link
                            href={`/cms/sponsors/${sponsor.id}/campaigns/${campaign.id}/analytics`}
                            className="inline-flex items-center rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-bold text-white/90 hover:border-[#f0abfc]/50 hover:text-[#f5d0fe] transition-colors"
                          >
                            {isReviewer ? "ดู" : "จัดการ"}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )
            ) : sponsorCampaignsPausedOrEnded.length === 0 ? (
              <p className="px-6 py-10 text-center text-sm text-white/55">ไม่มีแคมเปญที่หยุดหรือจบแล้ว</p>
            ) : (
              <table className="w-full min-w-[720px] text-left">
                <thead className="border-b border-white/10 bg-white/5">
                  <tr>
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-white/90">Campaign</th>
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-white/90">แชร์แล้ว</th>
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-white/90">จ่ายผ่านแคมเปญนี้</th>
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-white/90">สถานะ</th>
                    <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-white/90 text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {sponsorCampaignsPausedOrEnded.map((campaign) => (
                    <tr key={campaign.id} className="hover:bg-white/[0.04] transition-colors">
                      <td className="px-6 py-4 text-sm font-bold text-white">{campaign.name}</td>
                      <td className="px-6 py-4 text-sm text-white/85 tabular-nums">
                        {(campaign.currentShares ?? 0).toLocaleString("th-TH")}
                      </td>
                      <td className="px-6 py-4 text-sm text-white/85">{currencyFormatter.format(campaign.usedBudget)}</td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-black ${
                            campaign.status === "completed"
                              ? "border-amber-300/35 bg-amber-500/15 text-amber-100"
                              : "border-sky-300/35 bg-sky-500/15 text-sky-100"
                          }`}
                        >
                          {cmsCampaignStatusLabel(campaign.status)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/cms/sponsors/${sponsor.id}/campaigns/${campaign.id}/analytics`}
                          className="inline-flex items-center rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-bold text-white/90 hover:border-[#f0abfc]/50 hover:text-[#f5d0fe] transition-colors"
                        >
                          {isReviewer ? "ดู" : "จัดการ"}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
