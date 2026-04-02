export type AppCampaign = {
  id: string;
  title: string;
  description: string;
  totalBudget: number;
  usedBudget: number;
  reward: number;
  maxRewardPerUser: number;
  maxRewardPerUserPerDay: number;
  quota: number;
  current: number;
  images: string[];
  brand: string;
  popular?: boolean;
  categories?: string[];
};

export type CampaignFeedResponse = {
  ok?: boolean;
  campaigns?: AppCampaign[];
  error?: string;
};

const FALLBACK_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675"><rect width="100%" height="100%" fill="#f3e5f5"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="#8e24aa" font-family="Arial" font-size="40">No Image</text></svg>`
  );

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function normalizeString(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeImages(value: unknown): string[] {
  const items = Array.isArray(value) ? value : [];
  const normalized = items.map(normalizeString).filter(Boolean);
  return normalized.length > 0 ? normalized : [FALLBACK_IMAGE];
}

function normalizeCategories(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((x) => normalizeString(x).toLowerCase()).filter(Boolean);
}

export function normalizeCampaign(data: unknown): AppCampaign {
  const raw = (data ?? {}) as Record<string, unknown>;
  return {
    id: normalizeString(raw.id),
    title: normalizeString(raw.title),
    description: normalizeString(raw.description),
    totalBudget: Math.max(toNumber(raw.totalBudget), 0),
    usedBudget: Math.max(toNumber(raw.usedBudget), 0),
    reward: toNumber(raw.reward),
    maxRewardPerUser: Math.max(toNumber(raw.maxRewardPerUser), 0),
    maxRewardPerUserPerDay: Math.max(toNumber(raw.maxRewardPerUserPerDay), 0),
    quota: Math.max(toNumber(raw.quota), 0),
    current: Math.max(toNumber(raw.current), 0),
    images: normalizeImages(raw.images),
    brand: normalizeString(raw.brand),
    popular: Boolean(raw.popular),
    categories: normalizeCategories(raw.categories),
  };
}
