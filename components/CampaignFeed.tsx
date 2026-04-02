'use client';

import React, { useEffect, useMemo, useState } from 'react';
import AffiliateCampaignCard from './AffiliateCampaignCard';
import { ChevronDown, Sparkles, Filter } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  type AppCampaign,
  type CampaignFeedResponse,
  normalizeCampaign,
} from '@/lib/app/campaign-feed';

type FilterType = 'all' | 'popular';

export default function CampaignFeed() {
  const [filter, setFilter] = useState<FilterType>('all');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [campaigns, setCampaigns] = useState<AppCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadCampaigns() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/campaigns', { cache: 'no-store' });
        const data = (await res.json()) as CampaignFeedResponse;
        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? 'โหลดแคมเปญไม่สำเร็จ');
        }
        if (!cancelled) {
          const normalized = (data.campaigns ?? [])
            .map(normalizeCampaign)
            .filter((c) => c.id && c.title);
          setCampaigns(normalized);
        }
      } catch {
        if (!cancelled) {
          setError('ไม่สามารถโหลดแคมเปญได้ในขณะนี้');
          setCampaigns([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    loadCampaigns();
    return () => {
      cancelled = true;
    };
  }, []);

  const filterOptions = [
    { value: 'all', label: 'ทั้งหมด' },
    { value: 'popular', label: 'ยอดนิยม' },
  ];

  const currentLabel = filterOptions.find(opt => opt.value === filter)?.label;

  const filteredCampaigns = useMemo(() => campaigns.filter(campaign => {
    if (filter === 'all') return true;
    if (filter === 'popular') return campaign.popular;
    return true;
  }), [campaigns, filter]);

  return (
    <section className="px-4 md:px-0 py-8 md:py-12 pb-32 font-prompt max-w-7xl mx-auto">
      {/* Header Section (Refined) */}
      <div className="flex items-center justify-between gap-4 mb-8 md:mb-10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#f3e5f5] rounded-xl border border-[#e1bee7]">
            <Sparkles size={20} className="text-[#8e24aa]" />
          </div>
          <h1 className="text-xl md:text-3xl font-black text-[#4a148c] tracking-tight">แคมเปญทั้งหมด</h1>
        </div>

        {/* Sleek Dropdown Filter */}
        <div className="relative z-20 shrink-0">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center justify-between gap-2 md:gap-4 bg-white border border-[#e1bee7] px-4 md:px-5 py-2.5 md:py-3 rounded-xl md:rounded-2xl shadow-sm hover:border-[#8e24aa]/50 transition-all min-w-[120px] md:min-w-[160px] group"
          >
            <div className="flex items-center gap-2">
              <Filter size={14} className="text-[#8e24aa]/60 group-hover:text-[#8e24aa] transition-colors" />
              <span className="text-xs md:text-sm font-bold text-[#4a148c]">{currentLabel}</span>
            </div>
            <ChevronDown 
              size={14} 
              className={`text-slate-400 transition-transform duration-300 ${isDropdownOpen ? 'rotate-180' : ''}`} 
            />
          </button>

          <AnimatePresence>
            {isDropdownOpen && (
              <>
                <div 
                  className="fixed inset-0 z-[-1]" 
                  onClick={() => setIsDropdownOpen(false)} 
                />
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute top-full right-0 mt-2 bg-white border border-[#e1bee7] rounded-2xl shadow-xl overflow-hidden min-w-[160px]"
                >
                  {filterOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setFilter(option.value as FilterType);
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full text-left px-5 py-3.5 text-sm font-bold transition-colors ${
                        filter === option.value 
                          ? 'bg-[#8e24aa] text-white' 
                          : 'text-[#6a1b9a] hover:bg-[#f9f1fb] hover:text-[#4a148c]'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </div>
      </div>
      
      {loading ? (
        <div className="py-16 text-center text-sm text-[#6a1b9a]/70 font-bold">
          กำลังโหลดแคมเปญ...
        </div>
      ) : error ? (
        <div className="py-16 text-center space-y-3">
          <p className="text-sm text-rose-600 font-bold">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-xl border border-[#e1bee7] text-[#6a1b9a] font-bold text-xs hover:border-[#8e24aa]/40"
          >
            ลองใหม่
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
          <AnimatePresence mode="popLayout">
            {filteredCampaigns.map((campaign, index) => (
              <motion.div
                key={`${filter}-${campaign.id}`}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.3, delay: index * 0.04 }}
                className="h-full"
              >
                <AffiliateCampaignCard campaign={campaign} />
              </motion.div>
            ))}
          </AnimatePresence>
          {filteredCampaigns.length === 0 ? (
            <div className="md:col-span-2 lg:col-span-3 py-16 text-center text-sm text-[#6a1b9a]/70 font-bold">
              ยังไม่มีแคมเปญที่พร้อมเผยแพร่
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
