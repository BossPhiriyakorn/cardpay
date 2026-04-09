"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
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
      return "โครง Flex ต้องเป็น JSON object";
    case "duplicate_slug":
      return "slug นี้ถูกใช้แล้ว";
    case "not_found":
      return "ไม่พบเทมเพลต";
    default:
      return code ?? "บันทึกไม่สำเร็จ";
  }
}

export default function EditFlexTemplatePage() {
  const router = useRouter();
  const params = useParams();
  const templateId = typeof params?.templateId === "string" ? params.templateId : "";
  const { isAdmin } = useCmsAdminMe();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [flexSkeletonJson, setFlexSkeletonJson] = useState("{}");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!templateId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/cms/flex-templates/${templateId}`, { cache: "no-store" });
      const data = (await res.json()) as {
        ok?: boolean;
        template?: {
          name?: string;
          slug?: string;
          flexSkeletonJson?: string;
        };
        error?: string;
      };
      if (!res.ok || !data.ok || !data.template) {
        throw new Error(mapErr(data.error));
      }
      const t = data.template;
      setName(String(t.name ?? ""));
      setSlug(String(t.slug ?? ""));
      setFlexSkeletonJson(String(t.flexSkeletonJson ?? "{}"));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "โหลดไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }, [templateId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isAdmin || !templateId) return;
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/cms/flex-templates/${templateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          flexSkeletonJson,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        throw new Error(mapErr(data.error));
      }
      router.push("/cms/campaigns/templates");
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  if (!templateId) {
    return <p className="text-red-600 font-bold">ลิงก์ไม่ถูกต้อง</p>;
  }

  if (!isAdmin) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm font-bold text-amber-900">
        ไม่มีสิทธิ์แก้ไขเทมเพลต
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

      <h1 className="text-2xl md:text-3xl font-black text-[#4a148c]">แก้ไขเทมเพลต Flex</h1>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 text-[#8e24aa] animate-spin" />
        </div>
      ) : loadError ? (
        <p className="text-red-600 font-bold">{loadError}</p>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="space-y-5 bg-white border border-[#e1bee7] rounded-3xl p-5 md:p-6 shadow-sm"
        >
          <div>
            <label className={labelClass}>ชื่อเทมเพลต *</label>
            <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className={labelClass}>slug *</label>
            <input className={inputClass} value={slug} onChange={(e) => setSlug(e.target.value)} required />
          </div>
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
      )}
    </div>
  );
}
