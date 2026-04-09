"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { motion } from "motion/react";
import { ArrowLeft, LayoutTemplate, Pencil, Plus, Trash2 } from "lucide-react";

import { useCmsAdminMe } from "@/hooks/useCmsAdminMe";

type TemplateRow = {
  id: string;
  name: string;
  slug: string;
  updatedAt: string | null;
};

export default function FlexTemplatesListPage() {
  const { isAdmin } = useCmsAdminMe();
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/cms/flex-templates", { cache: "no-store" });
      const data = (await res.json()) as {
        ok?: boolean;
        templates?: TemplateRow[];
        error?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? "load_failed");
      }
      setTemplates(data.templates ?? []);
    } catch {
      setError("โหลดรายการเทมเพลตไม่สำเร็จ");
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDelete(id: string, name: string) {
    if (!isAdmin) return;
    if (!window.confirm(`ลบเทมเพลต "${name}" หรือไม่?`)) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/cms/flex-templates/${id}`, { method: "DELETE" });
      const data = (await res.json()) as { ok?: boolean };
      if (!res.ok || !data.ok) {
        throw new Error("delete_failed");
      }
      await load();
    } catch {
      setError("ลบเทมเพลตไม่สำเร็จ");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-8 md:space-y-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/cms/campaigns"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#6a1b9a]/80 hover:text-[#8e24aa]"
          >
            <ArrowLeft size={14} />
            กลับจัดการแคมเปญ
          </Link>
        </div>
        {isAdmin ? (
          <Link
            href="/cms/campaigns/templates/new"
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#ce93d8] bg-[#7b1fa2] px-5 py-3 text-sm font-black text-white shadow-[0_8px_28px_rgba(123,31,162,0.28)] transition hover:brightness-105"
          >
            <Plus size={18} />
            เพิ่มเทมเพลต
          </Link>
        ) : null}
      </div>

      <div>
        <h1 className="text-2xl md:text-3xl font-black text-[#4a148c] tracking-tight flex items-center gap-2">
          <LayoutTemplate className="w-7 h-7 md:w-8 md:h-8 shrink-0" />
          เทมเพลต Flex แคมเปญ
        </h1>
        <p className="mt-2 text-sm text-[#6a1b9a]/80 max-w-3xl leading-relaxed">
          แก้ไขโครง JSON Flex — ระบบสแกน <code className="text-xs bg-[#f3e5f5] px-1 rounded">{"{{...}}"}</code>{" "}
          แล้วสร้างฟอร์มสปอนเซอร์ให้สอดคล้อง โดยคีย์หลักจากฟอร์มเช่น{" "}
          <code className="text-xs bg-[#f3e5f5] px-1 rounded">{"{{campaign_name}}"}</code>,{" "}
          <code className="text-xs bg-[#f3e5f5] px-1 rounded">{"{{card_image}}"}</code>,{" "}
          <code className="text-xs bg-[#f3e5f5] px-1 rounded">{"{{contact_phone}}"}</code> ไม่ต้องให้กรอกซ้ำในฟิลด์เทมเพลต
        </p>
        <div className="mt-3 max-w-3xl rounded-2xl border border-[#ce93d8]/70 bg-[#f3e5f5] px-4 py-3 text-sm text-[#4a148c] leading-relaxed">
          <span className="font-black">ให้สปอนเซอร์สร้างแคมเปญได้:</span> หลังมีเทมเพลตแล้ว ต้องไปที่{" "}
          <Link href="/cms/campaigns" className="font-black text-[#8e24aa] underline-offset-2 hover:underline">
            จัดการแคมเปญ
          </Link>{" "}
          แล้วกดปุ่ม <span className="font-black">ใช้งานนี้</span> ในแถวเทมเพลตที่ต้องการ (ไม่ใช่แค่เพิ่มรายการในหน้านี้)
        </div>
      </div>

      {!isAdmin ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
          สิทธิ์ตรวจสอบดูรายการได้เท่านั้น — เพิ่ม/แก้/ลบต้องใช้บัญชีแอดมิน
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-[#e1bee7] bg-white p-8 text-center text-[#6a1b9a]">
          กำลังโหลด…
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-900">
          {error}
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#e1bee7] bg-[#faf8fc] p-8 text-center text-[#6a1b9a]">
          <p className="font-bold">ยังไม่มีเทมเพลต</p>
          {isAdmin ? (
            <Link
              href="/cms/campaigns/templates/new"
              className="mt-4 inline-flex items-center gap-2 text-sm font-black text-[#8e24aa] hover:underline"
            >
              <Plus size={16} />
              สร้างเทมเพลตแรก
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((t, index) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-[#e1bee7] bg-white p-4 md:p-5 shadow-sm"
            >
              <div className="flex-1 min-w-0">
                <p className="font-black text-[#4a148c] truncate">{t.name}</p>
                <p className="text-xs text-[#6a1b9a]/70 mt-0.5 font-mono truncate">{t.slug}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                {isAdmin ? (
                  <>
                    <Link
                      href={`/cms/campaigns/templates/${t.id}/edit`}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#e1bee7] px-3 py-2 text-xs font-bold text-[#6a1b9a] hover:border-[#8e24aa]/40"
                    >
                      <Pencil size={14} />
                      แก้ไข
                    </Link>
                    <button
                      type="button"
                      disabled={busyId === t.id}
                      onClick={() => void handleDelete(t.id, t.name)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"
                    >
                      <Trash2 size={14} />
                      ลบ
                    </button>
                  </>
                ) : null}
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
