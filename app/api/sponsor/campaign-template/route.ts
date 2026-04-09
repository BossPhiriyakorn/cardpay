import { NextResponse } from "next/server";

import { requireSponsorSession } from "@/lib/auth/require-sponsor-session";
import {
  parseFlexTemplateFieldsSpec,
  sponsorTemplateFieldsForUi,
} from "@/lib/flex-template-sponsor";
import { connectToDatabase } from "@/lib/mongodb";
import { getActiveSponsorFlexTemplateId } from "@/lib/platform-settings";
import FlexCampaignTemplate from "@/models/FlexCampaignTemplate";
import Sponsor from "@/models/Sponsor";

export const dynamic = "force-dynamic";

/**
 * GET — เทมเพลตที่ใช้สร้างแคมเปญ (สปอนเซอร์ล็อกอิน) + รายการฟิลด์ที่ต้องกรอก
 */
export async function GET() {
  const auth = await requireSponsorSession();
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    await connectToDatabase();
    const sponsor = await Sponsor.findById(auth.sponsorId).select("status").lean();
    if (!sponsor) {
      return NextResponse.json({ ok: false, error: "sponsor_not_found" }, { status: 404 });
    }
    if (String((sponsor as { status?: string }).status ?? "active") !== "active") {
      return NextResponse.json({ ok: false, error: "sponsor_inactive" }, { status: 403 });
    }

    const activeId = await getActiveSponsorFlexTemplateId();
    if (!activeId) {
      return NextResponse.json({
        ok: true,
        activeTemplate: null,
        hintTh:
          "แอดมินต้องตั้งเทมเพลตที่ใช้งานในหน้า CMS «จัดการแคมเปญ» ก่อน จึงจะสร้างแคมเปญได้",
      });
    }

    const doc = await FlexCampaignTemplate.findById(activeId).lean();
    if (!doc) {
      return NextResponse.json({
        ok: true,
        activeTemplate: null,
        hintTh: "เทมเพลตที่ตั้งไว้ไม่พบในระบบ — แจ้งแอดมินให้เลือกเทมเพลตใหม่",
      });
    }

    const allFields = parseFlexTemplateFieldsSpec(String(doc.fieldsSpecJson ?? "[]"));
    const fields = sponsorTemplateFieldsForUi(allFields);

    return NextResponse.json({
      ok: true,
      activeTemplate: {
        id: String(doc._id),
        name: String(doc.name ?? ""),
        slug: String(doc.slug ?? ""),
        fields,
        injectedKeysHintTh:
          "ระบบเติมจากฟอร์ม: campaign_name, campaign_description, ข้อความตอนแชร์ (linemsg/altText), contact_phone, contact_link, ข้อความปุ่มโทร/ลิงก์, สีปุ่มลิงก์ — สไตล์ปุ่มและสีปุ่มโทรล็อก ไม่ต้องใส่ใน JSON — รูป: ใช้ {{card_image}} กับช่องอัปโหลดหลักเมื่อไม่มีฟิลด์รูปใน fieldsSpec",
      },
    });
  } catch (e) {
    console.error("[api/sponsor/campaign-template GET]", e);
    return NextResponse.json({ ok: false, error: "database_unavailable" }, { status: 503 });
  }
}
