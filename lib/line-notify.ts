import { connectToDatabase } from "@/lib/mongodb";
import { CmsAdmin, LineMessageLog } from "@/models";

type Audience = "user" | "admin";

type TextMessage = {
  type: "text";
  text: string;
};

type LinePushMessage = TextMessage;

type LineRecipientType = "cms_admin" | "user" | "manual";

function getAudienceConfig(audience: Audience) {
  const prefix = audience === "admin" ? "LINE_ADMIN_NOTIFY" : "LINE_USER_NOTIFY";
  const enabled = (process.env[`${prefix}_ENABLED`] ?? "").trim();
  const channelAccessToken = (process.env[`${prefix}_CHANNEL_ACCESS_TOKEN`] ?? "").trim();
  const channelSecret = (process.env[`${prefix}_CHANNEL_SECRET`] ?? "").trim();

  return {
    enabled: enabled === "1" || enabled.toLowerCase() === "true",
    channelAccessToken,
    channelSecret,
  };
}

function compactRecipientIds(ids: Array<string | null | undefined>): string[] {
  return [...new Set(ids.map((id) => String(id ?? "").trim()).filter(Boolean))];
}

async function pushLineMessages(
  audience: Audience,
  recipients: Array<{ lineUserId: string; recipientType: LineRecipientType; recipientId?: string }>,
  eventType: string,
  messages: LinePushMessage[]
): Promise<void> {
  const cfg = getAudienceConfig(audience);
  if (!cfg.enabled || !cfg.channelAccessToken || recipients.length === 0 || messages.length === 0) {
    return;
  }

  await connectToDatabase();

  await Promise.all(
    recipients.map(async ({ lineUserId, recipientType, recipientId }) => {
      const res = await fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${cfg.channelAccessToken}`,
        },
        body: JSON.stringify({ to: lineUserId, messages }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        await LineMessageLog.create({
          audience,
          eventType,
          recipientType,
          recipientId: String(recipientId ?? ""),
          lineUserId,
          success: false,
          messagePreview: messages.map((m) => m.text).join("\n").slice(0, 200),
          errorMessage: text.slice(0, 1000),
        });
        throw new Error(`line_push_failed:${audience}:${res.status}:${text.slice(0, 200)}`);
      }

      await LineMessageLog.create({
        audience,
        eventType,
        recipientType,
        recipientId: String(recipientId ?? ""),
        lineUserId,
        success: true,
        messagePreview: messages.map((m) => m.text).join("\n").slice(0, 200),
        errorMessage: "",
      });
    })
  );
}

export function getUserNotifyRecipientId(user: {
  lineNotifyEnabled?: boolean | null;
  lineNotifyUserId?: string | null;
  lineUid?: string | null;
}): string {
  if (user.lineNotifyEnabled === false) return "";
  return String(user.lineNotifyUserId ?? "").trim() || String(user.lineUid ?? "").trim();
}

export async function getAdminNotifyRecipients(): Promise<
  Array<{ lineUserId: string; recipientType: LineRecipientType; recipientId?: string }>
> {
  const envIds = compactRecipientIds(
    String(process.env.LINE_ADMIN_NOTIFY_USER_IDS ?? "")
      .split(",")
      .map((id) => id.trim())
  );

  const dbAdmins = await CmsAdmin.find({
    isActive: true,
    lineNotifyEnabled: true,
    lineNotifyUserId: { $exists: true, $ne: "" },
  })
    .select("lineNotifyUserId")
    .lean();

  const recipients = new Map<string, { lineUserId: string; recipientType: LineRecipientType; recipientId?: string }>();
  for (const admin of dbAdmins) {
    const id = String((admin as { lineNotifyUserId?: string }).lineNotifyUserId ?? "").trim();
    if (id) {
      recipients.set(id, {
        lineUserId: id,
        recipientType: "cms_admin",
        recipientId: String(admin._id),
      });
    }
  }
  for (const id of envIds) {
    if (!recipients.has(id)) {
      recipients.set(id, { lineUserId: id, recipientType: "manual" });
    }
  }

  return Array.from(recipients.values());
}

export async function notifyAdminsWithdrawalRequested(params: {
  requesterName: string;
  requesterLineId?: string;
  amount: number;
  withdrawalId: string;
}): Promise<void> {
  const recipients = await getAdminNotifyRecipients();
  if (recipients.length === 0) return;

  const amountText = new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  }).format(params.amount);

  const text =
    [
      "มีรายการแจ้งถอนเงินใหม่",
      `ผู้ใช้: ${params.requesterName || "-"}`,
      `LINE ID: ${String(params.requesterLineId ?? "").trim() || "-"}`,
      `ยอดถอน: ${amountText}`,
      `เลขรายการ: ${params.withdrawalId}`,
    ].join("\n");

  await pushLineMessages("admin", recipients, "withdrawal_requested", [{ type: "text", text }]);
}

export async function notifyAdminsBankVerificationRequested(params: {
  requesterName: string;
  requesterLineId?: string;
  userId: string;
  bankName: string;
  accountLast4: string;
}): Promise<void> {
  const recipients = await getAdminNotifyRecipients();
  if (recipients.length === 0) return;

  const last4 = String(params.accountLast4 ?? "").replace(/\D/g, "").slice(-4) || "-";

  const text =
    [
      "มีผู้ใช้ส่งเอกสารตรวจสอบบัญชีธนาคาร",
      `ผู้ใช้: ${params.requesterName || "-"}`,
      `LINE ID: ${String(params.requesterLineId ?? "").trim() || "-"}`,
      `ธนาคาร: ${params.bankName || "-"}`,
      `เลขบัญชี (ท้าย 4 หลัก): ${last4}`,
      `userId: ${params.userId}`,
    ].join("\n");

  await pushLineMessages("admin", recipients, "bank_verification_requested", [{ type: "text", text }]);
}

export async function notifyUserWithdrawalCompleted(params: {
  recipientId: string;
  amount: number;
}): Promise<void> {
  const recipientId = String(params.recipientId ?? "").trim();
  if (!recipientId) return;

  const amountText = new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    maximumFractionDigits: 0,
  }).format(params.amount);

  const text =
    [
      "รายการถอนเงินสำเร็จแล้ว",
      `ยอดเงิน: ${amountText}`,
      "กรุณาตรวจสอบบัญชีธนาคารปลายทางของคุณ",
    ].join("\n");

  await pushLineMessages(
    "user",
    [{ lineUserId: recipientId, recipientType: "user" }],
    "withdrawal_completed",
    [{ type: "text", text }]
  );
}

export async function notifyUserBankAccountVerified(params: { recipientId: string }): Promise<void> {
  const recipientId = String(params.recipientId ?? "").trim();
  if (!recipientId) return;

  const text = [
    "บัญชีธนาคารของคุณได้รับการอนุมัติแล้ว",
    "คุณสามารถแจ้งถอนเงินได้ตามเงื่อนไขของระบบ",
  ].join("\n");

  await pushLineMessages(
    "user",
    [{ lineUserId: recipientId, recipientType: "user" }],
    "bank_account_verified",
    [{ type: "text", text }]
  );
}

export async function notifyUserBankAccountRejected(params: {
  recipientId: string;
  reason: string;
}): Promise<void> {
  const recipientId = String(params.recipientId ?? "").trim();
  if (!recipientId) return;

  const reason = String(params.reason ?? "").trim().slice(0, 400);
  const text = [
    "บัญชีธนาคารของคุณไม่ผ่านการอนุมัติ",
    reason ? `เหตุผล: ${reason}` : "กรุณาตรวจสอบข้อมูลและส่งเอกสารใหม่ตามที่ระบุในแอป",
    "หากมีข้อสงสัยติดต่อเจ้าหน้าที่ผ่านช่องทางที่กำหนด",
  ].join("\n");

  await pushLineMessages(
    "user",
    [{ lineUserId: recipientId, recipientType: "user" }],
    "bank_account_rejected",
    [{ type: "text", text }]
  );
}
