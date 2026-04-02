import AuditLog from "@/models/AuditLog";
import { connectToDatabase } from "@/lib/mongodb";

type AuditCategory = "auth" | "member" | "sponsor" | "campaign" | "withdrawal" | "system" | "other";

export async function createAuditLog(input: {
  action: string;
  category?: AuditCategory;
  targetType?: string;
  targetId?: string;
  ip?: string;
  device?: string;
  location?: string;
}) {
  try {
    await connectToDatabase();
    await AuditLog.create({
      action: input.action,
      category: input.category ?? "other",
      targetType: input.targetType ?? "",
      targetId: input.targetId ?? "",
      ip: input.ip ?? "",
      device: input.device ?? "",
      location: input.location ?? "",
    });
  } catch (e) {
    console.error("[audit-log]", e);
  }
}
