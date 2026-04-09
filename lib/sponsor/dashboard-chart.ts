import mongoose from "mongoose";

import CampaignShareDaily from "@/models/CampaignShareDaily";

export type SponsorDashboardChartPeriod = "day" | "week" | "month";

export type SponsorChartPoint = {
  date: string;
  dateFull: string;
  /** วันที่แบบย่อสำหรับ tooltip เช่น 22 มี.ค. 2569 */
  dateCompact: string;
  /** ยังไม่มีการเก็บคลิกรายวัน — ใช้ 0 */
  clicks: number;
  shares: number;
};

const BKK = "Asia/Bangkok";

function bangkokDayKeyFromDate(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: BKK });
}

function parseBangkokDayKey(key: string): Date {
  const [y, m, day] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day, 12, 0, 0));
}

function startOfBangkokDay(dayKey: string): Date {
  return new Date(`${dayKey}T00:00:00+07:00`);
}

function endOfBangkokDay(dayKey: string): Date {
  return new Date(`${dayKey}T23:59:59.999+07:00`);
}

function formatThaiFullDateFromKey(dayKey: string): string {
  const d = parseBangkokDayKey(dayKey);
  return d.toLocaleDateString("th-TH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: BKK,
    calendar: "buddhist",
  });
}

function formatShortDayLabel(dayKey: string): string {
  const d = parseBangkokDayKey(dayKey);
  return d.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    timeZone: BKK,
  });
}

/** วันที่ย่อพร้อมปี พ.ศ. สำหรับ tooltip */
function formatThaiCompactDateFromKey(dayKey: string): string {
  const d = parseBangkokDayKey(dayKey);
  return d.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: BKK,
    calendar: "buddhist",
  });
}

/** ลำดับวันที่ YYYY-MM-DD ย้อนหลัง n วัน (รวมวันนี้) โซนกรุงเทพ */
export function lastNBangkokDayKeys(n: number): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    keys.push(bangkokDayKeyFromDate(d));
  }
  return keys;
}

function bangkokMonthKey(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BKK,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value ?? "1970";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  return `${y}-${m}`;
}

function monthKeyFromBangkokDayKey(dayKey: string): string {
  return dayKey.slice(0, 7);
}

/**
 * กราฟรายวัน: 28 วันล่าสุด (กรุงเทพ) — แชร์จาก CampaignShareDaily, คลิก = 0
 */
export async function buildDayChartSeries(
  campaignId: string
): Promise<SponsorChartPoint[]> {
  if (!mongoose.Types.ObjectId.isValid(campaignId)) return [];
  const oid = new mongoose.Types.ObjectId(campaignId);
  const dayKeys = lastNBangkokDayKeys(28);
  if (dayKeys.length === 0) return [];
  const start = startOfBangkokDay(dayKeys[0]);
  const end = endOfBangkokDay(dayKeys[dayKeys.length - 1]);

  const docs = await CampaignShareDaily.find({
    campaignId: oid,
    day: { $gte: start, $lte: end },
  })
    .select("day shareCount")
    .lean();

  const byKey = new Map<string, number>();
  for (const row of docs) {
    const key = bangkokDayKeyFromDate(new Date(row.day as Date));
    byKey.set(key, Number(row.shareCount ?? 0));
  }

  return dayKeys.map((key) => ({
    date: formatShortDayLabel(key),
    dateFull: formatThaiFullDateFromKey(key),
    dateCompact: formatThaiCompactDateFromKey(key),
    clicks: 0,
    shares: byKey.get(key) ?? 0,
  }));
}

/** กราฟรายสัปดาห์: 7 วันล่าสุด ป้ายย่อวัน */
export async function buildWeekChartSeries(
  campaignId: string
): Promise<SponsorChartPoint[]> {
  if (!mongoose.Types.ObjectId.isValid(campaignId)) return [];
  const oid = new mongoose.Types.ObjectId(campaignId);
  const dayKeys = lastNBangkokDayKeys(7);
  const start = startOfBangkokDay(dayKeys[0]);
  const end = endOfBangkokDay(dayKeys[dayKeys.length - 1]);

  const docs = await CampaignShareDaily.find({
    campaignId: oid,
    day: { $gte: start, $lte: end },
  })
    .select("day shareCount")
    .lean();

  const byKey = new Map<string, number>();
  for (const row of docs) {
    const key = bangkokDayKeyFromDate(new Date(row.day as Date));
    byKey.set(key, Number(row.shareCount ?? 0));
  }

  return dayKeys.map((key) => {
    const d = parseBangkokDayKey(key);
    const weekday = d.toLocaleDateString("th-TH", {
      weekday: "short",
      timeZone: BKK,
    });
    return {
      date: weekday,
      dateFull: formatThaiFullDateFromKey(key),
      dateCompact: formatThaiCompactDateFromKey(key),
      clicks: 0,
      shares: byKey.get(key) ?? 0,
    };
  });
}

/** เดือนล่าสุด YYYY-MM ตามปฏิทินกรุงเทพ ย้อนหลัง n เดือน (รวมเดือนปัจจุบัน) */
function lastNBangkokMonthKeys(n: number): string[] {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BKK,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  let y = Number(parts.find((p) => p.type === "year")?.value ?? "1970");
  let m = Number(parts.find((p) => p.type === "month")?.value ?? "1");
  const keys: string[] = [];
  for (let i = 0; i < n; i++) {
    let cm = m - i;
    let cy = y;
    while (cm <= 0) {
      cm += 12;
      cy -= 1;
    }
    keys.unshift(`${cy}-${String(cm).padStart(2, "0")}`);
  }
  return keys;
}

/** กราฟรายเดือน: 12 เดือนล่าสุด (ตามปฏิทินกรุงเทพ) */
export async function buildMonthChartSeries(
  campaignId: string
): Promise<SponsorChartPoint[]> {
  if (!mongoose.Types.ObjectId.isValid(campaignId)) return [];
  const oid = new mongoose.Types.ObjectId(campaignId);

  const monthKeys = lastNBangkokMonthKeys(12);
  if (monthKeys.length === 0) return [];

  const startGuess = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);
  const docs = await CampaignShareDaily.find({
    campaignId: oid,
    day: { $gte: startGuess },
  })
    .select("day shareCount")
    .lean();

  const sums = new Map<string, number>();
  for (const row of docs) {
    const key = monthKeyFromBangkokDayKey(bangkokDayKeyFromDate(new Date(row.day as Date)));
    sums.set(key, (sums.get(key) ?? 0) + Number(row.shareCount ?? 0));
  }

  return monthKeys.map((mk) => {
    const [y, m] = mk.split("-").map(Number);
    const labelDate = new Date(Date.UTC(y, m - 1, 1, 12, 0, 0));
    const dateShort = labelDate.toLocaleDateString("th-TH", {
      month: "short",
      year: "2-digit",
      timeZone: BKK,
      calendar: "buddhist",
    });
    const dateFull = labelDate.toLocaleDateString("th-TH", {
      month: "long",
      year: "numeric",
      timeZone: BKK,
      calendar: "buddhist",
    });
    return {
      date: dateShort,
      dateFull: dateFull,
      dateCompact: dateShort,
      clicks: 0,
      shares: sums.get(mk) ?? 0,
    };
  });
}

export async function buildChartForPeriod(
  campaignId: string,
  period: SponsorDashboardChartPeriod
): Promise<SponsorChartPoint[]> {
  switch (period) {
    case "week":
      return buildWeekChartSeries(campaignId);
    case "month":
      return buildMonthChartSeries(campaignId);
    default:
      return buildDayChartSeries(campaignId);
  }
}
