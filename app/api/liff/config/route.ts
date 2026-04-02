import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * ส่ง LIFF ID ให้หน้าแชร์ — ตั้งค่า NEXT_PUBLIC_LIFF_ID หรือ LIFF_ID
 */
export async function GET() {
  const liffId =
    process.env.NEXT_PUBLIC_LIFF_ID?.trim() ||
    process.env.LIFF_ID?.trim() ||
    "";
  if (!liffId) {
    return NextResponse.json(
      { error: "LIFF ID is not configured (NEXT_PUBLIC_LIFF_ID or LIFF_ID)" },
      { status: 503 }
    );
  }
  const shareEndpointIncludesShare =
    process.env.NEXT_PUBLIC_LIFF_ENDPOINT_INCLUDES_SHARE === "1";
  return NextResponse.json({ liffId, shareEndpointIncludesShare });
}
