'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Megaphone,
  CheckCircle2,
  Ban,
  Tags,
  Search,
  ExternalLink,
} from 'lucide-react';
import type { CmsCampaignRow, CmsCampaignStatus } from '@/lib/cms/types';
import { useCmsAdminMe } from '@/hooks/useCmsAdminMe';

const budgetFormatter = new Intl.NumberFormat('th-TH', {
  style: 'currency',
  currency: 'THB',
  maximumFractionDigits: 0,
});

function statusLabel(status: CmsCampaignStatus) {
  switch (status) {
    case 'active':
      return { th: 'ใช้งาน', className: 'bg-emerald-500/10 text-emerald-700 border-emerald-400/35' };
    case 'paused':
      return { th: 'หยุดชั่วคราว', className: 'bg-amber-500/10 text-amber-800 border-amber-400/35' };
    case 'completed':
      return { th: 'สิ้นสุดแล้ว', className: 'bg-slate-500/10 text-slate-600 border-slate-400/30' };
    default:
      return { th: status, className: 'bg-slate-500/10 text-slate-600 border-slate-400/30' };
  }
}

type Props = {
  initialCampaigns: CmsCampaignRow[];
  initialStats: { total: number; active: number; inactive: number };
  initialTagCount: number;
};

export default function CmsCampaignsClient({
  initialCampaigns,
  initialStats,
  initialTagCount,
}: Props) {
  const { isAdmin } = useCmsAdminMe();
  const [search, setSearch] = useState('');

  const stats = initialStats;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return initialCampaigns;
    return initialCampaigns.filter((c) => {
      const tagMatch = c.tags.some(
        (t) =>
          t.nameTh.toLowerCase().includes(q) ||
          t.slug.toLowerCase().includes(q),
      );
      return (
        c.name.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        c.sponsorName.toLowerCase().includes(q) ||
        tagMatch
      );
    });
  }, [search, initialCampaigns]);

  const statCards = [
    {
      key: 'total',
      label: 'แคมเปญทั้งหมด',
      sub: 'Total campaigns',
      value: stats.total,
      icon: Megaphone,
    },
    {
      key: 'active',
      label: 'แคมเปญที่ใช้งาน',
      sub: 'Active',
      value: stats.active,
      icon: CheckCircle2,
    },
    {
      key: 'inactive',
      label: 'แคมเปญที่ไม่ใช้งาน',
      sub: 'Paused / ended',
      value: stats.inactive,
      icon: Ban,
    },
    {
      key: 'tags',
      label: 'จำนวนแท็ก',
      sub: 'Tags',
      value: initialTagCount,
      icon: Tags,
    },
  ];

  return (
    <div className="space-y-8 md:space-y-10">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-[#4a148c] tracking-tight">
            จัดการแคมเปญ
          </h1>
        </div>
        {isAdmin ? (
          <Link
            href="/cms/campaigns/tags"
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#ce93d8] bg-[#8e24aa] px-5 py-3 text-sm font-black text-white shadow-[0_8px_28px_rgba(142,36,170,0.28)] transition hover:brightness-105"
          >
            <Tags size={18} />
            เพิ่มหรือจัดการแท็กแคมเปญ
          </Link>
        ) : (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800">
            สิทธิ์ตรวจสอบดูสรุปแคมเปญได้ แต่ไม่สามารถแก้ไขแท็กได้
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 md:gap-6">
        {statCards.map((card, index) => (
          <motion.div
            key={card.key}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08 }}
            className="relative overflow-hidden rounded-2xl border border-[#e1bee7] bg-white p-5 md:p-6 shadow-sm"
          >
            <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-[#e1bee7]/40 blur-2xl" />
            <div className="relative flex items-start justify-between gap-3">
              <div className="rounded-xl border border-[#e1bee7] bg-[#f3e5f5] p-3 text-[#8e24aa]">
                <card.icon size={22} />
              </div>
            </div>
            <p className="relative mt-4 text-[10px] font-bold uppercase tracking-widest text-[#6a1b9a]/65">
              {card.label}
            </p>
            <p className="relative text-[11px] text-[#8e24aa]/80 font-medium">{card.sub}</p>
            <p className="relative mt-1 text-3xl font-black text-[#4a148c] tabular-nums">
              {card.value.toLocaleString('th-TH')}
            </p>
          </motion.div>
        ))}
      </div>

      <div className="space-y-4">
        <div className="relative max-w-md">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-[#8e24aa]/45"
            size={18}
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ค้นหาชื่อแคมเปญ สปอนเซอร์ หรือรหัส..."
            className="w-full rounded-2xl border border-[#e1bee7] bg-white py-3 pl-11 pr-4 text-sm text-[#4a148c] placeholder:text-[#6a1b9a]/40 focus:border-[#8e24aa]/50 focus:outline-none focus:ring-2 focus:ring-[#8e24aa]/15"
          />
        </div>

        <div className="overflow-hidden rounded-2xl border border-[#e1bee7] bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left">
              <thead className="border-b border-[#e1bee7] bg-[#faf5fc]">
                <tr>
                  <th className="px-5 py-4 text-xs font-black uppercase tracking-wider text-[#6a1b9a]/75">
                    แคมเปญ
                  </th>
                  <th className="px-5 py-4 text-xs font-black uppercase tracking-wider text-[#6a1b9a]/75">
                    แท็ก
                  </th>
                  <th className="px-5 py-4 text-xs font-black uppercase tracking-wider text-[#6a1b9a]/75">
                    สปอนเซอร์
                  </th>
                  <th className="px-5 py-4 text-xs font-black uppercase tracking-wider text-[#6a1b9a]/75">
                    งบรวม
                  </th>
                  <th className="px-5 py-4 text-xs font-black uppercase tracking-wider text-[#6a1b9a]/75">
                    ใช้ไปแล้ว
                  </th>
                  <th className="px-5 py-4 text-xs font-black uppercase tracking-wider text-[#6a1b9a]/75">
                    สถานะ
                  </th>
                  <th className="px-5 py-4 text-right text-xs font-black uppercase tracking-wider text-[#6a1b9a]/75">
                    สรุป (อ่านอย่างเดียว)
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f3e5f5]">
                {filtered.map((row) => {
                  const st = statusLabel(row.status);
                  return (
                    <tr key={row.id} className="hover:bg-[#fcf8fd] transition-colors">
                      <td className="px-5 py-4">
                        <p className="font-bold text-[#4a148c]">{row.name}</p>
                        <p className="text-[11px] font-semibold text-[#6a1b9a]/55">ID: {row.id}</p>
                      </td>
                      <td className="px-5 py-4 align-top">
                        {row.tags.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {row.tags.map((t) => (
                              <span
                                key={t.id}
                                className="inline-block rounded-lg border border-[#e1bee7] bg-[#f3e5f5]/80 px-2 py-0.5 text-[11px] font-bold text-[#6a1b9a]"
                              >
                                {t.nameTh}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[12px] text-[#6a1b9a]/40">—</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-sm font-medium text-[#4a148c]/90">
                        {row.sponsorName}
                      </td>
                      <td className="px-5 py-4 text-sm tabular-nums text-[#4a148c]">
                        {budgetFormatter.format(row.totalBudget)}
                      </td>
                      <td className="px-5 py-4 text-sm tabular-nums text-[#6a1b9a]/85">
                        {budgetFormatter.format(row.usedBudget)}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-wide ${st.className}`}
                        >
                          {st.th}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Link
                          href={`/cms/sponsors/${row.sponsorId}/campaigns/${row.id}/analytics?readonly=1`}
                          title="ดูงบและผู้แชร์แบบอ่านอย่างเดียว — แก้ไขแคมเปญที่เมนูจัดการสปอนเซอร์เท่านั้น"
                          className="inline-flex items-center gap-1.5 rounded-xl border border-[#e1bee7] px-3 py-2 text-xs font-bold text-[#8e24aa] hover:bg-[#f3e5f5] transition-colors"
                        >
                          ดูสรุป
                          <ExternalLink size={14} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <p className="py-16 text-center text-sm font-medium text-[#6a1b9a]/55">
              ไม่พบแคมเปญที่ตรงกับคำค้น
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
