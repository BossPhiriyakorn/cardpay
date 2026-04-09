'use client';

import React, { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'motion/react';
import { Users, Search, Plus, Mail, Phone, Calendar, Trash2 } from 'lucide-react';

type MemberStatus = 'Active' | 'Inactive' | 'Banned' | 'PendingTransfer';

type Member = {
  id: string;
  /** user | sponsor | admin — ใช้ซ่อนปุ่มลบ */
  role?: string;
  name: string;
  email: string;
  phone: string;
  /** ไอดี LINE ที่ผู้ใช้กรอกตอนสมัคร — ใช้แสดงแทนรหัสภายใน */
  lineDisplayId: string;
  referralCode: string;
  hasReferralCode: boolean;
  status: MemberStatus;
  bankVerificationStatus: "none" | "pending" | "verified" | "rejected";
  bankReviewReason: string;
  joined: string;
  pendingTransferAmount: number;
};

function bankVerificationLabel(status: Member["bankVerificationStatus"]): string {
  if (status === "pending") return "รอตรวจสอบ";
  if (status === "verified") return "อนุมัติแล้ว";
  if (status === "rejected") return "ไม่อนุมัติ";
  return "ยังไม่ผูกบัญชี";
}

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | MemberStatus>('all');
  const [bankFilter, setBankFilter] = useState<'all' | Member["bankVerificationStatus"]>('all');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Member | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const pageSize = 10;

  useEffect(() => {
    let cancelled = false;
    async function loadMembers() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/cms/members', { cache: 'no-store' });
        const data = (await res.json()) as { ok?: boolean; members?: Member[]; error?: string };
        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? 'load_failed');
        }
        if (!cancelled) {
          setMembers(data.members ?? []);
        }
      } catch {
        if (!cancelled) {
          setError('โหลดข้อมูลสมาชิกไม่สำเร็จ');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    loadMembers();
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredMembers = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return members.filter((m) => {
      const matchesKeyword = !keyword || [m.name, m.email, m.phone, m.lineDisplayId, m.referralCode].some((x) =>
        x.toLowerCase().includes(keyword)
      );
      const matchesStatus = statusFilter === 'all' || m.status === statusFilter;
      const matchesBank = bankFilter === 'all' || m.bankVerificationStatus === bankFilter;
      return matchesKeyword && matchesStatus && matchesBank;
    });
  }, [members, search, statusFilter, bankFilter]);
  const totalPages = Math.max(1, Math.ceil(filteredMembers.length / pageSize));
  const pagedMembers = useMemo(
    () => filteredMembers.slice((page - 1) * pageSize, page * pageSize),
    [filteredMembers, page]
  );

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, bankFilter]);

  const pendingBankReviewCount = useMemo(
    () => members.filter((m) => m.bankVerificationStatus === "pending").length,
    [members]
  );
  const pendingTransferReviewCount = useMemo(
    () => members.filter((m) => Number(m.pendingTransferAmount ?? 0) > 0).length,
    [members]
  );
  const totalMembersCount = members.length;

  function canDeleteMember(m: Member): boolean {
    const r = String(m.role ?? 'user');
    return r !== 'sponsor' && r !== 'admin';
  }

  async function handleConfirmDelete() {
    if (!confirmDelete) return;
    const id = confirmDelete.id;
    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/cms/members/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        const msg =
          data.error === 'cannot_delete_sponsor_user' || data.error === 'user_linked_to_sponsor_record'
            ? 'ไม่สามารถลบได้ — ผู้ใช้เป็นสปอนเซอร์หรือผูกกับสปอนเซอร์'
            : data.error === 'cannot_delete_line_admin_user'
              ? 'ไม่สามารถลบได้ — บัญชีนี้เป็นแอดมินระบบ'
              : data.error === 'forbidden'
                ? 'ไม่มีสิทธิ์ลบสมาชิก'
                : data.error === 'unauthorized'
                  ? 'หมดเซสชัน กรุณาเข้าสู่ระบบใหม่'
                  : 'ลบสมาชิกไม่สำเร็จ';
        setError(msg);
        setConfirmDelete(null);
        return;
      }
      setMembers((prev) => prev.filter((x) => x.id !== id));
      setConfirmDelete(null);
    } catch {
      setError('ลบสมาชิกไม่สำเร็จ');
      setConfirmDelete(null);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-8 text-[#4a148c]">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        <div className="rounded-2xl border border-[#e1bee7] bg-white p-4 md:p-5 shadow-sm">
          <p className="text-[11px] md:text-xs font-black text-[#6a1b9a]/75 uppercase tracking-wider">
            จำนวนสมาชิก
          </p>
          <p className="mt-2 text-2xl md:text-3xl font-black text-[#4a148c]">
            {totalMembersCount.toLocaleString("th-TH")}
          </p>
          <p className="text-[11px] md:text-xs text-[#6a1b9a]/65 mt-1">สมาชิกทั้งหมดในระบบ</p>
        </div>
        <div className="rounded-2xl border border-amber-300/60 bg-amber-50 p-4 md:p-5 shadow-sm">
          <p className="text-[11px] md:text-xs font-black text-amber-800 uppercase tracking-wider">
            รอตรวจสอบบัญชี
          </p>
          <p className="mt-2 text-2xl md:text-3xl font-black text-amber-900">
            {pendingBankReviewCount.toLocaleString("th-TH")}
          </p>
          <p className="text-[11px] md:text-xs text-amber-700 mt-1">รายการบัญชีที่ต้องอนุมัติ/ไม่อนุมัติ</p>
        </div>
        <div className="rounded-2xl border border-violet-300/60 bg-violet-50 p-4 md:p-5 shadow-sm">
          <p className="text-[11px] md:text-xs font-black text-violet-800 uppercase tracking-wider">
            รอตรวจสอบยอดโอน
          </p>
          <p className="mt-2 text-2xl md:text-3xl font-black text-violet-900">
            {pendingTransferReviewCount.toLocaleString("th-TH")}
          </p>
          <p className="text-[11px] md:text-xs text-violet-700 mt-1">สมาชิกที่มียอดรอโอนมากกว่า 0 บาท</p>
        </div>
      </div>

      {/* Header Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 md:gap-6 bg-white border border-[#e1bee7] p-4 md:p-6 rounded-3xl shadow-sm">
        <div className="flex items-center gap-3 md:gap-4 flex-1 w-full md:max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 md:left-4 top-1/2 -translate-y-1/2 text-[#8e24aa]/55 md:w-[18px] md:h-[18px]" size={16} />
            <input 
              type="text" 
              placeholder="ค้นหาสมาชิก..." 
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full bg-[#faf5fc] border border-[#e1bee7] rounded-2xl py-2.5 md:py-3 pl-10 md:pl-12 pr-4 text-xs md:text-sm text-[#4a148c] placeholder:text-[#6a1b9a]/45 focus:outline-none focus:border-[#8e24aa]/50 transition-all"
            />
          </div>
          <div className="flex gap-2 shrink-0">
            <select
              value={statusFilter}
              onChange={(event) => {
                setPage(1);
                setStatusFilter(event.target.value as 'all' | MemberStatus);
              }}
              className="bg-[#faf5fc] border border-[#e1bee7] rounded-2xl px-3 py-2.5 text-xs text-[#6a1b9a] focus:outline-none"
            >
              <option value="all">ทุกสถานะ</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
              <option value="Banned">Banned</option>
              <option value="PendingTransfer">PendingTransfer</option>
            </select>
            <select
              value={bankFilter}
              onChange={(event) => {
                setPage(1);
                setBankFilter(event.target.value as 'all' | Member["bankVerificationStatus"]);
              }}
              className="bg-[#faf5fc] border border-[#e1bee7] rounded-2xl px-3 py-2.5 text-xs text-[#6a1b9a] focus:outline-none"
            >
              <option value="all">บัญชีทั้งหมด</option>
              <option value="none">ยังไม่ผูก</option>
              <option value="pending">รอตรวจสอบ</option>
              <option value="verified">อนุมัติแล้ว</option>
              <option value="rejected">ไม่อนุมัติ</option>
            </select>
          </div>
        </div>
        
        <Link href="/register" className="flex items-center justify-center gap-2 bg-[#8e24aa] text-white text-xs md:text-sm font-black px-5 md:px-6 py-2.5 md:py-3 rounded-2xl shadow-[0_10px_25px_rgba(142,36,170,0.28)] hover:scale-105 transition-all w-full md:w-auto">
          <Plus size={18} className="md:w-5 md:h-5" />
          เพิ่มสมาชิกใหม่
        </Link>
      </div>

      {/* Members Table */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white border border-[#e1bee7] rounded-3xl overflow-hidden shadow-sm"
      >
        <div className="overflow-x-auto scrollbar-hide">
          <table className="w-full text-left border-collapse min-w-[600px] md:min-w-full">
            <thead>
              <tr className="border-b border-[#f1dff5] bg-[#faf5fc]">
                <th className="px-4 md:px-8 py-4 md:py-5 text-[10px] md:text-xs font-black text-[#6a1b9a]/85 uppercase tracking-widest">สมาชิก</th>
                <th className="px-4 md:px-8 py-4 md:py-5 text-[10px] md:text-xs font-black text-[#6a1b9a]/85 uppercase tracking-widest">ข้อมูลติดต่อ</th>
                <th className="hidden md:table-cell px-8 py-5 text-xs font-black text-[#6a1b9a]/85 uppercase tracking-widest">สถานะสมาชิก</th>
                <th className="hidden md:table-cell px-8 py-5 text-xs font-black text-[#6a1b9a]/85 uppercase tracking-widest">สถานะบัญชี</th>
                <th className="hidden md:table-cell px-8 py-5 text-xs font-black text-[#6a1b9a]/85 uppercase tracking-widest">รอโอน</th>
                <th className="hidden lg:table-cell px-8 py-5 text-xs font-black text-[#6a1b9a]/85 uppercase tracking-widest">วันที่เข้าร่วม</th>
                <th className="px-4 md:px-8 py-4 md:py-5 text-[10px] md:text-xs font-black text-[#6a1b9a]/85 uppercase tracking-widest text-right">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1dff5]">
              {pagedMembers.map((member) => (
                <tr key={member.id} className="hover:bg-[#fcf7fd] transition-colors group">
                  <td className="px-4 md:px-8 py-4 md:py-6">
                    <div className="flex items-center gap-3 md:gap-4">
                      <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gradient-to-br from-[#8e24aa]/20 to-transparent flex items-center justify-center text-[#8e24aa] border border-[#8e24aa]/10 shrink-0">
                        <Users size={16} className="md:w-[18px] md:h-[18px]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs md:text-sm font-bold text-[#4a148c] group-hover:text-[#8e24aa] transition-colors truncate">{member.name}</p>
                        <p className="text-[9px] md:text-[10px] text-[#6a1b9a]/55 font-bold tracking-tight">
                          ไอดี LINE:{" "}
                          {member.lineDisplayId ? (
                            <span className="text-[#4a148c]/80">{member.lineDisplayId}</span>
                          ) : (
                            <span className="text-[#6a1b9a]/40 italic font-normal">ยังไม่ระบุ</span>
                          )}
                        </p>
                        <p className="text-[9px] md:text-[10px] text-[#6a1b9a]/55 mt-1">
                          รหัสแนะนำ:{" "}
                          {member.hasReferralCode ? (
                            <span className="font-bold text-emerald-700">{member.referralCode}</span>
                          ) : (
                            <span className="italic">ยังไม่มี</span>
                          )}
                        </p>
                        <div className="md:hidden mt-1">
                          <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${
                            member.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                            member.status === 'PendingTransfer' ? 'bg-violet-500/15 text-violet-300 border border-violet-400/30' :
                            member.status === 'Inactive' ? 'bg-white/5 text-white/40 border border-white/10' :
                            'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                          }`}>
                            {member.status === 'PendingTransfer' ? 'รอโอน' : member.status}
                          </span>
                          <span className={`ml-1.5 text-[8px] font-black px-2 py-0.5 rounded-full uppercase tracking-widest ${
                            member.bankVerificationStatus === "verified"
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : member.bankVerificationStatus === "rejected"
                                ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                : member.bankVerificationStatus === "pending"
                                  ? "bg-amber-500/10 text-amber-300 border border-amber-400/20"
                                  : "bg-white/5 text-white/40 border border-white/10"
                          }`}>
                            {bankVerificationLabel(member.bankVerificationStatus)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 md:px-8 py-4 md:py-6">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-[10px] md:text-xs text-[#6a1b9a]/75 truncate max-w-[150px] md:max-w-none">
                        <Mail size={10} className="md:w-3 md:h-3 text-[#8e24aa] shrink-0" />
                        {member.email}
                      </div>
                      <div className="flex items-center gap-2 text-[10px] md:text-xs text-[#6a1b9a]/75">
                        <Phone size={10} className="md:w-3 md:h-3 text-[#8e24aa] shrink-0" />
                        {member.phone}
                      </div>
                    </div>
                  </td>
                  <td className="hidden md:table-cell px-8 py-6">
                    <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${
                      member.status === 'Active' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                      member.status === 'PendingTransfer' ? 'bg-violet-500/15 text-violet-300 border border-violet-400/30' :
                      member.status === 'Inactive' ? 'bg-white/5 text-white/40 border border-white/10' :
                      'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    }`}>
                      {member.status === 'PendingTransfer' ? 'รอโอน' : member.status}
                    </span>
                  </td>
                  <td className="hidden md:table-cell px-8 py-6">
                    <div className="space-y-1">
                      <span className={`text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest ${
                        member.bankVerificationStatus === "verified"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : member.bankVerificationStatus === "rejected"
                            ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                            : member.bankVerificationStatus === "pending"
                              ? "bg-amber-500/10 text-amber-300 border border-amber-400/20"
                              : "bg-white/5 text-white/40 border border-white/10"
                      }`}>
                        {bankVerificationLabel(member.bankVerificationStatus)}
                      </span>
                      {member.bankVerificationStatus === "rejected" && member.bankReviewReason ? (
                        <p className="text-[10px] text-rose-300/80 max-w-[180px] truncate" title={member.bankReviewReason}>
                          เหตุผล: {member.bankReviewReason}
                        </p>
                      ) : null}
                    </div>
                  </td>
                  <td className="hidden md:table-cell px-8 py-6">
                    <span className={`text-xs font-bold ${member.pendingTransferAmount > 0 ? 'text-amber-700' : 'text-[#6a1b9a]/35'}`}>
                      {member.pendingTransferAmount > 0 ? `฿${member.pendingTransferAmount.toLocaleString('th-TH')}` : '-'}
                    </span>
                  </td>
                  <td className="hidden lg:table-cell px-8 py-6">
                    <div className="flex items-center gap-2 text-xs text-[#6a1b9a]/75">
                      <Calendar size={14} className="text-[#8e24aa]" />
                      {member.joined}
                    </div>
                  </td>
                  <td className="px-4 md:px-8 py-4 md:py-6 text-right">
                    <div className="inline-flex flex-wrap items-center justify-end gap-2">
                      <Link
                        href={`/cms/members/${member.id}`}
                        className="inline-flex items-center justify-center px-4 py-2 text-xs font-bold rounded-xl border border-[#e1bee7] text-[#6a1b9a] hover:border-[#8e24aa]/50 hover:text-[#8e24aa] transition-colors"
                      >
                        จัดการ
                      </Link>
                      {canDeleteMember(member) ? (
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(member)}
                          disabled={deletingId === member.id}
                          className="inline-flex items-center justify-center gap-1 px-3 py-2 text-xs font-bold rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 hover:border-rose-300 transition-colors disabled:opacity-50"
                          title="ลบสมาชิกออกจากฐานข้อมูล"
                        >
                          <Trash2 size={14} />
                          ลบ
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filteredMembers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 md:px-8 py-6 text-sm text-[#6a1b9a]/70 text-center">
                    ไม่พบข้อมูลสมาชิก
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Placeholder */}
        <div className="p-4 md:p-6 border-t border-[#f1dff5] flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[10px] md:text-xs font-bold text-[#6a1b9a]/55 uppercase tracking-widest text-center sm:text-left">
            {loading ? 'กำลังโหลดข้อมูล...' : error ? error : `แสดง ${pagedMembers.length.toLocaleString('th-TH')} จาก ${filteredMembers.length.toLocaleString('th-TH')} รายการ`}
          </p>
          <div className="flex gap-1.5 md:gap-2">
            <button onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1} className="px-3 md:px-4 py-1.5 md:py-2 bg-[#faf5fc] border border-[#e1bee7] rounded-xl text-[10px] md:text-xs font-bold text-[#6a1b9a]/70 hover:text-[#4a148c] transition-all disabled:opacity-40">ก่อนหน้า</button>
            <button className="px-3 md:px-4 py-1.5 md:py-2 bg-[#8e24aa]/10 border border-[#8e24aa]/20 rounded-xl text-[10px] md:text-xs font-bold text-[#8e24aa]">{page}</button>
            <button onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={page >= totalPages} className="px-3 md:px-4 py-1.5 md:py-2 bg-[#faf5fc] border border-[#e1bee7] rounded-xl text-[10px] md:text-xs font-bold text-[#6a1b9a]/70 hover:text-[#4a148c] transition-all disabled:opacity-40">ถัดไป</button>
          </div>
        </div>
      </motion.div>

      {confirmDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-4">
          <div className="w-full max-w-md rounded-2xl border border-[#e1bee7] bg-white p-6 shadow-xl">
            <h2 className="text-base font-black text-[#4a148c] text-center">ยืนยันการลบสมาชิก</h2>
            <p className="mt-3 text-sm text-[#6a1b9a]/90 text-center leading-relaxed">
              ลบ <span className="font-bold text-[#4a148c]">{confirmDelete.name}</span> ออกจากระบบ
              <br />
              <span className="text-xs text-[#6a1b9a]/70">
                ข้อมูลในฐานข้อมูลที่เกี่ยวข้องจะถูกลบ (ไม่ลบไฟล์บน Google Drive)
              </span>
            </p>
            <div className="mt-5 flex flex-col-reverse sm:flex-row gap-2 sm:justify-center">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                disabled={deletingId !== null}
                className="w-full sm:w-auto rounded-xl border border-[#e1bee7] px-4 py-3 text-sm font-bold text-[#6a1b9a] hover:bg-[#faf5fc] disabled:opacity-50"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmDelete()}
                disabled={deletingId !== null}
                className="w-full sm:w-auto rounded-xl bg-rose-600 px-4 py-3 text-sm font-bold text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {deletingId ? 'กำลังลบ…' : 'ลบถาวร'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
