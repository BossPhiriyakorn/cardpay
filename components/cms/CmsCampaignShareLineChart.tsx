"use client";

import { useEffect, useMemo, useRef } from "react";
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
import type {
  SponsorChartPoint,
  SponsorDashboardChartPeriod,
} from "@/lib/sponsor/dashboard-chart";

const CHART_POINT_WIDTH_MOBILE = 44;
const CHART_POINT_WIDTH_DESKTOP = 52;

const LINE = "#f472b6";
const DOT = "#ce93d8";
const DOT_LAST = "#e879f9";
const CURSOR = "rgba(244, 114, 182, 0.6)";

const PERIOD_OPTIONS: { value: SponsorDashboardChartPeriod; label: string }[] = [
  { value: "day", label: "วัน" },
  { value: "week", label: "สัปดาห์" },
  { value: "month", label: "เดือน" },
];

function chartSubtitle(period: SponsorDashboardChartPeriod) {
  switch (period) {
    case "day":
      return "28 วันล่าสุด (โซนเวลาไทย)";
    case "week":
      return "7 วันล่าสุด";
    case "month":
      return "12 เดือนล่าสุด";
    default:
      return "";
  }
}

function CmsShareTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: SponsorChartPoint }>;
}) {
  if (!active || !payload?.[0]?.payload) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-xl border border-white/20 bg-[#1a1028] px-3 py-2.5 shadow-xl">
      <p className="text-[11px] text-zinc-300 leading-tight">{row.dateCompact}</p>
      <p className="mt-1.5 text-sm font-bold text-white">
        แชร์{" "}
        <span className="tabular-nums text-[#f472b6]">
          {row.shares.toLocaleString("th-TH")}
        </span>{" "}
        ครั้ง
      </p>
    </div>
  );
}

type Props = {
  points: SponsorChartPoint[];
  period: SponsorDashboardChartPeriod;
  onPeriodChange: (p: SponsorDashboardChartPeriod) => void;
  /** เมื่อสลับช่วงเวลาโดยไม่โหลดทั้งหน้า */
  refreshing?: boolean;
};

export function CmsCampaignShareLineChart({
  points,
  period,
  onPeriodChange,
  refreshing = false,
}: Props) {
  const isMobile = useIsMobile();
  const chartScrollRef = useRef<HTMLDivElement>(null);
  const chartAllowsHorizontalScroll = period !== "week";
  const chartMinWidthPx = chartAllowsHorizontalScroll
    ? points.length * (isMobile ? CHART_POINT_WIDTH_MOBILE : CHART_POINT_WIDTH_DESKTOP)
    : 0;

  useEffect(() => {
    const el = chartScrollRef.current;
    if (!el) return;
    if (period === "week") {
      el.scrollLeft = 0;
      return;
    }
    requestAnimationFrame(() => {
      el.scrollLeft = Math.max(0, el.scrollWidth - el.clientWidth);
    });
  }, [points, period]);

  const { yDomain, yTicks } = useMemo(() => {
    const maxVal = Math.max(...points.map((d) => d.shares), 1);
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
  }, [points, isMobile]);

  return (
    <div className="bg-[#241335]/70 border border-white/10 rounded-3xl overflow-hidden text-zinc-100">
      <div className="px-5 py-4 border-b border-white/10 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h2 className="text-sm font-black uppercase tracking-widest text-white">
            กราฟการแชร์
          </h2>
          <p className="text-xs text-zinc-400 mt-1">{chartSubtitle(period)}</p>
        </div>
        <div
          className="flex w-full sm:w-auto rounded-xl border border-white/10 bg-black/20 p-1 shrink-0"
          role="group"
          aria-label="เลือกช่วงเวลาของกราฟ"
        >
          {PERIOD_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              disabled={refreshing}
              onClick={() => onPeriodChange(value)}
              className={`min-h-[40px] flex-1 rounded-lg px-3 py-2 text-xs font-bold transition-all sm:min-w-[72px] disabled:opacity-50 ${
                period === value
                  ? "bg-white/15 text-white ring-1 ring-[#f472b6]/50"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className={`p-4 sm:p-5 md:p-6 transition-opacity ${refreshing ? "opacity-60" : ""}`}>
        {points.length === 0 ? (
          <div className="flex min-h-[240px] items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.03] px-4 py-10 text-center text-sm text-zinc-400">
            ยังไม่มีข้อมูลการแชร์รายวันในช่วงนี้ (จะสะสมหลังมีการแชร์ที่บันทึกในระบบ)
          </div>
        ) : (
          <>
            {chartAllowsHorizontalScroll ? (
              <p className="mb-2 text-center text-[10px] text-zinc-500 sm:text-right">
                เลื่อนซ้าย-ขวาเพื่อดูช่วงย้อนหลัง
              </p>
            ) : null}
            <div
              ref={chartScrollRef}
              className={`w-full overflow-y-hidden rounded-xl ${
                chartAllowsHorizontalScroll
                  ? "overflow-x-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] scroll-smooth touch-pan-x"
                  : "overflow-x-hidden"
              }`}
              style={chartAllowsHorizontalScroll ? { scrollbarGutter: "stable" } : undefined}
            >
              <div
                className="h-[min(48vh,360px)] min-h-[220px] sm:h-[320px] md:h-[340px] [&_.recharts-wrapper]:!overflow-visible [&_.recharts-surface]:overflow-visible"
                style={
                  chartAllowsHorizontalScroll
                    ? { width: `max(100%, ${chartMinWidthPx}px)`, minWidth: "100%" }
                    : { width: "100%" }
                }
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={points}
                    margin={
                      isMobile
                        ? {
                            top: 8,
                            right: 6,
                            left: 2,
                            bottom: period === "month" ? 14 : period === "week" ? 8 : 10,
                          }
                        : {
                            top: 16,
                            right: 12,
                            left: 4,
                            bottom: period === "month" ? 12 : period === "week" ? 8 : 10,
                          }
                    }
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.08)" />
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#a1a1aa", fontSize: isMobile ? 9 : 10, fontWeight: 600 }}
                      dy={8}
                      interval={0}
                      angle={period === "week" ? 0 : period === "month" || points.length > 12 ? -35 : 0}
                      textAnchor={
                        period === "week"
                          ? "middle"
                          : period === "month" || points.length > 12
                            ? "end"
                            : "middle"
                      }
                      height={
                        period === "week"
                          ? undefined
                          : period === "month" || points.length > 12
                            ? isMobile
                              ? 52
                              : 44
                            : undefined
                      }
                    />
                    <YAxis
                      domain={yDomain}
                      ticks={yTicks}
                      width={isMobile ? 36 : 48}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: "#a1a1aa", fontSize: isMobile ? 9 : 10, fontWeight: 600 }}
                      tickFormatter={(v) =>
                        v >= 10000
                          ? `${Math.round(v / 1000).toLocaleString("th-TH")}k`
                          : v.toLocaleString("th-TH")
                      }
                    />
                    <Tooltip
                      cursor={{ stroke: CURSOR, strokeWidth: 1, strokeDasharray: "4 4" }}
                      content={(props) => <CmsShareTooltip active={props.active} payload={props.payload} />}
                    />
                    <Line
                      type="linear"
                      dataKey="shares"
                      stroke={LINE}
                      strokeWidth={2.5}
                      dot={(dotProps) => {
                        const { cx, cy, index } = dotProps;
                        if (cx == null || cy == null || index == null) return null;
                        const isLast = index === points.length - 1;
                        return (
                          <circle
                            key={`dot-${index}`}
                            cx={cx}
                            cy={cy}
                            r={isLast ? 6 : 4}
                            fill={isLast ? DOT_LAST : DOT}
                            stroke="#241335"
                            strokeWidth={2}
                          />
                        );
                      }}
                      activeDot={{ r: 8, fill: LINE, stroke: "#fff", strokeWidth: 2 }}
                      isAnimationActive={chartAllowsHorizontalScroll ? false : true}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
