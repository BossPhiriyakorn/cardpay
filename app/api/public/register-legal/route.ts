import { NextResponse } from "next/server";

import { getResolvedPlatformSettings } from "@/lib/platform-settings";

export const dynamic = "force-dynamic";

/** GET — ข้อความนโยบาย/ข้อกำหนดสำหรับหน้าสมัคร (ไม่ต้องล็อกอิน) */
export async function GET() {
  try {
    const s = await getResolvedPlatformSettings();
    return NextResponse.json({
      ok: true,
      privacyPolicyText: s.privacyPolicyText,
      termsOfServiceText: s.termsOfServiceText,
    });
  } catch (e) {
    console.error("[api/public/register-legal]", e);
    return NextResponse.json({ ok: false, error: "load_failed" }, { status: 503 });
  }
}
