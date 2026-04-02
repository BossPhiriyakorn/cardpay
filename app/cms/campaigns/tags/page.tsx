'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Plus, Tag } from 'lucide-react';
import { useCmsAdminMe } from '@/hooks/useCmsAdminMe';

type TagRow = {
  id: string;
  slug: string;
  nameTh: string;
  nameEn: string;
  isActive: boolean;
};

type EditorState = {
  id?: string;
  nameTh: string;
  nameEn: string;
  slug: string;
  isActive: boolean;
};

const EMPTY_EDITOR: EditorState = { nameTh: '', nameEn: '', slug: '', isActive: true };

export default function CampaignTagsPage() {
  const { isAdmin } = useCmsAdminMe();
  const [tags, setTags] = useState<TagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [saving, setSaving] = useState(false);

  async function loadTags() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/cms/campaign-tags', { cache: 'no-store' });
      const data = (await res.json()) as { ok?: boolean; tags?: TagRow[]; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? 'load_failed');
      }
      setTags(data.tags ?? []);
    } catch {
      setError('โหลดแท็กแคมเปญไม่สำเร็จ');
      setTags([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTags();
  }, []);

  async function saveTag() {
    if (!isAdmin) {
      setError('สิทธิ์ตรวจสอบไม่สามารถแก้ไขแท็กได้');
      return;
    }
    if (!editor) return;
    setSaving(true);
    setError(null);
    try {
      const method = editor.id ? 'PATCH' : 'POST';
      const payload = editor.id ? editor : { ...editor };
      const res = await fetch('/api/cms/campaign-tags', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? 'save_failed');
      }
      setEditor(null);
      await loadTags();
    } catch (e) {
      const message = e instanceof Error ? e.message : '';
      setError(message === 'slug_taken' ? 'slug นี้ถูกใช้แล้ว' : 'บันทึกแท็กไม่สำเร็จ');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-4xl space-y-8 text-[#4a148c]">
      <Link href="/cms/campaigns" className="inline-flex items-center gap-2 text-sm font-bold text-[#8e24aa] hover:underline">
        ← กลับไปจัดการแคมเปญ
      </Link>

      <div>
        <h1 className="text-2xl md:text-3xl font-black tracking-tight">แท็กแคมเปญ</h1>
        <p className="mt-1 text-sm text-[#6a1b9a]/75 font-medium">
          {isAdmin ? 'เพิ่ม แก้ไข และเปิด/ปิดการใช้งานแท็กได้จริงจากหน้านี้' : 'สิทธิ์ตรวจสอบอ่านรายการแท็กได้อย่างเดียว'}
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        {isAdmin ? (
          <button
            type="button"
            onClick={() => setEditor({ ...EMPTY_EDITOR })}
            className="inline-flex items-center gap-2 rounded-2xl border border-dashed border-[#ce93d8] bg-[#f3e5f5]/50 px-4 py-3 text-sm font-black text-[#8e24aa] hover:bg-[#f3e5f5] transition-colors"
          >
            <Plus size={18} />
            เพิ่มแท็กใหม่
          </button>
        ) : null}
      </div>

      {editor && isAdmin ? (
        <div className="rounded-2xl border border-[#e1bee7] bg-white p-5 shadow-sm space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <input
              value={editor.nameTh}
              onChange={(event) => setEditor((prev) => (prev ? { ...prev, nameTh: event.target.value } : prev))}
              placeholder="ชื่อแท็กภาษาไทย"
              className="rounded-2xl border border-[#e1bee7] bg-[#faf5fc] px-4 py-3 text-sm focus:outline-none focus:border-[#8e24aa]/50"
            />
            <input
              value={editor.nameEn}
              onChange={(event) => setEditor((prev) => (prev ? { ...prev, nameEn: event.target.value } : prev))}
              placeholder="ชื่อแท็กภาษาอังกฤษ"
              className="rounded-2xl border border-[#e1bee7] bg-[#faf5fc] px-4 py-3 text-sm focus:outline-none focus:border-[#8e24aa]/50"
            />
            <input
              value={editor.slug}
              onChange={(event) => setEditor((prev) => (prev ? { ...prev, slug: event.target.value } : prev))}
              placeholder="slug เช่น beauty"
              className="rounded-2xl border border-[#e1bee7] bg-[#faf5fc] px-4 py-3 text-sm focus:outline-none focus:border-[#8e24aa]/50"
            />
            <label className="flex items-center gap-3 rounded-2xl border border-[#e1bee7] bg-[#faf5fc] px-4 py-3 text-sm font-medium">
              <input
                type="checkbox"
                checked={editor.isActive}
                onChange={(event) => setEditor((prev) => (prev ? { ...prev, isActive: event.target.checked } : prev))}
              />
              เปิดใช้งานแท็กนี้
            </label>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={saveTag} disabled={saving} className="rounded-2xl bg-[#8e24aa] px-5 py-3 text-sm font-black text-white disabled:opacity-60">
              {saving ? 'กำลังบันทึก...' : 'บันทึก'}
            </button>
            <button type="button" onClick={() => setEditor(null)} className="rounded-2xl border border-[#e1bee7] px-5 py-3 text-sm font-bold text-[#6a1b9a]">
              ยกเลิก
            </button>
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-[#e1bee7] bg-white shadow-sm">
        <div className="border-b border-[#e1bee7] bg-[#faf5fc] px-5 py-4">
          <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-[#4a148c]">
            <Tag size={18} className="text-[#8e24aa]" />
            รายการแท็ก
          </h2>
        </div>
        <ul className="divide-y divide-[#f3e5f5]">
          {tags.map((tag) => (
            <li key={tag.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-[#fcf8fd] transition-colors">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold text-[#4a148c]">
                    {tag.nameTh} <span className="font-medium text-[#6a1b9a]/70">({tag.nameEn || '-'})</span>
                  </p>
                  {!tag.isActive ? (
                    <span className="rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[10px] font-black uppercase text-slate-600">
                      ปิดใช้งาน
                    </span>
                  ) : null}
                </div>
                <p className="text-[11px] font-mono text-[#8e24aa]/70">slug: {tag.slug}</p>
              </div>
              {isAdmin ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setEditor({ ...tag })}
                    className="rounded-xl border border-[#e1bee7] px-3 py-1.5 text-xs font-bold text-[#8e24aa] hover:bg-[#f3e5f5] transition-colors"
                  >
                    แก้ไข
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setError(null);
                      const res = await fetch('/api/cms/campaign-tags', {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: tag.id, isActive: !tag.isActive }),
                      });
                      const data = (await res.json()) as { ok?: boolean; error?: string };
                      if (!res.ok || !data.ok) {
                        setError('เปลี่ยนสถานะแท็กไม่สำเร็จ');
                        return;
                      }
                      await loadTags();
                    }}
                    className="rounded-xl border border-[#e1bee7] px-3 py-1.5 text-xs font-bold text-[#6a1b9a] hover:bg-[#f3e5f5] transition-colors"
                  >
                    {tag.isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                  </button>
                </div>
              ) : (
                <span className="text-xs font-bold text-[#6a1b9a]/50">อ่านอย่างเดียว</span>
              )}
            </li>
          ))}
          {!loading && tags.length === 0 ? (
            <li className="px-5 py-6 text-sm text-[#6a1b9a]/70 text-center">{error ?? 'ยังไม่มีแท็กแคมเปญ'}</li>
          ) : null}
        </ul>
      </div>
      {error ? <p className="text-sm text-rose-600">{error}</p> : null}
    </div>
  );
}
