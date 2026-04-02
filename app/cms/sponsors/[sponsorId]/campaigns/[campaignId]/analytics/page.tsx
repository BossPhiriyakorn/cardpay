"use client";

import Link from "next/link";
import { Suspense, use, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, PencilLine } from "lucide-react";

import { CmsCampaignShareLineChart } from "@/components/cms/CmsCampaignShareLineChart";
import type { SponsorChartPoint, SponsorDashboardChartPeriod } from "@/lib/sponsor/dashboard-chart";

type Props = { params: Promise<{ sponsorId: string; campaignId: string }> };

type CampaignSummary = {
  id: string;
  sponsorId: string;
  sponsorName: string;
  name: string;
  totalBudget: number;
  usedBudget: number;
  status: string;
  currentShares: number;
  rewardPerShare: number;
  maxSharesFromBudget: number;
};

type SharerRow = {
  userId: string;
  displayName: string;
  shareCount: number;
  totalEarned: number;
  lastSharedAt: string | null;
};

const currencyFormatter = new Intl.NumberFormat("th-TH", {
  style: "currency",
  currency: "THB",
  maximumFractionDigits: 0,
});

function AnalyticsLoading() {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#241335]/70 p-6 text-white/70">
      กำลังโหลดรายละเอียดแคมเปญ...
    </div>
  );
}

function CampaignAnalyticsContent({ params }: Props) {
  const { sponsorId, campaignId } = use(params);
  const searchParams = useSearchParams();
  const readonly =
    searchParams.get("readonly") === "1" || searchParams.get("view") === "readonly";

  const backHref = readonly ? "/cms/campaigns" : `/cms/sponsors/${sponsorId}`;
  const backLabel = readonly ? "กลับไปจัดการแคมเปญ" : "กลับไปรายการแคมเปญของสปอนเซอร์";

  const [campaign, setCampaign] = useState<CampaignSummary | null>(null);
  const [sharers, setSharers] = useState<SharerRow[]>([]);
  const [chartPeriod, setChartPeriod] = useState<SponsorDashboardChartPeriod>("day");
  const [chartPoints, setChartPoints] = useState<SponsorChartPoint[]>([]);
  const [chartRefreshing, setChartRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const sponsorCampaignKeyRef = useRef("");

  useEffect(() => {
    let cancelled = false;
    const key = `${sponsorId}|${campaignId}`;
    const fullPageLoad = sponsorCampaignKeyRef.current !== key;
    if (fullPageLoad) sponsorCampaignKeyRef.current = key;

    async function load() {
      if (fullPageLoad) {
        setLoading(true);
        setError(null);
      } else {
        setChartRefreshing(true);
      }
      try {
        const q = new URLSearchParams({
          sponsorId,
          period: chartPeriod,
        });
        const res = await fetch(
          `/api/cms/campaigns/${campaignId}/analytics?${q.toString()}`,
          { cache: "no-store" }
        );
        const data = (await res.json()) as {
          ok?: boolean;
          campaign?: CampaignSummary;
          sharers?: SharerRow[];
          chart?: { points?: SponsorChartPoint[] };
          error?: string;
        };
        if (!res.ok || !data.ok || !data.campaign) {
          throw new Error(data.error ?? "โหลดไม่สำเร็จ");
        }
        if (!cancelled) {
          setCampaign(data.campaign);
          setSharers(data.sharers ?? []);
          setChartPoints(data.chart?.points ?? []);
        }
      } catch {
        if (!cancelled) setError("ไม่สามารถโหลดข้อมูลแคมเปญได้");
      } finally {
        if (!cancelled) {
          setLoading(false);
          setChartRefreshing(false);
        }
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [campaignId, sponsorId, chartPeriod]);

  if (loading) {
    return <AnalyticsLoading />;
  }

  if (error || !campaign) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#241335]/70 p-6 text-white/80">
        {error ?? "ไม่พบแคมเปญ"}
        <div className="mt-4">
          <Link href={backHref} className="text-sm font-bold text-[#f472b6] hover:underline">
            ← {backLabel}
          </Link>
        </div>
      </div>
    );
  }

  if (campaign.sponsorId !== sponsorId) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#241335]/70 p-6 text-white/80">
        แคมเปญนี้ไม่ตรงกับสปอนเซอร์ใน URL
        <div className="mt-4">
          <Link href="/cms/campaigns" className="text-sm font-bold text-[#f472b6] hover:underline">
            ← กลับไปจัดการแคมเปญ
          </Link>
        </div>
      </div>
    );
  }

  const budgetLeft = Math.max(campaign.totalBudget - campaign.usedBudget, 0);

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 text-xs font-bold uppercase tracking-wider text-zinc-800">
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 text-black hover:text-[#8e24aa] transition-colors"
          >
            <ArrowLeft size={14} />
            {backLabel}
          </Link>
        </div>
        {!readonly ? (
          <Link
            href={`/cms/sponsors/${sponsorId}/campaigns/${campaignId}`}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#8e24aa]/90 px-5 py-3 text-xs font-black uppercase tracking-wide text-white hover:bg-[#7b1fa2] transition-colors"
          >
            <PencilLine size={16} />
            แก้ไขแคมเปญ
          </Link>
        ) : null}
      </div>

      {readonly ? (
        <div className="rounded-2xl border border-amber-300/90 bg-amber-50 px-4 py-3 text-sm leading-relaxed shadow-sm ring-1 ring-amber-200/90">
          <p className="font-bold text-amber-950">โหมดอ่านอย่างเดียว (จากเมนูจัดการแคมเปญ)</p>
          <p className="mt-1 text-amber-900 text-xs md:text-sm">
            เมนูจัดการแคมเปญใช้ดูรายการและจัดการแท็กเท่านั้น — ไม่แก้ไขแคมเปญจากที่นี่
            หากต้องการแก้ไขแคมเปญให้ไป{" "}
            <span className="font-semibold text-amber-950">จัดการสปอนเซอร์</span> → เลือก{" "}
            <span className="font-semibold text-amber-950">{campaign.sponsorName}</span> → กด{" "}
            <span className="font-semibold text-amber-950">จัดการ</span> ที่แถวแคมเปญ →{" "}
            <span className="font-semibold text-amber-950">แก้ไขแคมเปญ</span>
          </p>
        </div>
      ) : null}

      <div className="text-zinc-900">
        <h1 className="text-2xl md:text-3xl font-black text-black tracking-tight">
          รายละเอียดแคมเปญ
        </h1>
        <p className="mt-1 text-xs font-bold uppercase tracking-widest text-zinc-600">
          สรุปงบ การแชร์ และผู้เข้าร่วม
        </p>
        <p className="mt-2 text-lg font-bold text-black">{campaign.name}</p>
        <p className="text-sm text-zinc-800 mt-1">
          สปอนเซอร์: <span className="font-semibold text-black">{campaign.sponsorName}</span>
        </p>
        <p className="text-xs text-zinc-600 mt-1 font-mono">ID: {campaign.id}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#241335]/70 border border-white/10 rounded-3xl p-5 text-zinc-100">
          <p className="text-xs text-zinc-400 uppercase tracking-widest font-black">งบรวม</p>
          <p className="text-2xl font-black text-white mt-2 tabular-nums">
            {currencyFormatter.format(campaign.totalBudget)}
          </p>
        </div>
        <div className="bg-[#241335]/70 border border-white/10 rounded-3xl p-5 text-zinc-100">
          <p className="text-xs text-zinc-400 uppercase tracking-widest font-black">ใช้ไปแล้ว</p>
          <p className="text-2xl font-black text-[#f472b6] mt-2 tabular-nums">
            {currencyFormatter.format(campaign.usedBudget)}
          </p>
        </div>
        <div className="bg-[#241335]/70 border border-white/10 rounded-3xl p-5 text-zinc-100">
          <p className="text-xs text-zinc-400 uppercase tracking-widest font-black">งบคงเหลือ</p>
          <p className="text-2xl font-black text-emerald-300 mt-2 tabular-nums">
            {currencyFormatter.format(budgetLeft)}
          </p>
        </div>
        <div className="bg-[#241335]/70 border border-white/10 rounded-3xl p-5 text-zinc-100">
          <p className="text-xs text-zinc-400 uppercase tracking-widest font-black">สถานะ</p>
          <p className="text-xl font-black text-white/90 mt-2 uppercase">{campaign.status}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#241335]/70 border border-white/10 rounded-3xl p-5 text-zinc-100">
          <p className="text-xs text-zinc-400 uppercase tracking-widest font-black">
            จำนวนแชร์สะสม (ระบบ)
          </p>
          <p className="text-3xl font-black text-white mt-2 tabular-nums">
            {campaign.currentShares.toLocaleString("th-TH")}
          </p>
        </div>
        <div className="bg-[#241335]/70 border border-white/10 rounded-3xl p-5 text-zinc-100">
          <p className="text-xs text-zinc-400 uppercase tracking-widest font-black">
            โควต้าสูงสุดจากงบ
          </p>
          <p className="text-3xl font-black text-white mt-2 tabular-nums">
            {campaign.maxSharesFromBudget > 0
              ? campaign.maxSharesFromBudget.toLocaleString("th-TH")
              : "—"}
          </p>
          <p className="text-[11px] text-zinc-400 mt-2">
            คำนวณจาก งบรวม ÷ ค่าตอบแทนต่อแชร์ ({currencyFormatter.format(campaign.rewardPerShare)})
          </p>
        </div>
        <div className="bg-[#241335]/70 border border-white/10 rounded-3xl p-5 text-zinc-100">
          <p className="text-xs text-zinc-400 uppercase tracking-widest font-black">
            ผู้ใช้ในตาราง (มีแถวสถิติ)
          </p>
          <p className="text-3xl font-black text-white mt-2 tabular-nums">
            {sharers.length.toLocaleString("th-TH")}
          </p>
        </div>
      </div>

      <CmsCampaignShareLineChart
        points={chartPoints}
        period={chartPeriod}
        onPeriodChange={setChartPeriod}
        refreshing={chartRefreshing}
      />

      <div className="bg-[#241335]/70 border border-white/10 rounded-3xl overflow-hidden text-zinc-100">
        <div className="px-5 py-4 border-b border-white/10">
          <h2 className="text-sm font-black uppercase tracking-widest text-white">
            ผู้ใช้ที่แชร์
          </h2>
          <p className="text-xs text-zinc-300 mt-1">
            เรียงตามจำนวนครั้งที่แชร์ (มาก → น้อย)
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-zinc-100">
            <thead className="border-b border-white/15 bg-white/[0.08]">
              <tr>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-zinc-100">
                  ผู้ใช้
                </th>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-zinc-100">
                  จำนวนครั้งที่แชร์
                </th>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-zinc-100">
                  รายได้จากแคมเปญนี้
                </th>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-zinc-100">
                  แชร์ล่าสุด
                </th>
                <th className="px-6 py-4 text-xs font-black uppercase tracking-widest text-zinc-100 text-right">
                  การจัดการ
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {sharers.map((row, idx) => (
                <tr key={row.userId || `row-${idx}`} className="hover:bg-white/[0.03]">
                  <td className="px-6 py-4 text-sm font-bold text-white">{row.displayName}</td>
                  <td className="px-6 py-4 text-sm tabular-nums text-white/85">
                    {row.shareCount.toLocaleString("th-TH")} ครั้ง
                  </td>
                  <td className="px-6 py-4 text-sm tabular-nums text-white/85">
                    {currencyFormatter.format(row.totalEarned)}
                  </td>
                  <td className="px-6 py-4 text-sm text-white/65">
                    {row.lastSharedAt
                      ? new Date(row.lastSharedAt).toLocaleString("th-TH", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })
                      : "—"}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {row.userId ? (
                      <Link
                        href={`/cms/members/${row.userId}`}
                        className="inline-flex rounded-xl border border-white/15 px-3 py-2 text-xs font-bold text-white/80 hover:border-[#8e24aa]/50 hover:text-[#8e24aa]"
                      >
                        โปรไฟล์สมาชิก
                      </Link>
                    ) : (
                      <span className="text-xs text-white/35">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {sharers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-sm text-zinc-300">
                    ยังไม่มีข้อมูลผู้แชร์ในแคมเปญนี้
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function CampaignAnalyticsPage(props: Props) {
  return (
    <Suspense fallback={<AnalyticsLoading />}>
      <CampaignAnalyticsContent {...props} />
    </Suspense>
  );
}
