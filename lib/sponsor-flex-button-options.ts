/** ตัวเลือกปุ่ม Flex สำหรับฟอร์มสปอนเซอร์ — ใช้ร่วมกับ placeholder ในเทมเพลต */

export const SPONSOR_FLEX_BUTTON_STYLES: ReadonlyArray<{ value: string; labelTh: string }> = [
  { value: "primary", labelTh: "หลัก (Primary)" },
  { value: "secondary", labelTh: "รอง (Secondary)" },
  { value: "link", labelTh: "ข้อความลิงก์ (Link)" },
];

export const SPONSOR_FLEX_BUTTON_COLORS: ReadonlyArray<{ value: string; labelTh: string }> = [
  { value: "#7b1fa2", labelTh: "ม่วงแบรนด์" },
  { value: "#6a1b9a", labelTh: "ม่วงเข้ม" },
  { value: "#8e24aa", labelTh: "ม่วงสด" },
  { value: "#00B900", labelTh: "เขียว LINE" },
  { value: "#42659a", labelTh: "น้ำเงิน" },
  { value: "#E91E63", labelTh: "ชมพู" },
  { value: "#F4511E", labelTh: "ส้ม" },
  { value: "#37474F", labelTh: "เทาเข้ม" },
  { value: "#000000", labelTh: "ดำ" },
];

/** ปุ่มโทร — ล็อกสไตล์/สีตามดีไซน์ (สปอนเซอร์ปรับได้แค่ข้อความ) */
export const SPONSOR_PHONE_BUTTON_STYLE_LOCKED = "primary" as const;
export const SPONSOR_PHONE_BUTTON_COLOR_LOCKED = "#42659a";

/** ปุ่มลิงก์ — ล็อกสไตล์ตามดีไซน์; เลือกสีได้เฉพาะชุดแบรนด์ช่องทาง */
export const SPONSOR_LINK_BUTTON_STYLE_LOCKED = "secondary" as const;

/** สีแบรนด์ทางการโซเชียล (Facebook / Instagram / LINE / TikTok / Messenger) — ค่าเริ่มต้น = รายการแรก */
export const SPONSOR_LINK_BUTTON_BRAND_COLORS: ReadonlyArray<{ value: string; labelTh: string }> = [
  { value: "#1877F2", labelTh: "Facebook" },
  { value: "#E4405F", labelTh: "Instagram" },
  { value: "#06C755", labelTh: "LINE" },
  { value: "#000000", labelTh: "TikTok" },
  { value: "#0084FF", labelTh: "Messenger" },
];

const ALLOWED_COLORS = new Set(SPONSOR_FLEX_BUTTON_COLORS.map((x) => x.value));

function hexEquals(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * ตรวจและคืนค่า #rrggbb (ตัวพิมพ์เล็ก) เมื่อเป็น hex ที่อนุญาต (3 หรือ 6 หลัก)
 */
export function parseSponsorFlexHexColor(raw: string): string | null {
  let t = String(raw ?? "").trim();
  if (!t) return null;
  if (!t.startsWith("#")) t = `#${t}`;
  const m = t.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (!m) return null;
  let digits = m[1];
  if (digits.length === 3) {
    digits = digits
      .split("")
      .map((ch) => ch + ch)
      .join("");
  }
  return `#${digits.toLowerCase()}`;
}

export function normalizeSponsorFlexButtonStyle(raw: string): "primary" | "secondary" | "link" {
  if (raw === "secondary" || raw === "link") return raw;
  return "primary";
}

export function normalizeSponsorFlexButtonColor(raw: string): string {
  const u = String(raw ?? "").trim();
  const parsed = parseSponsorFlexHexColor(u);
  if (parsed) {
    const preset = SPONSOR_FLEX_BUTTON_COLORS.find((c) => hexEquals(c.value, parsed));
    return preset ? preset.value : parsed;
  }
  if (ALLOWED_COLORS.has(u)) return u;
  return SPONSOR_FLEX_BUTTON_COLORS[0].value;
}

/** สีปุ่มลิงก์ — พรีเซ็ตแบรนด์ช่องทาง หรือ hex ที่ถูกต้อง (#RGB / #RRGGBB) */
export function normalizeSponsorLinkButtonColor(raw: string): string {
  const u = String(raw ?? "").trim();
  if (!u) return SPONSOR_LINK_BUTTON_BRAND_COLORS[0].value;
  const parsed = parseSponsorFlexHexColor(u);
  if (parsed) {
    const preset = SPONSOR_LINK_BUTTON_BRAND_COLORS.find((c) => hexEquals(c.value, parsed));
    return preset ? preset.value : parsed;
  }
  const presetOnly = SPONSOR_LINK_BUTTON_BRAND_COLORS.find((c) => hexEquals(c.value, u));
  return presetOnly ? presetOnly.value : SPONSOR_LINK_BUTTON_BRAND_COLORS[0].value;
}

const MAX_BTN_LABEL = 40;

export function clampSponsorButtonLabel(s: string): string {
  return String(s ?? "")
    .trim()
    .slice(0, MAX_BTN_LABEL);
}
