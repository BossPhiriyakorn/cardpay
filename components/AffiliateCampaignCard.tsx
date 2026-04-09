'use client';

import React, { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import Image from 'next/image';
import { Share2, ChevronLeft, ChevronRight, Coins } from 'lucide-react';
import { buildCampaignShareLiffUrl } from '@/lib/liffShare';
import { setPendingShareCampaign } from '@/lib/sharePendingCampaign';

interface Campaign {
  id: string;
  title: string;
  description: string;
  totalBudget: number;
  usedBudget: number;
  reward: number;
  maxRewardPerUser: number;
  maxRewardPerUserPerDay: number;
  quota: number;
  current: number;
  images: string[];
}

export default function AffiliateCampaignCard({ campaign }: { campaign: Campaign }) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const safeQuota = Math.max(campaign.quota, 0);
  const safeCurrent = Math.max(campaign.current, 0);
  const safeTotalBudget = Math.max(campaign.totalBudget, 0);
  const safeUsedBudget = Math.max(campaign.usedBudget, 0);
  const usesPerCampaignBudget = safeTotalBudget > 0;
  const remainingBudget = usesPerCampaignBudget
    ? Math.max(safeTotalBudget - safeUsedBudget, 0)
    : 0;
  const usedRatio =
    usesPerCampaignBudget && safeTotalBudget > 0
      ? Math.min(safeUsedBudget / safeTotalBudget, 1)
      : 0;
  const percentage = usedRatio * 100;
  const isLowBudget =
    usesPerCampaignBudget && safeTotalBudget > 0
      ? remainingBudget / safeTotalBudget < 0.2
      : false;
  const budgetExhaustedByAmount =
    usesPerCampaignBudget &&
    campaign.reward > 0 &&
    remainingBudget < campaign.reward;
  const quotaFull = safeQuota > 0 && Math.max(safeQuota - safeCurrent, 0) <= 0;
  const campaignClosed = quotaFull || budgetExhaustedByAmount;
  const closedLabel = quotaFull ? 'โควต้าแชร์เต็มแล้ว' : 'งบโฆษณาไม่พอสำหรับรางวัลนี้';

  const handleScroll = () => {
    if (scrollRef.current) {
      const index = Math.round(scrollRef.current.scrollLeft / scrollRef.current.offsetWidth);
      setActiveIndex(index);
    }
  };

  const scrollTo = (index: number) => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        left: index * scrollRef.current.offsetWidth,
        behavior: 'smooth',
      });
    }
  };

  async function handleShareClick() {
    if (campaignClosed) return;
    setPendingShareCampaign(campaign.id, 1);
    try {
      const res = await fetch("/api/liff/config");
      const cfg = (await res.json()) as {
        liffId?: string;
        shareEndpointIncludesShare?: boolean;
      };
      if (res.ok && cfg.liffId) {
        window.location.assign(
          buildCampaignShareLiffUrl(cfg.liffId, campaign.id, 1, {
            endpointIncludesShare: cfg.shareEndpointIncludesShare === true,
          })
        );
        return;
      }
    } catch {
      /* fallback ด้านล่าง */
    }
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID?.trim();
    if (liffId) {
      window.location.assign(buildCampaignShareLiffUrl(liffId, campaign.id));
      return;
    }
    router.push(`/share?campaignId=${encodeURIComponent(campaign.id)}`);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="w-full flex flex-col bg-white rounded-2xl shadow-sm border border-[#e1bee7] overflow-hidden h-full group hover:shadow-md transition-shadow duration-300"
    >
      {/* Section A: Swipeable Image Gallery */}
      <div className="relative aspect-video w-full overflow-hidden bg-slate-100">
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide h-full"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {campaign.images.map((img, idx) => (
            <div key={idx} className="w-full flex-shrink-0 snap-center h-full relative">
              <Image
                src={img}
                alt={`${campaign.title} - ${idx + 1}`}
                fill
                className="object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
          ))}
        </div>

        {/* Navigation Arrows (Visible on Hover) */}
        {campaign.images.length > 1 && (
          <>
            <button
              onClick={() => scrollTo(activeIndex - 1)}
              disabled={activeIndex === 0}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-white/90 backdrop-blur-sm text-[#6a1b9a] opacity-0 group-hover:opacity-100 disabled:opacity-0 transition-opacity duration-200 shadow-sm border border-[#e1bee7]"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => scrollTo(activeIndex + 1)}
              disabled={activeIndex === campaign.images.length - 1}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-white/90 backdrop-blur-sm text-[#6a1b9a] opacity-0 group-hover:opacity-100 disabled:opacity-0 transition-opacity duration-200 shadow-sm border border-[#e1bee7]"
            >
              <ChevronRight size={18} />
            </button>
          </>
        )}

        {/* Dot Indicators */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
          {campaign.images.map((_, idx) => (
            <button
              key={idx}
              onClick={() => scrollTo(idx)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                activeIndex === idx ? 'w-4 bg-white shadow-sm' : 'w-1.5 bg-white/50'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Section B: Campaign Details & Action */}
      <div className="p-5 flex flex-col flex-1">
        <div className="flex justify-between items-start gap-3 mb-2">
          <h3 className="text-base font-semibold text-[#4a148c] leading-snug line-clamp-2 break-words">
            {campaign.title}
          </h3>
          <div className="shrink-0 bg-[#f3e5f5] text-[#8e24aa] px-2.5 py-1 rounded-lg flex items-center gap-1.5 border border-[#e1bee7]">
            <Coins size={14} className="text-[#8e24aa]" />
            <span className="text-xs font-medium text-slate-500 tracking-tight whitespace-nowrap">฿{campaign.reward.toFixed(2)} / แชร์</span>
          </div>
        </div>

        <p className="text-sm font-normal text-slate-600 leading-relaxed line-clamp-2 mt-1 break-words whitespace-normal">
          {campaign.description}
        </p>

        <div className="mt-3 space-y-1.5 rounded-xl border border-[#f0e4f4] bg-[#fcf7fd] px-3 py-2.5">
          <p className="text-[11px] font-medium text-[#6a1b9a]/80">
            1 คนต่อวันสูงสุด:{" "}
            <span className="font-bold text-[#4a148c]">
              {campaign.maxRewardPerUserPerDay > 0
                ? `฿${campaign.maxRewardPerUserPerDay.toLocaleString()}`
                : "ไม่จำกัด"}
            </span>
          </p>
          <p className="text-[11px] font-medium text-[#6a1b9a]/80">
            1 คนต่อแคมเปญสูงสุด:{" "}
            <span className="font-bold text-[#4a148c]">
              {campaign.maxRewardPerUser > 0
                ? `฿${campaign.maxRewardPerUser.toLocaleString()}`
                : "ไม่จำกัด"}
            </span>
          </p>
        </div>

        <div className="mt-auto space-y-2.5">
          {usesPerCampaignBudget ? (
            <div className="space-y-1.5">
              <div className="flex justify-between items-end">
                <span className="text-xs font-medium text-[#6a1b9a]/70 uppercase tracking-wider">
                  งบคงเหลือ (แคมเปญ)
                </span>
                <span className={`text-xs font-medium ${isLowBudget ? 'text-rose-500' : 'text-[#4a148c]'}`}>
                  {`฿${remainingBudget.toLocaleString()} / ฿${safeTotalBudget.toLocaleString()}`}
                </span>
              </div>
              <div className="h-1.5 w-full bg-[#f3e5f5] rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  whileInView={{ width: `${100 - percentage}%` }}
                  transition={{ duration: 1, ease: 'easeOut' }}
                  className={`h-full rounded-full ${
                    isLowBudget ? 'bg-rose-500' : 'bg-[#8e24aa]'
                  }`}
                />
              </div>
            </div>
          ) : null}

          {/* Action Button — ไปหน้า /share ที่ init LIFF แล้วเปิด shareTargetPicker */}
          <motion.button
            type="button"
            whileHover={campaignClosed ? undefined : { scale: 1.02 }}
            whileTap={campaignClosed ? undefined : { scale: 0.98 }}
            disabled={campaignClosed}
            onClick={handleShareClick}
            aria-label="แชร์เพื่อรับเงิน"
            className={`w-full mt-2 py-3.5 font-bold text-sm sm:text-base rounded-xl flex items-center justify-center gap-2 shadow-sm transition-colors ${
              campaignClosed
                ? 'bg-slate-300 text-slate-500 cursor-not-allowed'
                : 'bg-[#8e24aa] hover:bg-[#6a1b9a] text-white'
            }`}
          >
            <Share2 size={16} />
            <span>
              {campaignClosed ? closedLabel : 'แชร์เพื่อรับเงิน (Share & Earn)'}
            </span>
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
