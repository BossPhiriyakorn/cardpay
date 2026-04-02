'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { 
  Users, 
  TrendingUp, 
  Activity, 
  ShieldCheck, 
  History,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';

type DashboardData = {
  stats: {
    memberCount: number;
    activeCampaignCount: number;
    onlineAdminCount: number;
    loginTodayCount: number;
  };
  bankReviewAlerts: Array<{ id: string; userId: string; userName: string; bankName: string; accountHolderName: string; requestedAt: string }>;
  withdrawalAlerts: Array<{ id: string; userId: string; amount: number; requestedAt: string; status: string }>;
  activities: Array<{ id: string; action: string; createdAt: string }>;
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setError(null);
        const res = await fetch('/api/cms/dashboard', { cache: 'no-store' });
        const d = (await res.json()) as { ok?: boolean } & Partial<DashboardData>;
        if (!res.ok || !d.ok) throw new Error('load_failed');
        if (!cancelled) {
          setData({
            stats: d.stats ?? {
              memberCount: 0,
              activeCampaignCount: 0,
              onlineAdminCount: 0,
              loginTodayCount: 0,
            },
            bankReviewAlerts: d.bankReviewAlerts ?? [],
            withdrawalAlerts: d.withdrawalAlerts ?? [],
            activities: d.activities ?? [],
          });
        }
      } catch {
        if (!cancelled) setError('โหลดข้อมูลแดชบอร์ดไม่สำเร็จ');
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => [
    { name: 'สมาชิกทั้งหมด', value: (data?.stats.memberCount ?? 0).toLocaleString('th-TH'), change: '0%', icon: Users, color: '#8e24aa' },
    { name: 'แคมเปญที่ใช้งาน', value: (data?.stats.activeCampaignCount ?? 0).toLocaleString('th-TH'), change: '0%', icon: TrendingUp, color: '#10B981' },
    { name: 'แอดมินออนไลน์', value: (data?.stats.onlineAdminCount ?? 0).toLocaleString('th-TH'), change: '0%', icon: ShieldCheck, color: '#6366F1' },
    { name: 'การเข้าใช้งานวันนี้', value: (data?.stats.loginTodayCount ?? 0).toLocaleString('th-TH'), change: '0%', icon: History, color: '#F59E0B' },
  ], [data]);

  const withdrawalAlerts = data?.withdrawalAlerts ?? [];
  const bankReviewAlerts = data?.bankReviewAlerts ?? [];
  const activities = data?.activities ?? [];

  return (
    <div className="space-y-10">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.name}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="bg-white backdrop-blur-xl border border-[#e1bee7] p-5 md:p-6 rounded-2xl relative overflow-hidden group hover:border-[#8e24aa]/40 transition-all"
          >
            <div className="absolute top-0 right-0 w-20 md:w-24 h-20 md:h-24 bg-gradient-to-br from-[#8e24aa]/10 to-transparent blur-2xl -mr-10 md:-mr-12 -mt-10 md:-mt-12 group-hover:scale-150 transition-transform" />
            
            <div className="flex items-center justify-between mb-3 md:mb-4">
              <div className="p-2.5 md:p-3 rounded-xl bg-[#f7edf9] border border-[#e1bee7] text-[#8e24aa] shadow-inner">
                <stat.icon size={20} className="md:w-6 md:h-6" />
              </div>
              <div className={`flex items-center gap-1 text-[10px] md:text-xs font-bold ${stat.change.startsWith('+') ? 'text-emerald-400' : stat.change === '0%' ? 'text-white/40' : 'text-rose-400'}`}>
                {stat.change}
                {stat.change.startsWith('+') ? <ArrowUpRight size={12} className="md:w-3.5 md:h-3.5" /> : stat.change === '0%' ? null : <ArrowDownRight size={12} className="md:w-3.5 md:h-3.5" />}
              </div>
            </div>
            
            <div className="space-y-1">
              <span className="text-[#6a1b9a]/70 text-[10px] md:text-xs font-bold tracking-widest uppercase">{stat.name}</span>
              <h3 className="text-2xl md:text-3xl font-black text-[#4a148c]">{stat.value}</h3>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Activity Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="lg:col-span-2 bg-white backdrop-blur-xl border border-[#e1bee7] p-6 md:p-8 rounded-3xl"
        >
          <div className="flex items-center justify-between mb-6 md:mb-8">
            <h3 className="text-lg md:text-xl font-bold flex items-center gap-3 text-[#4a148c]">
              <Activity size={20} className="md:w-[22px] md:h-[22px] text-[#8e24aa]" />
              กิจกรรมล่าสุด
            </h3>
            <button className="text-[10px] md:text-xs font-bold text-[#8e24aa] hover:underline">ดูทั้งหมด</button>
          </div>
          
          <div className="space-y-4 md:space-y-6">
            {(activities.length > 0 ? activities : [{ id: "empty", action: error ?? 'ยังไม่มีกิจกรรมล่าสุด', createdAt: '-' }]).map((item) => (
              <div key={item.id} className="flex items-center gap-3 md:gap-4 p-3 md:p-4 rounded-2xl hover:bg-[#faf3fc] transition-colors border border-transparent hover:border-[#e1bee7] group">
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-[#f5ecf8] flex items-center justify-center text-[#6a1b9a]/50 group-hover:text-[#8e24aa] transition-colors shrink-0">
                  <Users size={16} className="md:w-[18px] md:h-[18px]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs md:text-sm font-medium text-[#4a148c] truncate">{item.action}</p>
                  <p className="text-[9px] md:text-[10px] text-[#6a1b9a]/55 font-bold uppercase mt-0.5 md:mt-1">{item.createdAt}</p>
                </div>
                <button className="p-1.5 md:p-2 rounded-lg hover:bg-[#f3e5f5] text-[#6a1b9a]/45 hover:text-[#4a148c] transition-all shrink-0">
                  <ChevronRight size={14} className="md:w-4 md:h-4" />
                </button>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white backdrop-blur-xl border border-[#e1bee7] p-6 md:p-8 rounded-3xl"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg md:text-xl font-bold text-[#4a148c]">
              บัญชีที่ผู้ใช้ผูกไว้
            </h3>
            <span className="text-[10px] md:text-xs font-black px-2 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
              {bankReviewAlerts.length} รอตรวจสอบ
            </span>
          </div>
          <div className="space-y-2 mb-6">
            {bankReviewAlerts.length > 0 ? (
              bankReviewAlerts.map((alert) => (
                <div key={alert.id} className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                  <p className="text-sm font-bold text-[#4a148c]">{alert.accountHolderName}</p>
                  <p className="text-[11px] text-[#6a1b9a]/70 mt-0.5">
                    {alert.bankName} • {alert.requestedAt}
                  </p>
                  <p className="text-[11px] text-[#6a1b9a]/60 mt-0.5">
                    สมาชิก: {alert.userName} ({alert.userId})
                  </p>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-[#e1bee7] p-4 text-center">
                <p className="text-sm font-bold text-[#6a1b9a]/70">ไม่มีบัญชีที่รอตรวจสอบ</p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg md:text-xl font-bold text-[#4a148c]">
              แจ้งเตือนการถอนเงิน
            </h3>
            <span className="text-[10px] md:text-xs font-black px-2 py-1 rounded-full bg-[#f3e5f5] text-[#8e24aa] border border-[#e1bee7]">
              {withdrawalAlerts.length} รายการ
            </span>
          </div>

          <div className="space-y-3">
            {withdrawalAlerts.length > 0 ? (
              withdrawalAlerts.map((alert) => (
                <div
                  key={alert.id}
                  className="rounded-2xl border border-[#e1bee7] bg-[#fcf8fd] p-4 hover:border-[#8e24aa]/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-[#4a148c]">{alert.userId}</p>
                      <p className="text-[11px] text-[#6a1b9a]/60 mt-1">{alert.requestedAt}</p>
                    </div>
                    <span className="text-[10px] font-black px-2 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                      {alert.status}
                    </span>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-[#6a1b9a]/70 font-bold uppercase tracking-wider">ยอดถอน</span>
                    <span className="text-base font-black text-[#8e24aa]">฿{alert.amount.toLocaleString('th-TH')}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-[#e1bee7] p-6 text-center">
                <p className="text-sm font-bold text-[#6a1b9a]/70">ยังไม่มีคำขอถอนเงินใหม่</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

function ChevronRight({ size, className }: { size?: number, className?: string }) {
  return (
    <svg 
      width={size || 24} 
      height={size || 24} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="m9 18 6-6-6-6"/>
    </svg>
  );
}
