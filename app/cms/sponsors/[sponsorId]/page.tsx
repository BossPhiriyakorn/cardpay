"use client";

import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Search } from "lucide-react";
import { useCmsAdminMe } from "@/hooks/useCmsAdminMe";

type Props = { params: Promise<{ sponsorId: string }> };

type SponsorRow = {
  id: string;
  clientName: string;
  status: "Active" | "Inactive";
  activeCampaigns: number;
  totalBudget: number;
  /** ไอดีที่ใช้สมัคร/ล็อกอินพอร์ทัล หรือไอดี LINE จากบัญชีที่ผูก */
  signupLoginId?: string;
  signupLoginKind?: "portal" | "line" | "";
};

type CampaignRow = {
  id: string;
  sponsorId: string;
  name: string;
  totalBudget: number;
  usedBudget: number;
  status: "active" | "paused" | "completed";
};

const currencyFormatter = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  maximumFractionDigits: 0,
});

export default function SponsorDetailPage({ params }: Props) {
  const { isAdmin, isReviewer } = useCmsAdminMe();
  const { sponsorId } = use(params);
  const [sponsors, setSponsors] = useState<SponsorRow[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const totalBudget = sponsorCampaigns.reduce((sum, c) => sum + (c.totalBudget ?? 0), 0);
  const usedBudget = sponsorCampaigns.reduce((sum, c) => sum + (c.usedBudget ?? 0), 0);

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
        <div className="rounded-3xl border border-[#d7bde2] bg-[linear-gradient(135deg,#7d6b8d_0%,#6f5f80_100%)] p-5 md:p-6 space-y-2 text-white shadow-sm">
          <p className="text-xs text-white/65">งบรวม</p>
          <p className="text-2xl font-black text-white">{currencyFormatter.format(totalBudget)}</p>
          <p className="text-xs text-white/65">ใช้ไป</p>
          <p className="text-xl font-black text-[#ff73c6]">{currencyFormatter.format(usedBudget)}</p>
        </div>
      </div>

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

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead className="border-b border-white/10 bg-white/5">
              <tr>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-white/90">Campaign</th>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-white/90">Total Budget</th>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-white/90">Used</th>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-white/90">Status</th>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-white/90 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {sponsorCampaigns.map((campaign) => (
                <tr key={campaign.id} className="hover:bg-white/[0.04] transition-colors">
                  <td className="px-6 py-4 text-sm font-bold text-white">{campaign.name}</td>
                  <td className="px-6 py-4 text-sm text-white/85">{currencyFormatter.format(campaign.totalBudget)}</td>
                  <td className="px-6 py-4 text-sm text-white/85">{currencyFormatter.format(campaign.usedBudget)}</td>
                  <td className="px-6 py-4">
                    <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-white/90">
                      {campaign.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/cms/sponsors/${sponsor.id}/campaigns/${campaign.id}/analytics`}
                      title="ดูรายละเอียด งบ และผู้แชร์ — จากหน้านี้กดแก้ไขแคมเปญได้"
                      className="inline-flex items-center rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-bold text-white/90 hover:border-[#f0abfc]/50 hover:text-[#f5d0fe] transition-colors"
                    >
                      {isReviewer ? 'ดู' : 'จัดการ'}
                    </Link>
                  </td>
                </tr>
              ))}
              {sponsorCampaigns.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-sm text-white/60">
                    ไม่พบแคมเปญสำหรับสปอนเซอร์รายนี้
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
