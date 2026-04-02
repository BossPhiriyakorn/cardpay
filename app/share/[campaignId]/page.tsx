"use client";

import { useParams } from "next/navigation";
import { ShareContentShell } from "../ShareContent";

/**
 * /share/[campaignId] — รองรับ LIFF ที่ส่ง campaignId ใน path
 * (หลายกรณี query string ไม่ถึง Next.js ครบเมื่อเปิดผ่าน liff.line.me)
 */
export default function ShareByCampaignIdPage() {
  const params = useParams();
  const raw = params?.campaignId;
  const id = Array.isArray(raw) ? raw[0] : raw;
  const campaignIdFromPath = id != null ? decodeURIComponent(String(id)) : undefined;

  return <ShareContentShell campaignIdFromPath={campaignIdFromPath} />;
}
