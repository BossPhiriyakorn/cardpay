'use client';

import { isValidThaiPhoneDigits, sanitizeThaiPhoneInput } from '@/lib/thai-phone';
import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  Building2,
  Check,
  ChevronRight,
  CircleCheckBig,
  CircleX,
  Copy,
  Landmark,
  Pencil,
  RefreshCw,
  Wallet,
  UserCog,
  FileUp,
  ArrowUpRight,
  X,
} from 'lucide-react';
import Image from 'next/image';

const AVATAR_PLACEHOLDER =
  'data:image/svg+xml;utf8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect width="100%25" height="100%25" fill="%23f3e5f5"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%238e24aa" font-family="Arial" font-size="22"%3EUser%3C/text%3E%3C/svg%3E';

export default function ProfilePage() {
  type ProfileState = {
    name: string;
    lineId: string;
    email: string;
    phone: string;
    avatarUrl: string;
    walletBalance: number;
    referralCode: string;
  };
  type LinkedBankState = {
    bankName: string;
    accountNumber: string;
    accountName: string;
    status: 'รอตรวจสอบ' | 'อนุมัติแล้ว' | 'ไม่อนุมัติ';
    reviewReason?: string;
  };
  type WithdrawalRow = {
    id: string;
    date: string;
    amount: number;
    status: string;
  };

  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isAddBankModalOpen, setIsAddBankModalOpen] = useState(false);
  const [bankStep, setBankStep] = useState<1 | 2>(1);
  const [bankModalKey, setBankModalKey] = useState(0);
  const [idCardFile, setIdCardFile] = useState<File | null>(null);
  const [bankBookFile, setBankBookFile] = useState<File | null>(null);
  const [bankSubmitting, setBankSubmitting] = useState(false);
  const [bankSubmitError, setBankSubmitError] = useState<string | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);
  const [syncingLineAvatar, setSyncingLineAvatar] = useState(false);
  const [bankForm, setBankForm] = useState({
    bankName: '',
    accountNumber: '',
    name: '',
    idCardFileName: '',
    bankBookFileName: '',
  });
  const [linkedBank, setLinkedBank] = useState<LinkedBankState | null>(null);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRow[]>([]);
  const [withdrawModalOpen, setWithdrawModalOpen] = useState(false);
  const [withdrawBlockMessage, setWithdrawBlockMessage] = useState<string | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [copiedReferral, setCopiedReferral] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [minWithdrawalAmount, setMinWithdrawalAmount] = useState(0);
  const [profile, setProfile] = useState<ProfileState>({
    name: '',
    lineId: '',
    email: '',
    phone: '',
    avatarUrl: '',
    walletBalance: 0,
    referralCode: '',
  });
  const [draftProfile, setDraftProfile] = useState(profile);

  async function restartLineLogin(callbackPath: string) {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    window.location.assign(
      `/api/auth/line?callbackUrl=${encodeURIComponent(`${window.location.origin}${callbackPath}`)}`
    );
  }

  useEffect(() => {
    let cancelled = false;
    async function loadProfile() {
      setLoadingProfile(true);
      setProfileError(null);
      try {
        const res = await fetch('/api/user/profile', { cache: 'no-store' });
        const data = (await res.json()) as {
          ok?: boolean;
          profile?: ProfileState;
          linkedBank?: LinkedBankState | null;
          withdrawals?: WithdrawalRow[];
          minWithdrawalAmount?: number;
          error?: string;
        };
        if (data.error === 'stale_session' || data.error === 'unauthorized' || data.error === 'user_not_found') {
          await restartLineLogin('/register');
          return;
        }
        if (!res.ok || !data.ok || !data.profile) {
          throw new Error(data.error ?? 'profile_load_failed');
        }
        if (cancelled) return;
        setProfile(data.profile);
        setDraftProfile(data.profile);
        setLinkedBank(data.linkedBank ?? null);
        setWithdrawals(data.withdrawals ?? []);
        setMinWithdrawalAmount(Math.max(0, Math.floor(Number(data.minWithdrawalAmount ?? 0))));
      } catch {
        if (!cancelled) {
          setProfileError('ไม่สามารถโหลดข้อมูลโปรไฟล์ได้');
        }
      } finally {
        if (!cancelled) {
          setLoadingProfile(false);
        }
      }
    }
    loadProfile();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleStartEditProfile = () => {
    setDraftProfile({
      ...profile,
      phone: sanitizeThaiPhoneInput(profile.phone),
    });
    setIsEditingProfile(true);
  };

  const handleCancelEditProfile = () => {
    setDraftProfile(profile);
    setIsEditingProfile(false);
  };

  const handleSyncLineAvatar = async () => {
    setProfileError(null);
    setSyncingLineAvatar(true);
    try {
      const res = await fetch("/api/user/profile/sync-line", {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json()) as {
        ok?: boolean;
        avatarUrl?: string;
        error?: string;
        message?: string;
      };
      if (!res.ok || !data.ok) {
        setProfileError(
          data.message ??
            (data.error === "line_token_missing" || data.error === "line_unauthorized"
              ? "กรุณาออกจากระบบแล้วล็อกอินด้วย LINE ใหม่เพื่ออัปเดตรูป"
              : "ดึงรูปจาก LINE ไม่สำเร็จ ลองใหม่อีกครั้ง")
        );
        return;
      }
      const url = data.avatarUrl ?? "";
      setProfile((prev) => ({ ...prev, avatarUrl: url }));
      setDraftProfile((prev) => ({ ...prev, avatarUrl: url }));
    } catch {
      setProfileError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    } finally {
      setSyncingLineAvatar(false);
    }
  };

  const handleCopyReferralCode = async () => {
    if (!profile.referralCode) return;
    try {
      await navigator.clipboard.writeText(profile.referralCode);
      setCopiedReferral(true);
      window.setTimeout(() => setCopiedReferral(false), 1800);
    } catch {
      setProfileError("คัดลอกรหัสแนะนำไม่สำเร็จ");
    }
  };

  const handleSaveProfile = async () => {
    const phoneDigits = sanitizeThaiPhoneInput(draftProfile.phone);
    if (!isValidThaiPhoneDigits(phoneDigits)) {
      setProfileError('กรุณากรอกเบอร์โทร 10 หลัก (ตัวเลข 0–9 เท่านั้น)');
      return;
    }
    setSavingProfile(true);
    setProfileError(null);
    try {
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: draftProfile.name,
          lineId: draftProfile.lineId,
          email: draftProfile.email,
          phone: phoneDigits,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        if (data.error === 'invalid_phone') {
          setProfileError('กรุณากรอกเบอร์โทร 10 หลัก (ตัวเลข 0–9 เท่านั้น)');
        } else {
          setProfileError('บันทึกข้อมูลไม่สำเร็จ');
        }
        return;
      }
      setProfile((prev) => ({ ...prev, ...draftProfile, phone: phoneDigits }));
      setIsEditingProfile(false);
    } catch {
      setProfileError('บันทึกข้อมูลไม่สำเร็จ');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleOpenBankModal = () => {
    setBankModalKey((k) => k + 1);
    setBankStep(1);
    setIdCardFile(null);
    setBankBookFile(null);
    setBankForm({
      bankName: '',
      accountNumber: '',
      name: '',
      idCardFileName: '',
      bankBookFileName: '',
    });
    setBankSubmitError(null);
    setIsAddBankModalOpen(true);
  };

  const canProceedToDocStep =
    bankForm.bankName.trim().length > 0 &&
    bankForm.accountNumber.trim().length >= 10 &&
    bankForm.name.trim().length > 0;

  const canSubmitBankKyc = Boolean(idCardFile && bankBookFile);

  const submitBankKyc = async () => {
    if (!idCardFile || !bankBookFile) return;
    setBankSubmitting(true);
    setBankSubmitError(null);
    try {
      const fd = new FormData();
      fd.append('bankName', bankForm.bankName.trim());
      fd.append('accountNumber', bankForm.accountNumber.trim());
      fd.append('accountName', bankForm.name.trim());
      fd.append('idCard', idCardFile);
      fd.append('bankBook', bankBookFile);
      const res = await fetch('/api/user/bank-account', {
        method: 'POST',
        body: fd,
        credentials: 'include',
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        const err = data.error;
        setBankSubmitError(
          err === 'invalid_file_type'
            ? 'รองรับเฉพาะไฟล์ JPG, PNG, WebP หรือ PDF'
            : err === 'file_too_large'
              ? 'ไฟล์ใหญ่เกินไป (สูงสุด 12 MB ต่อไฟล์)'
              : err === 'drive_unavailable'
                ? 'ไม่สามารถอัปโหลดเอกสารได้ กรุณาลองใหม่ภายหลัง'
                : 'ส่งข้อมูลบัญชีไม่สำเร็จ กรุณาลองอีกครั้ง'
        );
        return;
      }
      const refresh = await fetch('/api/user/profile', { cache: 'no-store', credentials: 'include' });
      const refreshed = (await refresh.json()) as {
        ok?: boolean;
        linkedBank?: LinkedBankState | null;
      };
      if (refresh.ok && refreshed.ok && refreshed.linkedBank) {
        setLinkedBank(refreshed.linkedBank);
      } else {
        setLinkedBank({
          bankName: bankForm.bankName,
          accountNumber: bankForm.accountNumber,
          accountName: bankForm.name,
          status: 'รอตรวจสอบ',
        });
      }
      setIsAddBankModalOpen(false);
    } catch {
      setBankSubmitError('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้');
    } finally {
      setBankSubmitting(false);
    }
  };

  const maskAccountNumber = (accountNumber: string) => {
    if (accountNumber.length <= 4) return accountNumber;
    return `${'*'.repeat(accountNumber.length - 4)}${accountNumber.slice(-4)}`;
  };

  const openWithdraw = () => {
    if (!linkedBank) {
      setWithdrawBlockMessage("ยังไม่ได้ผูกบัญชีธนาคาร กรุณาเพิ่มบัญชีก่อนถอนเงิน");
      return;
    }
    if (linkedBank.status !== "อนุมัติแล้ว") {
      const reason =
        linkedBank.status === "ไม่อนุมัติ" && linkedBank.reviewReason
          ? ` (เหตุผล: ${linkedBank.reviewReason})`
          : "";
      setWithdrawBlockMessage(`บัญชียังไม่ผ่านการอนุมัติจากแอดมิน${reason}`);
      return;
    }
    if (profile.walletBalance <= 0) {
      setWithdrawBlockMessage("ยอดเงินคงเหลือไม่พอสำหรับการถอน");
      return;
    }
    if (minWithdrawalAmount > 0 && profile.walletBalance < minWithdrawalAmount) {
      setWithdrawBlockMessage(
        `ยอดถอนขั้นต่ำของระบบ ฿${minWithdrawalAmount.toLocaleString("th-TH")} — ยอดคงเหลือของคุณยังไม่ถึงขั้นต่ำ`
      );
      return;
    }
    setWithdrawAmount(String(Math.floor(profile.walletBalance)));
    setWithdrawModalOpen(true);
  };

  const submitWithdraw = async () => {
    const amount = Number(withdrawAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setProfileError("กรุณาระบุจำนวนเงินที่ต้องการถอนให้ถูกต้อง");
      return;
    }
    if (amount > profile.walletBalance) {
      setProfileError("จำนวนเงินเกินยอดที่ถอนได้");
      return;
    }
    if (minWithdrawalAmount > 0 && amount < minWithdrawalAmount) {
      setProfileError(
        `ยอดถอนขั้นต่ำ ฿${minWithdrawalAmount.toLocaleString("th-TH")} กรุณาระบุจำนวนไม่ต่ำกว่านี้`
      );
      return;
    }
    try {
      setWithdrawing(true);
      setProfileError(null);
      const res = await fetch("/api/user/withdrawals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        withdrawal?: WithdrawalRow;
        walletBalance?: number;
        minWithdrawalAmount?: number;
      };
      if (!res.ok || !data.ok || !data.withdrawal) {
        if (data.error === "bank_not_linked") {
          setWithdrawBlockMessage("ยังไม่ได้ผูกบัญชีธนาคาร กรุณาเพิ่มบัญชีก่อนถอนเงิน");
        } else if (data.error === "bank_not_verified") {
          setWithdrawBlockMessage("บัญชียังรอการอนุมัติจากแอดมิน");
        } else if (data.error === "insufficient_balance") {
          setProfileError("ยอดเงินคงเหลือไม่พอสำหรับการถอน");
        } else if (data.error === "below_min_withdrawal") {
          const m = Math.max(0, Math.floor(Number(data.minWithdrawalAmount ?? minWithdrawalAmount)));
          setProfileError(`ยอดถอนขั้นต่ำ ฿${m.toLocaleString("th-TH")} กรุณาระบุจำนวนไม่ต่ำกว่านี้`);
        } else {
          setProfileError("ส่งคำขอถอนเงินไม่สำเร็จ");
        }
        return;
      }
      setProfile((prev) => ({
        ...prev,
        walletBalance: Number(data.walletBalance ?? prev.walletBalance),
      }));
      setWithdrawals((prev) => [data.withdrawal!, ...prev]);
      setWithdrawModalOpen(false);
      setWithdrawAmount("");
    } catch {
      setProfileError("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ");
    } finally {
      setWithdrawing(false);
    }
  };
  const maxWithdrawable = Math.max(0, Math.floor(profile.walletBalance));
  const effectiveMinWithdraw = minWithdrawalAmount > 0 ? minWithdrawalAmount : 1;
  const canSubmitWithdraw =
    Number.isFinite(Number(withdrawAmount)) &&
    Number(withdrawAmount) >= effectiveMinWithdraw &&
    Number(withdrawAmount) <= maxWithdrawable &&
    !withdrawing;

  return (
    <div className="max-w-md mx-auto p-4 space-y-6 font-prompt pb-24 bg-slate-50 min-h-screen">
      {profileError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
          {profileError}
        </div>
      ) : null}
      {/* User Identity Section */}
      <motion.section 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-3 pt-2"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-4 min-w-0 flex-1">
            <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-white shadow-xl shrink-0">
              <Image
                src={profile.avatarUrl?.trim() ? profile.avatarUrl : AVATAR_PLACEHOLDER}
                alt="User Avatar"
                width={80}
                height={80}
                className="object-cover w-full h-full"
                referrerPolicy="no-referrer"
                unoptimized={
                  !profile.avatarUrl?.trim() ||
                  !/^https?:\/\//i.test(profile.avatarUrl.trim())
                }
              />
            </div>
            
            <div className="space-y-2 min-w-0 flex-1">
              {isEditingProfile ? (
                <>
                  <input
                    type="text"
                    value={draftProfile.name}
                    onChange={(event) => setDraftProfile((prev) => ({ ...prev, name: event.target.value }))}
                    className="w-full rounded-xl border border-[#e1bee7] bg-white px-3 py-2 text-base font-bold text-slate-900 focus:outline-none focus:border-[#8e24aa]/50"
                    placeholder="ชื่อ-สกุล"
                  />
                  <input
                    type="text"
                    value={draftProfile.lineId}
                    onChange={(event) => setDraftProfile((prev) => ({ ...prev, lineId: event.target.value }))}
                    className="w-full rounded-xl border border-[#e1bee7] bg-white px-3 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:border-[#8e24aa]/50"
                    placeholder="LINE ID"
                  />
                  <input
                    type="email"
                    value={draftProfile.email}
                    onChange={(event) => setDraftProfile((prev) => ({ ...prev, email: event.target.value }))}
                    className="w-full rounded-xl border border-[#e1bee7] bg-white px-3 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:border-[#8e24aa]/50"
                    placeholder="อีเมล"
                  />
                  <input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={draftProfile.phone}
                    onChange={(event) =>
                      setDraftProfile((prev) => ({
                        ...prev,
                        phone: sanitizeThaiPhoneInput(event.target.value),
                      }))
                    }
                    className="w-full rounded-xl border border-[#e1bee7] bg-white px-3 py-2 text-sm font-medium text-slate-700 focus:outline-none focus:border-[#8e24aa]/50"
                    placeholder="0812345678"
                  />
                </>
              ) : (
                <>
                  <p className="text-2xl font-bold text-slate-900 leading-tight tracking-tight">{profile.name}</p>
                  <p className="text-slate-500 text-sm font-medium">LINE ID: {profile.lineId}</p>
                  <p className="text-slate-500 text-sm font-medium">อีเมล: {profile.email}</p>
                  <p className="text-slate-500 text-sm font-medium">เบอร์โทร: {profile.phone}</p>
                  <div className="pt-2">
                    <p className="text-[11px] font-black uppercase tracking-wider text-[#8e24aa]/70">
                      รหัสแนะนำเพื่อน
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="rounded-xl border border-[#e1bee7] bg-white px-3 py-2 text-sm font-black tracking-[0.18em] text-[#4a148c]">
                        {profile.referralCode || "-"}
                      </div>
                      <button
                        type="button"
                        onClick={handleCopyReferralCode}
                        disabled={!profile.referralCode}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-[#e1bee7] bg-white px-3 py-2 text-xs font-bold text-[#6a1b9a] hover:border-[#8e24aa]/50 hover:text-[#8e24aa] disabled:opacity-50"
                      >
                        {copiedReferral ? <Check size={14} /> : <Copy size={14} />}
                        {copiedReferral ? "คัดลอกแล้ว" : "คัดลอก"}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
          {!isEditingProfile ? (
            <button
              type="button"
              onClick={handleStartEditProfile}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[#e1bee7] text-[#6a1b9a] hover:border-[#8e24aa]/50 hover:text-[#8e24aa] transition-colors text-xs font-bold shrink-0"
            >
              <Pencil size={14} />
              แก้ไข
            </button>
          ) : null}
        </div>

        {isEditingProfile && (
          <div className="rounded-2xl border border-[#e1bee7] bg-white p-4 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs font-bold text-[#6a1b9a]/75 uppercase tracking-wider">
                รูปโปรไฟล์จาก LINE
              </p>
              <button
                type="button"
                onClick={handleSyncLineAvatar}
                disabled={syncingLineAvatar}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#ce93d8] bg-[#f3e5f5] px-4 py-2.5 text-sm font-bold text-[#4a148c] hover:border-[#8e24aa]/50 hover:bg-[#ede7f6] transition-colors disabled:opacity-60"
              >
                {syncingLineAvatar ? (
                  <RefreshCw className="animate-spin shrink-0" size={18} />
                ) : (
                  <RefreshCw className="shrink-0" size={18} />
                )}
                {syncingLineAvatar ? "กำลังดึงรูป…" : "อัพเดทโปรไฟล์"}
              </button>
            </div>
            <p className="text-xs text-slate-500">
              หากรูปไม่ขึ้น หรือเปลี่ยนรูปใน LINE แล้วยังไม่อัปเดต — กดปุ่มเพื่อดึงรูปล่าสุดจาก LINE
            </p>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={handleCancelEditProfile}
                className="px-3 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                    onClick={handleSaveProfile}
                    disabled={savingProfile}
                className="px-3 py-2 rounded-lg bg-[#8e24aa] text-white text-xs font-bold hover:brightness-110 transition-all"
              >
                    {savingProfile ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
              </button>
            </div>
          </div>
        )}
      </motion.section>

      {/* The Wallet Card */}
      <motion.section
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="relative overflow-hidden bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-teal-900 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-teal-900/20"
      >
        {/* Decorative background elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-teal-400/10 blur-[60px] rounded-full" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-cyan-400/10 blur-[50px] rounded-full" />

        <div className="relative z-10 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 opacity-80">
              <Wallet size={18} />
              <span className="text-sm font-bold uppercase tracking-widest">Available Balance</span>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-medium text-teal-200/60 leading-relaxed">ยอดเงินที่ถอนได้</p>
            <h2 className="text-4xl font-bold tracking-tighter italic">
              ฿ {profile.walletBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </h2>
          </div>

          <button
            type="button"
            onClick={openWithdraw}
            className="w-full bg-white text-[#0f172a] py-4 rounded-2xl font-black text-lg shadow-xl shadow-black/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2 group"
          >
            ถอนเงิน
            <ArrowUpRight size={20} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
          </button>
        </div>
      </motion.section>

      {/* Action Cards - Inline Content */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-3"
      >
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-slate-50 rounded-xl text-[#8e24aa]">
                  <UserCog size={22} />
                </div>
                <div className="text-left">
                  <p className="text-base font-semibold text-slate-800 leading-snug break-words">จัดการบัญชี</p>
                  <p className="text-xs font-medium text-slate-400 uppercase tracking-widest">Account Management</p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleOpenBankModal}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#8e24aa] text-white text-xs font-bold hover:brightness-110 transition-all shrink-0"
              >
                <Landmark size={14} />
                เพิ่มบัญชี
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {linkedBank ? (
                <div className="w-full p-4 rounded-xl border border-[#e1bee7] bg-[#fcf7fd]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-white border border-[#e1bee7] flex items-center justify-center text-[#8e24aa]">
                        <Landmark size={16} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-800">{linkedBank.bankName}</p>
                        <p className="text-xs text-slate-500">เลขบัญชี: {maskAccountNumber(linkedBank.accountNumber)}</p>
                        <p className="text-xs text-slate-500">ชื่อบัญชี: {linkedBank.accountName}</p>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                      {linkedBank.status}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="w-full p-4 rounded-xl border border-dashed border-[#ce93d8] bg-[#fcf7fd] text-left">
                  <p className="text-sm font-bold text-slate-700">ยังไม่มีบัญชีที่เชื่อม</p>
                  <p className="text-xs text-slate-500 mt-1">กดปุ่ม &quot;เพิ่มบัญชี&quot; เพื่อเพิ่มข้อมูลบัญชีธนาคาร</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-slate-50 rounded-xl text-[#8e24aa]">
                <Landmark size={22} />
              </div>
              <div className="text-left">
                <p className="text-base font-semibold text-slate-800 leading-snug break-words">ประวัติรายการถอนเงิน</p>
                <p className="text-xs font-medium text-slate-400 uppercase tracking-widest">Withdrawal History</p>
              </div>
            </div>
            <div className="mt-4 space-y-2 text-sm">
              {loadingProfile ? (
                <p className="text-slate-500">กำลังโหลดประวัติ...</p>
              ) : withdrawals.length === 0 ? (
                <p className="text-slate-500">ยังไม่มีประวัติรายการถอนเงิน</p>
              ) : (
                withdrawals.map((row) => {
                  const isCompleted = row.status === 'completed';
                  return (
                    <div key={row.id} className="flex items-center justify-between">
                      <span className="text-slate-600">TX-{row.id.slice(-6).toUpperCase()} • {row.date}</span>
                      <span className={`font-bold ${isCompleted ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {isCompleted ? 'โอนแล้ว' : 'รอโอน'} ฿{row.amount.toLocaleString()}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </motion.section>

      {isAddBankModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm p-4 flex items-center justify-center">
          <div className="w-full max-w-md rounded-2xl border border-[#e1bee7] bg-white shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900">เพิ่มบัญชีธนาคาร</h3>
                <p className="text-xs text-slate-500 mt-1">
                  {bankStep === 1 ? 'ขั้นตอนที่ 1: ข้อมูลบัญชี' : 'ขั้นตอนที่ 2: เอกสารยืนยันตัวตน'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddBankModalOpen(false)}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="px-5 py-4">
              {bankStep === 1 ? (
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">ธนาคาร</label>
                  <div className="relative">
                    <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8e24aa]" />
                    <input
                      type="text"
                      value={bankForm.bankName}
                      onChange={(event) => setBankForm((prev) => ({ ...prev, bankName: event.target.value }))}
                      placeholder="เช่น กสิกรไทย / ไทยพาณิชย์"
                      className="w-full rounded-xl border border-[#e1bee7] bg-white pl-10 pr-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-[#8e24aa]/50"
                    />
                  </div>

                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">ชื่อ</label>
                  <input
                    type="text"
                    value={bankForm.name}
                    onChange={(event) => setBankForm((prev) => ({ ...prev, name: event.target.value }))}
                    placeholder="ชื่อ-นามสกุล"
                    className="w-full rounded-xl border border-[#e1bee7] bg-white px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-[#8e24aa]/50"
                  />

                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">เลขบัญชี</label>
                  <input
                    type="text"
                    value={bankForm.accountNumber}
                    onChange={(event) => setBankForm((prev) => ({ ...prev, accountNumber: event.target.value.replace(/\D/g, '') }))}
                    placeholder="เช่น 1234567890"
                    className="w-full rounded-xl border border-[#e1bee7] bg-white px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-[#8e24aa]/50"
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="w-full p-4 rounded-xl border border-dashed border-[#ce93d8] bg-[#fcf7fd]">
                    <label className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <FileUp size={16} className="text-[#8e24aa]" />
                      อัปโหลดบัตรประชาชน
                    </label>
                    <input
                      key={`id-card-${bankModalKey}`}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      onChange={(event) => {
                        const f = event.target.files?.[0] ?? null;
                        setIdCardFile(f);
                        setBankForm((prev) => ({
                          ...prev,
                          idCardFileName: f?.name ?? '',
                        }));
                      }}
                      className="mt-2 block w-full text-xs text-slate-500"
                    />
                    {bankForm.idCardFileName && (
                      <p className="mt-2 text-xs text-emerald-600 font-medium flex items-center gap-1">
                        <CircleCheckBig size={12} /> {bankForm.idCardFileName}
                      </p>
                    )}
                  </div>

                  <div className="w-full p-4 rounded-xl border border-dashed border-[#ce93d8] bg-[#fcf7fd]">
                    <label className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <FileUp size={16} className="text-[#8e24aa]" />
                      อัปโหลดสมุดบัญชีธนาคาร
                    </label>
                    <input
                      key={`bank-book-${bankModalKey}`}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      onChange={(event) => {
                        const f = event.target.files?.[0] ?? null;
                        setBankBookFile(f);
                        setBankForm((prev) => ({
                          ...prev,
                          bankBookFileName: f?.name ?? '',
                        }));
                      }}
                      className="mt-2 block w-full text-xs text-slate-500"
                    />
                    {bankForm.bankBookFileName && (
                      <p className="mt-2 text-xs text-emerald-600 font-medium flex items-center gap-1">
                        <CircleCheckBig size={12} /> {bankForm.bankBookFileName}
                      </p>
                    )}
                  </div>
                </div>
              )}
              {bankSubmitError && bankStep === 2 ? (
                <p className="text-xs text-red-600 font-medium mt-2">{bankSubmitError}</p>
              ) : null}
            </div>

            <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between">
              {bankStep === 1 ? (
                <>
                  <button
                    type="button"
                    onClick={() => setIsAddBankModalOpen(false)}
                    className="px-3 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50"
                  >
                    ยกเลิก
                  </button>
                  <button
                    type="button"
                    disabled={!canProceedToDocStep}
                    onClick={() => setBankStep(2)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#8e24aa] text-white text-xs font-bold hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    ถัดไป
                    <ChevronRight size={14} />
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setBankStep(1)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50"
                  >
                    <CircleX size={14} />
                    ย้อนกลับ
                  </button>
                  <button
                    type="button"
                    disabled={!canSubmitBankKyc || bankSubmitting}
                    onClick={() => void submitBankKyc()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#8e24aa] text-white text-xs font-bold hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Check size={14} />
                    {bankSubmitting ? 'กำลังส่ง...' : 'บันทึกและส่งตรวจสอบ'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {withdrawBlockMessage ? (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm p-4 flex items-center justify-center">
          <div className="w-full max-w-sm rounded-2xl border border-[#e1bee7] bg-white shadow-2xl p-5">
            <h3 className="text-base font-black text-slate-900">ไม่สามารถถอนเงินได้</h3>
            <p className="text-sm text-slate-600 mt-2">{withdrawBlockMessage}</p>
            <button
              type="button"
              onClick={() => setWithdrawBlockMessage(null)}
              className="mt-4 w-full rounded-xl bg-[#8e24aa] text-white py-2.5 text-sm font-bold"
            >
              ตกลง
            </button>
          </div>
        </div>
      ) : null}

      {withdrawModalOpen ? (
        <div className="fixed inset-0 z-50 bg-black/45 backdrop-blur-sm p-4 flex items-center justify-center">
          <div className="w-full max-w-sm rounded-2xl border border-[#e1bee7] bg-white shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="text-base font-black text-slate-900">ถอนเงิน</h3>
              <p className="text-xs text-slate-500 mt-1">
                ถอนได้สูงสุด ฿{profile.walletBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                {minWithdrawalAmount > 0 ? (
                  <>
                    <br />
                    <span className="text-[#8e24aa] font-bold">
                      ขั้นต่ำต่อครั้ง ฿{minWithdrawalAmount.toLocaleString("th-TH")}
                    </span>
                  </>
                ) : null}
              </p>
            </div>
            <div className="px-5 py-4 space-y-3">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                จำนวนเงินที่ต้องการถอน
              </label>
              <input
                type="number"
                min={effectiveMinWithdraw}
                max={maxWithdrawable}
                step={1}
                value={withdrawAmount}
                onChange={(event) => {
                  const raw = event.target.value.replace(/\D/g, "");
                  if (!raw) {
                    setWithdrawAmount("");
                    return;
                  }
                  const next = Math.min(Number(raw), maxWithdrawable);
                  setWithdrawAmount(String(next));
                }}
                className="w-full rounded-xl border border-[#e1bee7] bg-white px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:border-[#8e24aa]/50"
                placeholder="ระบุจำนวนเงิน"
              />
            </div>
            <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => setWithdrawModalOpen(false)}
                className="px-3 py-2 rounded-lg border border-slate-200 text-slate-600 text-xs font-bold"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                disabled={!canSubmitWithdraw}
                onClick={submitWithdraw}
                className="px-3 py-2 rounded-lg bg-[#8e24aa] text-white text-xs font-bold disabled:opacity-60"
              >
                {withdrawing ? "กำลังส่งคำขอ..." : "ยืนยันการถอน"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
