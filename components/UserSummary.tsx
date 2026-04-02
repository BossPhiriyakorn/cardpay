'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { TrendingUp, Wallet } from 'lucide-react';

export default function UserSummary() {
  const [loading, setLoading] = useState(true);
  const [walletBalance, setWalletBalance] = useState(0);
  const [sharesToday, setSharesToday] = useState(0);
  const [earnedToday, setEarnedToday] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const formattedWallet = walletBalance.toFixed(2).split('.');

  useEffect(() => {
    let cancelled = false;
    async function loadSummary() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/user/summary', { cache: 'no-store' });
        const data = (await res.json()) as {
          ok?: boolean;
          authenticated?: boolean;
          summary?: {
            walletBalance?: number;
            sharesToday?: number;
            earnedToday?: number;
          };
          error?: string;
        };
        if (data.authenticated === false) {
          window.location.assign(
            `/api/auth/line?callbackUrl=${encodeURIComponent(`${window.location.origin}/register`)}`
          );
          return;
        }
        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? 'load_failed');
        }
        if (cancelled) return;
        setWalletBalance(Number(data.summary?.walletBalance ?? 0));
        setSharesToday(Number(data.summary?.sharesToday ?? 0));
        setEarnedToday(Number(data.summary?.earnedToday ?? 0));
      } catch {
        if (!cancelled) {
          setError('โหลดข้อมูลสรุปไม่สำเร็จ');
          setWalletBalance(0);
          setSharesToday(0);
          setEarnedToday(0);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    loadSummary();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="mt-8 md:mt-12 px-0 font-prompt">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        whileHover={{ y: -4 }}
        className="relative overflow-hidden bg-white rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-10 shadow-[0_20px_40px_rgba(74,20,140,0.12)] border border-[#e1bee7] group"
      >
        {/* Animated Background Shimmer */}
        <motion.div 
          animate={{ 
            x: ['-100%', '100%'],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "linear"
          }}
          className="absolute inset-0 bg-gradient-to-r from-transparent via-[#f3e5f5]/60 to-transparent skew-x-12 pointer-events-none"
        />

        {/* Decorative Glowing Orbs */}
        <div className="absolute top-0 right-0 w-48 md:w-64 h-48 md:h-64 bg-[#e1bee7]/40 blur-[80px] md:blur-[100px] rounded-full -mr-24 md:-mr-32 -mt-24 md:-mt-32 animate-pulse" />
        <div className="absolute bottom-0 left-0 w-32 md:w-48 h-32 md:h-48 bg-[#f3e5f5] blur-[60px] md:blur-[80px] rounded-full -ml-16 md:-ml-24 -mb-16 md:-mb-24" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6 md:gap-8">
          <div className="space-y-1 md:space-y-2">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="p-1.5 md:p-2 bg-[#f3e5f5] rounded-lg md:rounded-xl border border-[#ce93d8]">
                <Wallet size={16} className="md:w-[18px] md:h-[18px] text-[#8e24aa]" />
              </div>
              <span className="text-[#6a1b9a]/70 text-[10px] md:text-xs font-black uppercase tracking-[0.2em]">ยอดเงินที่ถอนได้</span>
            </div>
            <h2 className="text-4xl md:text-6xl font-black text-[#4a148c] tracking-tighter">
              ฿{Number(formattedWallet[0] ?? 0).toLocaleString()}
              <span className="text-[#8e24aa]/40 text-2xl md:text-3xl">
                .{formattedWallet[1] ?? '00'}
              </span>
            </h2>
          </div>

          <div className="flex gap-3 md:gap-6">
            <div className="bg-[#faf5fc] backdrop-blur-md border border-[#e1bee7] rounded-[1.5rem] md:rounded-[2rem] p-4 md:p-5 flex-1 md:flex-none min-w-[120px] md:min-w-[150px] transition-all duration-300 hover:border-[#ce93d8]">
              <div className="text-[#6a1b9a]/60 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] mb-1 md:mb-2">แชร์วันนี้</div>
              <div className="text-xl md:text-2xl font-black text-[#4a148c] tracking-tight">{sharesToday.toLocaleString()} <span className="text-xs md:text-sm text-[#6a1b9a]/55 font-medium">ครั้ง</span></div>
            </div>
            <div className="bg-[#faf5fc] backdrop-blur-md border border-[#e1bee7] rounded-[1.5rem] md:rounded-[2rem] p-4 md:p-5 flex-1 md:flex-none min-w-[120px] md:min-w-[150px] transition-all duration-300 hover:border-[#ce93d8]">
              <div className="text-[#6a1b9a]/60 text-[9px] md:text-[10px] font-black uppercase tracking-[0.2em] mb-1 md:mb-2">รายได้วันนี้</div>
              <div className="text-xl md:text-2xl font-black text-[#8e24aa] tracking-tight">
                ฿{earnedToday.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </div>

        <motion.div 
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          className="mt-8 md:mt-10"
        >
          <Link
            href="/profile"
            className="flex items-center justify-center gap-2 md:gap-3 py-3.5 md:py-4 px-6 md:px-8 bg-[#8e24aa] hover:bg-[#6a1b9a] text-white font-black text-xs md:text-sm uppercase tracking-widest rounded-xl md:rounded-2xl transition-all duration-300 cursor-pointer shadow-[0_10px_30px_rgba(142,36,170,0.28)]"
          >
            <TrendingUp size={18} className="md:w-5 md:h-5" />
            <span>{loading ? 'กำลังโหลดข้อมูล...' : error ? 'เชื่อมต่อข้อมูลไม่สำเร็จ' : 'ถอนยอดจากการแชร์'}</span>
          </Link>
        </motion.div>
      </motion.div>
    </section>
  );
}
