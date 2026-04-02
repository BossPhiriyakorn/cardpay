'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, Plus, Search, User, Calendar } from 'lucide-react';
import { useCmsAdminMe } from '@/hooks/useCmsAdminMe';

type AdminRow = {
  id: string;
  name: string;
  username: string;
  role: string;
  roleKey: 'admin' | 'reviewer';
  status: string;
  lastActive: string;
};

export default function AdminsPage() {
  const { isAdmin } = useCmsAdminMe();
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState({ username: '', name: '', password: '', role: 'admin' as 'admin' | 'reviewer' });
  const [editing, setEditing] = useState<AdminRow | null>(null);
  const [editName, setEditName] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editRole, setEditRole] = useState<'admin' | 'reviewer'>('admin');
  const [saving, setSaving] = useState(false);

  async function loadAdmins() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/cms/admins', { cache: 'no-store' });
      const data = (await res.json()) as { ok?: boolean; admins?: AdminRow[]; error?: string };
      if (!res.ok || !data.ok) throw new Error(data.error ?? 'load_failed');
      setAdmins(data.admins ?? []);
    } catch {
      setError('โหลดข้อมูลแอดมินไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAdmins();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return admins;
    return admins.filter((a) => [a.name, a.username, a.role].some((x) => x.toLowerCase().includes(q)));
  }, [admins, search]);

  async function createAdmin() {
    if (!isAdmin) {
      setError('สิทธิ์ตรวจสอบไม่สามารถเพิ่มแอดมินได้');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/cms/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? 'create_failed');
      }
      setDraft({ username: '', name: '', password: '', role: 'admin' });
      setShowCreate(false);
      await loadAdmins();
    } catch (e) {
      const message = e instanceof Error ? e.message : '';
      if (message === 'username_taken') setError('username นี้ถูกใช้แล้ว');
      else if (message === 'password_too_short') setError('รหัสผ่านต้องอย่างน้อย 8 ตัวอักษร');
      else setError('สร้างแอดมินไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  }

  async function updateAdmin(changes: { name?: string; password?: string; isActive?: boolean; role?: 'admin' | 'reviewer' }) {
    if (!isAdmin) {
      setError('สิทธิ์ตรวจสอบไม่สามารถแก้ไขแอดมินได้');
      return;
    }
    if (!editing) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/cms/admins/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? 'update_failed');
      }
      setEditing(null);
      setEditName('');
      setEditPassword('');
      setEditRole('admin');
      await loadAdmins();
    } catch (e) {
      const message = e instanceof Error ? e.message : '';
      if (message === 'password_too_short') setError('รหัสผ่านต้องอย่างน้อย 8 ตัวอักษร');
      else setError('อัปเดตแอดมินไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  }

  async function toggleAdminStatus(admin: AdminRow) {
    if (!isAdmin) {
      setError('สิทธิ์ตรวจสอบไม่สามารถจัดการแอดมินได้');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/cms/admins/${admin.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: admin.status !== 'Online' }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? 'update_failed');
      }
      await loadAdmins();
    } catch {
      setError('อัปเดตสถานะแอดมินไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8 text-[#4a148c]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6 bg-white border border-[#e1bee7] p-4 md:p-6 rounded-3xl shadow-sm">
        <div className="flex items-center gap-3 md:gap-4 flex-1 w-full md:max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-[#8e24aa]/45 md:w-[18px] md:h-[18px]" size={16} />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="ค้นหาแอดมิน..."
              className="w-full bg-[#faf5fc] border border-[#e1bee7] rounded-2xl py-2.5 md:py-3 pl-10 md:pl-12 pr-4 text-xs md:text-sm text-[#4a148c] placeholder:text-[#6a1b9a]/40 focus:outline-none focus:border-[#8e24aa]/50 transition-all"
            />
          </div>
        </div>
        {isAdmin ? (
          <button onClick={() => setShowCreate((value) => !value)} className="flex items-center justify-center gap-2 bg-[#8e24aa] text-white text-xs md:text-sm font-black px-5 md:px-6 py-2.5 md:py-3 rounded-2xl shadow-[0_10px_25px_rgba(142,36,170,0.28)] hover:scale-105 transition-all w-full md:w-auto"><Plus size={18} className="md:w-5 md:h-5" />เพิ่มแอดมิน</button>
        ) : (
          <div className="w-full md:w-auto rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-bold text-amber-800">
            สิทธิ์ตรวจสอบดูข้อมูลแอดมินได้ แต่ไม่สามารถเพิ่มหรือแก้ไขได้
          </div>
        )}
      </div>

      {showCreate && isAdmin ? (
        <div className="rounded-3xl border border-[#e1bee7] bg-white p-5 md:p-6 shadow-sm space-y-4">
          <div className="grid gap-4 md:grid-cols-4">
            <input value={draft.username} onChange={(e) => setDraft((prev) => ({ ...prev, username: e.target.value }))} placeholder="username" className="rounded-2xl border border-[#e1bee7] bg-[#faf5fc] px-4 py-3 text-sm focus:outline-none focus:border-[#8e24aa]/50" />
            <input value={draft.name} onChange={(e) => setDraft((prev) => ({ ...prev, name: e.target.value }))} placeholder="ชื่อแสดง" className="rounded-2xl border border-[#e1bee7] bg-[#faf5fc] px-4 py-3 text-sm focus:outline-none focus:border-[#8e24aa]/50" />
            <input type="password" value={draft.password} onChange={(e) => setDraft((prev) => ({ ...prev, password: e.target.value }))} placeholder="รหัสผ่านอย่างน้อย 8 ตัว" className="rounded-2xl border border-[#e1bee7] bg-[#faf5fc] px-4 py-3 text-sm focus:outline-none focus:border-[#8e24aa]/50" />
            <select value={draft.role} onChange={(e) => setDraft((prev) => ({ ...prev, role: e.target.value as 'admin' | 'reviewer' }))} className="rounded-2xl border border-[#e1bee7] bg-[#faf5fc] px-4 py-3 text-sm focus:outline-none focus:border-[#8e24aa]/50">
              <option value="admin">แอดมิน</option>
              <option value="reviewer">ตรวจสอบ</option>
            </select>
          </div>
          <div className="flex gap-3">
            <button onClick={createAdmin} disabled={saving} className="rounded-2xl bg-[#8e24aa] px-5 py-3 text-sm font-black text-white disabled:opacity-60">
              {saving ? 'กำลังบันทึก...' : 'สร้างแอดมิน'}
            </button>
            <button onClick={() => setShowCreate(false)} className="rounded-2xl border border-[#e1bee7] px-5 py-3 text-sm font-bold text-[#6a1b9a]">
              ยกเลิก
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {filtered.map((admin, index) => (
          <motion.div key={admin.id} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: index * 0.1 }} className="bg-white border border-[#e1bee7] p-6 md:p-8 rounded-3xl hover:border-[#8e24aa]/30 transition-all group relative overflow-hidden shadow-sm">
            <div className="absolute top-0 right-0 w-24 md:w-32 h-24 md:h-32 bg-gradient-to-br from-[#8e24aa]/10 to-transparent blur-3xl -mr-12 md:-mr-16 -mt-12 md:-mt-16 group-hover:scale-150 transition-transform" />
            
            <div className="flex justify-between items-start mb-4 md:mb-6 relative z-10">
              <div className="w-12 h-12 md:w-16 md:h-16 rounded-2xl bg-gradient-to-br from-[#8e24aa]/20 to-transparent flex items-center justify-center text-[#8e24aa] border border-[#8e24aa]/10">
                <ShieldCheck size={24} className="md:w-8 md:h-8" />
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${admin.status === 'Online' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-slate-300'}`} />
                <span className="text-[8px] md:text-[10px] font-black text-[#6a1b9a]/50 uppercase tracking-widest">{admin.status}</span>
              </div>
            </div>

            <div className="space-y-3 md:space-y-4 relative z-10">
              <div>
                <h3 className="text-lg md:text-xl font-bold text-[#4a148c] group-hover:text-[#8e24aa] transition-colors truncate">{admin.name}</h3>
                <span className="text-[8px] md:text-[10px] font-black text-[#8e24aa] uppercase tracking-[0.2em]">{admin.role}</span>
              </div>
              
              <div className="space-y-1.5 md:space-y-2 pt-1 md:pt-2">
                <div className="flex items-center gap-2 md:gap-3 text-[10px] md:text-xs text-[#6a1b9a]/70 truncate"><User size={12} className="md:w-3.5 md:h-3.5" /> {admin.username}</div>
                <div className="flex items-center gap-2 md:gap-3 text-[10px] md:text-xs text-[#6a1b9a]/70"><Calendar size={12} className="md:w-3.5 md:h-3.5" /> ล่าสุด: {admin.lastActive}</div>
              </div>

              {isAdmin ? (
                <div className="flex gap-2 md:gap-3 pt-3 md:pt-4">
                  <button
                    onClick={() => {
                      setEditing(admin);
                      setEditName(admin.name);
                      setEditPassword('');
                      setEditRole(admin.roleKey);
                    }}
                    className="flex-1 py-2 md:py-2.5 bg-[#faf5fc] border border-[#e1bee7] rounded-xl text-[10px] md:text-xs font-bold text-[#6a1b9a] hover:bg-[#f3e5f5] transition-all"
                  >
                    แก้ไข
                  </button>
                  <button
                    onClick={() => void toggleAdminStatus(admin)}
                    className="px-3 py-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 transition-all shrink-0 text-[10px] md:text-xs font-bold"
                  >
                    {admin.status === 'Online' ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                  </button>
                </div>
              ) : (
                <div className="pt-3 md:pt-4 text-[11px] font-bold text-[#6a1b9a]/55">
                  สิทธิ์ตรวจสอบอ่านข้อมูลได้อย่างเดียว
                </div>
              )}
            </div>
          </motion.div>
        ))}
        {!loading && filtered.length === 0 ? (
          <div className="sm:col-span-2 lg:col-span-3 rounded-2xl border border-[#e1bee7] bg-white p-8 text-center text-[#6a1b9a]/60 text-sm font-bold">
            {error ?? 'ไม่พบข้อมูลแอดมิน'}
          </div>
        ) : null}
      </div>
      {editing && isAdmin ? (
        <div className="rounded-3xl border border-[#e1bee7] bg-white p-5 md:p-6 shadow-sm space-y-4">
          <h2 className="text-lg font-black text-[#4a148c]">แก้ไขแอดมิน `{editing.username}`</h2>
          <div className="grid gap-4 md:grid-cols-3">
            <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="ชื่อแสดง" className="rounded-2xl border border-[#e1bee7] bg-[#faf5fc] px-4 py-3 text-sm focus:outline-none focus:border-[#8e24aa]/50" />
            <input type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} placeholder="ใส่รหัสผ่านใหม่ถ้าต้องการเปลี่ยน" className="rounded-2xl border border-[#e1bee7] bg-[#faf5fc] px-4 py-3 text-sm focus:outline-none focus:border-[#8e24aa]/50" />
            <select value={editRole} onChange={(e) => setEditRole(e.target.value as 'admin' | 'reviewer')} className="rounded-2xl border border-[#e1bee7] bg-[#faf5fc] px-4 py-3 text-sm focus:outline-none focus:border-[#8e24aa]/50">
              <option value="admin">แอดมิน</option>
              <option value="reviewer">ตรวจสอบ</option>
            </select>
          </div>
          <div className="flex gap-3">
            <button onClick={() => updateAdmin({ name: editName, password: editPassword || undefined, ...(editing.roleKey !== editRole ? { role: editRole } : {}) } as { name?: string; password?: string; isActive?: boolean; role?: 'admin' | 'reviewer' })} disabled={saving} className="rounded-2xl bg-[#8e24aa] px-5 py-3 text-sm font-black text-white disabled:opacity-60">
              {saving ? 'กำลังบันทึก...' : 'บันทึกการแก้ไข'}
            </button>
            <button onClick={() => setEditing(null)} className="rounded-2xl border border-[#e1bee7] px-5 py-3 text-sm font-bold text-[#6a1b9a]">
              ยกเลิก
            </button>
          </div>
        </div>
      ) : null}
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}
