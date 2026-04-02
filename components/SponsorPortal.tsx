"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
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

type SponsorCampaignRow = {
  id: string;
  name: string;
  currentShares: number;
  remainingBudget: number;
  totalBudget: number;
  usedBudget: number;
};

type DashboardPayload = {
  ok: boolean;
  hasSponsorProfile?: boolean;
  companyName?: string;
  campaigns?: SponsorCampaignRow[];
  totalSharesAllCampaigns?: number;
  selectedCampaignId?: string | null;
  chart?: { period: ChartPeriod; points: SponsorChartPoint[] };
  error?: string;
};

const CHART_POINT_WIDTH_MOBILE = 44;
const CHART_POINT_WIDTH_DESKTOP = 52;

const SPONSOR_CHART_LINE = "#ce93d8";
const SPONSOR_CHART_DOT = "#8e24aa";
const SPONSOR_CHART_DOT_LAST = "#6a1b9a";
const SPONSOR_CHART_CURSOR = "#ab47bc";

const CHART_TOOLTIP_SPRING = { type: "spring" as const, stiffness: 300, damping: 35 };

const motionEase = [0.22, 1, 0.36, 1] as const;

const DASH_STAGGER = {
  metricShare: 0.04,
  metricCta: 0.12,
  analyticsHeader: 0.26,
  analyticsDropdown: 0.32,
  analyticsBalance: 0.38,
  analyticsPeriod: 0.44,
  analyticsChart: 0.5,
  footer: 0.56,
} as const;

function SponsorLineChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: SponsorChartPoint }>;
}) {
  const reduceMotion = useReducedMotion();
  if (!active || !payload?.[0]?.payload) return null;
  const row = payload[0].payload;

  const transition = reduceMotion ? { duration: 0.12 } : CHART_TOOLTIP_SPRING;
  const initial = reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 10 };
  const animate = reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 };

  return (
    <motion.div
      key={row.date}
      initial={initial}
      animate={animate}
      transition={transition}
      style={{ transformOrigin: "bottom center" }}
      className="rounded-2xl border border-[#e1bee7]/90 bg-white px-4 py-3 shadow-xl shadow-[#e1bee7]/35"
    >
      <p className="text-xs font-semibold leading-snug text-slate-600">{row.dateFull}</p>
      <p className="mt-2 text-sm font-bold text-[#4a148c]">
        แชร์ <span className="font-medium text-slate-400">:</span>{" "}
        {row.shares.toLocaleString("th-TH")}
      </p>
      <p className="mt-1 text-[11px] text-slate-400">
        การนับคลิกรายวันจะแสดงเมื่อระบบเก็บข้อมูลเพิ่มเติม
      </p>
    </motion.div>
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
  const selectedCampaign = useMemo(
    () => campaigns.find((c) => c.id === selectedCampaignId) ?? null,
    [campaigns, selectedCampaignId]
  );

  const campaignSharesTotal = dash?.totalSharesAllCampaigns ?? 0;
  const campaignRemainingBalance = selectedCampaign?.remainingBudget ?? 0;

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
        if (selectedCampaignId) q.set("campaignId", selectedCampaignId);
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
        if (selectedCampaignId === "" && data.selectedCampaignId) {
          setSelectedCampaignId(data.selectedCampaignId);
        }
      } catch (e) {
        if (ac.signal.aborted) return;
        setDashError(e instanceof Error ? e.message : "โหลดไม่สำเร็จ");
        setDash(null);
      } finally {
        if (!ac.signal.aborted) setDashLoading(false);
      }
    })();

    return () => ac.abort();
  }, [sponsorAuthed, chartPeriod, selectedCampaignId]);

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
              <div className="ml-auto flex items-center gap-2 shrink-0">
                {dashLoading ? (
                  <Loader2 className="w-5 h-5 text-[#8e24aa] animate-spin" aria-hidden />
                ) : null}
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#e1bee7] bg-white px-3 py-2 text-xs font-bold text-[#6a1b9a] hover:border-[#8e24aa]/40 hover:text-[#8e24aa] transition-colors"
                >
                  <LogOut size={14} />
                  ออกจากระบบ
                </button>
              </div>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 md:gap-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: DASH_STAGGER.metricShare, duration: 0.45, ease: motionEase }}
                className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-[#e1bee7]/70 shadow-sm shadow-[#f3e5f5]/50 flex items-center gap-4 sm:gap-5"
              >
                <div className="w-12 h-12 sm:w-14 sm:h-14 bg-[#f3e5f5] rounded-xl sm:rounded-2xl flex items-center justify-center text-[#8e24aa] shrink-0">
                  <MousePointer2 className="w-6 h-6 sm:w-7 sm:h-7" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] sm:text-xs font-medium text-slate-400 uppercase tracking-wider sm:tracking-widest mb-0.5 sm:mb-1 leading-snug">
                    แชร์แล้ว (ทุกแคมเปญ)
                  </p>
                  <h3 className="text-xl sm:text-2xl font-bold text-[#4a148c] tabular-nums">
                    {campaignSharesTotal.toLocaleString("th-TH")}
                  </h3>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: DASH_STAGGER.metricCta, duration: 0.45, ease: motionEase }}
                className="bg-gradient-to-r from-[#8e24aa] to-[#6a1b9a] p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-xl shadow-[#e1bee7]/60 flex flex-row items-center gap-3 sm:gap-5 group cursor-pointer hover:brightness-[1.03] active:brightness-95 transition-colors min-h-[56px]"
              >
                <div className="shrink-0 p-2.5 sm:p-2 bg-white/20 rounded-lg text-white">
                  <Phone className="w-5 h-5" />
                </div>
                <button type="button" className="text-left flex-1 min-w-0 py-1">
                  <p className="text-white font-black text-sm leading-snug">ติดต่อแอดมินเพื่อลงโฆษณา</p>
                  <p className="text-[#e1bee7] text-[10px] font-medium mt-0.5 sm:mt-1">Contact Admin to Advertise</p>
                </button>
                <ChevronRight className="shrink-0 w-5 h-5 text-white/70 group-hover:text-white transition-colors" aria-hidden />
              </motion.div>
            </div>

            <div className="bg-white rounded-2xl sm:rounded-[2rem] md:rounded-[2.5rem] border border-[#e1bee7]/70 shadow-sm shadow-[#f3e5f5]/40 overflow-hidden">
              <div className="p-4 sm:p-6 md:p-8 border-b border-[#f3e5f5] flex flex-col gap-4 sm:gap-5">
                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: DASH_STAGGER.analyticsHeader, duration: 0.42, ease: motionEase }}
                  className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0"
                >
                  <div className="shrink-0 p-2.5 sm:p-3 bg-gradient-to-br from-[#4a148c] to-[#8e24aa] rounded-xl sm:rounded-2xl text-white shadow-md shadow-[#e1bee7]/50">
                    <BarChart3 className="w-5 h-5 sm:w-6 sm:h-6" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-lg sm:text-xl font-black text-[#4a148c] tracking-tight leading-tight">
                      Campaign Analytics
                    </h2>
                    <p className="text-[11px] sm:text-xs text-slate-400 font-medium mt-0.5">
                      {chartSubtitle(chartPeriod)}
                    </p>
                  </div>
                </motion.div>

                <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch lg:gap-4">
                  <motion.div
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: DASH_STAGGER.analyticsDropdown, duration: 0.42, ease: motionEase }}
                    className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3 min-w-0"
                  >
                    <label htmlFor="campaign-select" className="text-[11px] sm:text-xs font-black text-slate-400 uppercase tracking-wider sm:tracking-widest shrink-0 sm:pt-0.5">
                      เลือกแคมเปญ:
                    </label>
                    {campaigns.length === 0 ? (
                      <p
                        id="campaign-select"
                        className="w-full min-h-[48px] flex items-center rounded-xl border border-dashed border-[#e1bee7] bg-[#faf8fc] px-4 text-sm font-medium text-slate-400"
                      >
                        ยังไม่มีแคมเปญ — ติดต่อแอดมินให้สร้างแคมเปญให้คุณ
                      </p>
                    ) : (
                      <select
                        id="campaign-select"
                        value={selectedCampaignId}
                        onChange={(e) => setSelectedCampaignId(e.target.value)}
                        className="w-full min-h-[48px] bg-[#faf8fc] border border-[#e1bee7]/80 rounded-xl px-3 sm:px-4 py-3 text-sm font-bold text-[#4a148c] focus:outline-none focus:ring-2 focus:ring-[#8e24aa]/25 touch-manipulation"
                      >
                        {campaigns.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name || "แคมเปญไม่มีชื่อ"}
                          </option>
                        ))}
                      </select>
                    )}
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: DASH_STAGGER.analyticsBalance, duration: 0.42, ease: motionEase }}
                    className="flex shrink-0 items-center gap-3 rounded-xl border border-[#e1bee7]/80 bg-[#faf8fc] px-4 py-3 min-h-[48px] w-full lg:w-auto lg:min-w-[220px] lg:max-w-[280px]"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#f3e5f5] text-[#8e24aa]">
                      <Wallet className="h-5 w-5" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        ยอดเงินคงเหลือ (แคมเปญนี้)
                      </p>
                      <p className="text-lg font-black tabular-nums text-[#4a148c] leading-tight">
                        ฿
                        {campaignRemainingBalance.toLocaleString("th-TH", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </p>
                    </div>
                  </motion.div>
                </div>

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

              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: DASH_STAGGER.analyticsChart, duration: 0.48, ease: motionEase }}
                className="px-3 sm:px-6 md:px-8 pb-6 sm:pb-8 md:pb-10 pt-0 w-full"
              >
                {campaigns.length === 0 || !selectedCampaignId ? (
                  <div className="flex min-h-[260px] items-center justify-center rounded-xl border border-dashed border-[#e1bee7] bg-[#faf8fc] px-4 py-12 text-center text-sm text-slate-500">
                    ไม่มีข้อมูลกราฟจนกว่าจะมีแคมเปญและมีการบันทึกการแชร์รายวันในระบบ
                  </div>
                ) : chartData.length === 0 ? (
                  <div className="flex min-h-[260px] items-center justify-center rounded-xl border border-dashed border-[#e1bee7] bg-[#faf8fc] px-4 py-12 text-center text-sm text-slate-500">
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
                        className="h-[min(52vh,400px)] min-h-[260px] sm:h-[360px] md:h-[400px] [&_.recharts-wrapper]:!overflow-visible [&_.recharts-surface]:overflow-visible"
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
                                    top: 8,
                                    right: 8,
                                    left: 4,
                                    bottom: chartPeriod === "month" ? 14 : chartPeriod === "week" ? 8 : 10,
                                  }
                                : {
                                    top: 20,
                                    right: 24,
                                    left: 0,
                                    bottom: chartPeriod === "month" ? 12 : chartPeriod === "week" ? 8 : 10,
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
                              isAnimationActive="auto"
                              animationDuration={280}
                              animationEasing="ease-out"
                              cursor={{ stroke: SPONSOR_CHART_CURSOR, strokeWidth: 1, strokeDasharray: "4 4" }}
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
                                    r={isLast ? 7 : 5}
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
