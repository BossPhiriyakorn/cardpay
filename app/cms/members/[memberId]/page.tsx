"use client";

import Image from "next/image";
import Link from "next/link";
import { use, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, CheckCircle2, Copy, UserCircle2, XCircle } from "lucide-react";
import { driveImageViewUrl, parseGoogleDriveFileId, resolveDriveImageSrcForPreview } from "@/lib/drive-image-url";
import { useCmsAdminMe } from "@/hooks/useCmsAdminMe";

type Props = {
  params: Promise<{ memberId: string }>;
};

type CampaignShare = {
  campaignId: string;
  campaignName: string;
  shareCount: number;
  ownShareEarned: number;
  referralEarned: number;
  totalEarned: number;
};

type ReferredByInfo = {
  userId: string;
  code: string;
  name: string;
};

type ReferredFriendReward = {
  id: string;
  name: string;
  referralCode: string;
  rewardClaimed: boolean;
  rewardClaimedAt: string | null;
  rewardCampaignId: string;
  rewardCampaignName: string;
  rewardAmount: number;
};

type ShareTableFilter = "all" | "referral_only";

type ShareTableRow =
  | { kind: "campaign"; row: CampaignShare }
  | { kind: "referral_first"; friend: ReferredFriendReward };

type TransferRecord = {
  id: string;
  date: string;
  amount: number;
  status: "Completed" | "Pending";
  note: string;
};

type LinkedBankAccount = {
  id: string;
  bankName: string;
  accountNumber: string;
  accountHolderName: string;
  status: "verified" | "pending" | "rejected";
  reviewReason?: string;
  reviewedAt?: string | null;
  idCardDriveFileId?: string;
  bankBookDriveFileId?: string;
};

type MemberProfile = {
  id: string;
  name: string;
  email: string;
  phone: string;
  /** ไอดีที่ผู้ใช้กรอกตอนสมัคร (ไม่แสดง MongoDB ObjectId ในหน้านี้) */
  lineDisplayId: string;
  avatar: string;
  role: string;
  joinedAt: string;
  totalEarnedAllTime: number;
  latestTransferableAmount: number;
  referralCode: string;
  referredBy: ReferredByInfo | null;
  referredFriends: ReferredFriendReward[];
  campaignShares: CampaignShare[];
  transfers: TransferRecord[];
  /** 1 คน 1 บัญชี — ไม่มี array */
  linkedBankAccount: LinkedBankAccount | null;
};

const money = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  maximumFractionDigits: 0,
});

function formatThaiDateTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return "—";
  }
}

export default function MemberDetailPage({ params }: Props) {
  const { isAdmin, isReviewer } = useCmsAdminMe();
  const { memberId: resolvedId } = use(params);
  const [member, setMember] = useState<MemberProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transferHistory, setTransferHistory] = useState<TransferRecord[]>([]);
  const [latestTransferableAmount, setLatestTransferableAmount] = useState<number>(0);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [reviewReason, setReviewReason] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState<"approve" | "reject" | null>(null);
  const [shareFilter, setShareFilter] = useState<ShareTableFilter>("all");

  useEffect(() => {
    let cancelled = false;
    async function loadMember() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/cms/members/${resolvedId}`, { cache: "no-store" });
        const data = (await res.json()) as { ok?: boolean; member?: MemberProfile; error?: string };
        if (!res.ok || !data.ok || !data.member) {
          throw new Error(data.error ?? "load_failed");
        }
        if (!cancelled) {
          setMember(data.member);
          setTransferHistory(data.member.transfers ?? []);
          setLatestTransferableAmount(data.member.latestTransferableAmount ?? 0);
        }
      } catch {
        if (!cancelled) {
          setError("ไม่สามารถโหลดข้อมูลสมาชิกได้");
          setMember(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    loadMember();
    return () => {
      cancelled = true;
    };
  }, [resolvedId]);

  const shareTableModel = useMemo(() => {
    const empty = {
      shareTableRows: [] as ShareTableRow[],
      footerOwnShareEarned: 0,
      footerReferralEarned: 0,
      footerTotalEarned: 0,
    };
    if (!member) return empty;

    const claimedReferrals = member.referredFriends.filter(
      (f) =>
        f.rewardClaimed &&
        Number(f.rewardAmount ?? 0) > 0 &&
        String(f.rewardCampaignId ?? "").trim() !== ""
    );

    if (shareFilter === "referral_only") {
      const sorted = [...claimedReferrals].sort((a, b) => {
        const cn = (a.rewardCampaignName || "").localeCompare(b.rewardCampaignName || "", "th");
        if (cn !== 0) return cn;
        return (a.name || "").localeCompare(b.name || "", "th");
      });
      const sumRef = sorted.reduce((s, f) => s + Number(f.rewardAmount ?? 0), 0);
      return {
        shareTableRows: sorted.map((friend) => ({ kind: "referral_first" as const, friend })),
        footerOwnShareEarned: 0,
        footerReferralEarned: sumRef,
        footerTotalEarned: sumRef,
      };
    }

    const orderedCampaignIds = member.campaignShares.map((c) => c.campaignId);
    const campaignById = new Map(member.campaignShares.map((c) => [c.campaignId, c]));
    const rows: ShareTableRow[] = [];

    for (const cid of orderedCampaignIds) {
      const c = campaignById.get(cid);
      if (c) rows.push({ kind: "campaign", row: c });
      const forCampaign = claimedReferrals
        .filter((f) => f.rewardCampaignId === cid)
        .sort((a, b) => (a.name || "").localeCompare(b.name || "", "th"));
      for (const f of forCampaign) {
        rows.push({ kind: "referral_first", friend: f });
      }
    }

    const campaignIdsSet = new Set(orderedCampaignIds);
    const orphans = claimedReferrals
      .filter((f) => !campaignIdsSet.has(f.rewardCampaignId))
      .sort((a, b) => {
        const cn = (a.rewardCampaignName || "").localeCompare(b.rewardCampaignName || "", "th");
        if (cn !== 0) return cn;
        return (a.name || "").localeCompare(b.name || "", "th");
      });
    for (const f of orphans) {
      rows.push({ kind: "referral_first", friend: f });
    }

    return {
      shareTableRows: rows,
      footerOwnShareEarned: member.campaignShares.reduce((s, i) => s + i.ownShareEarned, 0),
      footerReferralEarned: member.campaignShares.reduce((s, i) => s + i.referralEarned, 0),
      footerTotalEarned: member.campaignShares.reduce((s, i) => s + i.totalEarned, 0),
    };
  }, [member, shareFilter]);

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      setCopiedKey(null);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-[#e1bee7] bg-white p-6 text-[#4a148c]">
        กำลังโหลดข้อมูลสมาชิก...
      </div>
    );
  }

  if (!member) {
    return (
      <div className="rounded-2xl border border-[#e1bee7] bg-white p-6 text-[#4a148c]">
        {error ?? "ไม่พบข้อมูลสมาชิก"}
      </div>
    );
  }

  const linkedBank = member.linkedBankAccount;
  const idCardFileId = linkedBank?.idCardDriveFileId?.trim() ?? "";
  const bankBookFileId = linkedBank?.bankBookDriveFileId?.trim() ?? "";
  const idCardPreviewSrc = idCardFileId ? resolveDriveImageSrcForPreview(idCardFileId) : "";
  const bankBookPreviewSrc = bankBookFileId ? resolveDriveImageSrcForPreview(bankBookFileId) : "";
  const idCardViewUrl = idCardFileId
    ? driveImageViewUrl(parseGoogleDriveFileId(idCardFileId) ?? idCardFileId)
    : "";
  const bankBookViewUrl = bankBookFileId
    ? driveImageViewUrl(parseGoogleDriveFileId(bankBookFileId) ?? bankBookFileId)
    : "";

  const confirmTransfer = async (transferId: string) => {
    if (!isAdmin) {
      setError("สิทธิ์ตรวจสอบไม่สามารถยืนยันโอนเงินได้");
      return;
    }
    try {
      const res = await fetch(`/api/cms/withdrawals/${transferId}/confirm`, { method: "POST" });
      const data = (await res.json()) as { ok?: boolean };
      if (!res.ok || !data.ok) {
        throw new Error("confirm_failed");
      }
      setTransferHistory((prev) =>
        prev.map((item) => (item.id === transferId ? { ...item, status: "Completed" } : item))
      );
      setLatestTransferableAmount(0);
    } catch {
      setError("ยืนยันโอนไม่สำเร็จ");
    }
  };

  const reviewBankAccount = async (action: "approve" | "reject") => {
    if (!isAdmin) {
      setError("สิทธิ์ตรวจสอบไม่สามารถอนุมัติหรือปฏิเสธบัญชีได้");
      return;
    }
    if (!member?.linkedBankAccount) return;
    const reason = reviewReason.trim();
    if (action === "reject" && !reason) {
      setError("กรุณาระบุเหตุผลเมื่อไม่อนุมัติบัญชี");
      return;
    }
    try {
      setReviewSubmitting(action);
      setError(null);
      const res = await fetch(`/api/cms/members/${member.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        bankAccount?: { status?: LinkedBankAccount["status"]; reviewReason?: string; reviewedAt?: string | null };
      };
      if (!res.ok || !data.ok || !data.bankAccount) {
        throw new Error("review_failed");
      }
      setMember((prev) =>
        prev
          ? {
              ...prev,
              linkedBankAccount: prev.linkedBankAccount
                ? {
                    ...prev.linkedBankAccount,
                    status: data.bankAccount?.status ?? prev.linkedBankAccount.status,
                    reviewReason: data.bankAccount?.reviewReason ?? "",
                    reviewedAt: data.bankAccount?.reviewedAt ?? null,
                  }
                : null,
            }
          : prev
      );
      if (action === "approve") setReviewReason("");
    } catch {
      setError("บันทึกผลการตรวจสอบบัญชีไม่สำเร็จ");
    } finally {
      setReviewSubmitting(null);
    }
  };

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex items-center gap-3 text-xs font-bold text-[#6a1b9a]/65 uppercase tracking-wider">
        <Link href="/cms/members" className="inline-flex items-center gap-2 hover:text-[#8e24aa] transition-colors">
          <ArrowLeft size={14} />
          กลับไปหน้าจัดการสมาชิก
        </Link>
      </div>

      <div className="bg-white border border-[#e1bee7] rounded-3xl p-5 md:p-6">
        <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
          <div className="w-20 h-20 rounded-2xl overflow-hidden border border-[#e1bee7] bg-[#faf5fc] flex items-center justify-center shrink-0">
            {member.avatar ? (
              <Image src={member.avatar} alt={member.name} width={80} height={80} className="object-cover w-full h-full" />
            ) : (
              <UserCircle2 className="text-[#8e24aa]" size={42} />
            )}
          </div>

          <div className="min-w-0">
            <h1 className="text-2xl md:text-3xl font-black text-[#4a148c]">{member.name}</h1>
            <p className="text-sm text-[#6a1b9a]/70 mt-1">
              ไอดี LINE:{" "}
              {member.lineDisplayId ? (
                <span className="font-semibold text-[#4a148c]/90">{member.lineDisplayId}</span>
              ) : (
                <span className="text-[#6a1b9a]/50">ยังไม่ระบุ</span>
              )}
              <span className="text-[#6a1b9a]/50"> • </span>
              {member.role}
            </p>
            <p className="text-sm text-[#6a1b9a]/70">{member.email} • {member.phone}</p>
            <p className="text-xs text-[#6a1b9a]/55 mt-1">เข้าร่วมเมื่อ: {member.joinedAt}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl border border-[#e1bee7] bg-white p-5">
          <p className="text-xs font-black uppercase tracking-wider text-[#6a1b9a]/70">ยอดทั้งหมด (เคยแชร์ได้ทั้งหมด)</p>
          <p className="text-2xl font-black text-[#4a148c] mt-2">{money.format(member.totalEarnedAllTime)}</p>
        </div>
        <div className="rounded-2xl border border-[#e1bee7] bg-white p-5">
          <p className="text-xs font-black uppercase tracking-wider text-[#6a1b9a]/70">ยอดล่าสุด (รอโอน)</p>
          <p className="text-2xl font-black text-[#8e24aa] mt-2">{money.format(latestTransferableAmount)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="rounded-3xl border border-[#e1bee7] bg-white p-5 space-y-4">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-[#6a1b9a]/70">สถานะแนะนำเพื่อน</p>
            <h2 className="text-lg font-black text-[#4a148c] mt-2">ข้อมูลรหัสแนะนำของสมาชิก</h2>
          </div>

          <div className="rounded-2xl border border-[#e1bee7] bg-[#faf5fc] p-4">
            <p className="text-[11px] font-black uppercase tracking-wider text-[#6a1b9a]/70">รหัสของสมาชิก</p>
            <div className="mt-2 flex items-center gap-2">
              <div className="rounded-xl border border-[#e1bee7] bg-white px-3 py-2 text-sm font-black tracking-[0.18em] text-[#4a148c]">
                {member.referralCode || "-"}
              </div>
              {member.referralCode ? (
                <button
                  type="button"
                  onClick={() => copyToClipboard(member.referralCode, `${member.id}-referral`)}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#e1bee7] bg-white px-2.5 py-2 text-[11px] font-bold text-[#6a1b9a]"
                >
                  {copiedKey === `${member.id}-referral` ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                  {copiedKey === `${member.id}-referral` ? "คัดลอกแล้ว" : "คัดลอก"}
                </button>
              ) : null}
            </div>
            <p className="mt-2 text-xs text-[#6a1b9a]/60">
              {member.referralCode ? "สมาชิกคนนี้มีรหัสแนะนำเพื่อนแล้ว" : "ยังไม่มีรหัสแนะนำเพื่อน"}
            </p>
          </div>

          <div className="rounded-2xl border border-[#e1bee7] bg-white p-4">
            <p className="text-[11px] font-black uppercase tracking-wider text-[#6a1b9a]/70">ผู้แนะนำสมาชิกคนนี้</p>
            {member.referredBy ? (
              <div className="mt-2 space-y-1 text-sm text-[#4a148c]">
                <p className="font-bold">{member.referredBy.name || "ไม่ทราบชื่อ"}</p>
                <p className="text-[#6a1b9a]/75">รหัสที่ใช้สมัคร: {member.referredBy.code || "-"}</p>
                <p className="text-[11px] text-[#6a1b9a]/55">Member ID: {member.referredBy.userId}</p>
              </div>
            ) : (
              <p className="mt-2 text-sm text-[#6a1b9a]/70">ไม่มีผู้แนะนำหรือสมัครโดยไม่ใช้รหัส</p>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-[#e1bee7] bg-white p-5 space-y-4">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-[#6a1b9a]/70">เพื่อนที่ใช้รหัสของสมาชิก</p>
            <h2 className="text-lg font-black text-[#4a148c] mt-2">รายการเพื่อนที่สมัครผ่านการแนะนำ</h2>
            <p className="text-xs text-[#6a1b9a]/60 mt-1">แสดงเฉพาะชื่อเพื่อดูว่ามีใครสมัครผ่านรหัสแนะนำบ้าง</p>
          </div>

          {member.referredFriends.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#e1bee7] bg-[#faf5fc] p-4 text-sm text-[#6a1b9a]/70">
              ยังไม่มีเพื่อนที่ใช้รหัสของสมาชิกคนนี้
            </div>
          ) : (
            <ul className="rounded-2xl border border-[#e1bee7] bg-[#faf5fc] divide-y divide-[#f1dff5] overflow-hidden">
              {member.referredFriends.map((friend) => (
                <li key={friend.id} className="px-4 py-3 text-sm font-bold text-[#4a148c]">
                  {friend.name?.trim() || "ไม่ระบุชื่อ"}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="bg-white border border-[#e1bee7] rounded-3xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#e1bee7]">
          <h2 className="text-base md:text-lg font-black text-[#4a148c]">บัญชีที่ผู้ใช้ผูกไว้</h2>
          <p className="text-xs text-[#6a1b9a]/60 mt-1">
            ข้อมูลบัญชีธนาคารสำหรับโอนเงิน — คัดลอกได้เฉพาะเลขบัญชี
          </p>
        </div>
        <div className="p-6 space-y-4">
          {!linkedBank ? (
            <p className="text-sm text-[#6a1b9a]/70">ยังไม่มีบัญชีที่ผูกไว้ (1 คน 1 บัญชี)</p>
          ) : (
            <div className="rounded-2xl border border-[#e1bee7] bg-[#faf5fc] p-4 md:p-5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-black uppercase tracking-wider text-[#6a1b9a]/70">
                  บัญชีธนาคาร
                </p>
                <span
                  className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider ${
                    linkedBank.status === "verified"
                      ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                      : linkedBank.status === "rejected"
                        ? "bg-rose-100 text-rose-700 border border-rose-200"
                        : "bg-amber-100 text-amber-700 border border-amber-200"
                  }`}
                >
                  {linkedBank.status === "verified"
                    ? "อนุมัติแล้ว"
                    : linkedBank.status === "rejected"
                      ? "ไม่อนุมัติ"
                      : "รอตรวจสอบ"}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <span className="text-xs text-[#6a1b9a]/65 shrink-0 w-24">ธนาคาร</span>
                <div className="min-w-0 flex-1 rounded-xl border border-[#e1bee7] bg-white px-3 py-2">
                  <span className="text-sm font-semibold text-[#4a148c] truncate block">{linkedBank.bankName}</span>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <span className="text-xs text-[#6a1b9a]/65 shrink-0 w-24">เลขบัญชี</span>
                <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-[#e1bee7] bg-white px-3 py-2">
                  <span className="text-sm font-semibold text-[#4a148c] truncate">{linkedBank.accountNumber}</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(linkedBank.accountNumber, `${linkedBank.id}-acct`)}
                    className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-lg border border-[#e1bee7] bg-[#faf5fc] px-2 py-1 text-[11px] font-bold text-[#6a1b9a] hover:bg-[#f3e5f5] transition-colors"
                    title="คัดลอกเลขบัญชี"
                  >
                    {copiedKey === `${linkedBank.id}-acct` ? (
                      <>
                        <Check size={14} className="text-emerald-600" />
                        คัดลอกแล้ว
                      </>
                    ) : (
                      <>
                        <Copy size={14} />
                        คัดลอก
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                <span className="text-xs text-[#6a1b9a]/65 shrink-0 w-24">ชื่อบัญชี</span>
                <div className="min-w-0 flex-1 rounded-xl border border-[#e1bee7] bg-white px-3 py-2">
                  <span className="text-sm font-semibold text-[#4a148c] truncate block">{linkedBank.accountHolderName}</span>
                </div>
              </div>

              <div className="rounded-xl border border-[#e1bee7] bg-white p-3 space-y-3">
                <p className="text-xs font-black uppercase tracking-wider text-[#6a1b9a]/75">
                  ตรวจสอบความถูกต้องชื่อบัญชีและเลขบัญชี
                </p>
                <div className="rounded-xl bg-[#fcf7fd] p-3 space-y-3">
                  <p className="text-xs font-black uppercase tracking-wider text-[#6a1b9a]/75">
                    เอกสารที่แนบเพื่อยืนยันตัวตน
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="rounded-xl border border-[#ead8ef] bg-white p-3">
                      <p className="text-xs font-bold text-[#6a1b9a]/70 mb-2">บัตรประชาชน</p>
                      {idCardFileId ? (
                        <div className="space-y-2">
                          <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden border border-[#f1dff5] bg-[#faf5fc]">
                            <Image
                              src={idCardPreviewSrc}
                              alt="เอกสารบัตรประชาชน"
                              fill
                              className="object-contain"
                              unoptimized
                            />
                          </div>
                          <a
                            href={idCardViewUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-center w-full px-3 py-2 rounded-lg text-xs font-bold border border-[#e1bee7] text-[#6a1b9a] hover:bg-[#f3e5f5]"
                          >
                            เปิดเอกสาร
                          </a>
                        </div>
                      ) : (
                        <p className="text-xs text-[#6a1b9a]/60">ไม่มีเอกสารแนบ</p>
                      )}
                    </div>
                    <div className="rounded-xl border border-[#ead8ef] bg-white p-3">
                      <p className="text-xs font-bold text-[#6a1b9a]/70 mb-2">สมุดบัญชีธนาคาร</p>
                      {bankBookFileId ? (
                        <div className="space-y-2">
                          <div className="relative w-full aspect-[4/3] rounded-lg overflow-hidden border border-[#f1dff5] bg-[#faf5fc]">
                            <Image
                              src={bankBookPreviewSrc}
                              alt="เอกสารสมุดบัญชีธนาคาร"
                              fill
                              className="object-contain"
                              unoptimized
                            />
                          </div>
                          <a
                            href={bankBookViewUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-center w-full px-3 py-2 rounded-lg text-xs font-bold border border-[#e1bee7] text-[#6a1b9a] hover:bg-[#f3e5f5]"
                          >
                            เปิดเอกสาร
                          </a>
                        </div>
                      ) : (
                        <p className="text-xs text-[#6a1b9a]/60">ไม่มีเอกสารแนบ</p>
                      )}
                    </div>
                  </div>
                </div>
                {linkedBank.status === "pending" && isAdmin ? (
                  <textarea
                    value={reviewReason}
                    onChange={(e) => setReviewReason(e.target.value)}
                    placeholder="เหตุผลกรณีไม่อนุมัติ (บังคับกรอกเมื่อกดไม่อนุมัติ)"
                    className="w-full min-h-20 rounded-xl border border-[#e1bee7] bg-[#faf5fc] px-3 py-2 text-sm text-[#4a148c] placeholder:text-[#6a1b9a]/40 focus:outline-none focus:border-[#8e24aa]/50"
                  />
                ) : null}
                {linkedBank.status === "rejected" && linkedBank.reviewReason ? (
                  <p className="text-xs text-rose-600">
                    เหตุผลล่าสุด: {linkedBank.reviewReason}
                  </p>
                ) : null}
                {linkedBank.status === "pending" && isAdmin ? (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={reviewSubmitting !== null}
                      onClick={() => reviewBankAccount("approve")}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:brightness-110 disabled:opacity-60"
                    >
                      <CheckCircle2 size={14} />
                      อนุมัติบัญชี
                    </button>
                    <button
                      type="button"
                      disabled={reviewSubmitting !== null}
                      onClick={() => reviewBankAccount("reject")}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-rose-600 text-white hover:brightness-110 disabled:opacity-60"
                    >
                      <XCircle size={14} />
                      ไม่อนุมัติ
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-[#6a1b9a]/60">
                    {isReviewer
                      ? "สิทธิ์ตรวจสอบดูเอกสารได้ แต่ไม่สามารถอนุมัติหรือไม่อนุมัติได้"
                      : "ตรวจสอบรายการนี้แล้ว หากต้องการแก้ผลตรวจสอบให้รีเฟรชหน้าแล้วตรวจอีกครั้ง"}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white border border-[#e1bee7] rounded-3xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#e1bee7] flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base md:text-lg font-black text-[#4a148c]">
              ตารางแคมเปญที่สมาชิกแชร์
            </h2>
            <p className="text-xs text-[#6a1b9a]/60 mt-1 max-w-xl">
              รายการแยกตามแคมเปญ พร้อมแยกยอดจากเราแชร์เองและยอดโบนัสจากเพื่อนที่ใช้รหัสแนะนำ
              {shareFilter === "all" ? (
                <>
                  {" "}
                  — แถวสีอ่อนด้านล่างแต่ละแคมเปญคือรางวัลครั้งแรกเมื่อเพื่อนแชร์ (รายละเอียดตามเพื่อน) ยอดรวมท้ายตารางยังเป็นสรุปตามแคมเปญเท่านั้น
                </>
              ) : (
                <> — กำลังแสดงเฉพาะรายการรางวัลแนะนำเพื่อนครั้งแรก</>
              )}
            </p>
          </div>
          <div className="flex shrink-0 rounded-2xl border border-[#e1bee7] bg-[#faf5fc] p-1">
            <button
              type="button"
              onClick={() => setShareFilter("all")}
              className={`rounded-xl px-4 py-2 text-xs font-black transition-colors ${
                shareFilter === "all"
                  ? "bg-white text-[#8e24aa] shadow-sm"
                  : "text-[#6a1b9a]/70 hover:text-[#4a148c]"
              }`}
            >
              ทั้งหมด
            </button>
            <button
              type="button"
              onClick={() => setShareFilter("referral_only")}
              className={`rounded-xl px-4 py-2 text-xs font-black transition-colors ${
                shareFilter === "referral_only"
                  ? "bg-white text-[#8e24aa] shadow-sm"
                  : "text-[#6a1b9a]/70 hover:text-[#4a148c]"
              }`}
            >
              รายการแนะนำเพื่อน
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px]">
            <thead className="bg-[#faf5fc] border-b border-[#e1bee7]">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-[#6a1b9a]/75">แคมเปญ</th>
                <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-[#6a1b9a]/75">จำนวนครั้งที่แชร์</th>
                <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-[#6a1b9a]/75">ได้จากเราแชร์</th>
                <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-[#6a1b9a]/75">ได้จากเพื่อนแชร์</th>
                <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-[#6a1b9a]/75">ยอดรวม</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1dff5]">
              {shareTableModel.shareTableRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-sm text-[#6a1b9a]/65 font-bold">
                    {shareFilter === "referral_only"
                      ? "ยังไม่มีรายการรางวัลแนะนำเพื่อนครั้งแรก หรือเพื่อนยังไม่ได้แชร์แคมเปญแรกหลังใช้รหัสแนะนำ"
                      : "ยังไม่มีข้อมูลการแชร์แคมเปญ"}
                  </td>
                </tr>
              ) : (
                shareTableModel.shareTableRows.map((entry) =>
                  entry.kind === "campaign" ? (
                    <tr key={`c-${entry.row.campaignId}`} className="hover:bg-[#fcf7fd] transition-colors">
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-[#4a148c]">{entry.row.campaignName}</p>
                        <p className="text-[11px] text-[#6a1b9a]/55">Campaign ID: {entry.row.campaignId}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-[#4a148c]">
                        {entry.row.shareCount.toLocaleString("th-TH")} ครั้ง
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-sky-700">
                        {money.format(entry.row.ownShareEarned)}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-emerald-700">
                        {money.format(entry.row.referralEarned)}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-[#8e24aa]">
                        {money.format(entry.row.totalEarned)}
                      </td>
                    </tr>
                  ) : (
                    <tr
                      key={`r-${entry.friend.id}-${entry.friend.rewardCampaignId}`}
                      className="bg-emerald-50/40 hover:bg-emerald-50/70 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <p className="text-xs font-black uppercase tracking-wide text-emerald-800/90">
                          รางวัลแนะนำเพื่อนครั้งแรก
                        </p>
                        <p className="text-sm font-bold text-[#4a148c] mt-1">{entry.friend.rewardCampaignName}</p>
                        <p className="text-[11px] text-[#6a1b9a]/55">Campaign ID: {entry.friend.rewardCampaignId}</p>
                        <p className="text-[11px] text-[#6a1b9a]/70 mt-1">
                          เพื่อนที่ใช้รหัสเรา: <span className="font-bold text-[#4a148c]">{entry.friend.name}</span>{" "}
                          <span className="text-[#6a1b9a]/50">({entry.friend.referralCode})</span>
                        </p>
                        <p className="text-[10px] text-[#6a1b9a]/55 mt-0.5">
                          เวลาที่ได้รับรางวัล: {formatThaiDateTime(entry.friend.rewardClaimedAt)}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-sm text-[#6a1b9a]/70">ครั้งแรก</td>
                      <td className="px-6 py-4 text-sm text-[#6a1b9a]/45">—</td>
                      <td className="px-6 py-4 text-sm font-bold text-emerald-700">
                        {money.format(entry.friend.rewardAmount)}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-[#8e24aa]">
                        {money.format(entry.friend.rewardAmount)}
                      </td>
                    </tr>
                  )
                )
              )}
            </tbody>
            <tfoot>
              <tr className="bg-[#faf5fc] border-t border-[#e1bee7]">
                <td className="px-6 py-4 text-sm font-black text-[#4a148c]" colSpan={2}>
                  {shareFilter === "referral_only" ? "รวมรายการแนะนำเพื่อน" : "รวมจากแคมเปญทั้งหมด"}
                </td>
                <td className="px-6 py-4 text-sm font-black text-sky-700">
                  {money.format(shareTableModel.footerOwnShareEarned)}
                </td>
                <td className="px-6 py-4 text-sm font-black text-emerald-700">
                  {money.format(shareTableModel.footerReferralEarned)}
                </td>
                <td className="px-6 py-4 text-sm font-black text-[#8e24aa]">
                  {money.format(shareTableModel.footerTotalEarned)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="bg-white border border-[#e1bee7] rounded-3xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#e1bee7]">
          <h2 className="text-base md:text-lg font-black text-[#4a148c]">ประวัติการโอนเงิน</h2>
          <p className="text-xs text-[#6a1b9a]/60 mt-1">
            {isAdmin
              ? "ถ้ายังเป็นรอดำเนินการ สามารถกดยืนยันโอนเพื่อตัดยอดล่าสุดได้"
              : "สิทธิ์ตรวจสอบดูข้อมูลการโอนเงินได้ แต่ไม่สามารถยืนยันโอนได้"}
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead className="bg-[#faf5fc] border-b border-[#e1bee7]">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-[#6a1b9a]/75">รหัสรายการ</th>
                <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-[#6a1b9a]/75">วันที่</th>
                <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-[#6a1b9a]/75">ยอดเงิน</th>
                <th className="px-6 py-4 text-left text-xs font-black uppercase tracking-wider text-[#6a1b9a]/75">สถานะ</th>
                <th className="px-6 py-4 text-right text-xs font-black uppercase tracking-wider text-[#6a1b9a]/75">จัดการ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1dff5]">
              {transferHistory.map((transfer) => (
                <tr key={transfer.id} className="hover:bg-[#fcf7fd] transition-colors">
                  <td className="px-6 py-4 text-sm font-bold text-[#4a148c]">{transfer.id}</td>
                  <td className="px-6 py-4 text-sm text-[#6a1b9a]/80">{transfer.date}</td>
                  <td className="px-6 py-4 text-sm font-bold text-[#8e24aa]">{money.format(transfer.amount)}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider ${
                        transfer.status === "Completed"
                          ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                          : "bg-amber-100 text-amber-700 border border-amber-200"
                      }`}
                    >
                      {transfer.status === "Completed" ? "โอนแล้ว" : "รอโอน"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {transfer.status === "Pending" && isAdmin ? (
                      <button
                        type="button"
                        onClick={() => confirmTransfer(transfer.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-[#8e24aa] text-white hover:brightness-110 transition-all"
                      >
                        <CheckCircle2 size={14} />
                        ยืนยันโอน
                      </button>
                    ) : (
                      <span className="text-xs text-[#6a1b9a]/50">เรียบร้อย</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
