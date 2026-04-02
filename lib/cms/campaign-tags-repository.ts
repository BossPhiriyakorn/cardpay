import CampaignTag from "@/models/CampaignTag";
import { connectToDatabase } from "@/lib/mongodb";
import type { CmsCampaignTagRow } from "@/lib/cms/types";

const DEFAULT_TAGS: { slug: string; nameTh: string; nameEn: string; sortOrder: number }[] = [
  { slug: "tech", nameTh: "ไอที", nameEn: "Tech", sortOrder: 0 },
  { slug: "beauty", nameTh: "ความงาม", nameEn: "Beauty", sortOrder: 1 },
  { slug: "food", nameTh: "อาหาร", nameEn: "Food", sortOrder: 2 },
];

async function ensureDefaultTagsInDb(): Promise<void> {
  for (const t of DEFAULT_TAGS) {
    await CampaignTag.updateOne(
      { slug: t.slug },
      {
        $setOnInsert: {
          slug: t.slug,
          nameTh: t.nameTh,
          nameEn: t.nameEn,
          sortOrder: t.sortOrder,
          isActive: true,
        },
      },
      { upsert: true }
    );
  }
}

/** รายการแท็กแคมเปญ — จาก MongoDB เท่านั้น (ถ้าว่างจะ upsert ชุด default) */
export async function listCampaignTags(): Promise<{
  source: "database";
  tags: CmsCampaignTagRow[];
}> {
  if (!process.env.MONGODB_URI) {
    return { source: "database", tags: [] };
  }

  try {
    await connectToDatabase();
    let docs = await CampaignTag.find().sort({ sortOrder: 1, nameTh: 1 }).lean();
    if (docs.length === 0) {
      await ensureDefaultTagsInDb();
      docs = await CampaignTag.find().sort({ sortOrder: 1, nameTh: 1 }).lean();
    }

    const tags: CmsCampaignTagRow[] = docs.map((d) => ({
      id: String(d._id),
      slug: d.slug,
      nameTh: d.nameTh,
      nameEn: d.nameEn ?? "",
      isActive: (d as { isActive?: boolean }).isActive !== false,
    }));

    return { source: "database", tags };
  } catch (err) {
    console.error("[cms] listCampaignTags:", err);
    return { source: "database", tags: [] };
  }
}
