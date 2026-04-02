'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion } from 'motion/react';
import { KeyRound, ShieldCheck, UserCircle2, UserRound, Save, RefreshCw, BellRing, Link2, Unlink2 } from 'lucide-react';

type AdminMe = {
  ok?: boolean;
  id?: string;
  username?: string;
  name?: string;
  role?: 'admin' | 'reviewer';
  roleLabel?: string;
  lineNotifyEnabled?: boolean;
  lineNotifyConnected?: boolean;
  lineNotifyUserId?: string;
};

type AdminRow = {
  id: string;
  name: string;
  username: string;
  role: string;
  status: string;
  lastActive: string;
  lineNotifyEnabled?: boolean;
  lineNotifyConnected?: boolean;
  lineNotifyUserId?: string;
};

function AdminProfilePageInner() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [me, setMe] = useState<AdminRow | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftPassword, setDraftPassword] = useState('');
  const [draftConfirmPassword, setDraftConfirmPassword] = useState('');
  const [lineSaving, setLineSaving] = useState(false);

  async function loadProfile() {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      const meRes = await fetch('/api/auth/admin/me', { cache: 'no-store' });
      const meData = (await meRes.json()) as AdminMe;
      if (!meRes.ok || !meData.ok || !meData.username) {
        throw new Error('load_me_failed');
      }

      const current: AdminRow = {
        id: String(meData.id ?? ''),
        name: String(meData.name ?? meData.username ?? ''),
        username: String(meData.username ?? ''),
        role: String(meData.roleLabel ?? meData.role ?? 'Administrator'),
        status: 'Online',
        lastActive: '-',
        lineNotifyEnabled: meData.lineNotifyEnabled !== false,
        lineNotifyConnected: meData.lineNotifyConnected === true,
        lineNotifyUserId: String(meData.lineNotifyUserId ?? ''),
      };
      if (!current.id || !current.username) {
        throw new Error('admin_not_found');
      }

      setMe(current);
      setDraftName(current.name);
      setDraftPassword('');
      setDraftConfirmPassword('');
    } catch {
      setError('โหลดข้อมูลโปรไฟล์แอดมินไม่สำเร็จ');
      setMe(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProfile();
  }, []);

  useEffect(() => {
    const status = searchParams.get('lineConnect');
    if (!status) return;
    if (status === 'success') {
      setSuccess('เชื่อม LINE สำหรับแอดมินเรียบร้อยแล้ว');
      setError(null);
      return;
    }
    if (status === 'missing_config') {
      setError('ยังไม่ได้ตั้งค่า LINE Login สำหรับการเชื่อมบัญชีแอดมิน');
      return;
    }
    if (status === 'duplicate') {
      setError('LINE บัญชีนี้ถูกเชื่อมกับแอดมินคนอื่นอยู่แล้ว');
      return;
    }
    if (status === 'session_expired') {
      setError('เซสชันแอดมินหมดอายุ กรุณาเข้าสู่ระบบใหม่แล้วลองเชื่อม LINE อีกครั้ง');
      return;
    }
    if (status === 'state_mismatch') {
      setError('การยืนยันการเชื่อม LINE ไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง');
      return;
    }
    if (status === 'invalid_profile') {
      setError('LINE ไม่ได้ส่งข้อมูลผู้ใช้กลับมาครบถ้วน กรุณาลองใหม่อีกครั้ง');
      return;
    }
    setError('เชื่อม LINE ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง');
  }, [searchParams]);

  const canSave = useMemo(() => {
    if (!me) return false;
    if (!draftName.trim()) return false;
    if (draftPassword && draftPassword.length < 8) return false;
    if (draftPassword !== draftConfirmPassword) return false;
    return draftName.trim() !== me.name || draftPassword.length > 0;
  }, [draftConfirmPassword, draftName, draftPassword, me]);

  async function handleSave() {
    if (!me) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      if (draftPassword && draftPassword !== draftConfirmPassword) {
        setError('รหัสผ่านใหม่และยืนยันรหัสผ่านไม่ตรงกัน');
        return;
      }

      const res = await fetch(`/api/cms/admins/${me.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: draftName.trim(),
          password: draftPassword || undefined,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? 'update_failed');
      }

      setSuccess('บันทึกโปรไฟล์แอดมินเรียบร้อยแล้ว');
      await loadProfile();
    } catch (e) {
      const message = e instanceof Error ? e.message : '';
      if (message === 'password_too_short') setError('รหัสผ่านใหม่ต้องอย่างน้อย 8 ตัวอักษร');
      else if (message === 'invalid_name') setError('กรุณาระบุชื่อแสดง');
      else setError('บันทึกข้อมูลโปรไฟล์ไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleLineNotify(enabled: boolean) {
    if (!me) return;
    setLineSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/cms/admins/${me.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineNotifyEnabled: enabled }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? 'line_notify_update_failed');
      }
      setSuccess(enabled ? 'เปิดแจ้งเตือน LINE แล้ว' : 'ปิดแจ้งเตือน LINE แล้ว');
      await loadProfile();
    } catch {
      setError('อัปเดตสถานะการแจ้งเตือน LINE ไม่สำเร็จ');
    } finally {
      setLineSaving(false);
    }
  }

  async function handleDisconnectLine() {
    if (!me) return;
    setLineSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/cms/admins/${me.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lineNotifyUserId: '', lineNotifyEnabled: false }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? 'line_disconnect_failed');
      }
      setSuccess('ยกเลิกการเชื่อม LINE สำหรับแจ้งเตือนแล้ว');
      await loadProfile();
    } catch {
      setError('ยกเลิกการเชื่อม LINE ไม่สำเร็จ');
    } finally {
      setLineSaving(false);
    }
  }

  return (
    <div className="space-y-6 text-[#4a148c]">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-3xl border border-[#e1bee7] bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-wider text-[#6a1b9a]/70">สิทธิ์การใช้งาน</p>
          <p className="mt-2 text-xl font-black text-[#4a148c]">{me?.role ?? 'Administrator'}</p>
          <p className="mt-1 text-xs text-[#6a1b9a]/60">บัญชีสำหรับเข้าถึงส่วนจัดการระบบ</p>
        </div>
        <div className="rounded-3xl border border-[#e1bee7] bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-wider text-[#6a1b9a]/70">สถานะบัญชี</p>
          <p className="mt-2 text-xl font-black text-emerald-700">{me?.status ?? '-'}</p>
          <p className="mt-1 text-xs text-[#6a1b9a]/60">อ้างอิงจากรายการแอดมินในระบบ CMS</p>
        </div>
        <div className="rounded-3xl border border-[#e1bee7] bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-wider text-[#6a1b9a]/70">ล่าสุดที่มีการอัปเดต</p>
          <p className="mt-2 text-xl font-black text-[#4a148c]">{me?.lastActive ?? '-'}</p>
          <p className="mt-1 text-xs text-[#6a1b9a]/60">ใช้ประกอบการตรวจสอบการแก้ไขข้อมูลแอดมิน</p>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl border border-[#e1bee7] bg-white p-5 md:p-6 shadow-sm"
      >
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-[#6a1b9a]/70">โปรไฟล์แอดมิน</p>
            <h1 className="mt-2 text-2xl font-black text-[#4a148c]">จัดการข้อมูลบัญชีของคุณ</h1>
            <p className="mt-2 text-sm text-[#6a1b9a]/70">
              เปลี่ยนชื่อแสดง รหัสผ่าน และจัดการการเชื่อม LINE สำหรับแจ้งเตือนของบัญชีแอดมินนี้
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadProfile()}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#e1bee7] bg-[#faf5fc] px-4 py-3 text-sm font-bold text-[#6a1b9a] hover:bg-[#f3e5f5]"
          >
            <RefreshCw size={16} />
            รีเฟรชข้อมูล
          </button>
        </div>

        {error ? (
          <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
            {error}
          </div>
        ) : null}
        {success ? (
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
            {success}
          </div>
        ) : null}

        {loading ? (
          <div className="mt-6 rounded-2xl border border-[#e1bee7] bg-[#faf5fc] px-5 py-6 text-sm text-[#6a1b9a]/70">
            กำลังโหลดข้อมูลแอดมิน...
          </div>
        ) : me ? (
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-6">
            <div className="rounded-3xl border border-[#e1bee7] bg-[#faf5fc] p-5">
              <div className="w-20 h-20 rounded-full bg-white border border-[#e1bee7] flex items-center justify-center text-[#8e24aa] shadow-sm">
                <UserCircle2 size={44} />
              </div>
              <h2 className="mt-4 text-xl font-black text-[#4a148c]">{me.name}</h2>
              <p className="mt-1 text-sm font-bold uppercase tracking-[0.2em] text-[#8e24aa]">{me.username}</p>

              <div className="mt-5 space-y-3 text-sm text-[#6a1b9a]/75">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={16} className="text-[#8e24aa]" />
                  สิทธิ์: {me.role}
                </div>
                <div className="flex items-center gap-2">
                  <UserRound size={16} className="text-[#8e24aa]" />
                  สถานะ: {me.status}
                </div>
                <div className="flex items-center gap-2">
                  <KeyRound size={16} className="text-[#8e24aa]" />
                  รหัสผ่านสามารถเปลี่ยนได้จากฟอร์มด้านขวา
                </div>
                <div className="flex items-center gap-2">
                  <BellRing size={16} className="text-[#8e24aa]" />
                  LINE แจ้งเตือน: {me.lineNotifyConnected ? 'เชื่อมแล้ว' : 'ยังไม่เชื่อม'}
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-[#e1bee7] bg-white p-5 space-y-5">
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-wider text-[#6a1b9a]/70">
                    Username
                  </label>
                  <input
                    value={me.username}
                    disabled
                    className="w-full rounded-2xl border border-[#e1bee7] bg-[#f5f0f7] px-4 py-3 text-sm text-[#6a1b9a]/60"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-wider text-[#6a1b9a]/70">
                    ชื่อแสดง
                  </label>
                  <input
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    className="w-full rounded-2xl border border-[#e1bee7] bg-[#faf5fc] px-4 py-3 text-sm text-[#4a148c] focus:outline-none focus:border-[#8e24aa]/50"
                    placeholder="ชื่อแสดงของแอดมิน"
                  />
                </div>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-wider text-[#6a1b9a]/70">
                    รหัสผ่านใหม่
                  </label>
                  <input
                    type="password"
                    value={draftPassword}
                    onChange={(e) => setDraftPassword(e.target.value)}
                    className="w-full rounded-2xl border border-[#e1bee7] bg-[#faf5fc] px-4 py-3 text-sm text-[#4a148c] focus:outline-none focus:border-[#8e24aa]/50"
                    placeholder="เว้นว่างถ้าไม่ต้องการเปลี่ยน"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase tracking-wider text-[#6a1b9a]/70">
                    ยืนยันรหัสผ่านใหม่
                  </label>
                  <input
                    type="password"
                    value={draftConfirmPassword}
                    onChange={(e) => setDraftConfirmPassword(e.target.value)}
                    className="w-full rounded-2xl border border-[#e1bee7] bg-[#faf5fc] px-4 py-3 text-sm text-[#4a148c] focus:outline-none focus:border-[#8e24aa]/50"
                    placeholder="กรอกซ้ำอีกครั้ง"
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-[#e1bee7] bg-[#faf5fc] p-4 text-xs text-[#6a1b9a]/70">
                หากต้องการเปลี่ยนรหัสผ่าน กรุณากรอกอย่างน้อย 8 ตัวอักษร และยืนยันรหัสผ่านให้ตรงกันก่อนบันทึก
              </div>

              <div className="rounded-2xl border border-[#e1bee7] bg-[#faf5fc] p-4 space-y-4">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-[#6a1b9a]/70">
                      LINE Notify for Admin
                    </p>
                    <p className="mt-1 text-sm font-bold text-[#4a148c]">
                      {me.lineNotifyConnected ? 'เชื่อม LINE สำหรับรับแจ้งเตือนแล้ว' : 'ยังไม่ได้เชื่อม LINE'}
                    </p>
                  </div>
                  <div
                    className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-black ${
                      me.lineNotifyConnected
                        ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                        : 'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}
                  >
                    {me.lineNotifyConnected ? 'Connected' : 'Not connected'}
                  </div>
                </div>

                <div className="rounded-2xl border border-[#e1bee7] bg-white px-4 py-3 text-xs text-[#6a1b9a]/70">
                  LINE User ID: <span className="font-mono text-[#4a148c]">{me.lineNotifyUserId || '-'}</span>
                </div>

                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      window.location.href = '/api/auth/admin/line/connect';
                    }}
                    className="inline-flex items-center gap-2 rounded-2xl bg-[#06c755] px-5 py-3 text-sm font-black text-white hover:brightness-110"
                  >
                    <Link2 size={16} />
                    {me.lineNotifyConnected ? 'เชื่อม LINE ใหม่อีกครั้ง' : 'เชื่อม LINE'}
                  </button>
                  <button
                    type="button"
                    disabled={lineSaving || !me.lineNotifyConnected}
                    onClick={() => void handleDisconnectLine()}
                    className="inline-flex items-center gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-bold text-rose-700 disabled:opacity-50"
                  >
                    <Unlink2 size={16} />
                    ยกเลิกการเชื่อม
                  </button>
                  <button
                    type="button"
                    disabled={lineSaving || !me.lineNotifyConnected}
                    onClick={() => void handleToggleLineNotify(!(me.lineNotifyEnabled !== false))}
                    className="inline-flex items-center gap-2 rounded-2xl border border-[#e1bee7] bg-white px-5 py-3 text-sm font-bold text-[#6a1b9a] disabled:opacity-50"
                  >
                    <BellRing size={16} />
                    {me.lineNotifyEnabled !== false ? 'ปิดแจ้งเตือน LINE' : 'เปิดแจ้งเตือน LINE'}
                  </button>
                </div>

                <p className="text-xs text-[#6a1b9a]/70">
                  ใช้ LINE Login ชุดเดียวกับระบบหลักได้ เมื่อเชื่อมสำเร็จ บัญชีนี้จะสามารถรับแจ้งเตือนจาก LINE OA ฝั่งแอดมินได้
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={!canSave || saving}
                  className="inline-flex items-center gap-2 rounded-2xl bg-[#8e24aa] px-5 py-3 text-sm font-black text-white disabled:opacity-60"
                >
                  <Save size={16} />
                  {saving ? 'กำลังบันทึก...' : 'บันทึกโปรไฟล์'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDraftName(me.name);
                    setDraftPassword('');
                    setDraftConfirmPassword('');
                    setError(null);
                    setSuccess(null);
                  }}
                  className="rounded-2xl border border-[#e1bee7] px-5 py-3 text-sm font-bold text-[#6a1b9a]"
                >
                  คืนค่า
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </motion.div>
    </div>
  );
}

export default function AdminProfilePage() {
  return (
    <Suspense fallback={<div className="space-y-6 text-[#4a148c]" />}>
      <AdminProfilePageInner />
    </Suspense>
  );
}
