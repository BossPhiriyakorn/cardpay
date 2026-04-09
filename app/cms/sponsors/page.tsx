"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Building2, Plus, Search, X } from "lucide-react";
import { useCmsAdminMe } from "@/hooks/useCmsAdminMe";

type EligibleSponsorApplicant = {
  userId: string;
  name: string;
};

type SponsorRow = {
  id: string;
  userId: string;
  clientName: string;
  status: "Active" | "Inactive";
  activeCampaigns: number;
  totalBudget: number;
  advertisingTotalBudget?: number;
  advertisingUsedBudget?: number;
};

const budgetFormatter = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  maximumFractionDigits: 0,
});

export default function SponsorsPage() {
  const { isAdmin, isReviewer } = useCmsAdminMe();
  const [sponsorRows, setSponsorRows] = useState<SponsorRow[]>([]);
  const [eligibleSponsorApplicants, setEligibleSponsorApplicants] = useState<EligibleSponsorApplicant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tableSearch, setTableSearch] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState("");

  async function loadSponsors() {
    setLoading(true);
    setError(null);
    try {
      const [sponsorsRes, eligibleRes] = await Promise.all([
        fetch('/api/cms/sponsors', { cache: 'no-store' }),
        fetch('/api/cms/sponsors/eligible-users', { cache: 'no-store' }),
      ]);
      const sponsorsData = (await sponsorsRes.json()) as { ok?: boolean; sponsors?: SponsorRow[]; error?: string };
      const eligibleData = (await eligibleRes.json()) as { ok?: boolean; users?: EligibleSponsorApplicant[] };
      if (!sponsorsRes.ok || !sponsorsData.ok) {
        throw new Error(sponsorsData.error ?? 'load_failed');
      }
      setSponsorRows(sponsorsData.sponsors ?? []);
      setEligibleSponsorApplicants(eligibleData.users ?? []);
    } catch {
      setError("โหลดข้อมูลสปอนเซอร์ไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSponsors();
  }, []);

  const filteredSponsors = useMemo(() => {
    const keyword = tableSearch.trim().toLowerCase();
    if (!keyword) return sponsorRows;

    return sponsorRows.filter(
      (item) =>
        item.clientName.toLowerCase().includes(keyword) ||
        item.id.toLowerCase().includes(keyword)
    );
  }, [sponsorRows, tableSearch]);

  const filteredEligibleApplicants = useMemo(() => {
    const keyword = memberSearch.trim().toLowerCase();
    if (!keyword) return eligibleSponsorApplicants;

    return eligibleSponsorApplicants.filter((member) =>
      member.userId.toLowerCase().includes(keyword)
    );
  }, [memberSearch]);

  const selectedApplicant =
    eligibleSponsorApplicants.find((m) => m.userId === selectedMemberId) ?? null;
  const totalSponsorsCount = sponsorRows.length;
  const totalCampaignsCount = useMemo(
    () =>
      sponsorRows.reduce(
        (sum, row) => sum + Number(row.activeCampaigns ?? 0),
        0
      ),
    [sponsorRows]
  );
  const totalAdvertisingBudgetAllSponsors = useMemo(
    () =>
      sponsorRows.reduce(
        (sum, row) => sum + Number(row.advertisingTotalBudget ?? 0),
        0
      ),
    [sponsorRows]
  );

  const handleAddSponsor = async () => {
    if (!isAdmin) {
      setError("สิทธิ์ตรวจสอบไม่สามารถเพิ่มสปอนเซอร์ได้");
      return;
    }
    if (!selectedApplicant) return;
    try {
      const res = await fetch('/api/cms/sponsors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedApplicant.userId,
          companyName: companyName.trim() || selectedApplicant.name || `Sponsor ${selectedApplicant.userId.slice(-6)}`,
        }),
      });
      const data = (await res.json()) as { ok?: boolean };
      if (!res.ok || !data.ok) throw new Error('create_failed');
      setIsAddModalOpen(false);
      setSelectedMemberId(null);
      setMemberSearch("");
      setCompanyName("");
      await loadSponsors();
    } catch {
      setError('เพิ่มสปอนเซอร์ไม่สำเร็จ');
    }
  };

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="space-y-4">
        <h1 className="text-2xl md:text-3xl font-black text-[#4a148c] tracking-tight">จัดการสปอนเซอร์</h1>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
          <div className="rounded-2xl border border-[#e1bee7] bg-white p-4 md:p-5 shadow-sm">
            <p className="text-[11px] md:text-xs font-black text-[#6a1b9a]/75 uppercase tracking-wider">
              จำนวนสปอนเซอร์
            </p>
            <p className="mt-2 text-2xl md:text-3xl font-black text-[#4a148c]">
              {totalSponsorsCount.toLocaleString("th-TH")}
            </p>
            <p className="text-[11px] md:text-xs text-[#6a1b9a]/65 mt-1">สปอนเซอร์ทั้งหมดในระบบ</p>
          </div>

          <div className="rounded-2xl border border-violet-300/60 bg-violet-50 p-4 md:p-5 shadow-sm">
            <p className="text-[11px] md:text-xs font-black text-violet-800 uppercase tracking-wider">
              จำนวนแคมเปญ
            </p>
            <p className="mt-2 text-2xl md:text-3xl font-black text-violet-900">
              {totalCampaignsCount.toLocaleString("th-TH")}
            </p>
            <p className="text-[11px] md:text-xs text-violet-700 mt-1">
              เฉพาะแคมเปญที่สถานะเปิดใช้งาน (active) ของทุกสปอนเซอร์
            </p>
          </div>

          <div className="rounded-2xl border border-emerald-300/60 bg-emerald-50 p-4 md:p-5 shadow-sm">
            <p className="text-[11px] md:text-xs font-black text-emerald-800 uppercase tracking-wider">
              งบโฆษณารวม (สปอนเซอร์)
            </p>
            <p className="mt-2 text-2xl md:text-3xl font-black text-emerald-900">
              {budgetFormatter.format(totalAdvertisingBudgetAllSponsors)}
            </p>
            <p className="text-[11px] md:text-xs text-emerald-700 mt-1">
              ผลรวมงบที่กำหนดระดับสปอนเซอร์ (ไม่แยกตามแคมเปญ)
            </p>
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white border border-[#e1bee7] p-4 md:p-5 rounded-3xl shadow-sm">
          <div className="relative w-full md:max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8e24aa]/55" size={18} />
            <input
              value={tableSearch}
              onChange={(event) => setTableSearch(event.target.value)}
              type="text"
              placeholder="ค้นหาสปอนเซอร์..."
              className="w-full bg-[#faf5fc] border border-[#e1bee7] rounded-2xl py-3 pl-11 pr-4 text-sm text-[#4a148c] placeholder:text-[#6a1b9a]/45 focus:outline-none focus:border-[#8e24aa]/50"
            />
          </div>

          {isAdmin ? (
            <button
              type="button"
              onClick={() => {
                setIsAddModalOpen(true);
                setSelectedMemberId(null);
                setMemberSearch("");
              }}
              className="inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-black text-white bg-[#8e24aa] hover:brightness-110 transition-all shadow-[0_10px_24px_rgba(142,36,170,0.25)]"
            >
              <Plus size={18} />
              เพิ่มสปอนเซอร์
            </button>
          ) : (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800">
              สิทธิ์ตรวจสอบดูข้อมูลสปอนเซอร์และแคมเปญได้เท่านั้น
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border border-[#e1bee7] rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead className="border-b border-[#f1dff5] bg-[#faf5fc]">
              <tr>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-[#6a1b9a]/85">Client / สปอนเซอร์</th>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-[#6a1b9a]/85">Active Campaigns</th>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-[#6a1b9a]/85">งบรวมสปอนเซอร์</th>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-[#6a1b9a]/85">Status</th>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-[#6a1b9a]/85 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1dff5]">
              {filteredSponsors.map((sponsor) => (
                <tr key={sponsor.id} className="hover:bg-[#fcf7fd] transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#8e24aa]/10 border border-[#8e24aa]/20 text-[#8e24aa] flex items-center justify-center">
                        <Building2 size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-[#4a148c]">{sponsor.clientName}</p>
                        <p className="text-[11px] text-[#6a1b9a]/55 font-semibold">ID: {sponsor.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-[#4a148c]/90">
                    {sponsor.activeCampaigns ?? 0} แคมเปญ
                  </td>
                  <td className="px-6 py-4 text-sm text-[#4a148c]/90">
                    <span className="font-bold tabular-nums">
                      {budgetFormatter.format(sponsor.advertisingTotalBudget ?? 0)}
                    </span>
                    <span className="block text-[11px] text-[#6a1b9a]/60 font-medium mt-0.5 tabular-nums">
                      ใช้แล้ว {budgetFormatter.format(sponsor.advertisingUsedBudget ?? 0)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wider border ${
                        sponsor.status === "Active"
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-400/30"
                          : "bg-slate-100 text-slate-600 border-slate-200"
                      }`}
                    >
                      {sponsor.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/cms/sponsors/${sponsor.id}`}
                      className="px-4 py-2 text-xs font-bold rounded-xl border border-[#e1bee7] text-[#6a1b9a] bg-transparent hover:border-[#8e24aa]/50 hover:text-[#8e24aa] transition-colors"
                    >
                      {isReviewer ? 'ดูแคมเปญ' : 'จัดการ'}
                    </Link>
                  </td>
                </tr>
              ))}

              {filteredSponsors.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-[#6a1b9a]/70">
                    {loading ? 'กำลังโหลดข้อมูล...' : (error ?? 'ไม่พบข้อมูลสปอนเซอร์ที่ค้นหา')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isAddModalOpen && isAdmin && (
        <div className="fixed inset-0 z-[90] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-[#241335] border border-white/10 rounded-3xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
              <div>
                <h2 className="text-lg md:text-xl font-black text-white">เลือกผู้ใช้เพื่อเพิ่มเป็นสปอนเซอร์</h2>
                <p className="mt-1 text-[11px] text-white/45 font-medium leading-relaxed max-w-xl">
                  แสดงผู้ใช้ที่ยังไม่ได้ถูกเพิ่มเป็นสปอนเซอร์ — ใช้รหัสผู้ใช้จากฐานข้อมูลจริง
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/5 transition-colors"
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <label className="block text-xs font-black uppercase tracking-widest text-white/45">
                ค้นหารหัสผู้ใช้ (User ID)
              </label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" size={18} />
                <input
                  value={memberSearch}
                  onChange={(event) => setMemberSearch(event.target.value)}
                  type="text"
                  inputMode="search"
                  autoComplete="off"
                  placeholder="พิมพ์รหัสผู้ใช้..."
                  className="w-full bg-[#0b1220] border border-white/10 rounded-2xl py-3 pl-11 pr-4 text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-[#8e24aa]/50 font-mono"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-black uppercase tracking-widest text-white/45">ชื่อบริษัท / สปอนเซอร์</label>
                <input
                  value={companyName}
                  onChange={(event) => setCompanyName(event.target.value)}
                  type="text"
                  placeholder="เช่น บริษัทตัวอย่าง จำกัด"
                  className="w-full bg-[#0b1220] border border-white/10 rounded-2xl py-3 px-4 text-sm text-white placeholder:text-white/35 focus:outline-none focus:border-[#8e24aa]/50"
                />
              </div>

              <ul className="max-h-56 overflow-y-auto rounded-2xl border border-white/10 divide-y divide-white/10 bg-[#0b1220]">
                {filteredEligibleApplicants.map((member) => {
                  const isSelected = selectedMemberId === member.userId;
                  return (
                    <li key={member.userId}>
                      <button
                        type="button"
                        onClick={() => setSelectedMemberId(member.userId)}
                        className={`w-full text-left px-4 py-3 text-sm transition-colors font-mono tracking-tight ${
                          isSelected
                            ? "bg-[#8e24aa]/15 text-[#7ef9ff]"
                            : "text-white/90 hover:bg-white/[0.04]"
                        }`}
                      >
                        รหัสผู้ใช้: {member.userId} {member.name ? `• ${member.name}` : ''}
                      </button>
                    </li>
                  );
                })}
                {filteredEligibleApplicants.length === 0 && (
                  <li className="px-4 py-4 text-sm text-white/45">
                    {eligibleSponsorApplicants.length === 0
                      ? "ยังไม่มีผู้ใช้ที่สมัครสปอนเซอร์และได้รับการยืนยัน"
                      : "ไม่พบรหัสผู้ใช้ที่ตรงกับคำค้น"}
                  </li>
                )}
              </ul>

              <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3 text-xs text-white/60 font-mono">
                {selectedApplicant
                  ? `เลือกแล้ว: รหัสผู้ใช้ ${selectedApplicant.userId}`
                  : "ยังไม่ได้เลือกรหัสผู้ใช้"}
              </div>
            </div>

            <div className="px-6 py-5 border-t border-white/10 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2.5 rounded-xl border border-white/15 text-white/75 text-sm font-bold hover:bg-white/5 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={!selectedMemberId}
                onClick={handleAddSponsor}
                className="px-5 py-2.5 rounded-xl bg-[#8e24aa] text-[#1a1028] text-sm font-black disabled:opacity-40 disabled:cursor-not-allowed hover:brightness-110 transition-all"
              >
                เพิ่มสปอนเซอร์
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
