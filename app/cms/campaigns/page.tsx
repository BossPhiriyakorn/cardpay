import {
  computeCmsCampaignStats,
  listCmsCampaigns,
} from '@/lib/cms/campaigns-repository';
import { listCampaignTags } from '@/lib/cms/campaign-tags-repository';
import CmsCampaignsClient from './CmsCampaignsClient';

export default async function CmsCampaignsPage() {
  const [{ campaigns }, { tags }] = await Promise.all([
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
    />
  );
}
