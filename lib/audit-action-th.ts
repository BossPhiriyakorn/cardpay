/**
 * แปลข้อความ action ของ audit log จากรูปแบบภาษาอังกฤษ (ข้อมูลเก่า) เป็นภาษาไทยสำหรับแสดงใน CMS
 * ข้อมูลใหม่ที่บันทึกเป็นภาษาไทยอยู่แล้วจะส่งผ่านโดยไม่เปลี่ยน (ไม่ match pattern)
 */
export function toThaiAuditAction(action: string): string {
  const a = String(action ?? "").trim();
  if (!a) return a;

  const rules: Array<{ test: (s: string) => RegExpMatchArray | null; fmt: (m: RegExpMatchArray) => string }> = [
    {
      test: (s) => s.match(/^admin login:\s*(.+)$/i),
      fmt: (m) => `เข้าสู่ระบบแอดมิน: ${m[1]}`,
    },
    {
      test: (s) => s.match(/^admin logout:\s*(.+)$/i),
      fmt: (m) => `ออกจากระบบแอดมิน: ${m[1]}`,
    },
    {
      test: (s) => s.match(/^approve member bank account:\s*(.+?)\s+by\s+(.+)$/i),
      fmt: (m) => `อนุมัติบัญชีธนาคารของสมาชิก (${m[1]}) โดย ${m[2]}`,
    },
    {
      test: (s) => s.match(/^reject member bank account:\s*(.+?)\s+by\s+(.+)$/i),
      fmt: (m) => `ปฏิเสธบัญชีธนาคารของสมาชิก (${m[1]}) โดย ${m[2]}`,
    },
    {
      test: (s) => s.match(/^create cms admin:\s*(.+?)\s+by\s+(.+)$/i),
      fmt: (m) => `สร้างแอดมิน CMS: ${m[1]} โดย ${m[2]}`,
    },
    {
      test: (s) => s.match(/^update cms admin:\s*(.+?)\s+by\s+(.+)$/i),
      fmt: (m) => `แก้ไขข้อมูลแอดมิน CMS: ${m[1]} โดย ${m[2]}`,
    },
    {
      test: (s) => s.match(/^delete cms admin:\s*(.+?)\s+by\s+(.+)$/i),
      fmt: (m) => `ลบแอดมิน CMS: ${m[1]} โดย ${m[2]}`,
    },
    {
      test: (s) => s.match(/^create campaign tag:\s*(.+)\s+by\s+(.+)$/i),
      fmt: (m) => `สร้างแท็กแคมเปญ: ${m[1]} โดย ${m[2]}`,
    },
    {
      test: (s) => s.match(/^update campaign tag:\s*(.+)\s+by\s+(.+)$/i),
      fmt: (m) => `แก้ไขแท็กแคมเปญ: ${m[1]} โดย ${m[2]}`,
    },
    {
      test: (s) => s.match(/^clear audit logs\s*\((\d+)\)\s+by\s+(.+)$/i),
      fmt: (m) => `ล้างประวัติ ${m[1]} รายการ โดย ${m[2]}`,
    },
  ];

  for (const { test, fmt } of rules) {
    const m = test(a);
    if (m) return fmt(m);
  }

  return a;
}
