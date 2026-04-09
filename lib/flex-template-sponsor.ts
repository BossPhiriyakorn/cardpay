/**
 * ประกอบเทมเพลต Flex สำหรับพอร์ทัลสปอนเซอร์ — แทนที่ {{key}} ในสตริง JSON
 */

export type FlexTemplateFieldSpec = {
  key: string;
  type: "text" | "textarea" | "image";
  labelTh: string;
  required?: boolean;
  order: number;
};

/**
 * รูปบนการ์ดเมื่อเทมเพลตไม่ประกาศฟิลด์ `image` ใน fieldsSpec — ใส่ `{{card_image}}` ใน JSON เทมเพลต
 * (ถ้ามีฟิลด์รูปใน spec แล้ว จะใช้ฟิลด์นั้นแทน ไม่ใช้คีย์นี้)
 */
export const SPONSOR_FALLBACK_TEMPLATE_IMAGE_KEY = "card_image";

/** คีย์ที่ระบบเติมจากฟอร์มหลักของสปอนเซอร์ (ไม่ให้กรอกซ้ำในบล็อกฟิลด์เทมเพลต) */
export const SPONSOR_TEMPLATE_INJECTED_KEYS = new Set([
  "campaign_name",
  "share_alt",
  "campaign_description",
  "contact_phone",
  "contact_link",
  /** ปุ่มโทร — ใช้ใน JSON เทมเพลตเมื่อมี {{contact_phone_button_label}} ฯลฯ */
  "contact_phone_button_label",
  "contact_phone_button_style",
  "contact_phone_button_color",
  /** ปุ่มลิงก์ */
  "contact_link_button_label",
  "contact_link_button_style",
  "contact_link_button_color",
  /** ระบบเติมตอนสร้างแคมเปญ — ไม่ให้กรอกในฟอร์ม */
  "campaign_id",
  "share_liff_url",
  /** ชื่อเดียวกับ placeholder แบบ {{liff_url}} ในเทมเพลต */
  "liff_url",
]);

export function parseFlexTemplateFieldsSpec(json: string): FlexTemplateFieldSpec[] {
  try {
    const arr = JSON.parse(json) as unknown;
    if (!Array.isArray(arr)) return [];
    const out: FlexTemplateFieldSpec[] = [];
    for (const item of arr) {
      if (!item || typeof item !== "object") continue;
      const o = item as Record<string, unknown>;
      const key = String(o.key ?? "").trim();
      if (!key || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) continue;
      const type = o.type === "textarea" || o.type === "image" ? o.type : "text";
      out.push({
        key,
        type,
        labelTh: String(o.labelTh ?? key),
        required: Boolean(o.required),
        order: Number.isFinite(Number(o.order)) ? Number(o.order) : out.length,
      });
    }
    return out.sort((a, b) => a.order - b.order || a.key.localeCompare(b.key));
  } catch {
    return [];
  }
}

export function parseTemplateValuesJsonFromForm(raw: string): Record<string, string> | null {
  try {
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== "object" || Array.isArray(o)) return null;
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(k)) continue;
      out[k] = String(v ?? "").trim();
    }
    return out;
  } catch {
    return null;
  }
}

/**
 * แทนที่ {{key}} ในโครง JSON (ค่าต้องอยู่ในสตริง JSON — ใช้ escape แบบ JSON string)
 * รองรับรากแบบ bubble / carousel หรือ { type: flex, altText, contents }
 */
export function applyFlexTemplatePlaceholders(
  skeleton: string,
  values: Record<string, string>
): { ok: true; jsonStr: string } | { ok: false; error: string } {
  let out = skeleton;
  const keys = Object.keys(values).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    const token = `{{${key}}}`;
    if (!out.includes(token)) continue;
    const inner = JSON.stringify(values[key] ?? "").slice(1, -1);
    out = out.split(token).join(inner);
  }

  if (/\{\{[a-zA-Z_][a-zA-Z0-9_]*\}\}/.test(out)) {
    return { ok: false, error: "template_unfilled_placeholder" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(out);
  } catch {
    return { ok: false, error: "template_json_parse_failed" };
  }

  if (!parsed || typeof parsed !== "object") {
    return { ok: false, error: "template_invalid_root" };
  }

  const o = parsed as Record<string, unknown>;
  const t = o.type;
  if (t === "flex" && o.contents && typeof o.contents === "object") {
    return { ok: true, jsonStr: JSON.stringify(parsed, null, 2) };
  }
  if (t === "bubble" || t === "carousel") {
    return { ok: true, jsonStr: JSON.stringify(parsed, null, 2) };
  }

  return { ok: false, error: "template_must_be_flex_wrapper_or_bubble_or_carousel" };
}

export function sponsorTemplateFieldsForUi(specs: FlexTemplateFieldSpec[]): FlexTemplateFieldSpec[] {
  return specs.filter((f) => !SPONSOR_TEMPLATE_INJECTED_KEYS.has(f.key));
}
