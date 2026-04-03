import {
  computeCmsCampaignStats,
  listCmsCampaigns,
} from '@/lib/cms/campaigns-repository';
import { listCampaignTags } from '@/lib/cms/campaign-tags-repository';
import CmsCampaignsClient from './CmsCampaignsClient';

/** ห้าม prerender ตอน build (CI มักไม่มี MONGODB_URI) — ต้องโหลดจาก MongoDB ทุกครั้งที่เข้า CMS */
export const dynamic = 'force-dynamic';

export default async function CmsCampaignsPage() {
  const [{ campaigns, loadError }, { tags }] = await Promise.all([
    listCmsCampaigns(),
    listCampaignTags(),
  ]);
  const stats = computeCmsCampaignStats(campaigns);
  const activeTagCount = tags.filter((t) => t.isActive).length;

  return (
    <CmsCampaignsClient
      initialCampaigns={campaigns}
      initialStats={stats}
      initialTagCount={activeTagCount}
      loadError={loadError}
    />
  );
}
