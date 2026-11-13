import React, { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import {
  TrendingUp,
  Calendar,
  ArrowDownRight,
  Info,
  ShieldCheck,
  RefreshCw,
  Eye,
  EyeOff
} from 'lucide-react';

// =====================================================================
// TOP 3 BEST-SELLING PRODUCTS IN WAREHOUSE
// Single Source of Truth aligned with MASTER DATA KARKASIA
// =====================================================================
export interface ProductStockMeta {
  sku: string;
  name: string;
  shortName: string;
  rank: number;
  category: 'PRIMAL' | 'SLICE' | 'TETELAN';
  currentStockGram: number; // Zero-Float integer Gram
  safetyStockGram: number;  // Zero-Float integer Gram
  maxCapacityGram: number;
  color: string;
  strokeDash?: string;
  dailyBurnKg: number;      // Rata-rata konsumsi keluar per hari (KG)
  coldStorageZone: string;  // Lokasi penyimpanan cold chain
  lotCodeActive: string;    // Batch FEFO aktif
}

export const TOP_3_BEST_SELLERS: ProductStockMeta[] = [
  {
    sku: 'SKU-RIBEYE-AUS',
    name: 'Ribeye Meltique Australia (Primal)',
    shortName: 'Ribeye Meltique AUS',
    rank: 1,
    category: 'PRIMAL',
    currentStockGram: 48500,  // 48.5 KG
    safetyStockGram: 30000,   // 30.0 KG batas aman
    maxCapacityGram: 80000,
    color: '#0284c7',         // Sky/Blue 600
    dailyBurnKg: 4.8,
    coldStorageZone: 'Freezer A-01 (-20°C)',
    lotCodeActive: 'LOT-261101-001',
  },
  {
    sku: 'SKU-SIRLOIN-USA',
    name: 'Sirloin Choice USA (Primal)',
    shortName: 'Sirloin Choice USA',
    rank: 2,
    category: 'PRIMAL',
    currentStockGram: 82000,  // 82.0 KG
    safetyStockGram: 30000,   // 30.0 KG batas aman
    maxCapacityGram: 100000,
    color: '#059669',         // Emerald 600
    dailyBurnKg: 5.2,
    coldStorageZone: 'Freezer A-03 (-19°C)',
    lotCodeActive: 'LOT-261102-004',
  },
  {
    sku: 'SKU-SHORTPLATE-US',
    name: 'US Beef Shortplate 500g Slice',
    shortName: 'US Beef Shortplate',
    rank: 3,
    category: 'SLICE',
    currentStockGram: 65000,  // 65.0 KG
    safetyStockGram: 25000,   // 25.0 KG batas aman
    maxCapacityGram: 90000,
    color: '#d97706',         // Amber 600
    dailyBurnKg: 7.1,
    coldStorageZone: 'Chiller B-02 (-4°C)',
    lotCodeActive: 'LOT-261103-009',
  },
];

// =====================================================================
// 30-DAY COLD STORAGE STOCK LEVEL EVENT HISTORY
// Recorded in Grams (Zero-Float) & calculated in KG for visualization
// =====================================================================
interface DailyStockRecord {
  date: string;       // YYYY-MM-DD
  displayDate: string;// e.g. "08 Okt", "06 Nov"
  ribeyeGram: number;
  sirloinGram: number;
  shortplateGram: number;
  ribeyeKg: number;
  sirloinKg: number;
  shortplateKg: number;
  eventNote?: string;
  eventType?: 'INBOUND' | 'OUTBOUND' | 'CONVERSION' | 'OPNAME';
}

const HISTORICAL_STOCK_DATA: DailyStockRecord[] = [
  { date: '2026-10-08', displayDate: '08 Okt', ribeyeGram: 72000, sirloinGram: 95000, shortplateGram: 58000, ribeyeKg: 72.0, sirloinKg: 95.0, shortplateKg: 58.0 },
  { date: '2026-10-10', displayDate: '10 Okt', ribeyeGram: 67200, sirloinGram: 89800, shortplateGram: 50900, ribeyeKg: 67.2, sirloinKg: 89.8, shortplateKg: 50.9 },
  { date: '2026-10-12', displayDate: '12 Okt', ribeyeGram: 62400, sirloinGram: 84600, shortplateGram: 43800, ribeyeKg: 62.4, sirloinKg: 84.6, shortplateKg: 43.8, eventNote: 'Penjualan Resto Katering 35 KG Shortplate', eventType: 'OUTBOUND' },
  { date: '2026-10-14', displayDate: '14 Okt', ribeyeGram: 57600, sirloinGram: 79400, shortplateGram: 83700, ribeyeKg: 57.6, sirloinKg: 79.4, shortplateKg: 83.7, eventNote: 'Restock Inbound Container US Beef +45 KG', eventType: 'INBOUND' },
  { date: '2026-10-16', displayDate: '16 Okt', ribeyeGram: 52800, sirloinGram: 74200, shortplateGram: 76600, ribeyeKg: 52.8, sirloinKg: 74.2, shortplateKg: 76.6 },
  { date: '2026-10-18', displayDate: '18 Okt', ribeyeGram: 48000, sirloinGram: 69000, shortplateGram: 69500, ribeyeKg: 48.0, sirloinKg: 69.0, shortplateKg: 69.5 },
  { date: '2026-10-20', displayDate: '20 Okt', ribeyeGram: 43200, sirloinGram: 63800, shortplateGram: 62400, ribeyeKg: 43.2, sirloinKg: 63.8, shortplateKg: 62.4 },
  { date: '2026-10-22', displayDate: '22 Okt', ribeyeGram: 83200, sirloinGram: 58600, shortplateGram: 55300, ribeyeKg: 83.2, sirloinKg: 58.6, shortplateKg: 55.3, eventNote: 'Restock Impor Ribeye AUS +45 KG Cold Storage', eventType: 'INBOUND' },
  { date: '2026-10-24', displayDate: '24 Okt', ribeyeGram: 78400, sirloinGram: 98600, shortplateGram: 48200, ribeyeKg: 78.4, sirloinKg: 98.6, shortplateKg: 48.2, eventNote: 'Restock Inbound Sirloin Choice USA +45 KG', eventType: 'INBOUND' },
  { date: '2026-10-26', displayDate: '26 Okt', ribeyeGram: 73600, sirloinGram: 93400, shortplateGram: 41100, ribeyeKg: 73.6, sirloinKg: 93.4, shortplateKg: 41.1 },
  { date: '2026-10-28', displayDate: '28 Okt', ribeyeGram: 68800, sirloinGram: 88200, shortplateGram: 81100, ribeyeKg: 68.8, sirloinKg: 88.2, shortplateKg: 81.1, eventNote: 'Restock Slice Shabu Shortplate +45 KG', eventType: 'INBOUND' },
  { date: '2026-10-30', displayDate: '30 Okt', ribeyeGram: 64000, sirloinGram: 92000, shortplateGram: 74000, ribeyeKg: 64.0, sirloinKg: 92.0, shortplateKg: 74.0, eventNote: 'Opname Stok Bulanan Akhir Oktober (Matched)', eventType: 'OPNAME' },
  { date: '2026-11-01', displayDate: '01 Nov', ribeyeGram: 59200, sirloinGram: 89400, shortplateGram: 72000, ribeyeKg: 59.2, sirloinKg: 89.4, shortplateKg: 72.0 },
  { date: '2026-11-02', displayDate: '02 Nov', ribeyeGram: 54400, sirloinGram: 86800, shortplateGram: 69500, ribeyeKg: 54.4, sirloinKg: 86.8, shortplateKg: 69.5, eventNote: 'Konversi Trimming Primal ke Tetelan (-4.8 KG)', eventType: 'CONVERSION' },
  { date: '2026-11-03', displayDate: '03 Nov', ribeyeGram: 52000, sirloinGram: 85000, shortplateGram: 68000, ribeyeKg: 52.0, sirloinKg: 85.0, shortplateKg: 68.0 },
  { date: '2026-11-04', displayDate: '04 Nov', ribeyeGram: 50800, sirloinGram: 83800, shortplateGram: 66800, ribeyeKg: 50.8, sirloinKg: 83.8, shortplateKg: 66.8 },
  { date: '2026-11-05', displayDate: '05 Nov', ribeyeGram: 49600, sirloinGram: 82900, shortplateGram: 65900, ribeyeKg: 49.6, sirloinKg: 82.9, shortplateKg: 65.9 },
  { date: '2026-11-06', displayDate: 'Hari Ini', ribeyeGram: 48500, sirloinGram: 82000, shortplateGram: 65000, ribeyeKg: 48.5, sirloinKg: 82.0, shortplateKg: 65.0, eventNote: 'Posisi Stok Real-Time Coldroom Saat Ini', eventType: 'OPNAME' },
];

export interface StockLevelOverTimeChartProps {
  className?: string;
  onOpenAuditLog?: () => void;
  onTriggerReorder?: (sku: string) => void;
}

export const StockLevelOverTimeChart: React.FC<StockLevelOverTimeChartProps> = ({
  className = '',
  onOpenAuditLog,
  onTriggerReorder,
}) => {
  // State Filter & Tampilan
  const [timeRange, setTimeRange] = useState<'7D' | '14D' | '30D'>('14D');
  const [unitMode, setUnitMode] = useState<'KG' | 'GRAM'>('KG');
  const [showSafetyThreshold, setShowSafetyThreshold] = useState<boolean>(true);
  const [visibleProducts, setVisibleProducts] = useState<Record<string, boolean>>({
    'SKU-RIBEYE-AUS': true,
    'SKU-SIRLOIN-USA': true,
    'SKU-SHORTPLATE-US': true,
  });
  const [hoveredDataPoint, setHoveredDataPoint] = useState<DailyStockRecord | null>(null);

  // Filter Data berdasarkan Rentang Waktu Terpilih
  const filteredData = useMemo(() => {
    if (timeRange === '7D') {
      return HISTORICAL_STOCK_DATA.slice(-7);
    }
    if (timeRange === '14D') {
      return HISTORICAL_STOCK_DATA.slice(-14);
    }
    return HISTORICAL_STOCK_DATA;
  }, [timeRange]);

  // Toggle visibilitas produk individual
  const toggleProduct = (sku: string) => {
    setVisibleProducts(prev => {
      const next = { ...prev, [sku]: !prev[sku] };
      // Pastikan minimal 1 garis tetap aktif
      if (!next['SKU-RIBEYE-AUS'] && !next['SKU-SIRLOIN-USA'] && !next['SKU-SHORTPLATE-US']) {
        return prev;
      }
      return next;
    });
  };

  // Reset semua produk ke visible
  const showAllProducts = () => {
    setVisibleProducts({
      'SKU-RIBEYE-AUS': true,
      'SKU-SIRLOIN-USA': true,
      'SKU-SHORTPLATE-US': true,
    });
  };

  // Format angka ke Rupiah / Gram / KG tanpa float error
  const formatStockValue = (valKg: number, valGram: number) => {
    if (unitMode === 'GRAM') {
      return `${valGram.toLocaleString('id-ID')} g`;
    }
    return `${valKg.toFixed(1)} KG`;
  };

  return (
    <div className={`b2b-card p-4 sm:p-5 border border-slate-200 bg-white shadow-xs rounded-xl ${className}`}>
      {/* Header & Controls Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-50 text-blue-700">
              <TrendingUp className="w-4 h-4" />
            </span>
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">
              Grafik Stok Gudang Terlaris
            </h3>
            <span className="text-[11px] font-medium text-slate-500">
              · 3 Barang Terlaris
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Pantau sisa stok di freezer, pemakaian harian, dan batas aman stok.
          </p>
        </div>

        {/* Toolbar Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Time Range Selector */}
          <div className="flex items-center p-0.5 bg-slate-100 rounded-lg text-xs font-semibold">
            {[
              { id: '7D', label: '7 Hari' },
              { id: '14D', label: '14 Hari' },
              { id: '30D', label: '30 Hari' },
            ].map(r => (
              <button
                key={r.id}
                type="button"
                onClick={() => setTimeRange(r.id as any)}
                className={`px-2.5 py-1 rounded-md transition-colors ${
                  timeRange === r.id
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {/* Unit Mode Selector */}
          <div className="flex items-center p-0.5 bg-slate-100 rounded-lg text-xs font-semibold">
            <button
              type="button"
              onClick={() => setUnitMode('KG')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                unitMode === 'KG'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              KG
            </button>
            <button
              type="button"
              onClick={() => setUnitMode('GRAM')}
              className={`px-2.5 py-1 rounded-md transition-colors ${
                unitMode === 'GRAM'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Gram
            </button>
          </div>

          {/* Batas Aman Toggle */}
          <button
            type="button"
            onClick={() => setShowSafetyThreshold(!showSafetyThreshold)}
            className={`min-h-[36px] px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors flex items-center gap-1.5 cursor-pointer ${
              showSafetyThreshold
                ? 'bg-rose-50 text-rose-700 border-rose-200'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
            title="Tampilkan garis batas aman stok gudang"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Batas Aman
          </button>
        </div>
      </div>

      {/* Top 3 Product KPI Cards (Interactive Filter / Highlight) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 my-4">
        {TOP_3_BEST_SELLERS.map(p => {
          const isVisible = visibleProducts[p.sku];
          const stockKg = p.currentStockGram / 1000;
          const safetyKg = p.safetyStockGram / 1000;
          const runwayDays = (stockKg / p.dailyBurnKg).toFixed(1);
          const isBelowSafety = stockKg <= safetyKg;
          const isNearSafety = stockKg <= safetyKg * 1.3;

          return (
            <div
              key={p.sku}
              onClick={() => toggleProduct(p.sku)}
              className={`p-3 rounded-lg border transition-all cursor-pointer select-none ${
                isVisible
                  ? 'bg-slate-50/70 border-slate-200 hover:border-slate-300'
                  : 'bg-slate-100/50 border-dashed border-slate-200 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: p.color }}
                  />
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 leading-tight">
                      #{p.rank} {p.shortName}
                    </h4>
                    <span className="text-[10px] text-slate-500 font-mono">
                      {p.sku} · {p.coldStorageZone}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  className="p-1 text-slate-400 hover:text-slate-600 rounded"
                  title={isVisible ? 'Sembunyikan dari grafik' : 'Tampilkan di grafik'}
                >
                  {isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Metrics Row */}
              <div className="mt-2.5 flex items-baseline justify-between pt-2 border-t border-slate-200/60">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Stok Real</span>
                  <span className="text-sm font-extrabold text-slate-900 font-mono">
                    {formatStockValue(stockKg, p.currentStockGram)}
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Laju Keluar</span>
                  <span className="text-xs font-bold text-slate-700 font-mono flex items-center justify-end gap-0.5">
                    <ArrowDownRight className="w-3 h-3 text-rose-500" />
                    {p.dailyBurnKg} KG/hari
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Ketahanan</span>
                  <span
                    className={`text-xs font-bold font-mono px-1.5 py-0.5 rounded ${
                      isBelowSafety
                        ? 'text-rose-700 bg-rose-50'
                        : isNearSafety
                        ? 'text-amber-700 bg-amber-50'
                        : 'text-emerald-700 bg-emerald-50'
                    }`}
                  >
                    {runwayDays} hari
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Recharts Line Chart Container */}
      <div className="w-full h-72 sm:h-80 pt-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={filteredData}
            margin={{ top: 12, right: 16, left: unitMode === 'GRAM' ? 20 : 0, bottom: 8 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="displayDate"
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
            />
            <YAxis
              stroke="#64748b"
              fontSize={11}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
              tickFormatter={(value) => {
                if (unitMode === 'GRAM') {
                  return `${Math.round(value / 1000)}k g`;
                }
                return `${value} kg`;
              }}
              domain={unitMode === 'GRAM' ? [0, 110000] : [0, 110]}
            />
            <RechartsTooltip
              content={({ active, payload, label }) => {
                if (!active || !payload || !payload.length) return null;
                const point = payload[0]?.payload as DailyStockRecord;

                return (
                  <div className="bg-slate-900 text-white p-3 rounded-lg shadow-xl text-xs border border-slate-800 min-w-[220px]">
                    <div className="flex items-center justify-between pb-1.5 mb-2 border-b border-slate-800">
                      <span className="font-bold flex items-center gap-1.5 text-slate-200">
                        <Calendar className="w-3.5 h-3.5 text-blue-400" />
                        {point.date} ({label})
                      </span>
                      {point.eventType && (
                        <span className="text-[10px] font-semibold text-amber-300">
                          {point.eventType}
                        </span>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      {visibleProducts['SKU-RIBEYE-AUS'] && (
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-slate-300">
                            <span className="w-2 h-2 rounded-full bg-sky-500" />
                            Ribeye Meltique:
                          </span>
                          <span className="font-mono font-bold text-white">
                            {unitMode === 'GRAM'
                              ? `${point.ribeyeGram.toLocaleString('id-ID')} g`
                              : `${point.ribeyeKg.toFixed(1)} KG`}
                          </span>
                        </div>
                      )}

                      {visibleProducts['SKU-SIRLOIN-USA'] && (
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-slate-300">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            Sirloin USA:
                          </span>
                          <span className="font-mono font-bold text-white">
                            {unitMode === 'GRAM'
                              ? `${point.sirloinGram.toLocaleString('id-ID')} g`
                              : `${point.sirloinKg.toFixed(1)} KG`}
                          </span>
                        </div>
                      )}

                      {visibleProducts['SKU-SHORTPLATE-US'] && (
                        <div className="flex items-center justify-between">
                          <span className="flex items-center gap-1.5 text-slate-300">
                            <span className="w-2 h-2 rounded-full bg-amber-500" />
                            US Shortplate:
                          </span>
                          <span className="font-mono font-bold text-white">
                            {unitMode === 'GRAM'
                              ? `${point.shortplateGram.toLocaleString('id-ID')} g`
                              : `${point.shortplateKg.toFixed(1)} KG`}
                          </span>
                        </div>
                      )}
                    </div>

                    {point.eventNote && (
                      <div className="mt-2 pt-1.5 border-t border-slate-800 text-[11px] text-amber-200 flex items-start gap-1">
                        <Info className="w-3 h-3 shrink-0 mt-0.5" />
                        <span>{point.eventNote}</span>
                      </div>
                    )}
                  </div>
                );
              }}
            />

            {/* Batas Aman Reference Line (30 KG Threshold) */}
            {showSafetyThreshold && (
              <ReferenceLine
                y={unitMode === 'GRAM' ? 30000 : 30.0}
                stroke="#e11d48"
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: unitMode === 'GRAM' ? 'Batas Aman: 30.000 g' : 'Batas Aman: 30.0 KG',
                  position: 'insideTopLeft',
                  fill: '#e11d48',
                  fontSize: 10,
                  fontWeight: 600,
                }}
              />
            )}

            {/* Line 1: Ribeye Meltique AUS */}
            {visibleProducts['SKU-RIBEYE-AUS'] && (
              <Line
                type="monotone"
                dataKey={unitMode === 'GRAM' ? 'ribeyeGram' : 'ribeyeKg'}
                name="Ribeye Meltique AUS"
                stroke="#0284c7"
                strokeWidth={2.5}
                dot={{ r: 3.5, fill: '#0284c7', strokeWidth: 1, stroke: '#ffffff' }}
                activeDot={{ r: 6, fill: '#0284c7', stroke: '#ffffff', strokeWidth: 2 }}
              />
            )}

            {/* Line 2: Sirloin Choice USA */}
            {visibleProducts['SKU-SIRLOIN-USA'] && (
              <Line
                type="monotone"
                dataKey={unitMode === 'GRAM' ? 'sirloinGram' : 'sirloinKg'}
                name="Sirloin Choice USA"
                stroke="#059669"
                strokeWidth={2.5}
                dot={{ r: 3.5, fill: '#059669', strokeWidth: 1, stroke: '#ffffff' }}
                activeDot={{ r: 6, fill: '#059669', stroke: '#ffffff', strokeWidth: 2 }}
              />
            )}

            {/* Line 3: US Beef Shortplate */}
            {visibleProducts['SKU-SHORTPLATE-US'] && (
              <Line
                type="monotone"
                dataKey={unitMode === 'GRAM' ? 'shortplateGram' : 'shortplateKg'}
                name="US Beef Shortplate"
                stroke="#d97706"
                strokeWidth={2.5}
                dot={{ r: 3.5, fill: '#d97706', strokeWidth: 1, stroke: '#ffffff' }}
                activeDot={{ r: 6, fill: '#d97706', stroke: '#ffffff', strokeWidth: 2 }}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Footer Notes & Cold-Chain Warehouse Insight */}
      <div className="mt-3 pt-3 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            Batas aman 30 KG menjaga stok daging tetap tersedia selama pengiriman baru 5–7 hari.
          </span>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto font-medium">
          <button
            type="button"
            onClick={showAllProducts}
            className="text-blue-600 hover:text-blue-700 hover:underline flex items-center gap-1 text-[11px]"
          >
            <RefreshCw className="w-3 h-3" />
            Tampilkan Semua Garis
          </button>
        </div>
      </div>
    </div>
  );
};
