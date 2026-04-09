"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";
import liff from "@line/liff";

import {
  assertFlexShareMessageReady,
  buildFlexShareMessageForLiff,
  normalizeFlexForShare,
  type FlexShareMessage,
} from "@/lib/flexMessage";
import { buildCampaignShareLiffUrl } from "@/lib/liffShare";
import {
  clearPendingShareCampaign,
  getPendingShareCampaign,
  setPendingShareCampaign,
} from "@/lib/sharePendingCampaign";

/** รองรับแบบ line_flex_tem: query บางครั้งไปอยู่ใน hash หลัง # — อ่าน hash ครั้งแรกแบบ sync */
function useQueryAndHashParams() {
  const search = useSearchParams();
  const [hashParams, setHashParams] = useState<URLSearchParams>(() => {
    if (typeof window === "undefined") return new URLSearchParams();
    return new URLSearchParams(window.location.hash.replace(/^#/, ""));
  });

  useEffect(() => {
    const read = () =>
      new URLSearchParams(window.location.hash.replace(/^#/, ""));
    setHashParams(read());
    const onHash = () => setHashParams(read());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const get = useCallback(
    (key: string) => {
      const q = search.get(key)?.trim() ?? "";
      if (q) return q;
      return hashParams.get(key)?.trim() ?? "";
    },
    [search, hashParams]
  );

  return get;
}

function extractCampaignIdFromLiffState(raw: string): string {
  const value = raw.trim();
  if (!value) return "";

  const tryRead = (input: string) => {
    try {
      const url = new URL(input, "https://liff.local");
      const pathMatch = url.pathname.match(/^\/(?:share\/)?([^/]+)\/?$/);
      if (pathMatch?.[1]) {
        const seg = decodeURIComponent(pathMatch[1]).trim();
        if (seg && seg !== "share") {
          return seg;
        }
      }
      const fromQuery =
        url.searchParams.get("campaignId")?.trim() ||
        url.searchParams.get("name")?.trim() ||
        "";
      return fromQuery;
    } catch {
      return "";
    }
  };

  return tryRead(value) || tryRead(decodeURIComponent(value)) || "";
}

async function waitForLiffSdk(maxAttempts = 20, delayMs = 200) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const maybeWindow = typeof window !== "undefined" ? (window as Window & { liff?: unknown }) : null;
    if (maybeWindow?.liff) {
      return;
    }
    await new Promise((resolve) => window.setTimeout(resolve, delayMs));
  }
}

export type Phase = "loading" | "ready" | "error" | "shared";

type Props = {
  /** จาก dynamic route /share/[campaignId] — LINE/LIFF มักส่ง path ได้มากกว่า query */
  campaignIdFromPath?: string;
};

type ShareWarningDialog = {
  title: string;
  body: string;
} | null;

/** LIFF คืน { status: 'success' } เมื่อส่งสำเร็จ (บางเวอร์ชันอาจคืน true) */
function isShareTargetPickerSuccess(result: unknown): boolean {
  if (result === true) return true;
  if (result == null || typeof result !== "object") return false;
  return (result as { status?: string }).status === "success";
}

function mapRecordShareWarning(error?: string, message?: string): ShareWarningDialog {
  switch (error) {
    case "campaign_user_daily_reward_limit_reached":
      return {
        title: "ครบเพดานรายวันแล้ว",
        body: "วันนี้คุณได้รับเงินจากแคมเปญนี้ครบตามที่กำหนดแล้ว สามารถแชร์ใหม่ได้ในวันถัดไปหากยังไม่เกินเพดานรวมของแคมเปญ",
      };
    case "campaign_user_reward_limit_reached":
      return {
        title: "ครบเพดานของแคมเปญแล้ว",
        body: "คุณได้รับเงินจากแคมเปญนี้ครบตามสิทธิ์สูงสุดแล้ว จึงไม่สามารถรับเงินเพิ่มจากแคมเปญนี้ได้อีก",
      };
    case "quota_exhausted":
      return {
        title: "โควต้าแคมเปญเต็มแล้ว",
        body: "แคมเปญนี้มีผู้ใช้รับสิทธิ์ครบตามโควต้าแล้ว จึงไม่สามารถรับเงินจากการแชร์ครั้งนี้ได้",
      };
    case "budget_exhausted":
      return {
        title: "งบแคมเปญไม่พอ",
        body: "งบของแคมเปญนี้ถูกใช้ครบหรือเหลือไม่พอสำหรับการจ่ายรางวัลแล้ว",
      };
    case "sponsor_budget_not_configured":
      return {
        title: "ยังไม่ได้ตั้งงบสปอนเซอร์",
        body: "สปอนเซอร์ต้องตั้งงบโฆษณารวมในระบบก่อน จึงจะจ่ายรางวัลจากการแชร์ได้ — ติดต่อผู้ดูแล",
      };
    case "inactive":
      return {
        title: "แคมเปญยังไม่เปิดรับ",
        body: "แคมเปญนี้ไม่ได้อยู่ในสถานะที่รับการแชร์เพื่อรับรางวัลในตอนนี้",
      };
    default:
      if (!error && !message) return null;
      return {
        title: "บันทึกรางวัลไม่สำเร็จ",
        body: message || "ระบบไม่สามารถบันทึกสิทธิ์รับเงินจากการแชร์ครั้งนี้ได้",
      };
  }
}

async function precheckShareEligibility(campaignId: string): Promise<ShareWarningDialog> {
  const idToken = await liff.getIDToken();
  if (!idToken) {
    return {
      title: "ไม่สามารถตรวจสอบสิทธิ์ได้",
      body: "ระบบไม่พบ LINE token สำหรับตรวจสอบสิทธิ์ก่อนแชร์ กรุณาลองเข้าสู่ระบบใหม่แล้วทำรายการอีกครั้ง",
    };
  }

  const res = await fetch(`/api/campaigns/${encodeURIComponent(campaignId)}/share-eligibility`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ idToken }),
  });

  if (res.ok) return null;

  const payload = (await res.json().catch(() => ({}))) as {
    error?: string;
    message?: string;
  };
  return mapRecordShareWarning(payload.error, payload.message);
}

/** สรุปข้อมูลสำคัญจาก Flex message เพื่อแสดงใน UI สำหรับ debug */
function summarizeFlexMessage(msg: FlexShareMessage): string {
  try {
    const contents = msg.contents as Record<string, unknown> | null;
    const hero = contents?.hero as Record<string, unknown> | undefined;
    const heroUrl = typeof hero?.url === "string" ? hero.url.slice(0, 60) : "(ไม่มีรูป)";
    const footer = contents?.footer as Record<string, unknown> | undefined;
    const footerContents = footer?.contents;
    const buttons = Array.isArray(footerContents) ? (footerContents as unknown[]).length : "?";
    return `altText: ${msg.altText} | img: ${heroUrl}... | buttons: ${buttons}`;
  } catch {
    return "(สรุปไม่ได้)";
  }
}

export function ShareContentInner({
  campaignId,
  templateIndex,
}: {
  campaignId: string;
  templateIndex: number;
}) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [message, setMessage] = useState<string>("");
  const [flexMessage, setFlexMessage] = useState<FlexShareMessage | null>(null);
  const [flexSummary, setFlexSummary] = useState<string>("");
  const [showDebugJson, setShowDebugJson] = useState(false);
  const [resolvedLiffId, setResolvedLiffId] = useState<string | null>(null);
  const [shareEndpointIncludesShare, setShareEndpointIncludesShare] =
    useState<boolean>(false);
  const [warningDialog, setWarningDialog] = useState<ShareWarningDialog>(null);

  const runShare = useCallback(
    async (msg: FlexShareMessage) => {
      if (!liff.isInClient()) {
        setPhase("error");
        setMessage("เปิดลิงก์นี้ในแอป LINE เพื่อใช้การแชร์การ์ด");
        return;
      }
      try {
        const eligibilityWarning = await precheckShareEligibility(campaignId);
        if (eligibilityWarning) {
          setPhase("ready");
          setWarningDialog(eligibilityWarning);
          setMessage("ไม่สามารถแชร์เพื่อรับรางวัลได้ในตอนนี้");
          return;
        }

        if (!liff.isApiAvailable("shareTargetPicker")) {
          setPhase("error");
          setMessage(
            "ยังไม่เปิดใช้ Share Target Picker — ตั้งค่าใน LINE Developers → LIFF → Edit → Share target"
          );
          return;
        }

        try {
          assertFlexShareMessageReady(msg);
        } catch (ve) {
          setPhase("error");
          setMessage(ve instanceof Error ? ve.message : String(ve));
          return;
        }

        // Pre-warm: ให้ proxy route compile + cache รูปก่อนที่ LINE จะมาดึง
        try {
          const c = msg.contents as Record<string, unknown> | null;
          const heroUrl = (c?.hero as Record<string, unknown> | undefined)?.url;
          if (typeof heroUrl === "string" && heroUrl.includes("/api/drive-image/")) {
            await fetch(heroUrl, { method: "HEAD" }).catch(() => {});
          }
        } catch { /* ไม่บล็อก share ถ้า pre-warm ล้ม */ }

        console.log("[share] altText:", msg.altText);
        console.log("[share] payload:", JSON.stringify(msg));

        /**
         * ส่งแบบเดียวกับ line_flex_tem Share.jsx:
         * สร้าง object ใหม่แค่ { type, altText, contents: {...} } แล้วส่งตรง
         * ไม่ walk/coerce/deep-clone ซ้ำ — ลดโอกาส LINE silent-reject
         */
        const contents = msg.contents as Record<string, unknown>;
        const toSend = {
          type: "flex" as const,
          altText: msg.altText,
          contents: { ...contents },
        };
        const result = await liff.shareTargetPicker([
          toSend as Parameters<typeof liff.shareTargetPicker>[0][number],
        ]);
        if (isShareTargetPickerSuccess(result)) {
          clearPendingShareCampaign();
          try {
            const idToken = await liff.getIDToken();
            if (idToken) {
              const rec = await fetch(
                `/api/campaigns/${encodeURIComponent(campaignId)}/record-share`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  credentials: "include",
                  body: JSON.stringify({ idToken }),
                }
              );
              if (!rec.ok) {
                const j = (await rec.json().catch(() => ({}))) as {
                  message?: string;
                  error?: string;
                };
                console.warn("[record-share]", rec.status, j);
                setWarningDialog(mapRecordShareWarning(j.error, j.message));
              }
            } else {
              setWarningDialog({
                title: "ยังไม่ได้บันทึกรางวัล",
                body: "แชร์สำเร็จแล้ว แต่ระบบไม่ได้รับ LINE token จึงยังไม่บันทึกรางวัล — ลองปิดแล้วเปิดหน้านี้จากเมนูในแอปอีกครั้ง หรือล็อกอินใหม่แล้วแชร์ซ้ำ",
              });
            }
          } catch (recErr) {
            console.warn("[record-share] request failed", recErr);
            setWarningDialog(
              mapRecordShareWarning(
                "server_error",
                "แชร์สำเร็จแล้ว แต่ระบบไม่สามารถยืนยันสิทธิ์รับเงินได้ในขณะนี้ กรุณาลองตรวจสอบอีกครั้งภายหลัง"
              )
            );
          }
          setPhase("shared");
          setMessage("ส่งการ์ดแล้ว");
        } else {
          setPhase("ready");
          setMessage("ยกเลิกการเลือกแชท");
        }
      } catch (e) {
        const err = e as { message?: string };
        const m =
          err?.message?.includes("shareTargetPicker is not allowed") || false
            ? "LIFF ยังไม่ได้เปิดใช้ Share Target Picker — ตรวจสอบการตั้งค่าใน LINE Developers"
            : err?.message ?? "ไม่สามารถเปิดตัวเลือกแชร์ได้";
        setPhase("error");
        setMessage(m);
      }
    },
    [campaignId]
  );

  useEffect(() => {
    if (!campaignId) {
      setPhase("error");
      setMessage(
        "ลิงก์ไม่ครบ — ต้องมี campaignId ใน path หรือ ?campaignId= / ?name= (รหัสแคมเปญ)"
      );

      return;
    }

    let cancelled = false;

    async function init() {
      setPhase("loading");
      setMessage("กำลังเตรียมการแชร์…");

      try {
        const cfgRes = await fetch("/api/liff/config");
        const cfg = (await cfgRes.json()) as {
          liffId?: string;
          shareEndpointIncludesShare?: boolean;
          error?: string;
        };
        if (!cfgRes.ok || !cfg.liffId) {
          throw new Error(cfg.error ?? "ไม่พบ LIFF ID บนเซิร์ฟเวอร์");
        }

        setResolvedLiffId(cfg.liffId);
        setShareEndpointIncludesShare(cfg.shareEndpointIncludesShare === true);
        await waitForLiffSdk();
        await liff.init({ liffId: cfg.liffId });
        if (cancelled) return;

        if (!liff.isInClient()) {
          setPhase("error");
          setMessage(
            "เบราว์เซอร์นี้ไม่ได้อยู่ในแอป LINE แบบ LIFF — กดปุ่มด้านล่างเพื่อเปิดผ่านลิงก์ LIFF (จะเปิด share target ได้)"
          );
          return;
        }

        if (!liff.isLoggedIn()) {
          setPendingShareCampaign(campaignId, templateIndex);
          liff.login();
          return;
        }

        const flexRes = await fetch(`/api/campaigns/${campaignId}/flex-json`);
        const flexData = (await flexRes.json()) as {
          success?: boolean;
          payload?: unknown;
          shareAltText?: string;
          error?: string;
        };
        if (!flexRes.ok) {
          throw new Error(flexData.error ?? "โหลด Flex JSON ไม่สำเร็จ");
        }

        const idx = Number.isNaN(templateIndex) ? 1 : templateIndex;
        const normalized = normalizeFlexForShare(
          flexData.payload,
          idx,
          flexData.shareAltText
        );
        const msg = buildFlexShareMessageForLiff(normalized);
        if (cancelled) return;

        setFlexMessage(msg);
        setFlexSummary(summarizeFlexMessage(msg));
        await runShare(msg);
      } catch (e) {
        if (cancelled) return;
        setPhase("error");
        setMessage(e instanceof Error ? e.message : String(e));
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [campaignId, templateIndex, runShare]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 py-16 bg-[#f6f7fb] text-[#1a1a1a]">
      <div className="w-full max-w-md rounded-2xl border border-black/5 bg-white p-8 shadow-sm">
        <h1 className="text-lg font-bold tracking-tight text-center mb-2">แชร์การ์ดแคมเปญ</h1>
        <p className="text-xs text-center text-black/50 mb-6 font-medium">
          CardPay · LIFF
        </p>

        {campaignId ? (
          <p className="text-[11px] text-black/40 text-center break-all mb-2">
            campaignId: {campaignId}
          </p>
        ) : null}

        {flexSummary ? (
          <div className="mb-4">
            <p className="text-[10px] text-black/30 text-center break-all leading-relaxed">
              {flexSummary}
            </p>
            <button
              type="button"
              onClick={() => setShowDebugJson((v) => !v)}
              className="mt-1 block mx-auto text-[10px] text-blue-500 underline"
            >
              {showDebugJson ? "ซ่อน JSON" : "ดู JSON"}
            </button>
            {showDebugJson && flexMessage && (
              <pre className="mt-2 max-h-48 overflow-auto rounded bg-gray-100 p-2 text-[9px] text-black/60 break-all whitespace-pre-wrap">
                {JSON.stringify(flexMessage, null, 2)}
              </pre>
            )}
          </div>
        ) : null}

        {phase === "loading" && (
          <p className="text-sm text-center text-black/70">{message || "กำลังโหลด…"}</p>
        )}

        {phase === "error" && (
          <div className="space-y-4">
            <p className="text-sm text-center text-red-700/90">{message}</p>
            {resolvedLiffId && campaignId ? (
              <a
                href={buildCampaignShareLiffUrl(
                  resolvedLiffId,
                  campaignId,
                  Number.isNaN(templateIndex) ? 1 : templateIndex,
                  { endpointIncludesShare: shareEndpointIncludesShare }
                )}
                className="flex w-full py-3 rounded-xl bg-[#06C755] text-white text-sm font-bold hover:brightness-105 items-center justify-center no-underline"
              >
                เปิดแชร์ผ่าน LIFF (แนะนำ)
              </a>
            ) : null}
            {flexMessage && liff.isInClient() && (
              <button
                type="button"
                onClick={() => void runShare(flexMessage)}
                className="w-full py-3 rounded-xl bg-[#8e24aa] text-white text-sm font-bold hover:brightness-105"
              >
                ลองแชร์อีกครั้ง
              </button>
            )}
          </div>
        )}

        {phase === "ready" && (
          <div className="space-y-4">
            <p className="text-sm text-center text-black/70">{message || "พร้อมแชร์"}</p>
            {flexMessage && (
              <button
                type="button"
                onClick={() => void runShare(flexMessage)}
                className="w-full py-3 rounded-xl bg-[#06C755] text-white text-sm font-bold hover:brightness-105"
              >
                แชร์การ์ด
              </button>
            )}
          </div>
        )}

        {phase === "shared" && (
          <p className="text-sm text-center text-[#06C755] font-semibold">{message}</p>
        )}
      </div>

      {warningDialog ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-6">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-base font-bold text-[#4a148c] text-center">
              {warningDialog.title}
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-center text-black/70">
              {warningDialog.body}
            </p>
            <button
              type="button"
              onClick={() => setWarningDialog(null)}
              className="mt-5 w-full rounded-xl bg-[#8e24aa] py-3 text-sm font-bold text-white hover:brightness-105"
            >
              รับทราบ
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ShareContentWithSearch({ campaignIdFromPath }: Props) {
  const pathname = usePathname() ?? "";
  const get = useQueryAndHashParams();
  const idParam = get("id");
  const liffState = get("liff.state");

  /** หลัง hydrate แล้วค่อยอ่าน storage — รองรับหลัง liff.login() ที่ URL หลุด (ดู line_flex_tem Share.jsx) */
  const [mounted, setMounted] = useState(false);
  useLayoutEffect(() => {
    setMounted(true);
  }, []);

  const pending = mounted ? getPendingShareCampaign() : { campaignId: "", templateIndex: 1 };

  /** บางกรณี LIFF ส่ง path มาแต่ dynamic route ไม่ได้รับค่า — ดึงจาก pathname โดยตรง */
  const campaignIdFromPathname = useMemo(() => {
    const m = pathname.match(/^\/share\/([^/]+)\/?$/);
    if (!m?.[1]) return "";
    try {
      const seg = decodeURIComponent(m[1]).trim();
      if (!seg || seg === "share") return "";
      return seg;
    } catch {
      return "";
    }
  }, [pathname]);

  /** campaignId | name — สอดคล้องกับโปรเจกต์อ้างอิงที่ใช้ ?name= เป็นรหัสการ์ด */
  const campaignIdFromUrl = (
    campaignIdFromPath?.trim() ||
    campaignIdFromPathname ||
    extractCampaignIdFromLiffState(liffState) ||
    get("campaignId") ||
    get("name") ||
    ""
  ).trim();

  const campaignId = (campaignIdFromUrl || pending.campaignId || "").trim();

  const templateFromQuery =
    idParam !== "" ? Number.parseInt(idParam, 10) : Number.NaN;
  const templateIndex = Number.isNaN(templateFromQuery)
    ? pending.templateIndex
    : templateFromQuery;

  /** ไม่มี id ใน URL เลย — รอ mount ก่อนค่อยรวม storage ไม่ให้แสดง error ก่อนอ่าน localStorage */
  const waitingForStorageMerge = !mounted && !campaignIdFromUrl;

  if (waitingForStorageMerge) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 py-16 bg-[#f6f7fb] text-[#1a1a1a]">
        <div className="w-full max-w-md rounded-2xl border border-black/5 bg-white p-8 shadow-sm text-center">
          <p className="text-sm text-black/60">กำลังโหลด…</p>
        </div>
      </div>
    );
  }

  return (
    <ShareContentInner
      campaignId={campaignId}
      templateIndex={Number.isNaN(templateIndex) ? 1 : templateIndex}
    />
  );
}

export function ShareContentShell(props: Props) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#f6f7fb] text-black/60 text-sm">
          กำลังโหลด…
        </div>
      }
    >
      <ShareContentWithSearch {...props} />
    </Suspense>
  );
}
