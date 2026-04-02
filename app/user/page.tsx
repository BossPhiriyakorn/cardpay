'use client';

import React from 'react';
import UserSummary from '@/components/UserSummary';
import CampaignFeed from '@/components/CampaignFeed';
import { motion } from 'motion/react';

export default function UserHomePage() {
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants: any = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0, 
      transition: { 
        duration: 0.6, 
        ease: [0.22, 1, 0.36, 1] 
      } 
    }
  };

  return (
    <div className="relative overflow-x-hidden">
      {/* Premium Background Pattern */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:40px_40px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-20" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-gradient-to-b from-[#e1bee7]/40 to-transparent blur-3xl" />
      </div>

      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-7xl mx-auto relative px-4 md:px-6 z-10 font-prompt pb-24 md:pb-32"
      >
        {/* Hero / Header Section */}
        <motion.header variants={itemVariants} className="pt-8 md:pt-16 pb-6 md:pb-8">
          <h1 className="text-2xl md:text-6xl font-black text-[#4a148c] leading-[1.3] md:leading-[1.1] tracking-tighter">
            ยินดีต้อนรับกลับมา,<br />
            <span className="text-[#6B7280] font-bold text-base md:text-4xl opacity-60">พร้อมสำหรับการเปลี่ยนแปลงอย่างราบรื่นวันนี้หรือยัง?</span>
          </h1>
        </motion.header>

        {/* User Earnings Summary */}
        <motion.div variants={itemVariants}>
          <UserSummary />
        </motion.div>

        {/* Campaigns Feed */}
        <motion.div variants={itemVariants}>
          <CampaignFeed />
        </motion.div>
      </motion.div>

      {/* Footer / Decorative */}
      <footer className="fixed bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white via-white/80 to-transparent pointer-events-none z-40" />
    </div>
  );
}
