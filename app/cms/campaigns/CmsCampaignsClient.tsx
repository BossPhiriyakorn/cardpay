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
  LayoutTemplate,
  Loader2,
  Pencil,
} from 'lucide-react';
import type {
  CmsCampaignRow,
  CmsCampaignStatus,
  CmsFlexTemplateTableRow,
} from '@/lib/cms/types';
import type { ListCmsCampaignsLoadError } from '@/lib/cms/campaigns-repository';
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
    case 'archived':
      return { th: 'ลบแล้ว', className: 'bg-violet-500/10 text-violet-800 border-violet-400/35' };
    default:
      return { th: status, className: 'bg-slate-500/10 text-slate-600 border-slate-400/30' };
  }
}

type Props = {
  initialCampaigns: CmsCampaignRow[];
  initialStats: { total: number; active: number; inactive: number };
  initialTagCount: number;
  loadError?: ListCmsCampaignsLoadError;
  initialFlexTemplates?: CmsFlexTemplateTableRow[];
  initialActiveFlexTemplateId?: string | null;
  flexTemplatesLoadError?: boolean;
};

function loadErrorMessage(code: ListCmsCampaignsLoadError): string {
  switch (code) {
    case 'missing_mongodb_uri':
      return 'เซิร์ฟเวอร์ไม่มี MONGODB_URI — ตรวจไฟล์ .env บน EC2 และรีสตาร์ทบริการแอป';
    case 'database_error':
      return 'โหลดรายการแคมเปญจาก MongoDB ไม่สำเร็จ — ตรวจการเชื่อมต่อ Atlas, ชื่อฐาน MONGODB_DB_NAME และดู log เซิร์ฟเวอร์';
    default:
      return 'โหลดข้อมูลไม่สำเร็จ';
  }
}

export default function CmsCampaignsClient({
  initialCampaigns,
  initialStats,
  initialTagCount,
  loadError,
  initialFlexTemplates = [],
  initialActiveFlexTemplateId = null,
  flexTemplatesLoadError = false,
}: Props) {
  const { isAdmin } = useCmsAdminMe();
  const [search, setSearch] = useState('');
  const [activeFlexTemplateId, setActiveFlexTemplateId] = useState<string | null>(
    initialActiveFlexTemplateId,
  );
  const [flexTplBusy, setFlexTplBusy] = useState<string | null>(null);
  const [flexTplError, setFlexTplError] = useState<string | null>(null);

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

  const emptyHint = loadError
    ? null
    : search.trim() === ''
      ? initialCampaigns.length === 0
        ? 'ยังไม่มีแคมเปญในระบบ — แอดมินสร้างแคมเปญแบบออกแบบเองได้ที่เมนูจัดการสปอนเซอร์ แล้วเลือกสปอนเซอร์รายนั้นเท่านั้น'
        : null
      : 'ไม่พบแคมเปญที่ตรงกับคำค้น';

  return (
    <div className="space-y-8 md:space-y-10">
      {loadError ? (
        <div
          role="alert"
          className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-900"
        >
          {loadErrorMessage(loadError)}
        </div>
      ) : null}
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-[#4a148c] tracking-tight">
            จัดการแคมเปญ
          </h1>
        </div>
        {isAdmin ? (
          <div className="flex flex-wrap gap-2">
            <Link
              href="/cms/campaigns/templates"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#ce93d8] bg-[#7b1fa2] px-5 py-3 text-sm font-black text-white shadow-[0_8px_28px_rgba(123,31,162,0.28)] transition hover:brightness-105"
            >
              <LayoutTemplate size={18} />
              จัดการเทมเพลต
            </Link>
            <Link
              href="/cms/campaigns/tags"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#ce93d8] bg-[#8e24aa] px-5 py-3 text-sm font-black text-white shadow-[0_8px_28px_rgba(142,36,170,0.28)] transition hover:brightness-105"
            >
              <Tags size={18} />
              แท็กแคมเปญ
            </Link>
          </div>
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

      <section className="space-y-3 rounded-2xl border border-[#e1bee7] bg-white p-5 md:p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-black text-[#4a148c] tracking-tight">
              เทมเพลตสำหรับพอร์ทัลสปอนเซอร์
            </h2>
            <p className="text-xs font-medium text-[#6a1b9a]/75 mt-1 max-w-2xl leading-relaxed">
              เลือกได้ทีละหนึ่งเทมเพลต — สปอนเซอร์จะสร้างแคมเปญได้ก็ต่อเมื่อมีเทมเพลตที่ «กำลังใช้งาน» ด้านล่าง
            </p>
          </div>
        </div>
        {flexTemplatesLoadError ? (
          <p className="text-sm font-bold text-red-700" role="alert">
            โหลดรายการเทมเพลตไม่สำเร็จ
          </p>
        ) : null}
        {flexTplError ? (
          <p className="text-sm font-bold text-red-700" role="alert">
            {flexTplError}
          </p>
        ) : null}
        <div className="overflow-hidden rounded-xl border border-[#f3e5f5]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-[#e1bee7] bg-[#faf5fc]">
                <tr>
                  <th className="px-4 py-3 text-xs font-black uppercase tracking-wider text-[#6a1b9a]/75">
                    เทมเพลต
                  </th>
                  <th className="px-4 py-3 text-xs font-black uppercase tracking-wider text-[#6a1b9a]/75">
                    Slug
                  </th>
                  <th className="px-4 py-3 text-xs font-black uppercase tracking-wider text-[#6a1b9a]/75">
                    อัปเดต
                  </th>
                  <th className="px-4 py-3 text-xs font-black uppercase tracking-wider text-[#6a1b9a]/75">
                    สถานะพอร์ทัล
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-black uppercase tracking-wider text-[#6a1b9a]/75">
                    การทำงาน
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f3e5f5]">
                {initialFlexTemplates.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-[#6a1b9a]/65 font-medium">
                      ยังไม่มีเทมเพลต —{' '}
                      <Link href="/cms/campaigns/templates/new" className="font-black text-[#8e24aa] underline-offset-2 hover:underline">
                        สร้างเทมเพลตแรก
                      </Link>
                    </td>
                  </tr>
                ) : (
                  initialFlexTemplates.map((row) => {
                    const isActive = activeFlexTemplateId === row.id;
                    return (
                      <tr key={row.id} className="hover:bg-[#fcf8fd] transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-bold text-[#4a148c]">{row.name}</p>
                          <p className="text-[11px] text-[#6a1b9a]/50">ID: {row.id}</p>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-[#6a1b9a]/85">{row.slug}</td>
                        <td className="px-4 py-3 text-xs tabular-nums text-[#6a1b9a]/80">
                          {row.updatedAt
                            ? new Date(row.updatedAt).toLocaleString('th-TH', {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })
                            : '—'}
                        </td>
                        <td className="px-4 py-3">
                          {isActive ? (
                            <span className="inline-flex rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-black uppercase tracking-wide text-emerald-800">
                              กำลังใช้งาน
                            </span>
                          ) : (
                            <span className="text-[12px] text-[#6a1b9a]/40">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {isAdmin ? (
                            <div className="flex flex-wrap justify-end gap-2">
                              {!isActive ? (
                                <button
                                  type="button"
                                  disabled={flexTplBusy !== null}
                                  onClick={async () => {
                                    setFlexTplError(null);
                                    setFlexTplBusy(row.id);
                                    try {
                                      const res = await fetch('/api/cms/flex-templates/active', {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ templateId: row.id }),
                                      });
                                      const data = (await res.json()) as {
                                        ok?: boolean;
                                        error?: string;
                                        activeTemplateId?: string | null;
                                      };
                                      if (!res.ok || !data.ok) {
                                        throw new Error(
                                          data.error === 'template_not_found'
                                            ? 'ไม่พบเทมเพลต'
                                            : data.error === 'forbidden'
                                              ? 'ไม่มีสิทธิ์'
                                              : 'บันทึกไม่สำเร็จ',
                                        );
                                      }
                                      setActiveFlexTemplateId(data.activeTemplateId ?? row.id);
                                    } catch (e) {
                                      setFlexTplError(e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ');
                                    } finally {
                                      setFlexTplBusy(null);
                                    }
                                  }}
                                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#ce93d8] bg-[#f3e5f5] px-3 py-1.5 text-xs font-black text-[#6a1b9a] hover:bg-[#e1bee7]/60 disabled:opacity-50"
                                >
                                  {flexTplBusy === row.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                                  ) : null}
                                  ใช้งานนี้
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={flexTplBusy !== null}
                                  onClick={async () => {
                                    setFlexTplError(null);
                                    setFlexTplBusy('clear');
                                    try {
                                      const res = await fetch('/api/cms/flex-templates/active', {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ templateId: null }),
                                      });
                                      const data = (await res.json()) as { ok?: boolean; error?: string };
                                      if (!res.ok || !data.ok) {
                                        throw new Error('ยกเลิกไม่สำเร็จ');
                                      }
                                      setActiveFlexTemplateId(null);
                                    } catch (e) {
                                      setFlexTplError(e instanceof Error ? e.message : 'ยกเลิกไม่สำเร็จ');
                                    } finally {
                                      setFlexTplBusy(null);
                                    }
                                  }}
                                  className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300/80 bg-amber-50 px-3 py-1.5 text-xs font-black text-amber-900 hover:bg-amber-100/90 disabled:opacity-50"
                                >
                                  {flexTplBusy === 'clear' ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                                  ) : null}
                                  ยกเลิกการใช้งาน
                                </button>
                              )}
                              <Link
                                href={`/cms/campaigns/templates/${row.id}/edit`}
                                className="inline-flex items-center gap-1 rounded-xl border border-[#e1bee7] px-3 py-1.5 text-xs font-bold text-[#8e24aa] hover:bg-[#f3e5f5]"
                              >
                                <Pencil size={14} aria-hidden />
                                แก้ไข
                              </Link>
                            </div>
                          ) : (
                            <span className="text-[11px] text-[#6a1b9a]/45">ดูอย่างเดียว</span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
        {!activeFlexTemplateId && initialFlexTemplates.length > 0 ? (
          <p className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200/80 rounded-xl px-3 py-2">
            ยังไม่ได้เลือกเทมเพลตที่ใช้งาน — สปอนเซอร์จะสร้างแคมเปญไม่ได้จนกว่าจะกด «ใช้งานนี้»
          </p>
        ) : null}
      </section>

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
            <table className="w-full min-w-[1080px] text-left">
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
                    แชร์แล้ว
                  </th>
                  <th className="px-5 py-4 text-xs font-black uppercase tracking-wider text-[#6a1b9a]/75">
                    งบคงเหลือ (สปอนเซอร์)
                  </th>
                  <th className="px-5 py-4 text-xs font-black uppercase tracking-wider text-[#6a1b9a]/75">
                    จ่ายผ่านแคมเปญนี้
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
                  const sponsorRemaining = Math.max(
                    0,
                    Number(row.sponsorAdvertisingTotalBudget ?? 0) -
                      Number(row.sponsorAdvertisingUsedBudget ?? 0)
                  );
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
                        {row.currentShares.toLocaleString('th-TH')}
                      </td>
                      <td
                        className="px-5 py-4 text-sm tabular-nums text-[#4a148c]"
                        title={`งบรวม ${budgetFormatter.format(row.sponsorAdvertisingTotalBudget)} · ใช้ไป ${budgetFormatter.format(row.sponsorAdvertisingUsedBudget)}`}
                      >
                        {budgetFormatter.format(sponsorRemaining)}
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
                          title="ดูการแชร์ ยอดจ่ายผ่านแคมเปญ และผู้แชร์ (อ่านอย่างเดียว) — แก้ไขที่จัดการสปอนเซอร์"
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
          {filtered.length === 0 && emptyHint ? (
            <div className="space-y-3 py-16 text-center text-sm font-medium text-[#6a1b9a]/65">
              <p>{emptyHint}</p>
              {search.trim() === '' && initialCampaigns.length === 0 ? (
                <Link
                  href="/cms/sponsors"
                  className="inline-flex font-black text-[#8e24aa] underline-offset-2 hover:underline"
                >
                  ไปจัดการสปอนเซอร์
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
