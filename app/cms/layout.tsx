'use client';

import React, { Suspense, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Users,
  Building2,
  Megaphone,
  ShieldCheck,
  History,
  LogOut,
  Menu,
  X,
  ChevronRight,
  UserCircle2,
  Settings,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useCmsAdminMe } from '@/hooks/useCmsAdminMe';

const sidebarItems: {
  name: string;
  href: string;
  icon: LucideIcon;
  linkTitle?: string;
}[] = [
  { name: 'แดชบอร์ด', href: '/cms/dashboard', icon: LayoutDashboard },
  { name: 'จัดการสมาชิก', href: '/cms/members', icon: Users },
  { name: 'จัดการสปอนเซอร์', href: '/cms/sponsors', icon: Building2 },
  {
    name: 'จัดการแคมเปญ',
    href: '/cms/campaigns',
    icon: Megaphone,
    linkTitle:
      "ดูรายการแคมเปญและจัดการแท็ก (เพิ่ม/แก้/ลบ) เท่านั้น — แก้ไขแคมเปญผ่านเมนูจัดการสปอนเซอร์เท่านั้น",
  },
  { name: 'จัดการแอดมิน', href: '/cms/admins', icon: ShieldCheck },
  { name: 'โปรไฟล์แอดมิน', href: '/cms/profile', icon: UserCircle2 },
  { name: 'ตั้งค่า', href: '/cms/settings', icon: Settings },
  { name: 'ประวัติเข้าใช้งาน', href: '/cms/logs', icon: History },
];

/**
 * หน้าสรุปแคมเปญจากเมนู «จัดการแคมเปญ» (อ่านอย่างเดียว) ใส่ ?readonly=1 — ไฮไลต์เมนูแคมเปญ
 * การจัดการแคมเปญภายใต้สปอนเซอร์ (แก้ไข / สรุปปกติ) อยู่ภายใต้เมนู «จัดการสปอนเซอร์»
 */
function isSponsorCampaignAnalyticsReadonly(
  pathname: string,
  searchParams: URLSearchParams
): boolean {
  if (!/^\/cms\/sponsors\/[^/]+\/campaigns\/[^/]+\/analytics$/.test(pathname)) {
    return false;
  }
  return (
    searchParams.get("readonly") === "1" || searchParams.get("view") === "readonly"
  );
}

function isCmsSponsorsNavPath(pathname: string, searchParams: URLSearchParams): boolean {
  if (pathname === "/cms/sponsors") return true;
  if (!pathname.startsWith("/cms/sponsors/")) return false;
  if (isSponsorCampaignAnalyticsReadonly(pathname, searchParams)) return false;
  return true;
}

function isCmsCampaignsNavPath(pathname: string, searchParams: URLSearchParams): boolean {
  if (pathname === "/cms/campaigns") return true;
  if (pathname.startsWith("/cms/campaigns/")) return true;
  if (isSponsorCampaignAnalyticsReadonly(pathname, searchParams)) return true;
  return false;
}

function getCmsHeaderSectionName(
  pathname: string,
  searchParams: URLSearchParams
): string {
  if (pathname.startsWith("/cms/campaigns/tags")) return "จัดการแท็กแคมเปญ";
  if (pathname.startsWith("/cms/campaigns/templates")) return "เทมเพลต Flex แคมเปญ";
  if (isCmsCampaignsNavPath(pathname, searchParams)) return "จัดการแคมเปญ";
  if (isCmsSponsorsNavPath(pathname, searchParams)) return "จัดการสปอนเซอร์";
  const item = sidebarItems.find(
    (i) => pathname === i.href || (i.href !== "/cms" && pathname.startsWith(`${i.href}/`)),
  );
  return item?.name ?? "CMS Management";
}

function CMSLayoutInner({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Default to closed for mobile
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(true);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { admin } = useCmsAdminMe();

  if (pathname === "/cms/login") {
    return <div className="min-h-screen font-prompt">{children}</div>;
  }

  const visibleSidebarItems = sidebarItems.filter((item) => {
    if (item.href === '/cms/admins' && admin?.role === 'reviewer') return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-white flex overflow-hidden font-prompt">
      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar (Mobile & Desktop) */}
      <motion.aside 
        initial={false}
        animate={{ 
          width: isDesktopSidebarOpen ? 280 : 80,
          x: isSidebarOpen ? 0 : (typeof window !== 'undefined' && window.innerWidth < 1024 ? -280 : 0)
        }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className={`fixed lg:relative z-[70] lg:z-50 bg-white/95 lg:bg-white/90 backdrop-blur-2xl border-r border-[#e1bee7] flex flex-col h-screen transition-all duration-300 ease-in-out text-[#4a148c] ${isSidebarOpen ? 'w-[280px]' : 'w-0 lg:w-auto'}`}
      >
        {/* Sidebar Header */}
        <div className="h-[70px] md:h-[80px] flex items-center justify-between px-6 border-b border-[#e1bee7]">
          <AnimatePresence mode="wait">
            {(isDesktopSidebarOpen || isSidebarOpen) ? (
              <motion.div
                key="logo-full"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex items-center gap-3"
              >
                <div className="w-8 h-8 bg-[#8e24aa] rounded-lg rotate-45 flex items-center justify-center shadow-[0_0_15px_rgba(142,36,170,0.3)]">
                  <div className="w-4 h-4 bg-white rounded-sm" />
                </div>
                <span className="font-black text-xl tracking-tighter italic">CMS PANEL</span>
              </motion.div>
            ) : (
              <motion.div
                key="logo-mini"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                className="w-8 h-8 bg-[#8e24aa] rounded-lg rotate-45 mx-auto flex items-center justify-center shadow-[0_0_15px_rgba(142,36,170,0.3)]"
              >
                <div className="w-4 h-4 bg-white rounded-sm" />
              </motion.div>
            )}
          </AnimatePresence>
          
          {(isDesktopSidebarOpen || isSidebarOpen) && (
            <button 
              onClick={() => {
                setIsSidebarOpen(false);
                if (typeof window !== 'undefined' && window.innerWidth >= 1024) {
                  setIsDesktopSidebarOpen(false);
                }
              }}
              className="p-1.5 rounded-lg hover:bg-[#f3e5f5] text-[#8e24aa] transition-colors"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 py-6 px-3 space-y-2 overflow-y-auto custom-scrollbar">
          {!isDesktopSidebarOpen && !isSidebarOpen && (
            <button 
              onClick={() => setIsDesktopSidebarOpen(true)}
              className="w-full hidden lg:flex justify-center p-3 rounded-xl hover:bg-[#f3e5f5] text-[#8e24aa] mb-4"
            >
              <Menu size={24} />
            </button>
          )}

          {visibleSidebarItems.map((item) => {
            const isActive =
              item.href === "/cms/sponsors"
                ? isCmsSponsorsNavPath(pathname, searchParams)
                : item.href === "/cms/campaigns"
                  ? isCmsCampaignsNavPath(pathname, searchParams)
                  : pathname === item.href ||
                    (item.href !== "/cms" && pathname.startsWith(`${item.href}/`));
            const showLabel = isDesktopSidebarOpen || isSidebarOpen;
            return (
              <Link
                key={item.name}
                href={item.href}
                title={item.linkTitle}
                onClick={() => setIsSidebarOpen(false)}
              >
                <motion.div
                  whileHover={{ x: 4 }}
                  className={`flex items-center gap-4 p-3.5 rounded-xl transition-all duration-200 group relative ${
                    isActive 
                      ? 'bg-[#f3e5f5] text-[#8e24aa] border border-[#ce93d8] shadow-[0_0_20px_rgba(142,36,170,0.1)]' 
                      : 'text-[#6a1b9a]/80 hover:text-[#4a148c] hover:bg-[#f8effa]'
                  }`}
                >
                  <item.icon size={22} className={isActive ? 'text-[#8e24aa]' : 'group-hover:text-[#8e24aa] transition-colors'} />
                  {showLabel && (
                    <span className="font-medium tracking-wide whitespace-nowrap">{item.name}</span>
                  )}
                  {isActive && showLabel && (
                    <ChevronRight size={16} className="ml-auto opacity-50" />
                  )}
                  
                  {/* Tooltip for collapsed state */}
                  {!showLabel && (
                    <div className="absolute left-full ml-4 px-3 py-2 bg-white border border-[#e1bee7] rounded-lg text-xs font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-[60] shadow-xl text-[#4a148c]">
                      {item.name}
                    </div>
                  )}
                </motion.div>
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="p-4 border-t border-[#e1bee7]">
          <button
            type="button"
            onClick={async () => {
              await fetch("/api/auth/admin/logout", { method: "POST" });
              window.location.href = "/cms/login";
            }}
            className="w-full text-left"
          >
            <motion.div
              whileHover={{ x: 4 }}
              className="flex items-center gap-4 p-3.5 rounded-xl text-red-400 hover:bg-red-500/10 transition-all group relative"
            >
              <LogOut size={22} />
              {(isDesktopSidebarOpen || isSidebarOpen) && (
                <span className="font-bold tracking-wide">ออกจากระบบ</span>
              )}
              {!(isDesktopSidebarOpen || isSidebarOpen) && (
                <div className="absolute left-full ml-4 px-3 py-2 bg-red-500 text-white rounded-lg text-xs font-bold whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-[60] shadow-xl">
                  ออกจากระบบ
                </div>
              )}
            </motion.div>
          </button>
        </div>
      </motion.aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative text-[#4a148c]">
        {/* Background Decorative */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#e1bee7]/50 blur-[120px] rounded-full -mr-64 -mt-64 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-[#f3e5f5] blur-[100px] rounded-full -ml-32 -mb-32 pointer-events-none" />

        {/* Top Header */}
        <header className="min-h-[70px] md:h-[80px] border-b border-[#e1bee7] flex items-center justify-between px-4 md:px-8 py-3 md:py-0 bg-white/80 backdrop-blur-md relative z-10">
          <div className="flex items-center gap-3 md:gap-4 min-w-0 flex-1">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-2 text-[#8e24aa] hover:bg-[#f3e5f5] rounded-lg transition-colors shrink-0"
            >
              <Menu size={24} />
            </button>
            <h2 className="text-sm sm:text-base md:text-xl font-black text-[#4a148c] tracking-tight leading-tight break-words min-w-0">
              {getCmsHeaderSectionName(pathname, searchParams)}
            </h2>
          </div>
          
          <div className="flex items-center gap-3 md:gap-6 shrink-0 pl-3">
            <div className="hidden md:flex flex-col items-end">
              <span className="text-sm font-bold text-[#4a148c]">{admin?.roleLabel ?? 'Administrator'}</span>
              <span className="text-[10px] text-[#8e24aa] font-medium tracking-widest uppercase">
                {admin?.username ?? "—"}
              </span>
            </div>
            <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-[#8e24aa] to-[#ce93d8] p-[1px]">
              <Link
                href="/cms/profile"
                className="w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden"
                title="โปรไฟล์แอดมิน"
              >
                <Users size={16} className="md:w-5 md:h-5 text-[#8e24aa]" />
              </Link>
            </div>
          </div>
        </header>

        {/* Content Scrollable */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 relative z-10 custom-scrollbar">
          {children}
        </div>
      </main>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(142, 36, 170, 0.35);
        }
      `}</style>
    </div>
  );
}

export default function CMSLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="min-h-screen font-prompt bg-white" />}>
      <CMSLayoutInner>{children}</CMSLayoutInner>
    </Suspense>
  );
}
