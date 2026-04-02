/** เบอร์มือถือไทยแบบเก็บในฐานข้อมูล: ตัวเลข 10 หลักเท่านั้น */

export const THAI_PHONE_DIGITS_LEN = 10;

export function sanitizeThaiPhoneInput(raw: string): string {
  return String(raw ?? "").replace(/\D/g, "").slice(0, THAI_PHONE_DIGITS_LEN);
}

export function isValidThaiPhoneDigits(digits: string): boolean {
  return /^\d{10}$/.test(String(digits ?? "").trim());
}
