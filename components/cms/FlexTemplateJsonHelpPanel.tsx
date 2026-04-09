"use client";

import { useCallback, useState } from "react";
import { Check, Copy } from "lucide-react";

type PlaceholderRow = {
  token: string;
  title: string;
  hint?: string;
};

/** ลำดับเดียวกับฟอร์มสร้างแคมเปญสปอนเซอร์ — วางใน JSON โครง Flex ตรง key ที่เหมาะสม (เช่น text / url / uri) */
const PLACEHOLDER_ROWS: PlaceholderRow[] = [
  {
    token: "{{campaign_name}}",
    title: "หัวข้อการ์ด",
    hint: "ในฟอร์มเว้นหัวข้อการ์ดว่าง ระบบใช้ชื่อแคมเปญแทน",
  },
  {
    token: "{{card_image}}",
    title: "รูปอัปโหลดบนการ์ด",
    hint: "ใส่ในค่า url ขององค์ประกอบรูปใน Flex",
  },
  { token: "{{campaign_description}}", title: "คำอธิบายบนการ์ด" },
  {
    token: "{{contact_phone}}",
    title: "เบอร์โทร → URI ปุ่มโทร",
    hint: "ระบบแปลงเบอร์ 10 หลักเป็น tel:+66…",
  },
  { token: "{{contact_link}}", title: "ลิงก์ปุ่มช่องทาง (https://…)" },
  {
    token: "{{contact_phone_button_label}}",
    title: "ปุ่มโทร — ข้อความบนปุ่ม",
    hint: "สไตล์และสีปุ่มโทรล็อกโดยระบบ — ไม่ต้องใส่ placeholder สไตล์/สีใน JSON",
  },
  {
    token: "{{contact_link_button_label}}",
    title: "ปุ่มลิงก์ — ข้อความบนปุ่ม",
    hint: "สไตล์ปุ่มลิงก์ล็อกโดยระบบ — เลือกสีปุ่มลิงก์ได้ในฟอร์ม",
  },
  { token: "{{contact_link_button_color}}", title: "ปุ่มลิงก์ — สี (เลือกในฟอร์ม)" },
];

function CopyTokenButton({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }, [token]);

  return (
    <button
      type="button"
      onClick={() => void handleCopy()}
      className="shrink-0 inline-flex items-center gap-1 rounded-xl border border-[#ce93d8]/80 bg-white px-2.5 py-1.5 text-[11px] font-bold text-[#6a1b9a] hover:bg-[#f3e5f5] hover:border-[#8e24aa]/40 transition-colors"
      aria-label={`คัดลอก ${token}`}
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5 text-emerald-600" aria-hidden />
          คัดลอกแล้ว
        </>
      ) : (
        <>
          <Copy className="w-3.5 h-3.5" aria-hidden />
          คัดลอก
        </>
      )}
    </button>
  );
}

export default function FlexTemplateJsonHelpPanel() {
  return (
    <div className="rounded-2xl border border-[#ce93d8]/50 bg-[#f3e5f5]/40 p-4 md:p-5 space-y-4 text-sm text-[#4a148c] leading-relaxed">
      <p className="font-black text-[#6a1b9a] text-xs uppercase tracking-wider">
        Placeholder สำหรับวางในโครง Flex (พอร์ทัลสปอนเซอร์)
      </p>
      <p className="text-xs text-[#6a1b9a]/90">
        วางข้อความใน <strong className="text-[#4a148c]">สตริง JSON</strong> ตรงตำแหน่งที่ต้องการ (เช่น{" "}
        <code className="font-mono text-[11px] bg-white/70 px-1 rounded">&quot;text&quot;</code>,{" "}
        <code className="font-mono text-[11px] bg-white/70 px-1 rounded">&quot;url&quot;</code>,{" "}
        <code className="font-mono text-[11px] bg-white/70 px-1 rounded">&quot;uri&quot;</code>) — คีย์ที่ระบบเติมจากฟอร์มหลักไม่ต้องให้สปอนเซอร์กรอกซ้ำในบล็อกฟิลด์เทมเพลต
      </p>

      <div className="rounded-xl border border-amber-200/90 bg-amber-50/80 p-3 md:p-4 space-y-2 text-xs text-[#5d4037]">
        <p className="font-black text-[#6d4c41]">ข้อความตอนแชร์ — ไม่ใส่ในโครง Flex ชุดนี้</p>
        <p className="leading-relaxed text-[#6d4c41]/95">
          สปอนเซอร์กรอกในฟอร์ม «ข้อความตอนแชร์» ระบบเก็บแยก แล้วนำไป<strong>ประกอบ JSON ฉบับสมบูรณ์</strong> เช่นใส่ใน{" "}
          <code className="font-mono text-[11px] bg-white/90 px-1 rounded">tectony1[0].linemsg</code> ส่วนโครง{" "}
          <code className="font-mono text-[11px] bg-white/90 px-1 rounded">bubble</code> / การ์ดอยู่ในองค์ประกอบถัดไปของ{" "}
          <code className="font-mono text-[11px] bg-white/90 px-1 rounded">tectony1</code> — ไม่ต้องวาง{" "}
          <code className="font-mono text-[11px]">{"{{share_alt}}"}</code> ใน JSON เทมเพลตที่ช่องด้านล่าง
        </p>
        <pre className="text-[10px] md:text-[11px] font-mono leading-5 whitespace-pre-wrap break-all rounded-lg bg-white/90 border border-amber-100 p-2.5 text-[#4a148c]">
          {`{
  "tectony1": [
    { "linemsg": "…จากฟอร์มข้อความตอนแชร์…" },
    { "type": "bubble", "hero": { … }, "body": { … } }
  ]
}`}
        </pre>
      </div>

      <ol className="space-y-3 list-none p-0 m-0">
        {PLACEHOLDER_ROWS.map((row, i) => (
          <li
            key={row.token}
            className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3 rounded-xl border border-[#ce93d8]/35 bg-white/75 p-3 md:p-3.5"
          >
            <span className="flex items-start gap-2 min-w-0 flex-1">
              <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-lg bg-[#7b1fa2]/12 text-[11px] font-black text-[#6a1b9a]">
                {i + 1}
              </span>
              <span className="min-w-0 pt-0.5">
                <code className="text-xs md:text-sm font-mono text-[#4a148c] break-all">{row.token}</code>
                <span className="block text-xs font-bold text-[#6a1b9a] mt-0.5">{row.title}</span>
                {row.hint ? (
                  <span className="block text-[11px] text-[#6a1b9a]/70 mt-0.5 leading-snug">{row.hint}</span>
                ) : null}
              </span>
            </span>
            <CopyTokenButton token={row.token} />
          </li>
        ))}
      </ol>

      <ul className="list-disc pl-5 space-y-1 text-[11px] text-[#6a1b9a]/80 border-t border-[#ce93d8]/30 pt-3">
        <li>
          ใช้ <code className="font-mono px-0.5">{"{{contact_phone}}"}</code> /{" "}
          <code className="font-mono px-0.5">{"{{contact_link}}"}</code> แทนรูปแบบเก่า เช่น{" "}
          <code className="font-mono px-0.5">{"{{tel}}"}</code> /{" "}
          <code className="font-mono px-0.5">{"{{buttonUrl}}"}</code>
        </li>
        <li>ชื่อในวงเล็บปีกกา: อังกฤษ ตัวเลข _ เท่านั้น — ใช้ซ้ำหลายจุดใน JSON ได้ ค่าเดียวกัน</li>
      </ul>
    </div>
  );
}
