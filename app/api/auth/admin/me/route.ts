import { NextResponse } from "next/server";

import { getCmsRoleLabel } from "@/lib/auth/cms-admin-permissions";
import { requireAdminSession } from "@/lib/auth/require-admin-session";

export async function GET() {
  const admin = await requireAdminSession();
  if (!admin.ok) {
    return NextResponse.json({ ok: false, authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    ok: true,
    authenticated: true,
    id: admin.id,
    username: admin.username,
    name: admin.name,
    role: admin.role,
    roleLabel: getCmsRoleLabel(admin.role),
    lineNotifyEnabled: admin.lineNotifyEnabled,
    lineNotifyConnected: admin.lineNotifyConnected,
    lineNotifyUserId: admin.lineNotifyUserId,
    lineNotifyDisplayName: admin.lineNotifyDisplayName,
  });
}
