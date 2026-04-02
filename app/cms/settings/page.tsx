'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import {
  BellRing,
  Database,
  FileText,
  KeyRound,
  Link2,
  ShieldCheck,
  Users,
  UserCircle2,
  Workflow,
  ArrowRight,
} from 'lucide-react';

const settingCards = [
  {
    title: 'โปรไฟล์แอดมิน',
    description: 'แก้ไขชื่อแสดงและเปลี่ยนรหัสผ่านของแอดมินที่กำลังล็อกอินอยู่',
    href: '/cms/profile',
    icon: UserCircle2,
    accent: 'from-[#8e24aa]/15 to-[#ce93d8]/10',
  },
  {
    title: 'จัดการแอดมิน',
    description: 'เพิ่มบัญชีแอดมินใหม่ เปิด/ปิดสิทธิ์ และตรวจสอบรายชื่อผู้ดูแลระบบ',
    href: '/cms/admins',
    icon: ShieldCheck,
    accent: 'from-[#7c4dff]/15 to-[#b388ff]/10',
  },
  {
    title: 'สมาชิกและการยืนยันตัวตน',
    description: 'ตรวจสอบสมาชิก, สถานะผูกบัญชี และข้อมูลที่ใช้ประกอบการถอนเงิน',
    href: '/cms/members',
    icon: Users,
    accent: 'from-[#26a69a]/15 to-[#80cbc4]/10',
  },
  {
    title: 'สปอนเซอร์และแคมเปญ',
    description: 'ตั้งค่าแคมเปญ โควตา งบประมาณ และตรวจสอบข้อมูลที่เชื่อมกับสปอนเซอร์',
    href: '/cms/sponsors',
    icon: Workflow,
    accent: 'from-[#ef6c00]/15 to-[#ffcc80]/10',
  },
  {
    title: 'เนื้อหาสมัครและถอนเงิน',
    description:
      'ข้อความนโยบายความเป็นส่วนตัวและข้อกำหนดที่แสดงหน้าสมัคร — และยอดถอนเงินขั้นต่ำทุกผู้ใช้ (เฉพาะแอดมินหลัก)',
    href: '/cms/settings/platform',
    icon: FileText,
    accent: 'from-[#00897b]/15 to-[#80cbc4]/10',
  },
];

const checklist = [
  {
    icon: KeyRound,
    title: 'ความปลอดภัยบัญชี',
    detail: 'ตรวจสอบรหัสผ่านของแอดมินและแยกบัญชีสำหรับแต่ละผู้ใช้งานในทีม',
  },
  {
    icon: BellRing,
    title: 'การแจ้งเตือนระบบ',
    detail: 'เหมาะสำหรับต่อยอดแจ้งเตือน LINE หรืออีเมลเมื่อมีคำขอถอนเงินหรือเหตุการณ์สำคัญ',
  },
  {
    icon: Link2,
    title: 'การเชื่อมต่อภายนอก',
    detail: 'ใช้เช็กค่าการเชื่อมต่อ LINE, Google Drive และบริการภายนอกที่ระบบพึ่งพา',
  },
  {
    icon: Database,
    title: 'ข้อมูลและการดูแลระบบ',
    detail: 'ใช้ติดตามความพร้อมของข้อมูลใน MongoDB และความสอดคล้องของข้อมูลธุรกิจ',
  },
];

export default function CmsSettingsPage() {
  return (
    <div className="space-y-6 text-[#4a148c]">
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-[#e1bee7] bg-white p-6 md:p-8 shadow-sm"
      >
        <p className="text-xs font-black uppercase tracking-wider text-[#6a1b9a]/70">ตั้งค่าระบบ</p>
        <h1 className="mt-2 text-2xl md:text-3xl font-black text-[#4a148c]">ศูนย์รวมการตั้งค่า CMS</h1>
        <p className="mt-3 max-w-3xl text-sm md:text-base text-[#6a1b9a]/70">
          หน้านี้ใช้เป็นจุดรวมสำหรับการจัดการบัญชีผู้ดูแล, การตั้งค่าการใช้งานภายใน และทางลัดไปยังส่วนที่เกี่ยวข้องกับการดูแลระบบในแพลตฟอร์ม
        </p>
      </motion.section>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {settingCards.map((card, index) => (
          <motion.div
            key={card.href}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.06 }}
            className={`rounded-3xl border border-[#e1bee7] bg-gradient-to-br ${card.accent} p-[1px] shadow-sm`}
          >
            <div className="h-full rounded-[calc(1.5rem-1px)] bg-white p-5 md:p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="w-12 h-12 rounded-2xl border border-[#e1bee7] bg-[#faf5fc] flex items-center justify-center text-[#8e24aa]">
                  <card.icon size={24} />
                </div>
                <Link
                  href={card.href}
                  className="inline-flex items-center gap-2 rounded-2xl border border-[#e1bee7] bg-[#faf5fc] px-3 py-2 text-xs font-bold text-[#6a1b9a] hover:bg-[#f3e5f5]"
                >
                  เปิดหน้า
                  <ArrowRight size={14} />
                </Link>
              </div>

              <h2 className="mt-5 text-xl font-black text-[#4a148c]">{card.title}</h2>
              <p className="mt-2 text-sm text-[#6a1b9a]/70">{card.description}</p>
            </div>
          </motion.div>
        ))}
      </section>

      <section className="rounded-3xl border border-[#e1bee7] bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-2xl border border-[#e1bee7] bg-[#faf5fc] flex items-center justify-center text-[#8e24aa]">
            <ShieldCheck size={24} />
          </div>
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-[#6a1b9a]/70">รายการแนะนำ</p>
            <h2 className="mt-1 text-xl font-black text-[#4a148c]">Checklist สำหรับผู้ดูแลระบบ</h2>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {checklist.map((item) => (
            <div key={item.title} className="rounded-2xl border border-[#e1bee7] bg-[#faf5fc] p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white border border-[#e1bee7] flex items-center justify-center text-[#8e24aa]">
                  <item.icon size={18} />
                </div>
                <div>
                  <p className="text-sm font-black text-[#4a148c]">{item.title}</p>
                  <p className="mt-1 text-xs text-[#6a1b9a]/70">{item.detail}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
