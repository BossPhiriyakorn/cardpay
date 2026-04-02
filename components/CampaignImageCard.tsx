'use client';

import React from 'react';
import { motion } from 'motion/react';
import Image from 'next/image';
import { Share2, CheckCircle2 } from 'lucide-react';

interface Campaign {
  id: string;
  title: string;
  description: string;
  reward: number;
  quota: number;
  current: number;
  image: string;
}

export default function CampaignImageCard({ campaign }: { campaign: Campaign }) {
  const safeQuota = Math.max(campaign.quota, 0);
  const percentage =
    safeQuota > 0 ? Math.min((campaign.current / safeQuota) * 100, 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      whileHover={{ y: -5 }}
      className="relative h-[280px] md:h-[450px] w-full rounded-[1.5rem] md:rounded-[2.5rem] overflow-hidden group font-prompt shadow-xl"
    >
      {/* Background Image */}
      <Image
        src={campaign.image}
        alt={campaign.title}
        fill
        className="object-cover transition-transform duration-1000 group-hover:scale-110"
        referrerPolicy="no-referrer"
      />
      
      {/* Dark Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#0A192F] via-[#0A192F]/40 to-transparent opacity-80 group-hover:opacity-90 transition-opacity duration-500" />
      
      {/* Content Overlay */}
      <div className="absolute inset-0 p-4 md:p-8 flex flex-col justify-end">
        <div className="space-y-2 md:space-y-4">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="bg-[#00F2FF] text-[#0A192F] px-2 md:px-4 py-0.5 md:py-1.5 rounded-full text-[7px] md:text-[10px] font-black uppercase tracking-widest shadow-[0_0_20px_rgba(0,242,255,0.4)]">
              HOT
            </div>
            <div className="bg-white/10 backdrop-blur-md border border-white/20 p-0.5 md:p-1 rounded-full">
              <CheckCircle2 size={12} className="md:w-4 md:h-4 text-[#10B981]" />
            </div>
          </div>
          
          <h3 className="text-sm md:text-3xl font-black text-white leading-tight tracking-tight line-clamp-2">
            {campaign.title}
          </h3>
          
          <p className="hidden md:block text-white/70 text-sm line-clamp-2 leading-relaxed max-w-md">
            {campaign.description}
          </p>
          
          <div className="flex items-center justify-between pt-1 md:pt-4">
            <div className="flex flex-col">
              <span className="text-white/50 text-[7px] md:text-[10px] font-black uppercase tracking-widest">Reward</span>
              <span className="text-[#00F2FF] text-sm md:text-2xl font-black tracking-tight">฿{campaign.reward.toFixed(2)}</span>
            </div>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="bg-white text-[#0A192F] px-3 md:px-6 py-1.5 md:py-3 rounded-lg md:rounded-2xl font-black text-[8px] md:text-xs uppercase tracking-widest flex items-center gap-1 md:gap-2 shadow-xl hover:bg-[#00F2FF] transition-colors"
            >
              <Share2 size={12} className="md:w-4 md:h-4" />
              <span className="hidden xs:inline">แชร์เลย</span>
            </motion.button>
          </div>
        </div>
      </div>
      
      {/* Progress Bar at the very bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-1 md:h-1.5 bg-white/10">
        <motion.div 
          initial={{ width: 0 }}
          whileInView={{ width: `${100 - percentage}%` }}
          transition={{ duration: 1.5, ease: 'circOut' }}
          className="h-full bg-[#00F2FF] shadow-[0_0_15px_rgba(0,242,255,0.8)]"
        />
      </div>
    </motion.div>
  );
}
