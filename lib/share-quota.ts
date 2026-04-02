/**
 * จำนวนแชร์สูงสุดที่งบรองรับ — อิงจากงบรวมและค่าตอบแทนต่อแชร์
 * (ไม่ใช้ฟิลด์ quota แยกใน CMS)
 */
export function shareQuotaFromBudget(totalBudget: number, rewardPerShare: number): number {
  const tb = Number(totalBudget);
  const rps = Number(rewardPerShare);
  if (!Number.isFinite(tb) || tb < 0) return 0;
  if (!Number.isFinite(rps) || rps <= 0) return 0;
  return Math.floor(tb / rps);
}
