'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { ArrowLeft, FileText, Loader2, Save, Wallet } from 'lucide-react';
import { useCmsAdminMe } from '@/hooks/useCmsAdminMe';

type SettingsPayload = {
  privacyPolicyText: string;
  termsOfServiceText: string;
  minWithdrawalAmount: number;
  updatedAt: string | null;
};

export default function CmsPlatformSettingsPage() {
  const { isAdmin, loading: adminLoading } = useCmsAdminMe();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [privacyPolicyText, setPrivacyPolicyText] = useState('');
  const [termsOfServiceText, setTermsOfServiceText] = useState('');
  const [minWithdrawalAmount, setMinWithdrawalAmount] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  useEffect(() => {
    if (adminLoading) return;
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/cms/platform-settings', { cache: 'no-store' });
        const data = (await res.json()) as {
          ok?: boolean;
          settings?: SettingsPayload;
          error?: string;
        };
        if (!res.ok || !data.ok || !data.settings) {
          throw new Error(data.error ?? 'load_failed');
        }
        if (cancelled) return;
        setPrivacyPolicyText(data.settings.privacyPolicyText);
        setTermsOfServiceText(data.settings.termsOfServiceText);
        setMinWithdrawalAmount(data.settings.minWithdrawalAmount);
        setUpdatedAt(data.settings.updatedAt);
      } catch {
        if (!cancelled) setError('โหลดการตั้งค่าไม่สำเร็จ');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [adminLoading, isAdmin]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/cms/platform-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          privacyPolicyText,
          termsOfServiceText,
          minWithdrawalAmount: Math.max(0, Math.floor(minWithdrawalAmount)),
        }),
      });
      const data = (await res.json()) as { ok?: boolean; settings?: SettingsPayload; error?: string };
      if (!res.ok || !data.ok || !data.settings) {
        throw new Error(data.error ?? 'save_failed');
      }
      setPrivacyPolicyText(data.settings.privacyPolicyText);
      setTermsOfServiceText(data.settings.termsOfServiceText);
      setMinWithdrawalAmount(data.settings.minWithdrawalAmount);
      setUpdatedAt(data.settings.updatedAt);
    } catch {
      setError('บันทึกไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  }

  if (adminLoading || (isAdmin && loading)) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-[#6a1b9a]">
        <Loader2 className="animate-spin" size={36} />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="rounded-3xl border border-[#e1bee7] bg-white p-8 text-center text-[#4a148c]">
        <p className="font-black text-lg">ไม่มีสิทธิ์เข้าถึง</p>
        <p className="mt-2 text-sm text-[#6a1b9a]/70">เฉพาะแอดมินหลักเท่านั้นที่แก้ไขการตั้งค่านี้ได้</p>
        <Link
          href="/cms/settings"
          className="mt-6 inline-flex items-center gap-2 text-sm font-bold text-[#8e24aa] hover:underline"
        >
          <ArrowLeft size={16} />
          กลับไปตั้งค่า
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-[#4a148c]">
      <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-[#6a1b9a]/70 uppercase tracking-wider">
        <Link href="/cms/settings" className="inline-flex items-center gap-2 hover:text-[#8e24aa]">
          <ArrowLeft size={14} />
          ตั้งค่า
        </Link>
        <span className="text-[#e1bee7]">/</span>
        <span>เนื้อหาสมัครและถอนเงิน</span>
      </div>

      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-[#e1bee7] bg-white p-6 md:p-8 shadow-sm"
      >
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-2xl border border-[#e1bee7] bg-[#faf5fc] flex items-center justify-center text-[#8e24aa]">
            <FileText size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-[#4a148c]">นโยบาย / ข้อกำหนด และยอดถอนขั้นต่ำ</h1>
            <p className="mt-1 text-sm text-[#6a1b9a]/70 max-w-2xl">
              ข้อความนโยบายความเป็นส่วนตัวและข้อกำหนดการใช้บริการจะแสดงในหน้าสมัครสมาชิกหลังล็อกอิน LINE
              หากเว้นว่าง ระบบจะใช้ข้อความเริ่มต้นภายในแอป
            </p>
            {updatedAt ? (
              <p className="mt-2 text-[11px] text-[#6a1b9a]/55">
                อัปเดตล่าสุด: {new Date(updatedAt).toLocaleString('th-TH')}
              </p>
            ) : null}
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="mt-8 space-y-6">
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-[#6a1b9a]/75 mb-2">
              นโยบายความเป็นส่วนตัว
            </label>
            <textarea
              value={privacyPolicyText}
              onChange={(e) => setPrivacyPolicyText(e.target.value)}
              rows={12}
              className="w-full rounded-2xl border border-[#e1bee7] bg-[#faf5fc] px-4 py-3 text-sm text-[#4a148c] focus:outline-none focus:border-[#8e24aa]/50 font-sans"
              placeholder="เว้นว่างเพื่อใช้ข้อความเริ่มต้นของระบบ"
            />
          </div>
          <div>
            <label className="block text-xs font-black uppercase tracking-wider text-[#6a1b9a]/75 mb-2">
              ข้อกำหนดการใช้บริการ
            </label>
            <textarea
              value={termsOfServiceText}
              onChange={(e) => setTermsOfServiceText(e.target.value)}
              rows={12}
              className="w-full rounded-2xl border border-[#e1bee7] bg-[#faf5fc] px-4 py-3 text-sm text-[#4a148c] focus:outline-none focus:border-[#8e24aa]/50 font-sans"
              placeholder="เว้นว่างเพื่อใช้ข้อความเริ่มต้นของระบบ"
            />
          </div>

          <div className="rounded-2xl border border-[#e1bee7] bg-[#faf5fc] p-5">
            <div className="flex items-center gap-2 text-[#8e24aa] mb-3">
              <Wallet size={20} />
              <span className="text-sm font-black">ยอดถอนเงินขั้นต่ำ (ทุกผู้ใช้)</span>
            </div>
            <p className="text-xs text-[#6a1b9a]/70 mb-3">
              กำหนดเป็นจำนวนเต็มบาท ผู้ใช้แต่ละคนต้องแจ้งถอนไม่ต่ำกว่านี้ต่อครั้ง ใส่ 0 = ไม่กำหนดขั้นต่ำ
            </p>
            <input
              type="number"
              min={0}
              step={1}
              value={minWithdrawalAmount}
              onChange={(e) => setMinWithdrawalAmount(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
              className="w-full max-w-xs rounded-xl border border-[#e1bee7] bg-white px-4 py-2.5 text-sm font-bold text-[#4a148c] focus:outline-none focus:border-[#8e24aa]/50"
            />
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSave()}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#8e24aa] text-white px-6 py-3 text-sm font-black hover:brightness-110 disabled:opacity-60"
          >
            {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
            {saving ? 'กำลังบันทึก…' : 'บันทึกการตั้งค่า'}
          </button>
        </div>
      </motion.section>
    </div>
  );
}
