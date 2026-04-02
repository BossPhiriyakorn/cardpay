'use client';

import React from 'react';
import { motion } from 'motion/react';
import Image from 'next/image';
import { Share2, Users, CheckCircle2 } from 'lucide-react';

interface Campaign {
  id: string;
  title: string;
  description: string;
  reward: number;
  quota: number;
  current: number;
  image: string;
}

export default function CampaignCard({ campaign }: { campaign: Campaign }) {
  const safeQuota = Math.max(campaign.quota, 0);
  const percentage =
    safeQuota > 0 ? Math.min((campaign.current / safeQuota) * 100, 100) : 0;
  const isLowBudget = safeQuota > 0 && percentage > 80;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      whileHover={{ y: -8 }}
      className="bg-white rounded-[1.5rem] md:rounded-[2.5rem] overflow-hidden border border-[#E5E7EB] shadow-[0_10px_30px_rgba(0,0,0,0.04)] hover:shadow-[0_30px_60px_rgba(0,0,0,0.12)] transition-all duration-500 group font-prompt h-full flex flex-col"
    >
      {/* Image Container */}
      <div className="relative h-32 md:h-64 w-full overflow-hidden shrink-0">
        <Image
          src={campaign.image}
          alt={campaign.title}
          fill
          className="object-cover transition-transform duration-700 group-hover:scale-110"
          referrerPolicy="no-referrer"
        />
        {/* Subtle Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        
        <div className="absolute top-2 md:top-5 right-2 md:right-5">
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="bg-white/90 backdrop-blur-xl px-2 md:px-5 py-1 md:py-2 rounded-lg md:rounded-2xl shadow-[0_8px_20px_rgba(0,0,0,0.1)] flex items-center gap-1 md:gap-2 border border-white/20"
          >
            <span className="text-[#0A192F] font-black text-[10px] md:text-base tracking-tight">฿{campaign.reward.toFixed(2)}</span>
            <span className="text-[#6B7280] text-[6px] md:text-[10px] font-black uppercase tracking-widest opacity-60">/ Share</span>
          </motion.div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4 md:p-8 flex flex-col flex-1">
        <div className="flex justify-between items-start mb-2 md:mb-4">
          <h3 className="text-sm md:text-2xl font-black text-[#0A192F] leading-tight tracking-tight group-hover:text-[#00F2FF] transition-colors duration-300 line-clamp-2">
            {campaign.title}
          </h3>
          <div className="p-0.5 md:p-1 bg-[#10B981]/10 rounded-full shrink-0">
            <CheckCircle2 size={12} className="md:w-[22px] md:h-[22px] text-[#10B981] shrink-0" />
          </div>
        </div>
        <p className="hidden md:block text-[#6B7280] text-xs md:text-sm line-clamp-2 mb-6 md:mb-8 leading-relaxed font-medium">
          {campaign.description}
        </p>

        {/* Spacer to push content down if needed */}
        <div className="mt-auto">
          {/* Quota Progress */}
          <div className="space-y-1.5 md:space-y-3 mb-4 md:mb-8">
            <div className="flex justify-between text-[6px] md:text-[10px] font-black uppercase tracking-[0.1em] md:tracking-[0.2em]">
              <span className="text-[#9CA3AF]">คงเหลือ</span>
              <span className={isLowBudget ? 'text-[#EF4444]' : 'text-[#0A192F]'}>
                {safeQuota > 0
                  ? `${Math.max(safeQuota - campaign.current, 0)} สิทธิ์`
                  : "—"}
              </span>
            </div>
            <div className="h-1.5 md:h-2.5 w-full bg-[#F3F4F6] rounded-full overflow-hidden relative">
              <motion.div
                initial={{ width: 0 }}
                whileInView={{ width: `${100 - percentage}%` }}
                transition={{ duration: 1.5, ease: 'circOut' }}
                className={`h-full rounded-full relative ${
                  isLowBudget ? 'bg-gradient-to-r from-[#F59E0B] to-[#EF4444]' : 'bg-gradient-to-r from-[#00F2FF] to-[#0A192F]'
                }`}
              >
                {/* Progress Glow */}
                <div className="absolute top-0 right-0 bottom-0 w-4 md:w-8 bg-white/30 blur-sm" />
              </motion.div>
            </div>
          </div>

          {/* Action Button */}
          <motion.button
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            className="w-full py-2.5 md:py-5 bg-[#0A192F] hover:bg-[#00F2FF] hover:text-[#0A192F] text-white font-black text-[8px] md:text-sm uppercase tracking-[0.1em] md:tracking-[0.2em] rounded-lg md:rounded-[1.5rem] flex items-center justify-center gap-1.5 md:gap-3 transition-all duration-300 shadow-[0_10px_30px_rgba(10,25,47,0.15)] hover:shadow-[0_20px_40px_rgba(0,242,255,0.25)]"
          >
            <Share2 size={12} className="md:w-5 md:h-5" />
            <span>แชร์เลย</span>
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
