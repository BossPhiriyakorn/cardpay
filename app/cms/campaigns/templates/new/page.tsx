"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";

import FlexTemplateJsonHelpPanel from "@/components/cms/FlexTemplateJsonHelpPanel";
import { useCmsAdminMe } from "@/hooks/useCmsAdminMe";

const inputClass =
  "w-full rounded-2xl border border-[#e1bee7] bg-white px-4 py-3 text-sm text-[#4a148c] placeholder:text-[#6a1b9a]/40 focus:outline-none focus:border-[#8e24aa]/50";
const labelClass = "block text-xs font-black uppercase tracking-wider text-[#6a1b9a]/70 mb-1.5";
const codeClass = `${inputClass} font-mono text-xs min-h-[280px] resize-y leading-relaxed`;

function mapErr(code: string | undefined): string {
  switch (code) {
    case "invalid_flex_skeleton":
      return "โครง Flex ต้องเป็น JSON object ที่ parse ได้";
    case "duplicate_slug":
      return "slug นี้ถูกใช้แล้ว — เปลี่ยน slug";
    case "missing_name_or_slug":
      return "กรุณากรอกชื่อเทมเพลต";
    default:
      return code ?? "บันทึกไม่สำเร็จ";
  }
}

export default function NewFlexTemplatePage() {
  const router = useRouter();
  const { isAdmin } = useCmsAdminMe();
  const [name, setName] = useState("");
  const [flexSkeletonJson, setFlexSkeletonJson] = useState("{}");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isAdmin) return;
    setError(null);
    setSaving(true);
    try {
      const res = await fetch("/api/cms/flex-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          flexSkeletonJson,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; id?: string; error?: string };
      if (!res.ok || !data.ok || !data.id) {
        throw new Error(mapErr(data.error));
      }
      router.push("/cms/campaigns/templates");
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  if (!isAdmin) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm font-bold text-amber-900">
        ไม่มีสิทธิ์สร้างเทมเพลต
        <Link href="/cms/campaigns/templates" className="ml-2 text-[#8e24aa] underline">
          กลับ
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <Link
        href="/cms/campaigns/templates"
        className="inline-flex items-center gap-1.5 text-xs font-bold text-[#6a1b9a]/80 hover:text-[#8e24aa]"
      >
        <ArrowLeft size={14} />
        กลับรายการเทมเพลต
      </Link>

      <h1 className="text-2xl md:text-3xl font-black text-[#4a148c]">เพิ่มเทมเพลต Flex</h1>

      <form onSubmit={handleSubmit} className="space-y-5 bg-white border border-[#e1bee7] rounded-3xl p-5 md:p-6 shadow-sm">
        <div>
          <label className={labelClass}>ชื่อเทมเพลต *</label>
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <p className="text-[11px] text-[#6a1b9a]/65 -mt-2">
          slug สร้างจากชื่ออัตโนมัติ — แก้ slug ได้ในหน้าแก้ไขเทมเพลต
        </p>
        <FlexTemplateJsonHelpPanel />
        <div>
          <label className={labelClass}>โครง Flex skeleton (JSON) *</label>
          <textarea
            className={codeClass}
            value={flexSkeletonJson}
            onChange={(e) => setFlexSkeletonJson(e.target.value)}
            spellCheck={false}
          />
        </div>

        {error ? <p className="text-sm font-bold text-red-600">{error}</p> : null}

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-2xl bg-[#7b1fa2] px-6 py-3 text-sm font-black text-white hover:brightness-105 disabled:opacity-50 inline-flex items-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            บันทึก
          </button>
          <Link
            href="/cms/campaigns/templates"
            className="inline-flex items-center rounded-2xl border border-[#e1bee7] px-6 py-3 text-sm font-bold text-[#6a1b9a]"
          >
            ยกเลิก
          </Link>
        </div>
      </form>
    </div>
  );
}
