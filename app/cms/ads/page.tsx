'use client';

import Link from 'next/link';
import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Megaphone, Plus, Search, Eye, TrendingUp, Wallet } from 'lucide-react';

type CampaignStatus = 'active' | 'paused' | 'completed';

type AdCampaign = {
  id: string;
  sponsorId: string;
  sponsorName: string;
  name: string;
  totalBudget: number;
  usedBudget: number;
  status: CampaignStatus;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 0,
  }).format(value);
}

function statusUi(status: CampaignStatus) {
  if (status === 'active') {
    return {
      label: 'Active',
      className: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
    };
  }
  if (status === 'paused') {
    return {
      label: 'Paused',
      className: 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
    };
  }
  return {
    label: 'Completed',
    className: 'bg-white/5 text-white/40 border border-white/10',
  };
}

export default function AdsPage() {
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadCampaigns() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/cms/campaigns', { cache: 'no-store' });
        const data = (await res.json()) as {
          ok?: boolean;
          campaigns?: AdCampaign[];
          error?: string;
        };
        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? 'load_failed');
        }
        if (!cancelled) {
          setCampaigns(data.campaigns ?? []);
        }
      } catch {
        if (!cancelled) {
          setError('โหลดรายการโฆษณาไม่สำเร็จ');
          setCampaigns([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadCampaigns();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredCampaigns = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) return campaigns;
    return campaigns.filter((campaign) =>
      [campaign.name, campaign.sponsorName, campaign.id].some((value) =>
        value.toLowerCase().includes(keyword)
      )
    );
  }, [campaigns, search]);

  return (
    <div className="space-y-5 md:space-y-8 text-zinc-100">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-6 bg-[#241335]/40 backdrop-blur-xl border border-white/5 p-3.5 md:p-6 rounded-2xl md:rounded-3xl">
        <div className="flex items-center gap-3 md:gap-4 flex-1 w-full md:max-w-md">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-white/30 md:w-[18px] md:h-[18px]"
              size={16}
            />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ค้นหาโฆษณา / แคมเปญ..."
              className="w-full bg-white/5 border border-white/10 rounded-2xl py-2.5 md:py-3 pl-10 md:pl-12 pr-4 text-xs md:text-sm text-white placeholder:text-zinc-400 focus:outline-none focus:border-[#8e24aa]/50 transition-all"
            />
          </div>
        </div>
        <Link
          href="/cms/sponsors"
          className="flex items-center justify-center gap-2 bg-[#8e24aa] text-white text-xs md:text-sm font-black px-4 md:px-6 py-2.5 md:py-3 rounded-2xl shadow-[0_0_30px_rgba(142,36,170,0.2)] hover:brightness-110 transition-all w-full md:w-auto"
        >
          <Plus size={18} className="md:w-5 md:h-5 shrink-0" />
          ไปเพิ่มแคมเปญผ่านสปอนเซอร์
        </Link>
      </div>

      {loading ? (
        <div className="rounded-2xl md:rounded-3xl border border-white/10 bg-[#241335]/60 p-6 text-center text-sm text-white/70">
          กำลังโหลดรายการโฆษณา...
        </div>
      ) : error ? (
        <div className="rounded-2xl md:rounded-3xl border border-rose-500/20 bg-rose-500/10 p-6 text-center text-sm text-rose-200">
          {error}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:gap-6">
          {filteredCampaigns.map((campaign, index) => {
            const status = statusUi(campaign.status);
            const remainingBudget = Math.max(campaign.totalBudget - campaign.usedBudget, 0);

            return (
              <motion.div
                key={campaign.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.06 }}
                className="bg-[#241335]/60 backdrop-blur-xl border border-white/5 p-4 md:p-6 rounded-2xl md:rounded-3xl hover:border-[#8e24aa]/30 transition-all group"
              >
                <div className="flex flex-col lg:flex-row lg:items-center gap-4 md:gap-8">
                  <div className="flex items-center gap-3 md:gap-4 lg:block">
                    <div className="w-16 h-16 md:w-24 md:h-24 rounded-2xl bg-white/5 flex items-center justify-center text-[#8e24aa] border border-white/10 shrink-0 group-hover:bg-[#8e24aa]/10 transition-colors">
                      <Megaphone size={24} className="md:w-8 md:h-8" />
                    </div>
                    <div className="lg:hidden flex-1 min-w-0">
                      <div className="flex items-start gap-2 mb-1">
                        <h3 className="text-sm font-bold text-white group-hover:text-[#8e24aa] transition-colors leading-snug break-words min-w-0">
                          {campaign.name}
                        </h3>
                        <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest shrink-0 ${status.className}`}>
                          {status.label}
                        </span>
                      </div>
                      <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest leading-relaxed break-words">
                        Sponsor: <span className="text-white/70">{campaign.sponsorName}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex-1 space-y-3 md:space-y-2">
                    <div className="hidden lg:flex items-center gap-3">
                      <h3 className="text-xl font-bold text-white group-hover:text-[#8e24aa] transition-colors">
                        {campaign.name}
                      </h3>
                      <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${status.className}`}>
                        {status.label}
                      </span>
                    </div>
                    <p className="hidden lg:block text-sm text-white/40 font-bold uppercase tracking-widest">
                      Sponsor: <span className="text-white/70">{campaign.sponsorName}</span>
                    </p>

                    <div className="grid grid-cols-1 xs:grid-cols-2 sm:flex sm:items-center gap-2.5 md:gap-6 pt-1 md:pt-2">
                      <div className="flex items-center gap-2 text-[10px] md:text-xs text-white/50">
                        <Wallet size={12} className="md:w-3.5 md:h-3.5 text-[#8e24aa] shrink-0" />
                        ใช้ไป {formatMoney(campaign.usedBudget)}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] md:text-xs text-white/50">
                        <TrendingUp size={12} className="md:w-3.5 md:h-3.5 text-[#8e24aa] shrink-0" />
                        งบรวม {formatMoney(campaign.totalBudget)}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] md:text-xs text-white/50 xs:col-span-2 sm:col-auto">
                        <Eye size={12} className="md:w-3.5 md:h-3.5 text-[#8e24aa] shrink-0" />
                        คงเหลือ {formatMoney(remainingBudget)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between lg:justify-end gap-3 md:gap-4 lg:border-l lg:border-white/5 lg:pl-8 pt-3 lg:pt-0 border-t lg:border-t-0 border-white/5">
                    <Link
                      href={`/cms/sponsors/${campaign.sponsorId}/campaigns/${campaign.id}/analytics`}
                      className="flex-1 lg:flex-none px-5 md:px-6 py-2 md:py-2.5 bg-white/5 border border-white/10 rounded-xl text-[10px] md:text-xs font-bold text-white/80 hover:bg-[#8e24aa] hover:text-white hover:border-[#8e24aa] transition-all text-center"
                    >
                      จัดการแคมเปญ
                    </Link>
                  </div>
                </div>
              </motion.div>
            );
          })}

          {filteredCampaigns.length === 0 ? (
            <div className="rounded-2xl md:rounded-3xl border border-white/10 bg-[#241335]/60 p-8 text-center text-sm text-white/60 font-bold">
              ไม่พบรายการโฆษณา/แคมเปญที่ตรงกับคำค้น
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
