'use client';

import { useEffect, useState } from 'react';
import { Search, Clock, Shield, Trash2 } from 'lucide-react';
import { useCmsAdminMe } from '@/hooks/useCmsAdminMe';

type LogRow = {
  id: string;
  action: string;
  category: string;
  targetType: string;
  targetId: string;
  createdAt: string;
};

const CATEGORY_OPTIONS = [
  { value: 'all', label: 'ทุกประเภท' },
  { value: 'auth', label: 'เข้าสู่ระบบ' },
  { value: 'member', label: 'สมาชิก' },
  { value: 'campaign', label: 'แคมเปญ' },
  { value: 'system', label: 'ระบบ' },
  { value: 'other', label: 'อื่นๆ' },
];

const CLEAR_AUDIT_LOGS_CONFIRM = 'CLEAR_ALL_AUDIT_LOGS';

export default function LogsPage() {
  const { isAdmin, loading: sessionLoading } = useCmsAdminMe();
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [listVersion, setListVersion] = useState(0);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadLogs() {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: String(page),
          category,
          search,
        });
        const res = await fetch(`/api/cms/logs?${params.toString()}`, {
          cache: 'no-store',
          credentials: 'same-origin',
        });
        const data = (await res.json()) as {
          ok?: boolean;
          logs?: LogRow[];
          totalPages?: number;
          error?: string;
        };
        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? 'load_failed');
        }
        if (!cancelled) {
          setLogs(data.logs ?? []);
          setTotalPages(Math.max(1, Number(data.totalPages ?? 1)));
        }
      } catch {
        if (!cancelled) {
          setError('โหลดประวัติเข้าใช้งานไม่สำเร็จ');
          setLogs([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    loadLogs();
    return () => {
      cancelled = true;
    };
  }, [page, category, search, listVersion]);

  async function clearAllLogs() {
    if (!isAdmin) return;
    if (
      !window.confirm(
        'ลบประวัติทั้งหมดในฐานข้อมูลหรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้ (จะเหลือเพียงบันทึกว่ามีการล้างประวัติ 1 รายการ)'
      )
    ) {
      return;
    }
    if (!window.confirm('ยืนยันอีกครั้งว่าต้องการล้างประวัติทั้งหมด')) {
      return;
    }
    setClearing(true);
    setError(null);
    try {
      const res = await fetch('/api/cms/logs', {
        method: 'DELETE',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: CLEAR_AUDIT_LOGS_CONFIRM }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? 'clear_failed');
      }
      setPage(1);
      setListVersion((v) => v + 1);
    } catch (e) {
      const message = e instanceof Error ? e.message : '';
      if (message === 'forbidden') setError('ไม่มีสิทธิ์ล้างประวัติ');
      else setError('ล้างประวัติไม่สำเร็จ');
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="space-y-8 text-[#4a148c]">
      <div className="flex flex-col gap-4 bg-white border border-[#e1bee7] p-4 md:p-6 rounded-3xl shadow-sm">
        <div className="flex flex-col md:flex-row gap-3 w-full">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8e24aa]/45" size={16} />
            <input
              type="text"
              value={search}
              onChange={(event) => {
                setPage(1);
                setSearch(event.target.value);
              }}
              placeholder="ค้นหาจากการกระทำหรือเป้าหมาย..."
              className="w-full bg-[#faf5fc] border border-[#e1bee7] rounded-2xl py-3 pl-10 pr-4 text-sm text-[#4a148c] placeholder:text-[#6a1b9a]/40 focus:outline-none focus:border-[#8e24aa]/50"
            />
          </div>
          <select
            value={category}
            onChange={(event) => {
              setPage(1);
              setCategory(event.target.value);
            }}
            className="bg-[#faf5fc] border border-[#e1bee7] rounded-2xl px-4 py-3 text-sm text-[#4a148c] focus:outline-none focus:border-[#8e24aa]/50 md:min-w-[200px]"
          >
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {sessionLoading ? (
        <div className="rounded-2xl border border-[#e1bee7] bg-[#faf5fc] px-4 py-3 text-sm font-bold text-[#6a1b9a]/70">
          กำลังโหลดสิทธิ์...
        </div>
      ) : isAdmin ? (
        <div className="flex flex-col gap-3 rounded-2xl border-2 border-rose-300 bg-gradient-to-br from-rose-50 to-white px-4 py-4 md:flex-row md:items-center md:justify-between md:gap-6 shadow-sm">
          <p className="text-sm leading-relaxed text-[#4a148c]">
            <span className="font-black text-rose-800">ล้างประวัติทั้งหมด</span>
            {' — '}
            ลบรายการในฐานข้อมูลทุกแถวของประวัตินี้ (หลังล้างจะมีบันทึกสรุปว่ามีการล้าง 1 รายการ)
          </p>
          <button
            type="button"
            disabled={clearing || loading}
            onClick={() => void clearAllLogs()}
            className="shrink-0 inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-rose-500 bg-white px-5 py-3 text-sm font-black text-rose-800 shadow-sm hover:bg-rose-100 disabled:opacity-50"
          >
            <Trash2 size={18} />
            {clearing ? 'กำลังล้าง...' : 'ล้างประวัติทั้งหมด'}
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-bold text-sky-950">
          บัญชีสิทธิ์ตรวจสอบดูประวัติได้เท่านั้น — ไม่มีปุ่มล้างประวัติ (ใช้ได้เฉพาะแอดมินหลัก)
        </div>
      )}

      <div className="bg-white border border-[#e1bee7] rounded-3xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[560px]">
            <thead>
              <tr className="border-b border-[#f1dff5] bg-[#faf5fc]">
                <th className="px-6 py-4 text-xs font-black text-[#6a1b9a]/85 uppercase tracking-widest">ประเภท</th>
                <th className="px-6 py-4 text-xs font-black text-[#6a1b9a]/85 uppercase tracking-widest">การกระทำ</th>
                <th className="px-6 py-4 text-xs font-black text-[#6a1b9a]/85 uppercase tracking-widest">เป้าหมาย</th>
                <th className="px-6 py-4 text-xs font-black text-[#6a1b9a]/85 uppercase tracking-widest">วันเวลา</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1dff5]">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-[#fcf8fd] transition-colors">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-[#f3e5f5] flex items-center justify-center text-[#8e24aa]">
                        <Shield size={14} />
                      </div>
                      <span className="text-xs font-bold uppercase">{log.category}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-sm text-[#4a148c]">{log.action}</td>
                  <td className="px-6 py-5 text-xs text-[#6a1b9a]/75">
                    {log.targetType || '-'} {log.targetId ? `(${log.targetId})` : ''}
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2 text-xs font-bold text-[#6a1b9a]">
                      <Clock size={12} className="text-[#8e24aa]" />
                      {log.createdAt}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && logs.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-sm text-[#6a1b9a]/70">
                    {error ?? 'ยังไม่มีประวัติเข้าใช้งาน'}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        <div className="border-t border-[#f1dff5] px-6 py-4 flex items-center justify-between">
          <p className="text-xs font-bold text-[#6a1b9a]/60">
            {loading ? 'กำลังโหลด...' : `หน้า ${page} / ${totalPages}`}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              className="px-4 py-2 rounded-xl border border-[#e1bee7] text-xs font-bold text-[#6a1b9a] disabled:opacity-40"
            >
              ก่อนหน้า
            </button>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
              className="px-4 py-2 rounded-xl border border-[#e1bee7] text-xs font-bold text-[#6a1b9a] disabled:opacity-40"
            >
              ถัดไป
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
