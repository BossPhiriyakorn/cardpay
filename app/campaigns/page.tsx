'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Search, Filter, Flame } from 'lucide-react';
import AffiliateCampaignCard from '@/components/AffiliateCampaignCard';
import { motion } from 'motion/react';
import {
  type AppCampaign,
  type CampaignFeedResponse,
  normalizeCampaign,
} from '@/lib/app/campaign-feed';

export default function AllCampaignsPage() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
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
          setCampaigns([]);
          setError('ไม่สามารถโหลดแคมเปญได้ในขณะนี้');
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

  const categories = useMemo(() => {
    const set = new Set<string>();
    campaigns.forEach((campaign) => {
      (campaign.categories ?? []).forEach((category) => {
        if (category) set.add(category);
      });
    });
    return [
      { id: 'all', label: 'ทั้งหมด', icon: Flame, sub: 'All' },
      ...Array.from(set).map((id) => ({
        id,
        label: id.toUpperCase(),
        icon: Flame,
        sub: id,
      })),
    ];
  }, [campaigns]);

  const filteredCampaigns = campaigns.filter(campaign => {
    const matchesCategory =
      activeCategory === 'all' || (campaign.categories ?? []).includes(activeCategory);
    const matchesSearch = campaign.brand.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          campaign.title.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="w-full px-4 mx-auto overflow-x-hidden max-w-7xl space-y-8 font-prompt pb-24 md:pt-6">
      {/* Page Header & Search */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h1 className="text-xl font-bold text-slate-900 leading-tight tracking-tight sm:text-2xl italic">
            แคมเปญทั้งหมด <span className="text-teal-500 font-medium text-xs sm:text-sm uppercase tracking-widest opacity-60">All Campaigns</span>
          </h1>
          
          <div className="relative group w-full md:w-96">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-teal-500 transition-colors" size={20} />
            <input 
              type="text" 
              placeholder="ค้นหาแบรนด์หรือแคมเปญ..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-4 bg-white border border-slate-100 rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all font-medium"
            />
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex items-center gap-6 overflow-x-auto whitespace-nowrap py-2 px-4 -mx-4 md:mx-0 md:px-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`text-sm transition-all cursor-pointer whitespace-nowrap ${
                activeCategory === cat.id 
                ? 'font-bold text-slate-900 border-b-2 border-slate-900 pb-1' 
                : 'font-medium text-slate-500 hover:text-slate-800'
              }`}
            >
              {cat.label} ({cat.sub})
            </button>
          ))}
        </div>
      </div>

      {/* Campaign Grid */}
      {loading ? (
        <div className="py-20 text-center text-sm text-slate-500 font-bold">
          กำลังโหลดแคมเปญ...
        </div>
      ) : error ? (
        <div className="py-20 text-center space-y-4">
          <p className="text-rose-600 font-bold">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:border-slate-300"
          >
            โหลดใหม่
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {filteredCampaigns.length > 0 ? (
            filteredCampaigns.map((campaign, index) => (
              <motion.div
                key={campaign.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.06 }}
              >
                <AffiliateCampaignCard campaign={campaign} />
              </motion.div>
            ))
          ) : (
            <div className="col-span-full py-20 text-center space-y-4">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                <Filter className="text-slate-200" size={32} />
              </div>
              <p className="text-slate-400 font-bold">ไม่พบแคมเปญที่คุณกำลังมองหา</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
