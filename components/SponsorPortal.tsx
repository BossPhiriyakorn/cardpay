"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import Link from "next/link";
import {
  Phone,
  LayoutDashboard,
  BarChart3,
  Wallet,
  MousePointer2,
  ChevronRight,
  ShieldCheck,
  Loader2,
  User,
  Lock,
  Mail,
  Eye,
  EyeOff,
  LogOut,
  Megaphone,
  Share2,
  Table2,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

import { useIsMobile } from "@/hooks/use-mobile";
import type { SponsorChartPoint } from "@/lib/sponsor/dashboard-chart";

type ChartPeriod = "day" | "week" | "month";

type SponsorCampaignStatus = "active" | "paused" | "completed" | "archived";

type SponsorCampaignRow = {
  id: string;
  name: string;
  currentShares: number;
  usedBudget: number;
  status: SponsorCampaignStatus;
};

type DashboardPayload = {
  ok: boolean;
  hasSponsorProfile?: boolean;
  companyName?: string;
  campaigns?: SponsorCampaignRow[];
  totalSharesAllCampaigns?: number;
  selectedCampaignId?: string | null;
  chart?: { period: ChartPeriod; points: SponsorChartPoint[] };
  advertisingTotalBudget?: number;
  advertisingUsedBudget?: number;
  advertisingRemainingBudget?: number;
  /** ลิงก์ติดต่อแอดมิน — จาก CMS (ตั้งค่าแพลตฟอร์ม); ว่างบน client จะ fallback env */
  supportContactUrl?: string;
  error?: string;
};

const CHART_POINT_WIDTH_MOBILE = 44;
const CHART_POINT_WIDTH_DESKTOP = 52;

const SPONSOR_CHART_LINE = "#ce93d8";
const SPONSOR_CHART_DOT = "#8e24aa";
const SPONSOR_CHART_DOT_LAST = "#6a1b9a";
const SPONSOR_CHART_CURSOR = "#ab47bc";

const motionEase = [0.22, 1, 0.36, 1] as const;

const DASH_STAGGER = {
  metricShare: 0.04,
  metricBalance: 0.08,
  metricCta: 0.12,
  metricCampaignCount: 0.16,
  analyticsHeader: 0.22,
  analyticsCampaignSelect: 0.28,
  analyticsPeriod: 0.36,
  analyticsChart: 0.42,
  inactiveCampaignTable: 0.45,
  footer: 0.48,
} as const;

function SponsorLineChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: SponsorChartPoint }>;
}) {
  if (!active || !payload?.[0]?.payload) return null;
  const row = payload[0].payload;

  return (
    <div className="w-max max-w-[min(100vw-24px,200px)] rounded-lg border border-[#e1bee7]/90 bg-white px-2.5 py-1.5 shadow-md shadow-[#e1bee7]/25">
      <p className="text-[11px] font-semibold leading-tight text-slate-700 whitespace-normal">
        {row.dateCompact}
      </p>
      <p className="mt-1 text-xs font-bold leading-tight text-[#4a148c] tabular-nums">
        แชร์ : {row.shares.toLocaleString("th-TH")}
      </p>
    </div>
  );
}

function chartSubtitle(period: ChartPeriod) {
  switch (period) {
    case "day":
      return "สถิติการแชร์รายวัน (จากระบบ)";
    case "week":
      return "สัปดาห์ล่าสุด (7 วัน)";
    case "month":
      return "สถิติการแชร์รายเดือน";
    default:
      return "สถิติการแชร์";
  }
}

const PERIOD_OPTIONS: { value: ChartPeriod; label: string }[] = [
  { value: "day", label: "วัน" },
  { value: "week", label: "สัปดาห์" },
  { value: "month", label: "เดือน" },
];

export default function SponsorPortal() {
  const isMobile = useIsMobile();

  const [authChecking, setAuthChecking] = useState(true);
  const [sponsorAuthed, setSponsorAuthed] = useState(false);

  const [isLoginMode, setIsLoginMode] = useState(true);
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [authSubmitting, setAuthSubmitting] = useState(false);

  const [regUsername, setRegUsername] = useState("");
  const [regCompany, setRegCompany] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [regConfirm, setRegConfirm] = useState("");
  const [regTerms, setRegTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [dash, setDash] = useState<DashboardPayload | null>(null);
  const [dashLoading, setDashLoading] = useState(false);
  const [dashError, setDashError] = useState<string | null>(null);
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [chartPeriod, setChartPeriod] = useState<ChartPeriod>("day");
  /** การ์ดตาราง: ลบแล้ว vs หยุด/จบแล้ว */
  const [inactiveCampaignTab, setInactiveCampaignTab] = useState<"archived" | "paused">("archived");

  const checkSession = useCallback(async () => {
    try {
      const res = await fetch("/api/sponsor/auth/me", { cache: "no-store" });
      const data = (await res.json()) as { ok?: boolean; authenticated?: boolean };
      setSponsorAuthed(res.ok && data.ok === true && data.authenticated === true);
    } catch {
      setSponsorAuthed(false);
    } finally {
      setAuthChecking(false);
    }
  }, []);

  useEffect(() => {
    void checkSession();
  }, [checkSession]);

  const chartData = useMemo(
    () => (dash?.chart?.points?.length ? dash.chart.points : ([] as SponsorChartPoint[])),
    [dash?.chart?.points]
  );

  const campaigns = dash?.campaigns ?? [];

  const campaignsActive = useMemo(
    () => campaigns.filter((c) => c.status === "active"),
    [campaigns]
  );
  const campaignsArchivedOnly = useMemo(
    () => campaigns.filter((c) => c.status === "archived"),
    [campaigns]
  );
  const campaignsPausedOrEnded = useMemo(
    () => campaigns.filter((c) => c.status === "paused" || c.status === "completed"),
    [campaigns]
  );

  const selectedCampaign = useMemo(
    () => campaignsActive.find((c) => c.id === selectedCampaignId) ?? null,
    [campaignsActive, selectedCampaignId]
  );

  const campaignSpendFormatter = useMemo(
    () =>
      new Intl.NumberFormat("th-TH", {
        style: "currency",
        currency: "THB",
        maximumFractionDigits: 0,
      }),
    []
  );

  const campaignSharesTotal = dash?.totalSharesAllCampaigns ?? 0;
  const advRemaining = Math.max(0, Number(dash?.advertisingRemainingBudget ?? 0));
  const advTotal = Math.max(0, Number(dash?.advertisingTotalBudget ?? 0));
  const advUsed = Math.max(0, Number(dash?.advertisingUsedBudget ?? 0));

  useEffect(() => {
    if (!sponsorAuthed) {
      setDash(null);
      setDashError(null);
      return;
    }

    const ac = new AbortController();
    (async () => {
      setDashLoading(true);
      setDashError(null);
      try {
        const q = new URLSearchParams({ period: chartPeriod });
        if (selectedCampaignId) {
          q.set("campaignId", selectedCampaignId);
        }
        const res = await fetch(`/api/sponsor/dashboard?${q}`, {
          signal: ac.signal,
          cache: "no-store",
        });
        const data = (await res.json()) as DashboardPayload;
        if (ac.signal.aborted) return;
        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? "load_failed");
        }
        setDash(data);
      } catch (e) {
        if (ac.signal.aborted) return;
        const abortedByFetch =
          e instanceof DOMException && e.name === "AbortError";
        if (abortedByFetch) return;
        setDashError(e instanceof Error ? e.message : "โหลดไม่สำเร็จ");
        setDash(null);
      } finally {
        if (!ac.signal.aborted) setDashLoading(false);
      }
    })();

    return () => ac.abort();
  }, [sponsorAuthed, chartPeriod, selectedCampaignId]);

  /** แยกจาก effect โหลด — อย่า setSelectedCampaignId ใน callback ที่ deps มี selectedCampaignId (จะ abort แข่งกันแล้วขึ้น load_failed) */
  useEffect(() => {
    if (!sponsorAuthed || !dash?.campaigns) return;
    const activeIds = (dash.campaigns ?? [])
      .filter((c) => c.status === "active")
      .map((c) => c.id);
    const allowed = new Set(activeIds);
    const serverPick = String(dash.selectedCampaignId ?? "").trim();
    const cur = selectedCampaignId;
    if (cur && allowed.has(cur)) return;
    const next =
      serverPick && allowed.has(serverPick)
        ? serverPick
        : activeIds[0] ?? "";
    if (next !== cur) {
      setSelectedCampaignId(next);
    }
  }, [sponsorAuthed, dash, selectedCampaignId]);

  async function handleLogout() {
    try {
      await fetch("/api/sponsor/auth/logout", { method: "POST" });
    } catch {
      /* ignore */
    }
    setSponsorAuthed(false);
    setDash(null);
    setSelectedCampaignId("");
  }

  const chartScrollRef = useRef<HTMLDivElement>(null);
  const chartAllowsHorizontalScroll = chartPeriod !== "week";
  const chartMinWidthPx = chartAllowsHorizontalScroll
    ? chartData.length * (isMobile ? CHART_POINT_WIDTH_MOBILE : CHART_POINT_WIDTH_DESKTOP)
    : 0;

  useEffect(() => {
    const el = chartScrollRef.current;
    if (!el) return;
    if (chartPeriod === "week") {
      el.scrollLeft = 0;
      return;
    }
    requestAnimationFrame(() => {
      el.scrollLeft = Math.max(0, el.scrollWidth - el.clientWidth);
    });
  }, [chartData, chartPeriod, selectedCampaignId]);

  const { yDomain, yTicks } = useMemo(() => {
    const maxVal = Math.max(...chartData.map((d) => d.shares), 1);
    let upper: number;
    if (maxVal <= 50) {
      upper = Math.max(5, Math.ceil(maxVal * 1.2));
    } else if (maxVal <= 4000) {
      upper = Math.ceil((maxVal * 1.08) / 50) * 50;
    } else if (maxVal <= 30000) {
      upper = Math.ceil((maxVal * 1.08) / 2500) * 2500;
    } else {
      upper = Math.ceil((maxVal * 1.08) / 10000) * 10000;
    }
    const ticks = isMobile
      ? [0, Math.round(upper / 2), upper]
      : [0, Math.round(upper * 0.25), Math.round(upper * 0.5), Math.round(upper * 0.75), upper];
    return { yDomain: [0, upper] as [number, number], yTicks: [...new Set(ticks)].sort((a, b) => a - b) };
  }, [chartData, isMobile]);

  const passwordsMatch = regPassword === regConfirm || regConfirm === "";

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    setAuthSubmitting(true);
    try {
      const res = await fetch("/api/sponsor/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: loginUsername.trim().toLowerCase(),
          password: loginPassword,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setLoginError(
          data.error === "invalid_credentials"
            ? "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง"
            : data.error === "token_config"
              ? "ระบบยังไม่ตั้งค่า SPONSOR_JWT_SECRET (อย่างน้อย 32 ตัวอักษร)"
              : "เข้าสู่ระบบไม่สำเร็จ"
        );
        return;
      }
      setSponsorAuthed(true);
      setLoginPassword("");
    } catch {
      setLoginError("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ");
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoginError("");
    if (!passwordsMatch || regConfirm === "") {
      setLoginError("กรุณายืนยันรหัสผ่านให้ตรงกัน");
      return;
    }
    if (!regTerms) {
      setLoginError("กรุณายอมรับข้อกำหนด");
      return;
    }
    setAuthSubmitting(true);
    try {
      const res = await fetch("/api/sponsor/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: regUsername.trim().toLowerCase(),
          password: regPassword,
          companyName: regCompany.trim(),
          contactEmail: regEmail.trim(),
        }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        const msg =
          data.error === "username_taken"
            ? "ชื่อผู้ใช้นี้ถูกใช้แล้ว"
            : data.error === "invalid_username"
              ? "ไอดี 3–32 ตัว ใช้ a-z ตัวเลข และ _ เท่านั้น"
              : data.error === "password_too_short"
                ? "รหัสผ่านอย่างน้อย 8 ตัว"
                : data.error === "invalid_company_name"
                  ? "กรุณากรอกชื่อบริษัท/องค์กร"
                  : data.error === "invalid_email"
                    ? "รูปแบบอีเมลไม่ถูกต้อง"
                    : "สมัครสมาชิกไม่สำเร็จ";
        setLoginError(msg);
        return;
      }
      const loginRes = await fetch("/api/sponsor/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: regUsername.trim().toLowerCase(),
          password: regPassword,
        }),
      });
      const loginData = (await loginRes.json()) as { ok?: boolean };
      if (!loginRes.ok || !loginData.ok) {
        setLoginError("สมัครสำเร็จแล้ว กรุณาเข้าสู่ระบบด้วยไอดีและรหัสผ่านที่ตั้งไว้");
        setIsLoginMode(true);
        setLoginUsername(regUsername.trim().toLowerCase());
        return;
      }
      setSponsorAuthed(true);
      setRegPassword("");
      setRegConfirm("");
    } catch {
      setLoginError("เชื่อมต่อเซิร์ฟเวอร์ไม่สำเร็จ");
    } finally {
      setAuthSubmitting(false);
    }
  }

  if (authChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center font-prompt bg-gradient-to-b from-[#e1bee7]/35 via-white to-[#fafafa]">
        <Loader2 className="w-10 h-10 text-[#8e24aa] animate-spin" aria-label="กำลังโหลด" />
      </div>
    );
  }

  if (!sponsorAuthed) {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key="auth"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
        >
          <div className="relative min-h-screen flex items-center justify-center p-3 sm:p-4 font-prompt overflow-x-hidden">
            <div
              className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-b from-[#e1bee7]/35 via-white to-[#fafafa]"
              aria-hidden
            />
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-md bg-white rounded-2xl sm:rounded-3xl shadow-2xl shadow-[#e1bee7]/40 overflow-hidden border border-[#e1bee7]/80"
            >
              <div className="bg-gradient-to-br from-[#4a148c] to-[#6a1b9a] p-8 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full opacity-[0.12]">
                  <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] bg-[radial-gradient(circle,white_1px,transparent_1px)] [background-size:20px_20px]" />
                </div>
                <div className="relative z-10 inline-flex items-center justify-center w-16 h-16 bg-[#8e24aa] rounded-2xl mb-4 shadow-lg">
                  <ShieldCheck className="text-white" size={32} />
                </div>
                <h2 className="relative z-10 text-xl font-bold text-white tracking-tight">จัดการโฆษณา</h2>
                <p className="relative z-10 text-[#e1bee7] text-xs font-medium mt-1">
                  Sponsor Portal — แยกจากบัญชี LINE ผู้ใช้ทั่วไป
                </p>
              </div>

              <div className="flex p-2 bg-[#f3e5f5]/80 mx-8 mt-8 rounded-2xl border border-[#e1bee7]/90">
                <button
                  type="button"
                  onClick={() => {
                    setIsLoginMode(true);
                    setLoginError("");
                  }}
                  className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${
                    isLoginMode
                      ? "bg-white text-[#4a148c] shadow-sm ring-1 ring-[#e1bee7]/60"
                      : "text-slate-500 hover:text-[#6a1b9a]"
                  }`}
                >
                  เข้าสู่ระบบ
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsLoginMode(false);
                    setLoginError("");
                  }}
                  className={`flex-1 py-2.5 text-sm font-bold rounded-xl transition-all ${
                    !isLoginMode
                      ? "bg-white text-[#4a148c] shadow-sm ring-1 ring-[#e1bee7]/60"
                      : "text-slate-500 hover:text-[#6a1b9a]"
                  }`}
                >
                  สมัครสมาชิก
                </button>
              </div>

              <div className="p-8">
                <AnimatePresence mode="wait">
                  {isLoginMode ? (
                    <motion.form
                      key="login"
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 12 }}
                      className="space-y-4"
                      onSubmit={handleLogin}
                    >
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-400 uppercase tracking-widest ml-1">
                          ชื่อผู้ใช้
                        </label>
                        <div className="relative">
                          <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                          <input
                            type="text"
                            autoComplete="username"
                            placeholder="เช่น mybrand_official"
                            value={loginUsername}
                            onChange={(e) => {
                              setLoginUsername(e.target.value);
                              setLoginError("");
                            }}
                            className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#8e24aa]/20 focus:border-[#8e24aa]"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-400 uppercase tracking-widest ml-1">
                          รหัสผ่าน
                        </label>
                        <div className="relative">
                          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                          <input
                            type="password"
                            autoComplete="current-password"
                            placeholder="รหัสผ่าน"
                            value={loginPassword}
                            onChange={(e) => {
                              setLoginPassword(e.target.value);
                              setLoginError("");
                            }}
                            className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#8e24aa]/20 focus:border-[#8e24aa]"
                          />
                        </div>
                      </div>
                      {loginError ? (
                        <p className="text-sm font-medium text-red-600 text-center" role="alert">
                          {loginError}
                        </p>
                      ) : null}
                      <button
                        type="submit"
                        disabled={authSubmitting}
                        className="w-full py-4 bg-[#4a148c] hover:bg-[#6a1b9a] disabled:opacity-60 text-white font-black rounded-2xl shadow-xl shadow-[#e1bee7]/60 transition-all mt-4 flex items-center justify-center gap-2"
                      >
                        {authSubmitting ? <Loader2 className="animate-spin" size={20} /> : null}
                        เข้าสู่ระบบ
                        <ChevronRight size={18} />
                      </button>
                    </motion.form>
                  ) : (
                    <motion.form
                      key="register"
                      initial={{ opacity: 0, x: 12 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -12 }}
                      className="space-y-4"
                      onSubmit={handleRegister}
                    >
                      <div className="space-y-1.5">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
                          ชื่อผู้ใช้ (a-z ตัวเลข _)
                        </label>
                        <div className="relative">
                          <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                          <input
                            type="text"
                            autoComplete="username"
                            placeholder="3–32 ตัวอักษร"
                            value={regUsername}
                            onChange={(e) => {
                              setRegUsername(e.target.value);
                              setLoginError("");
                            }}
                            className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#8e24aa]/20 focus:border-[#8e24aa]"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
                          ชื่อบริษัท / องค์กร
                        </label>
                        <input
                          type="text"
                          placeholder="ชื่อที่แสดงในระบบ"
                          value={regCompany}
                          onChange={(e) => {
                            setRegCompany(e.target.value);
                            setLoginError("");
                          }}
                          className="w-full px-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#8e24aa]/20 focus:border-[#8e24aa]"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
                          อีเมล (ไม่บังคับ)
                        </label>
                        <div className="relative">
                          <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                          <input
                            type="email"
                            autoComplete="email"
                            placeholder="contact@company.com"
                            value={regEmail}
                            onChange={(e) => {
                              setRegEmail(e.target.value);
                              setLoginError("");
                            }}
                            className="w-full pl-12 pr-4 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#8e24aa]/20 focus:border-[#8e24aa]"
                          />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
                          รหัสผ่าน
                        </label>
                        <div className="relative">
                          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                          <input
                            type={showPassword ? "text" : "password"}
                            autoComplete="new-password"
                            placeholder="อย่างน้อย 8 ตัว"
                            value={regPassword}
                            onChange={(e) => setRegPassword(e.target.value)}
                            className="w-full pl-12 pr-12 py-3.5 bg-slate-50 border border-slate-100 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#8e24aa]/20 focus:border-[#8e24aa]"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
                          >
                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-black text-slate-400 uppercase tracking-widest ml-1">
                          ยืนยันรหัสผ่าน
                        </label>
                        <div className="relative">
                          <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                          <input
                            type={showConfirmPassword ? "text" : "password"}
                            autoComplete="new-password"
                            placeholder="ยืนยันรหัสผ่าน"
                            value={regConfirm}
                            onChange={(e) => setRegConfirm(e.target.value)}
                            className={`w-full pl-12 pr-12 py-3.5 bg-slate-50 border rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-[#8e24aa]/20 ${
                              !passwordsMatch && regConfirm !== ""
                                ? "border-red-400"
                                : "border-slate-100 focus:border-[#8e24aa]"
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500"
                          >
                            {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                          </button>
                        </div>
                        {!passwordsMatch && regConfirm !== "" ? (
                          <p className="text-[10px] font-bold text-red-500 ml-1">รหัสผ่านไม่ตรงกัน</p>
                        ) : null}
                      </div>
                      <div className="flex items-start gap-3 py-2">
                        <input
                          type="checkbox"
                          id="sponsor-pdpa"
                          checked={regTerms}
                          onChange={(e) => setRegTerms(e.target.checked)}
                          className="mt-1 w-4 h-4 rounded border-slate-300 text-[#8e24aa] focus:ring-[#8e24aa]"
                        />
                        <label htmlFor="sponsor-pdpa" className="text-xs text-slate-500 leading-relaxed">
                          ฉันยอมรับนโยบายความเป็นส่วนตัวและข้อกำหนดการใช้งาน
                        </label>
                      </div>
                      {loginError ? (
                        <p className="text-sm font-medium text-red-600 text-center" role="alert">
                          {loginError}
                        </p>
                      ) : null}
                      <button
                        type="submit"
                        disabled={authSubmitting}
                        className="w-full py-4 bg-[#8e24aa] hover:bg-[#7b1fa2] disabled:opacity-60 text-white font-black rounded-2xl shadow-xl shadow-[#e1bee7]/60 transition-all mt-2 flex items-center justify-center gap-2"
                      >
                        {authSubmitting ? <Loader2 className="animate-spin" size={20} /> : null}
                        สมัครและเข้าใช้งาน
                        <ChevronRight size={18} />
                      </button>
                    </motion.form>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  if (dashError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 font-prompt">
        <p className="text-red-600 font-medium text-center">โหลดแดชบอร์ดไม่สำเร็จ — ลองรีเฟรชหน้า</p>
      </div>
    );
  }

  const companyName = dash?.companyName?.trim() ?? "";
  const sponsorSupportUrl =
    (dash?.supportContactUrl?.trim() ||
      process.env.NEXT_PUBLIC_SPONSOR_SUPPORT_URL?.trim() ||
      "");
  const campaignCount = campaignsActive.length;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="dashboard"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.35 }}
      >
        <div className="relative min-h-screen font-prompt pb-[max(1rem,env(safe-area-inset-bottom))] overflow-x-hidden">
          <div
            className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-b from-[#e1bee7]/30 via-white to-[#fafafa]"
            aria-hidden
          />
          <main className="max-w-7xl mx-auto px-3 sm:px-4 md:px-10 pt-3 sm:pt-5 md:pt-8 pb-4 sm:pb-6 md:pb-10 space-y-4 sm:space-y-6 md:space-y-8">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.38, ease: motionEase }}
              className="flex min-w-0 items-center gap-3 sm:gap-4"
            >
              <div className="shrink-0 w-10 h-10 sm:w-11 sm:h-11 bg-[#8e24aa] rounded-xl sm:rounded-2xl flex items-center justify-center shadow-md shadow-[#8e24aa]/30 text-white">
                <LayoutDashboard className="w-[18px] h-[18px] sm:w-5 sm:h-5" aria-hidden />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-black tracking-tight text-[#4a148c] leading-tight truncate">
                  Sponsor Dashboard
                </h1>
                <p className="text-[10px] sm:text-[11px] text-[#8e24aa] font-bold uppercase tracking-widest mt-0.5">
                  Management Portal
                  {companyName ? ` · ${companyName}` : ""}
                </p>
              </div>
              <div className="ml-auto flex items-start gap-2 shrink-0">
                <div
                  className="flex w-6 shrink-0 items-center justify-center self-stretch pt-2"
                  aria-hidden={!dashLoading}
                >
                  {dashLoading ? (
                    <Loader2 className="h-5 w-5 text-[#8e24aa] animate-spin" aria-label="กำลังโหลด" />
                  ) : null}
                </div>
                <div className="flex w-[min(100%,17.5rem)] sm:w-[17.5rem] flex-col gap-2">
                  {sponsorSupportUrl ? (
                    <a
                      href={sponsorSupportUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex w-full min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-[#e1bee7] bg-white px-3 py-2 text-[11px] sm:text-xs font-bold text-[#6a1b9a] hover:border-[#8e24aa]/40 hover:text-[#8e24aa] transition-colors"
                    >
                      <Phone size={14} aria-hidden />
                      ติดต่อแอดมิน / เติมเงิน
                    </a>
                  ) : (
                    <span
                      className="inline-flex w-full min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-dashed border-[#e1bee7] bg-[#faf8fc] px-3 py-2 text-center text-[10px] sm:text-[11px] font-bold leading-snug text-[#6a1b9a]/70"
                      title="แอดมิน: ตั้งค่าได้ที่ CMS → ตั้งค่า → เนื้อหาสมัครและถอนเงิน → ช่องทางติดต่อแอดมิน — หรือตั้ง NEXT_PUBLIC_SPONSOR_SUPPORT_URL"
                    >
                      <Phone size={14} className="shrink-0" aria-hidden />
                      ติดต่อแอดมิน / เติมเงิน
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleLogout()}
                    className="inline-flex w-full min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-[#e1bee7] bg-white px-3 py-2 text-xs font-bold text-[#6a1b9a] hover:border-[#8e24aa]/40 hover:text-[#8e24aa] transition-colors"
                  >
                    <LogOut size={14} aria-hidden />
                    ออกจากระบบ
                  </button>
                </div>
              </div>
            </motion.div>

            <div className="grid grid-cols-2 gap-2 sm:gap-4 md:gap-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: DASH_STAGGER.metricShare, duration: 0.45, ease: motionEase }}
                className="bg-white p-3 sm:p-6 rounded-2xl sm:rounded-3xl border border-[#e1bee7]/70 shadow-sm shadow-[#f3e5f5]/50 flex items-center gap-2 sm:gap-5 min-h-[88px] sm:min-h-0"
              >
                <div className="w-10 h-10 sm:w-14 sm:h-14 bg-[#f3e5f5] rounded-xl sm:rounded-2xl flex items-center justify-center text-[#8e24aa] shrink-0">
                  <MousePointer2 className="w-5 h-5 sm:w-7 sm:h-7" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-wider sm:tracking-widest mb-0.5 sm:mb-1 leading-snug">
                    จำนวนการแชร์
                  </p>
                  <h3 className="text-lg sm:text-2xl font-bold text-[#4a148c] tabular-nums">
                    {campaignSharesTotal.toLocaleString("th-TH")}
                  </h3>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: DASH_STAGGER.metricBalance, duration: 0.45, ease: motionEase }}
                className="bg-white p-3 sm:p-6 rounded-2xl sm:rounded-3xl border border-[#e1bee7]/70 shadow-sm shadow-[#f3e5f5]/50 flex items-center gap-2 sm:gap-5 min-h-[88px] sm:min-h-0"
              >
                <div className="w-10 h-10 sm:w-14 sm:h-14 bg-[#f3e5f5] rounded-xl sm:rounded-2xl flex items-center justify-center text-[#8e24aa] shrink-0">
                  <Wallet className="w-5 h-5 sm:w-6 sm:h-6" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-wider sm:tracking-widest mb-0.5 sm:mb-1 leading-snug">
                    ยอดเงินคงเหลือ
                  </p>
                  <p className="text-lg sm:text-2xl font-black tabular-nums text-[#4a148c] leading-tight truncate">
                    {advTotal > 0
                      ? `฿${advRemaining.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                      : "—"}
                  </p>
                  <p className="text-[9px] sm:text-[10px] text-slate-400 mt-0.5 tabular-nums leading-snug line-clamp-2">
                    {advTotal > 0 ? (
                      <>
                        ใช้ไป ฿{advUsed.toLocaleString("th-TH")} / กำหนดรวม ฿
                        {advTotal.toLocaleString("th-TH")}
                      </>
                    ) : (
                      <>ยังไม่ได้ตั้งงบรวม — ติดต่อแอดมิน</>
                    )}
                  </p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: DASH_STAGGER.metricCta, duration: 0.45, ease: motionEase }}
                className="min-h-[88px] sm:min-h-[112px]"
              >
                <Link
                  href="/sponsor/campaigns/new"
                  className="flex h-full min-h-[88px] sm:min-h-[112px] items-center justify-center rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#5e35b1] via-[#7b1fa2] to-[#8e24aa] px-4 py-5 sm:px-6 sm:py-8 text-center text-white shadow-lg shadow-[#ce93d8]/35 ring-1 ring-white/15 transition-all hover:brightness-[1.07] hover:shadow-xl hover:shadow-[#ab47bc]/25 active:brightness-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8e24aa] focus-visible:ring-offset-2 focus-visible:ring-offset-[#fafafa]"
                >
                  <span className="text-base sm:text-xl font-black tracking-tight">สร้างแคมเปญ</span>
                </Link>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: DASH_STAGGER.metricCampaignCount, duration: 0.45, ease: motionEase }}
                className="bg-white p-3 sm:p-6 rounded-2xl sm:rounded-3xl border border-[#e1bee7]/70 shadow-sm shadow-[#f3e5f5]/50 flex items-center gap-2 sm:gap-5 min-h-[88px] sm:min-h-[112px]"
              >
                <div className="w-10 h-10 sm:w-14 sm:h-14 bg-[#f3e5f5] rounded-xl sm:rounded-2xl flex items-center justify-center text-[#8e24aa] shrink-0">
                  <Megaphone className="w-5 h-5 sm:w-7 sm:h-7" aria-hidden />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] sm:text-xs font-medium text-slate-400 uppercase tracking-wider sm:tracking-widest mb-0.5 sm:mb-1 leading-snug">
                    จำนวนแคมเปญ
                  </p>
                  <h3 className="text-lg sm:text-2xl font-bold text-[#4a148c] tabular-nums">
                    {campaignCount.toLocaleString("th-TH")}
                  </h3>
                </div>
              </motion.div>
            </div>

            <div className="bg-white rounded-2xl sm:rounded-[2rem] md:rounded-[2.5rem] border border-[#e1bee7]/70 shadow-sm shadow-[#f3e5f5]/40 overflow-hidden">
              <div className="p-4 sm:p-6 md:p-8 border-b border-[#f3e5f5] flex flex-col gap-4 sm:gap-5">
                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: DASH_STAGGER.analyticsHeader, duration: 0.42, ease: motionEase }}
                  className="flex items-start gap-3 sm:gap-4 min-w-0"
                >
                  <div className="shrink-0 p-2.5 sm:p-3 bg-gradient-to-br from-[#4a148c] to-[#8e24aa] rounded-xl sm:rounded-2xl text-white shadow-md shadow-[#e1bee7]/50">
                    <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <div className="min-w-0 flex-1 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <h2 className="text-lg sm:text-xl font-black text-[#4a148c] tracking-tight leading-tight">
                          Campaign Analytics
                        </h2>
                        <Link
                          href="/sponsor/campaigns"
                          className="inline-flex items-center rounded-xl border border-[#e1bee7] bg-[#faf8fc] px-3 py-1.5 text-xs sm:text-sm font-black text-[#6a1b9a] hover:border-[#8e24aa]/45 hover:text-[#8e24aa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8e24aa]/25 shrink-0"
                        >
                          จัดการ
                        </Link>
                      </div>
                      <p className="text-[11px] sm:text-xs text-slate-400 font-medium mt-0.5">
                        {chartSubtitle(chartPeriod)}
                      </p>
                      {campaignsActive.length === 0 && campaigns.length === 0 ? (
                        <p className="text-[10px] sm:text-[11px] text-slate-400/90 mt-1.5">
                          <Link href="/sponsor/campaigns/new" className="font-bold text-[#8e24aa] hover:underline">
                            สร้างแคมเปญแรก
                          </Link>
                          เพื่อเริ่มเก็บสถิติการแชร์
                        </p>
                      ) : null}
                    </div>
                  </div>
                </motion.div>

                {campaignsActive.length > 0 ? (
                  <motion.div
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: DASH_STAGGER.analyticsCampaignSelect, duration: 0.42, ease: motionEase }}
                    className="flex flex-col gap-3 min-w-0"
                  >
                    <label
                      htmlFor="sponsor-campaign-analytics-select"
                      className="text-[11px] sm:text-xs font-black text-slate-400 uppercase tracking-wider sm:tracking-widest shrink-0"
                    >
                      เลือกแคมเปญ (เปิดใช้งาน):
                    </label>
                    <select
                      id="sponsor-campaign-analytics-select"
                      value={selectedCampaignId}
                      onChange={(e) => setSelectedCampaignId(e.target.value)}
                      className="w-full min-h-[48px] bg-[#faf8fc] border border-[#e1bee7]/80 rounded-xl px-3 sm:px-4 py-3 text-sm font-bold text-[#4a148c] focus:outline-none focus:ring-2 focus:ring-[#8e24aa]/25 touch-manipulation"
                    >
                      {campaignsActive.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name || "แคมเปญไม่มีชื่อ"}
                        </option>
                      ))}
                    </select>
                  </motion.div>
                ) : campaigns.length > 0 ? (
                  <p className="text-[11px] sm:text-xs font-bold text-[#6a1b9a]/80">ไม่มีแคมเปญที่เปิดใช้งาน</p>
                ) : null}

                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: DASH_STAGGER.analyticsPeriod, duration: 0.42, ease: motionEase }}
                  className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4 pt-1"
                >
                  <span className="text-[11px] sm:text-xs font-black uppercase tracking-wider text-slate-400 shrink-0">
                    ช่วงเวลากราฟ:
                  </span>
                  <div
                    className="flex w-full sm:w-auto rounded-xl border border-[#e1bee7]/80 bg-[#f3e5f5]/50 p-1 sm:min-w-0"
                    role="group"
                    aria-label="เลือกช่วงเวลาของกราฟ"
                  >
                    {PERIOD_OPTIONS.map(({ value, label }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setChartPeriod(value)}
                        className={`min-h-[44px] flex-1 rounded-lg px-3 py-2.5 text-sm font-bold transition-all touch-manipulation sm:min-w-[88px] ${
                          chartPeriod === value
                            ? "bg-white text-[#4a148c] shadow-sm ring-1 ring-[#e1bee7]/90"
                            : "text-slate-500 hover:text-[#4a148c]"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </motion.div>
              </div>

              {campaigns.length > 0 && selectedCampaign && selectedCampaignId ? (
                <div className="px-3 sm:px-6 md:px-8 pt-4 pb-3 sm:pb-4 grid grid-cols-2 gap-2 sm:gap-4">
                  <div className="bg-white min-w-0 p-2.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-[#e1bee7]/70 shadow-sm shadow-[#f3e5f5]/50 flex items-center gap-2 sm:gap-4 min-h-[88px]">
                    <div className="w-9 h-9 sm:w-12 sm:h-12 bg-[#f3e5f5] rounded-lg sm:rounded-2xl flex items-center justify-center text-[#8e24aa] shrink-0">
                      <Share2 className="w-[18px] h-[18px] sm:w-6 sm:h-6" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[9px] sm:text-xs font-medium text-slate-400 uppercase tracking-wider sm:tracking-widest mb-0.5 leading-snug line-clamp-2">
                        ยอดแชร์แคมเปญนี้
                      </p>
                      <p className="text-lg sm:text-2xl font-black text-[#4a148c] tabular-nums leading-tight">
                        {selectedCampaign.currentShares.toLocaleString("th-TH")}
                      </p>
                      <p className="text-[8px] sm:text-[10px] text-slate-400 mt-0.5 leading-snug line-clamp-2">
                        จำนวนครั้งที่แชร์สะสมของแคมเปญที่เลือก
                      </p>
                    </div>
                  </div>
                  <div className="bg-white min-w-0 p-2.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-[#e1bee7]/70 shadow-sm shadow-[#f3e5f5]/50 flex items-center gap-2 sm:gap-4 min-h-[88px]">
                    <div className="w-9 h-9 sm:w-12 sm:h-12 bg-[#f3e5f5] rounded-lg sm:rounded-2xl flex items-center justify-center text-[#8e24aa] shrink-0">
                      <Wallet className="w-[18px] h-[18px] sm:w-6 sm:h-6" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[9px] sm:text-xs font-medium text-slate-400 uppercase tracking-wider sm:tracking-widest mb-0.5 leading-snug line-clamp-2">
                        งบที่ใช้กับแคมเปญนี้
                      </p>
                      <p className="text-lg sm:text-2xl font-black text-[#4a148c] tabular-nums leading-tight truncate">
                        {campaignSpendFormatter.format(Math.max(0, selectedCampaign.usedBudget))}
                      </p>
                      <p className="text-[8px] sm:text-[10px] text-slate-400 mt-0.5 leading-snug line-clamp-2">
                        ยอดจ่ายรางวัลสะสมผ่านแคมเปญนี้
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: DASH_STAGGER.analyticsChart, duration: 0.48, ease: motionEase }}
                className="px-3 sm:px-6 md:px-8 pb-6 sm:pb-8 md:pb-10 pt-0 w-full"
              >
                {campaigns.length === 0 ? (
                  <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-dashed border-[#e1bee7] bg-[#faf8fc] px-4 py-10 text-center text-sm text-slate-500">
                    ไม่มีข้อมูลกราฟจนกว่าจะมีแคมเปญและมีการบันทึกการแชร์รายวันในระบบ
                  </div>
                ) : campaignsActive.length === 0 ? (
                  <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-dashed border-[#e1bee7] bg-[#faf8fc] px-4 py-10 text-center text-sm text-slate-500">
                    ไม่มีแคมเปญที่เปิดใช้งาน — จึงยังไม่มีกราฟในส่วนนี้ (ดูรายการหยุดหรือลบแล้วในการ์ดด้านล่าง)
                  </div>
                ) : !selectedCampaignId ? (
                  <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-dashed border-[#e1bee7] bg-[#faf8fc] px-4 py-10 text-center text-sm text-slate-500">
                    กำลังโหลดกราฟ…
                  </div>
                ) : chartData.length === 0 ? (
                  <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-dashed border-[#e1bee7] bg-[#faf8fc] px-4 py-10 text-center text-sm text-slate-500">
                    ยังไม่มีข้อมูลการแชร์ในช่วงเวลานี้
                  </div>
                ) : (
                  <>
                    {chartAllowsHorizontalScroll ? (
                      <p className="mb-2 text-center text-[10px] text-slate-400 sm:text-right">
                        เลื่อนซ้าย-ขวาเพื่อดูช่วงเวลาย้อนหลังที่หลุดกรอบ
                      </p>
                    ) : null}
                    <div
                      ref={chartScrollRef}
                      className={`w-full overflow-y-hidden rounded-lg border border-transparent ${
                        chartAllowsHorizontalScroll
                          ? "overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] scroll-smooth touch-pan-x"
                          : "overflow-x-hidden"
                      }`}
                      style={chartAllowsHorizontalScroll ? { scrollbarGutter: "stable" } : undefined}
                    >
                      <div
                        className="h-[min(30vh,240px)] min-h-[200px] sm:h-[220px] md:h-[260px] [&_.recharts-wrapper]:!overflow-visible [&_.recharts-surface]:overflow-visible"
                        style={
                          chartAllowsHorizontalScroll
                            ? { width: `max(100%, ${chartMinWidthPx}px)`, minWidth: "100%" }
                            : { width: "100%" }
                        }
                      >
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart
                            data={chartData}
                            style={{ overflow: "visible" }}
                            margin={
                              isMobile
                                ? {
                                    top: 52,
                                    right: 10,
                                    left: 8,
                                    bottom: chartPeriod === "month" ? 16 : chartPeriod === "week" ? 10 : 12,
                                  }
                                : {
                                    top: 56,
                                    right: 14,
                                    left: 8,
                                    bottom: chartPeriod === "month" ? 14 : chartPeriod === "week" ? 10 : 12,
                                  }
                            }
                          >
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ede7f6" />
                            <XAxis
                              dataKey="date"
                              axisLine={false}
                              tickLine={false}
                              tick={{ fill: "#94a3b8", fontSize: isMobile ? 9 : 11, fontWeight: 600 }}
                              dy={isMobile ? 6 : 10}
                              interval={0}
                              angle={
                                chartPeriod === "week"
                                  ? 0
                                  : chartPeriod === "month" || chartData.length > 12
                                    ? -40
                                    : 0
                              }
                              textAnchor={
                                chartPeriod === "week"
                                  ? "middle"
                                  : chartPeriod === "month" || chartData.length > 12
                                    ? "end"
                                    : "middle"
                              }
                              height={
                                chartPeriod === "week"
                                  ? undefined
                                  : chartPeriod === "month" || chartData.length > 12
                                    ? isMobile
                                      ? 58
                                      : 50
                                    : undefined
                              }
                            />
                            <YAxis
                              domain={yDomain}
                              ticks={yTicks}
                              width={isMobile ? 40 : 52}
                              axisLine={false}
                              tickLine={false}
                              tick={{ fill: "#94a3b8", fontSize: isMobile ? 10 : 11, fontWeight: 600 }}
                              tickFormatter={(v) =>
                                v >= 10000
                                  ? `${Math.round(v / 1000).toLocaleString("th-TH")}k`
                                  : v.toLocaleString("th-TH")
                              }
                            />
                            <Tooltip
                              isAnimationActive={false}
                              allowEscapeViewBox={{ x: false, y: true }}
                              offset={10}
                              cursor={{ stroke: SPONSOR_CHART_CURSOR, strokeWidth: 1, strokeDasharray: "4 4" }}
                              wrapperStyle={{
                                padding: 0,
                                margin: 0,
                                border: "none",
                                boxShadow: "none",
                                background: "transparent",
                              }}
                              content={(props) => (
                                <SponsorLineChartTooltip active={props.active} payload={props.payload} />
                              )}
                            />
                            <Line
                              type="linear"
                              dataKey="shares"
                              stroke={SPONSOR_CHART_LINE}
                              strokeWidth={3}
                              strokeOpacity={1}
                              fill="none"
                              isAnimationActive={chartAllowsHorizontalScroll ? false : "auto"}
                              animationBegin={0}
                              animationDuration={550}
                              animationEasing="ease-out"
                              connectNulls
                              dot={(props) => {
                                const { cx, cy, index } = props;
                                if (cx == null || cy == null || index == null) return null;
                                const isLast = index === chartData.length - 1;
                                return (
                                  <circle
                                    key={`dot-${index}`}
                                    cx={cx}
                                    cy={cy}
                                    r={isLast ? (isMobile ? 5 : 6) : isMobile ? 4 : 5}
                                    fill={isLast ? SPONSOR_CHART_DOT_LAST : SPONSOR_CHART_DOT}
                                    stroke="#ffffff"
                                    strokeWidth={2}
                                    className={isLast ? undefined : "hover:fill-[#8e24aa] transition-colors"}
                                  />
                                );
                              }}
                              activeDot={{ r: 9, fill: SPONSOR_CHART_DOT, stroke: "#fff", strokeWidth: 2 }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </>
                )}
              </motion.div>
            </div>

            {campaignsArchivedOnly.length > 0 || campaignsPausedOrEnded.length > 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: DASH_STAGGER.inactiveCampaignTable, duration: 0.42, ease: motionEase }}
                className="bg-white rounded-2xl sm:rounded-[2rem] md:rounded-[2.5rem] border border-[#e1bee7]/70 shadow-sm shadow-[#f3e5f5]/40 overflow-hidden"
              >
                <div className="p-4 sm:p-6 md:p-8 border-b border-[#f3e5f5] space-y-4">
                  <div className="flex flex-wrap items-start gap-3 sm:gap-4 min-w-0">
                    <div className="shrink-0 p-2.5 sm:p-3 bg-[#f3e5f5] rounded-xl sm:rounded-2xl text-[#8e24aa]">
                      <Table2 className="w-5 h-5 sm:w-6 sm:h-6" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="text-lg sm:text-xl font-black text-[#4a148c] tracking-tight leading-tight">
                        แคมเปญที่ไม่ได้เปิดใช้งาน
                      </h2>
                    </div>
                  </div>
                  <div
                    className="flex w-full max-w-md rounded-xl border border-[#e1bee7]/80 bg-[#f3e5f5]/50 p-1"
                    role="tablist"
                    aria-label="เลือกประเภทแคมเปญ"
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={inactiveCampaignTab === "archived"}
                      onClick={() => setInactiveCampaignTab("archived")}
                      className={`min-h-[40px] flex-1 rounded-lg px-3 py-2 text-xs sm:text-sm font-black transition-all ${
                        inactiveCampaignTab === "archived"
                          ? "bg-white text-[#4a148c] shadow-sm ring-1 ring-[#e1bee7]/90"
                          : "text-slate-500 hover:text-[#4a148c]"
                      }`}
                    >
                      ลบแล้ว ({campaignsArchivedOnly.length})
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={inactiveCampaignTab === "paused"}
                      onClick={() => setInactiveCampaignTab("paused")}
                      className={`min-h-[40px] flex-1 rounded-lg px-3 py-2 text-xs sm:text-sm font-black transition-all ${
                        inactiveCampaignTab === "paused"
                          ? "bg-white text-[#4a148c] shadow-sm ring-1 ring-[#e1bee7]/90"
                          : "text-slate-500 hover:text-[#4a148c]"
                      }`}
                    >
                      หยุด / จบแล้ว ({campaignsPausedOrEnded.length})
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto px-3 sm:px-6 md:px-8 pb-6 sm:pb-8">
                  {inactiveCampaignTab === "archived" ? (
                    campaignsArchivedOnly.length === 0 ? (
                      <p className="text-sm text-slate-500 py-6 text-center">ไม่มีแคมเปญที่ลบแล้ว</p>
                    ) : (
                      <table className="w-full min-w-[520px] text-left text-sm">
                        <thead className="bg-[#faf8fc] border-y border-[#e1bee7]">
                          <tr>
                            <th className="px-3 py-3 text-[11px] font-black uppercase text-[#6a1b9a]">
                              แคมเปญ
                            </th>
                            <th className="px-3 py-3 text-[11px] font-black uppercase text-[#6a1b9a] tabular-nums">
                              แชร์
                            </th>
                            <th className="px-3 py-3 text-[11px] font-black uppercase text-[#6a1b9a] tabular-nums">
                              งบที่ใช้
                            </th>
                            <th className="px-3 py-3 text-right text-[11px] font-black uppercase text-[#6a1b9a]">
                              ดูข้อมูล
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#f3e5f5]">
                          {campaignsArchivedOnly.map((c) => (
                            <tr key={c.id} className="hover:bg-[#faf8fc]/80">
                              <td className="px-3 py-3 font-bold text-[#4a148c]">{c.name || "—"}</td>
                              <td className="px-3 py-3 tabular-nums text-[#4a148c]">
                                {c.currentShares.toLocaleString("th-TH")}
                              </td>
                              <td className="px-3 py-3 tabular-nums text-[#4a148c]">
                                {campaignSpendFormatter.format(Math.max(0, c.usedBudget))}
                              </td>
                              <td className="px-3 py-3 text-right">
                                <Link
                                  href={`/sponsor/campaigns/${c.id}/edit`}
                                  className="inline-flex rounded-xl border border-[#e1bee7] bg-white px-3 py-1.5 text-xs font-black text-[#6a1b9a] hover:border-[#8e24aa]/40"
                                >
                                  ดู
                                </Link>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )
                  ) : campaignsPausedOrEnded.length === 0 ? (
                    <p className="text-sm text-slate-500 py-6 text-center">ไม่มีแคมเปญที่หยุดหรือจบแล้ว</p>
                  ) : (
                    <table className="w-full min-w-[560px] text-left text-sm">
                      <thead className="bg-[#faf8fc] border-y border-[#e1bee7]">
                        <tr>
                          <th className="px-3 py-3 text-[11px] font-black uppercase text-[#6a1b9a]">
                            แคมเปญ
                          </th>
                          <th className="px-3 py-3 text-[11px] font-black uppercase text-[#6a1b9a]">สถานะ</th>
                          <th className="px-3 py-3 text-[11px] font-black uppercase text-[#6a1b9a] tabular-nums">
                            แชร์
                          </th>
                          <th className="px-3 py-3 text-[11px] font-black uppercase text-[#6a1b9a] tabular-nums">
                            งบที่ใช้
                          </th>
                          <th className="px-3 py-3 text-right text-[11px] font-black uppercase text-[#6a1b9a]">
                            จัดการ
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#f3e5f5]">
                        {campaignsPausedOrEnded.map((c) => (
                          <tr key={c.id} className="hover:bg-[#faf8fc]/80">
                            <td className="px-3 py-3 font-bold text-[#4a148c]">{c.name || "—"}</td>
                            <td className="px-3 py-3">
                              <span className="inline-flex rounded-full border border-[#e1bee7] bg-white px-2.5 py-0.5 text-[11px] font-black text-[#6a1b9a]">
                                {c.status === "completed" ? "จบแล้ว" : "หยุดชั่วคราว"}
                              </span>
                            </td>
                            <td className="px-3 py-3 tabular-nums text-[#4a148c]">
                              {c.currentShares.toLocaleString("th-TH")}
                            </td>
                            <td className="px-3 py-3 tabular-nums text-[#4a148c]">
                              {campaignSpendFormatter.format(Math.max(0, c.usedBudget))}
                            </td>
                            <td className="px-3 py-3 text-right">
                              <Link
                                href={`/sponsor/campaigns/${c.id}/edit`}
                                className="inline-flex rounded-xl border border-[#e1bee7] bg-white px-3 py-1.5 text-xs font-black text-[#6a1b9a] hover:border-[#8e24aa]/40"
                              >
                                แก้ไข
                              </Link>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </motion.div>
            ) : null}

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: DASH_STAGGER.footer, duration: 0.4, ease: motionEase }}
              className="flex flex-col sm:flex-row items-center justify-center sm:justify-between gap-3 sm:gap-4 text-slate-400 text-[11px] sm:text-xs font-medium pb-6 sm:pb-10 text-center sm:text-left px-1"
            >
              <p>© 2026 CardPay Platform. All rights reserved.</p>
              <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
                <a href="#" className="hover:text-[#8e24aa] transition-colors py-1">
                  Privacy Policy
                </a>
                <a href="#" className="hover:text-[#8e24aa] transition-colors py-1">
                  Terms of Service
                </a>
                <a href="#" className="hover:text-[#8e24aa] transition-colors py-1">
                  Support
                </a>
              </div>
            </motion.div>
          </main>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
