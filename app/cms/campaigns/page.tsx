import {
  computeCmsCampaignStats,
  listCmsCampaigns,
} from '@/lib/cms/campaigns-repository';
import { listCampaignTags } from '@/lib/cms/campaign-tags-repository';
import { connectToDatabase } from '@/lib/mongodb';
import { getActiveSponsorFlexTemplateId } from '@/lib/platform-settings';
import type { CmsFlexTemplateTableRow } from '@/lib/cms/types';
import FlexCampaignTemplate from '@/models/FlexCampaignTemplate';
import CmsCampaignsClient from './CmsCampaignsClient';

/** ห้าม prerender ตอน build (CI มักไม่มี MONGODB_URI) — ต้องโหลดจาก MongoDB ทุกครั้งที่เข้า CMS */
export const dynamic = 'force-dynamic';

async function loadFlexTemplatesForTable(): Promise<{
  templates: CmsFlexTemplateTableRow[];
  activeTemplateId: string | null;
  error: boolean;
}> {
  try {
    await connectToDatabase();
    const [docs, activeTemplateId] = await Promise.all([
      FlexCampaignTemplate.find({})
        .sort({ updatedAt: -1 })
        .select('name slug updatedAt')
        .lean(),
      getActiveSponsorFlexTemplateId(),
    ]);
    const templates: CmsFlexTemplateTableRow[] = docs.map((d) => ({
      id: String(d._id),
      name: String(d.name ?? ''),
      slug: String(d.slug ?? ''),
      updatedAt: d.updatedAt ? new Date(d.updatedAt).toISOString() : null,
    }));
    return { templates, activeTemplateId, error: false };
  } catch {
    return { templates: [], activeTemplateId: null, error: true };
  }
}

export default async function CmsCampaignsPage() {
  const [{ campaigns, loadError }, { tags }, flexTpl] = await Promise.all([
    listCmsCampaigns(),
    listCampaignTags(),
    loadFlexTemplatesForTable(),
  ]);
  const stats = computeCmsCampaignStats(campaigns);
  const activeTagCount = tags.filter((t) => t.isActive).length;

  return (
    <CmsCampaignsClient
      initialCampaigns={campaigns}
      initialStats={stats}
      initialTagCount={activeTagCount}
      loadError={loadError}
      initialFlexTemplates={flexTpl.templates}
      initialActiveFlexTemplateId={flexTpl.activeTemplateId}
      flexTemplatesLoadError={flexTpl.error}
    />
  );
}
