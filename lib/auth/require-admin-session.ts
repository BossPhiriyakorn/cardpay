import { cookies } from "next/headers";

import { verifyAdminAccessToken } from "@/lib/auth/admin-jwt";
import { ADMIN_TOKEN_COOKIE } from "@/lib/auth/token-constants";
import { connectToDatabase } from "@/lib/mongodb";
import CmsAdmin, { type CmsAdminRole } from "@/models/CmsAdmin";

/** ใช้ใน Route Handler ของ CMS ที่ต้องยืนยันแอดมิน */
export async function requireAdminSession(): Promise<
  {
    ok: true;
    id: string;
    username: string;
    name: string;
    role: CmsAdminRole;
    lineNotifyEnabled: boolean;
    lineNotifyConnected: boolean;
    lineNotifyUserId: string;
    lineNotifyDisplayName: string;
  } | { ok: false }
> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_TOKEN_COOKIE)?.value;
  if (!token) {
    return { ok: false };
  }
  try {
    const payload = await verifyAdminAccessToken(token);
    const username = typeof payload.sub === "string" ? payload.sub : "";
    if (!username) {
      return { ok: false };
    }

    await connectToDatabase();
    const admin = await CmsAdmin.findOne({ username, isActive: true })
      .select("_id username name role lineNotifyEnabled lineNotifyUserId lineNotifyDisplayName")
      .lean();
    if (!admin?._id) {
      return { ok: false };
    }

    return {
      ok: true,
      id: String(admin._id),
      username: String(admin.username ?? ""),
      name: String(admin.name ?? admin.username ?? ""),
      role: (admin.role === "reviewer" ? "reviewer" : "admin") as CmsAdminRole,
      lineNotifyEnabled: admin.lineNotifyEnabled !== false,
      lineNotifyConnected: Boolean(String(admin.lineNotifyUserId ?? "").trim()),
      lineNotifyUserId: String(admin.lineNotifyUserId ?? "").trim(),
      lineNotifyDisplayName: String(
        (admin as { lineNotifyDisplayName?: string }).lineNotifyDisplayName ?? ""
      ).trim(),
    };
  } catch {
    return { ok: false };
  }
}
