import React, { useState } from 'react';
import {
  TrendingUp,
  AlertTriangle,
  Package,
  Calendar,
  Clock,
  ArrowRight,
  Plus,
  CheckCircle2,
  Ship,
  Sparkles,
  Zap,
  ShieldAlert,
  Flame,
  Check,
  RotateCcw,
  Info
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';

export interface DailySalesVolume {
  dayLabel: string;
  dateStr: string;
  volumeKg: number;
  highlight?: boolean;
}

export interface RestockPredictionItem {
  id: string;
  sku: string;
  name: string;
  shortName: string;
  category: string;
  currentStockKg: number;
  safetyStockKg: number;
  salesVolume7dKg: number;
  dailyBurnRateKg: number;
  runwayDays: number;
  urgencyStatus: 'CRITICAL' | 'WARNING' | 'HEALTHY';
  stockoutDateStr: string;
  suggestedReorderKg: number;
  estimatedFobPriceKg: number;
  preferredSupplier: string;
  containerType: string;
  leadTimeDays: number;
  color: string;
}

// 7-Day Historical Daily Daging Sales Volume Data
export const HISTORICAL_7D_VOLUME: DailySalesVolume[] = [
  { dayLabel: 'Sen (01/11)', dateStr: '2026-11-01', volumeKg: 98.5 },
  { dayLabel: 'Sel (02/11)', dateStr: '2026-11-02', volumeKg: 112.0 },
  { dayLabel: 'Rab (03/11)', dateStr: '2026-11-03', volumeKg: 104.5 },
  { dayLabel: 'Kam (04/11)', dateStr: '2026-11-04', volumeKg: 118.0 },
  { dayLabel: 'Jum (05/11)', dateStr: '2026-11-05', volumeKg: 136.5 },
  { dayLabel: 'Sab (06/11)', dateStr: '2026-11-06', volumeKg: 154.5, highlight: true },
  { dayLabel: 'Hari Ini (07/11)', dateStr: '2026-11-07', volumeKg: 142.0, highlight: true },
];

// Predictive Restock Forecast Items
export const RESTOCK_PREDICTION_DATA: RestockPredictionItem[] = [
  {
    id: 'PRED_01',
    sku: 'SKU-TETELAN-SP',
    name: 'Tetelan Rawon Super KARKASIA',
    shortName: 'Tetelan Rawon Super',
    category: 'TETELAN',
    currentStockKg: 24.0,
    safetyStockKg: 25.0,
    salesVolume7dKg: 38.5,
    dailyBurnRateKg: 5.5,
    runwayDays: 4.4,
    urgencyStatus: 'CRITICAL',
    stockoutDateStr: '11 Nov 2026 (4 hari lagi)',
    suggestedReorderKg: 250,
    estimatedFobPriceKg: 55000,
    preferredSupplier: 'PT Meat Importers Indonesia',
    containerType: '20ft Reefer (-20°C)',
    leadTimeDays: 4,
    color: '#e11d48', // Rose 600
  },
  {
    id: 'PRED_02',
    sku: 'SKU-RIBEYE-AUS',
    name: 'Ribeye Meltique Australia (Primal)',
    shortName: 'Ribeye Meltique AUS',
    category: 'PRIMAL',
    currentStockKg: 48.5,
    safetyStockKg: 30.0,
    salesVolume7dKg: 42.0,
    dailyBurnRateKg: 6.0,
    runwayDays: 8.1,
    urgencyStatus: 'WARNING',
    stockoutDateStr: '15 Nov 2026 (8 hari lagi)',
    suggestedReorderKg: 500,
    estimatedFobPriceKg: 165000,
    preferredSupplier: 'Teys Australia Meat Group',
    containerType: '40ft Reefer (-25°C)',
    leadTimeDays: 7,
    color: '#f59e0b', // Amber 500
  },
  {
    id: 'PRED_03',
    sku: 'SKU-SHORTPLATE-US',
    name: 'US Beef Shortplate 500g Slice',
    shortName: 'US Beef Shortplate',
    category: 'SLICE',
    currentStockKg: 65.0,
    safetyStockKg: 25.0,
    salesVolume7dKg: 56.0,
    dailyBurnRateKg: 8.0,
    runwayDays: 8.1,
    urgencyStatus: 'WARNING',
    stockoutDateStr: '15 Nov 2026 (8 hari lagi)',
    suggestedReorderKg: 400,
    estimatedFobPriceKg: 95000,
    preferredSupplier: 'JBS USA Beef Export Inc',
    containerType: '40ft Reefer (-25°C)',
    leadTimeDays: 6,
    color: '#f59e0b', // Amber 500
  },
  {
    id: 'PRED_04',
    sku: 'SKU-TENDER-AUS',
    name: 'Tenderloin Grassfed Australia',
    shortName: 'Tenderloin Grassfed',
    category: 'PRIMAL',
    currentStockKg: 18.0,
    safetyStockKg: 20.0,
    salesVolume7dKg: 14.0,
    dailyBurnRateKg: 2.0,
    runwayDays: 9.0,
    urgencyStatus: 'WARNING',
    stockoutDateStr: '16 Nov 2026 (9 hari lagi)',
    suggestedReorderKg: 150,
    estimatedFobPriceKg: 210000,
    preferredSupplier: 'Australia Beef Direct Ltd',
    containerType: '20ft Reefer (-20°C)',
    leadTimeDays: 7,
    color: '#f59e0b', // Amber 500
  },
  {
    id: 'PRED_05',
    sku: 'SKU-SIRLOIN-USA',
    name: 'Sirloin Choice USA (Primal)',
    shortName: 'Sirloin Choice USA',
    category: 'PRIMAL',
    currentStockKg: 82.0,
    safetyStockKg: 30.0,
    salesVolume7dKg: 31.5,
    dailyBurnRateKg: 4.5,
    runwayDays: 18.2,
    urgencyStatus: 'HEALTHY',
    stockoutDateStr: '25 Nov 2026 (18 hari lagi)',
    suggestedReorderKg: 300,
    estimatedFobPriceKg: 145000,
    preferredSupplier: 'JBS USA Beef Export Inc',
    containerType: '40ft Reefer (-25°C)',
    leadTimeDays: 7,
    color: '#10b981', // Emerald 500
  },
];

export interface RestockPredictionCardProps {
  className?: string;
  onOpenDraftPO: (item: RestockPredictionItem) => void;
  onOpenBatchPO?: (items: RestockPredictionItem[]) => void;
  onNavigateToWarehouse?: () => void;
}

export const RestockPredictionCard: React.FC<RestockPredictionCardProps> = ({
  className = '',
  onOpenDraftPO,
  onOpenBatchPO,
  onNavigateToWarehouse,
}) => {
  const [filterUrgency, setFilterUrgency] = useState<'ALL' | 'ACTION_NEEDED' | 'HEALTHY'>('ACTION_NEEDED');
  const [draftedSkuMap, setDraftedSkuMap] = useState<Record<string, boolean>>({});

  const filteredItems = RESTOCK_PREDICTION_DATA.filter(item => {
    if (filterUrgency === 'ACTION_NEEDED') {
      return item.urgencyStatus === 'CRITICAL' || item.urgencyStatus === 'WARNING';
    }
    if (filterUrgency === 'HEALTHY') {
      return item.urgencyStatus === 'HEALTHY';
    }
    return true;
  });

  const criticalCount = RESTOCK_PREDICTION_DATA.filter(i => i.urgencyStatus === 'CRITICAL').length;
  const warningCount = RESTOCK_PREDICTION_DATA.filter(i => i.urgencyStatus === 'WARNING').length;
  const healthyCount = RESTOCK_PREDICTION_DATA.filter(i => i.urgencyStatus === 'HEALTHY').length;
  const totalSuggestedReorderKg = RESTOCK_PREDICTION_DATA
    .filter(i => i.urgencyStatus !== 'HEALTHY')
    .reduce((acc, i) => acc + i.suggestedReorderKg, 0);

  const handleDraftClick = (item: RestockPredictionItem) => {
    setDraftedSkuMap(prev => ({ ...prev, [item.sku]: true }));
    onOpenDraftPO(item);
  };

  const handleBatchDraftClick = () => {
    const needed = RESTOCK_PREDICTION_DATA.filter(i => i.urgencyStatus !== 'HEALTHY');
    needed.forEach(i => {
      setDraftedSkuMap(prev => ({ ...prev, [i.sku]: true }));
    });
    if (onOpenBatchPO) {
      onOpenBatchPO(needed);
    } else if (needed.length > 0) {
      onOpenDraftPO(needed[0]);
    }
  };

  return (
    <div className={`b2b-card p-5 border border-slate-200 bg-white rounded-xl space-y-4 ${className}`}>
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="p-1.5 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
              <TrendingUp className="w-4 h-4" />
            </span>
            <h3 className="text-sm sm:text-base font-extrabold text-slate-900 tracking-tight">
              Perkiraan Stok Belanja Ulang
            </h3>
            <span className="text-[11px] font-medium text-slate-500">
              · Data 7 hari terakhir
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Perkiraan kapan stok daging menipis berdasarkan pemakaian harian minggu ini.
          </p>
        </div>

        {/* Action Controls & Batch Button */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center p-1 bg-slate-100 rounded-lg text-xs font-semibold">
            {[
              { id: 'ACTION_NEEDED', label: `Perlu Beli (${criticalCount + warningCount})` },
              { id: 'ALL', label: `Semua (${RESTOCK_PREDICTION_DATA.length})` },
              { id: 'HEALTHY', label: `Aman (${healthyCount})` },
            ].map(f => (
              <button
                key={f.id}
                type="button"
                onClick={() => setFilterUrgency(f.id as any)}
                className={`min-h-[36px] px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                  filterUrgency === f.id
                    ? 'bg-white text-slate-900 font-bold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleBatchDraftClick}
            className="min-h-[40px] px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer"
            title="Siapkan rencana pembelian untuk semua daging yang mulai menipis"
          >
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
            <span>Siapkan Beli ({totalSuggestedReorderKg} KG)</span>
          </button>
        </div>
      </div>

      {/* 7-Day Velocity Mini Sparkline & Summary KPI */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200/80">
        {/* KPI 1 */}
        <div className="space-y-1">
          <span className="text-[11px] font-semibold text-slate-500">Ketersediaan Stok Freezer</span>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-extrabold font-mono tabular-nums text-rose-600">
              {criticalCount} Perlu dicek
            </span>
            <span className="text-xs font-bold text-amber-700">
              &amp; {warningCount} Mulai Menipis
            </span>
          </div>
          <span className="text-[11px] text-slate-500 block">
            Waktu tunggu kiriman baru: <strong>5–7 Hari</strong>
          </span>
        </div>

        {/* KPI 2 */}
        <div className="space-y-1">
          <span className="text-[11px] font-semibold text-slate-500">Total Keluar 7 Hari</span>
          <div className="text-xl font-extrabold font-mono tabular-nums text-slate-900">
            866.5 KG
          </div>
          <span className="text-[11px] text-emerald-700 font-semibold block">
            Rata-rata keluar: 26.0 KG / hari
          </span>
        </div>

        {/* 7-Day Sales Volume Mini Bar Chart */}
        <div className="h-16 w-full">
          <span className="text-[11px] font-semibold text-slate-500 block mb-1">Keluar Harian (KG)</span>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={HISTORICAL_7D_VOLUME} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 2" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="dayLabel" hide />
              <YAxis hide domain={[80, 170]} />
              <RechartsTooltip
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const d = payload[0].payload as DailySalesVolume;
                  return (
                    <div className="bg-slate-900 text-white text-[11px] px-2.5 py-1.5 rounded font-mono">
                      {d.dayLabel}: <strong>{d.volumeKg} KG</strong>
                    </div>
                  );
                }}
              />
              <Bar dataKey="volumeKg" radius={[2, 2, 0, 0]}>
                {HISTORICAL_7D_VOLUME.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.highlight ? '#0f172a' : '#94a3b8'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Predictive Items List */}
      <div className="space-y-3">
        {filteredItems.map(item => {
          const isCritical = item.urgencyStatus === 'CRITICAL';
          const isWarning = item.urgencyStatus === 'WARNING';
          const isDrafted = draftedSkuMap[item.sku];

          const runwayPercent = Math.min(100, Math.round((item.runwayDays / 20) * 100));

          return (
            <div
              key={item.id}
              className={`p-3.5 sm:p-4 rounded-xl border transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                isCritical
                  ? 'bg-rose-50/40 border-rose-200'
                  : isWarning
                  ? 'bg-amber-50/30 border-amber-200'
                  : 'bg-white border-slate-200'
              }`}
            >
              {/* Product Info & Daily Usage */}
              <div className="space-y-1.5 flex-1 min-w-[240px]">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md border ${
                      isCritical
                        ? 'bg-rose-50 text-rose-800 border-rose-200'
                        : isWarning
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    }`}
                  >
                    {isCritical ? (
                      <>
                        <AlertTriangle className="w-3 h-3" />
                        <span>Perlu dicek</span>
                      </>
                    ) : isWarning ? (
                      <>
                        <Clock className="w-3 h-3" />
                        <span>Perlu dicek</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Tersimpan ✓</span>
                      </>
                    )}
                  </span>

                  <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                    {item.name}
                  </h4>
                  <span className="text-[11px] font-mono text-slate-400">
                    {item.sku}
                  </span>
                </div>

                {/* Metrics Row */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                  <span>
                    Stok Ada: <strong className="text-slate-900 font-mono tabular-nums">{item.currentStockKg} KG</strong>
                    <span className="text-slate-500 text-[11px] ml-1">(Batas Aman: {item.safetyStockKg} KG)</span>
                  </span>
                  <span>·</span>
                  <span className="flex items-center gap-1 font-medium text-slate-700">
                    Pemakaian: <strong className="font-mono tabular-nums text-slate-900">{item.dailyBurnRateKg} KG/hari</strong>
                  </span>
                  <span>·</span>
                  <span>
                    Keluar 7 Hari: <strong className="font-mono tabular-nums text-slate-900">{item.salesVolume7dKg} KG</strong>
                  </span>
                </div>

                {/* Visual Runway Bar */}
                <div className="space-y-1 pt-1 max-w-md">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      Perkiraan Habis: <strong className={isCritical ? 'text-rose-700 font-bold' : isWarning ? 'text-amber-800 font-bold' : 'text-slate-700'}>{item.stockoutDateStr}</strong>
                    </span>
                    <span className="font-mono font-bold text-slate-800">
                      Cukup {item.runwayDays} Hari
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        isCritical ? 'bg-rose-600' : isWarning ? 'bg-amber-500' : 'bg-emerald-600'
                      }`}
                      style={{ width: `${runwayPercent}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Suggested Reorder Box & Action Button */}
              <div className="flex flex-col sm:flex-row md:flex-col lg:flex-row items-start sm:items-center justify-between md:justify-end gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-slate-200/80 shrink-0">
                <div className="text-left sm:text-right md:text-left lg:text-right">
                  <span className="text-[11px] font-semibold text-slate-500 block">Saran Beli:</span>
                  <div className="text-sm font-extrabold text-slate-900 font-mono tabular-nums">
                    +{item.suggestedReorderKg} KG
                  </div>
                  <span className="text-[11px] text-slate-500 block font-mono tabular-nums">
                    Perkiraan Harga Beli: Rp {(item.suggestedReorderKg * item.estimatedFobPriceKg).toLocaleString('id-ID')}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => handleDraftClick(item)}
                  className={`min-h-[40px] px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer ${
                    isDrafted
                      ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                      : isCritical
                      ? 'bg-rose-600 hover:bg-rose-700 text-white'
                      : 'bg-slate-900 hover:bg-slate-800 text-white'
                  }`}
                  title="Siapkan catatan beli stok untuk barang dan supplier ini"
                >
                  {isDrafted ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      Siap Dibeli
                    </>
                  ) : (
                    <>
                      <Plus className="w-3.5 h-3.5" />
                      Catat Beli Stok
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer Insight & Information */}
      <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-slate-500 border-t border-slate-100">
        <div className="flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span>
            Saran beli sudah menghitung waktu pengiriman 5–7 hari supaya stok toko tidak sempat kosong.
          </span>
        </div>

        {onNavigateToWarehouse && (
          <button
            type="button"
            onClick={onNavigateToWarehouse}
            className="min-h-[36px] px-2 text-slate-900 hover:underline font-semibold text-xs flex items-center gap-1 self-end sm:self-auto cursor-pointer"
          >
            Lihat Stok Gudang
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
