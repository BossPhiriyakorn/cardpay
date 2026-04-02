/** โซนเวลาเดียวกับกราฟแดชบอร์ดสปอนเซอร์ (lib/sponsor/dashboard-chart.ts) */

const BKK = "Asia/Bangkok";

export function bangkokDayKeyFromDate(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: BKK });
}

/** จุดเริ่มวันตามปฏิทินกรุงเทพ (ใช้เป็น `day` ใน UserDailyStat / CampaignShareDaily) */
export function startOfBangkokDayFromKey(dayKey: string): Date {
  return new Date(`${dayKey}T00:00:00+07:00`);
}

export function nowBangkokDayKey(): string {
  return bangkokDayKeyFromDate(new Date());
}
