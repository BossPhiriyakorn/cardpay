import { NextResponse } from "next/server";
import {
  computeCmsCampaignStats,
  listCmsCampaigns,
} from "@/lib/cms/campaigns-repository";

/** GET — รายการแคมเปญ CMS จาก MongoDB */
export async function GET() {
  try {
    const { source, campaigns, loadError } = await listCmsCampaigns();
    const stats = computeCmsCampaignStats(campaigns);
    return NextResponse.json({ ok: true, source, campaigns, stats, loadError: loadError ?? null });
  } catch (e) {
    console.error("[api/cms/campaigns]", e);
    return NextResponse.json(
      { ok: false, error: "ไม่สามารถโหลดรายการแคมเปญได้" },
      { status: 500 }
    );
  }
}
