'use client';

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { name: 'หน้าแรก', href: '/', disabled: false },
  { name: 'โปรไฟล์', href: '/profile', disabled: false },
  { name: 'แคมเปญทั้งหมด', href: '/campaigns', disabled: false },
  { name: 'จัดการโฆษณา', href: '/sponsor', disabled: false },
];

export default function DynamicIslandNav() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [scrollProgress, setScrollProgress] = useState(0);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY;
      const progress = Math.min(currentY / 180, 1);
      setScrollProgress(progress);

      if (currentY < 16) {
        setIsVisible(true);
        lastScrollY.current = currentY;
        return;
      }

      const scrollingDown = currentY > lastScrollY.current;
      const movedEnough = Math.abs(currentY - lastScrollY.current) > 8;

      if (movedEnough) {
        setIsVisible(!scrollingDown || isOpen);
        lastScrollY.current = currentY;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [isOpen]);

  const activeItem = navItems.find((item) => item.href === pathname);
  const islandBackgroundAlpha = 0.88 + scrollProgress * 0.08;
  const islandBorderAlpha = 0.35 + scrollProgress * 0.2;
  const islandBlur = 20 + scrollProgress * 10;

  return (
    <>
      {/* Dynamic Island style navbar for app pages only */}
      <motion.header
        initial={false}
        animate={{
          y: isVisible ? 0 : -110,
          opacity: isVisible ? 1 : 0.5,
          scale: 1 - scrollProgress * 0.03,
        }}
        transition={{ type: 'spring', stiffness: 280, damping: 30 }}
        className="fixed top-4 md:top-5 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-1rem)] md:w-[min(1100px,calc(100%-3rem))]"
      >
        <div
          className="h-[60px] md:h-[70px] rounded-2xl md:rounded-3xl border shadow-[0_12px_50px_rgba(0,0,0,0.35)] flex items-center justify-between px-4 md:px-7 gap-3 transition-[background-color,border-color,backdrop-filter] duration-200"
          style={{
            backgroundColor: `rgba(255, 255, 255, ${islandBackgroundAlpha})`,
            borderColor: `rgba(142, 36, 170, ${islandBorderAlpha})`,
            backdropFilter: `blur(${islandBlur}px)`,
          }}
        >
          
          {/* Left Side: Logo & Text */}
          <Link href="/" className="flex items-center gap-2 md:gap-3 shrink-0 group">
            <div className="relative w-7 h-7 md:w-10 md:h-10 flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:scale-105">
               <div className="absolute inset-0 bg-[#8e24aa] rounded-lg rotate-45 shadow-[0_0_20px_rgba(142,36,170,0.4)]" />
               <div className="relative w-3.5 h-3.5 md:w-5 md:h-5 bg-white rounded-sm rotate-45" />
            </div>
            <span className="text-[#4a148c] font-black text-lg md:text-2xl tracking-tighter italic select-none">
              CARDPAY
            </span>
          </Link>

          <div className="hidden md:inline-flex text-[11px] font-black uppercase tracking-wider rounded-full border border-[#8e24aa]/30 bg-[#f3e5f5] text-[#6a1b9a] px-3 py-1">
            {activeItem?.name ?? 'CardPay'}
          </div>

          {/* Right Side: Teal-Blue Animated Hamburger Menu Icon */}
          <div className="flex items-center shrink-0">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="relative w-9 h-9 md:w-10 md:h-10 flex items-center justify-center focus:outline-none group"
              aria-label="Toggle Menu"
            >
              <div className="relative w-5 h-4 md:w-6 md:h-5">
                <motion.span
                  animate={isOpen ? { rotate: 45, y: 7 } : { rotate: 0, y: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="absolute top-0 left-0 w-full h-0.5 bg-[#8e24aa] rounded-full origin-center"
                />
                <motion.span
                  animate={isOpen ? { opacity: 0, x: -10 } : { opacity: 1, x: 0 }}
                  transition={{ duration: 0.2 }}
                  className="absolute top-1/2 -translate-y-1/2 left-0 w-full h-0.5 bg-[#8e24aa] rounded-full"
                />
                <motion.span
                  animate={isOpen ? { rotate: -45, y: -7 } : { rotate: 0, y: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="absolute bottom-0 left-0 w-full h-0.5 bg-[#8e24aa] rounded-full origin-center"
                />
              </div>
            </button>
          </div>
          
        </div>
      </motion.header>

      {/* Full-Screen Overlay (Menu Modal) */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[45] bg-[#f7f3fb]/95 backdrop-blur-[20px] flex flex-col items-center justify-center p-6 md:p-8"
          >
            {/* Decorative elements */}
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-[#e1bee7]/50 blur-[150px] rounded-full pointer-events-none" />
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#ce93d8]/45 blur-[150px] rounded-full pointer-events-none" />

            <div className="flex flex-col items-center gap-8 md:gap-12 relative z-10">
              {navItems.map((item, index) => (
                <motion.div
                  key={item.name}
                  initial={{ y: 60, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -40, opacity: 0 }}
                  transition={{ 
                    delay: index * 0.1, 
                    type: "spring", 
                    stiffness: 150, 
                    damping: 20 
                  }}
                >
                  {item.disabled ? (
                    <div className="group relative flex flex-col items-center opacity-40 cursor-not-allowed">
                      <span className="text-3xl md:text-7xl font-black text-[#4a148c] tracking-wider transition-all">
                        {item.name}
                      </span>
                      <span className="absolute -top-1 -right-4 md:-top-4 md:-right-10 text-[8px] md:text-xs font-bold bg-[#f3e5f5] text-[#8e24aa] px-1.5 md:px-2 py-0.5 md:py-1 rounded-full border border-[#ce93d8] whitespace-nowrap">
                        เร็วๆ นี้
                      </span>
                    </div>
                  ) : (
                    <Link
                      href={item.href}
                      onClick={() => setIsOpen(false)}
                      className="group relative flex flex-col items-center"
                    >
                      <span className={`text-3xl md:text-7xl font-black tracking-wider transition-all group-hover:scale-105 ${
                        pathname === item.href ? 'text-[#8e24aa]' : 'text-[#4a148c] group-hover:text-[#8e24aa]'
                      }`}>
                        {item.name}
                      </span>
                      <motion.div 
                        className={`h-1 md:h-2 bg-[#8e24aa] rounded-full mt-2 md:mt-4 ${pathname === item.href ? 'w-full' : 'w-0'}`}
                        whileHover={{ width: '100%' }}
                        transition={{ duration: 0.4 }}
                      />
                    </Link>
                  )}
                </motion.div>
              ))}
            </div>

            {/* Background Branding */}
            <div className="absolute inset-0 flex items-center justify-center opacity-[0.03] pointer-events-none select-none">
              <span className="text-[25vw] font-black tracking-tighter italic">CARDPAY</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
