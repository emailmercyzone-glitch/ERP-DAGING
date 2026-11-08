import React from 'react';
import {
  AlertTriangle,
  Clock,
  Sparkles,
  Scissors,
  ArrowRight,
  Package,
  Calendar,
  MapPin,
  Scale,
  Zap,
  TrendingDown,
  Filter
} from 'lucide-react';

export interface CriticalLotItem {
  id: string;
  code: string;
  product: string;
  daysLeft: number;
  expiryDate: string;
  weightGram: number;
  loc: string;
  hppKgRupiah?: number;
}

export interface FefoCriticalWarningBannerProps {
  criticalLots: CriticalLotItem[];
  onOpenFlashSale: (productName: string) => void;
  onOpenTrimmingConversion: (lotId: string, weightKg: number) => void;
  onViewInWarehouse: (lotCode: string) => void;
  onFilterCriticalLotsInWarehouse?: () => void;
}

export const FefoCriticalWarningBanner: React.FC<FefoCriticalWarningBannerProps> = ({
  criticalLots,
  onOpenFlashSale,
  onOpenTrimmingConversion,
  onViewInWarehouse,
  onFilterCriticalLotsInWarehouse,
}) => {
  if (criticalLots.length === 0) return null;

  const totalWeightKg = (criticalLots.reduce((sum, l) => sum + l.weightGram, 0) / 1000).toFixed(1);
  const totalValueEst = criticalLots.reduce((sum, l) => {
    const hpp = l.hppKgRupiah || 170000;
    return sum + Math.round((l.weightGram / 1000) * hpp);
  }, 0);

  return (
    <div className="b2b-card bg-gradient-to-r from-rose-950/90 via-slate-900 to-amber-950/80 border-2 border-rose-500/60 p-4 sm:p-5 text-white shadow-xl space-y-4 animate-fade-in relative overflow-hidden">
      
      {/* Background Decorative Alert Glow */}
      <div className="absolute -top-12 -right-12 w-48 h-48 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Header Alert Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-rose-600/30 text-rose-400 border border-rose-500/50 shadow-inner mt-0.5 shrink-0">
            <AlertTriangle className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-black tracking-tight text-white">
                Peringatan Kritis FEFO: {criticalLots.length} Batch Daging Mendekati Expired (Sisa Umur &lt; 7 Hari)
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-black bg-rose-500 text-white animate-pulse">
                ACTION REQUIRED
              </span>
            </div>
            <p className="text-xs text-rose-200/90 mt-0.5">
              Segera prioritaskan penjualan melalui <strong>Promo Flash Sale POS</strong> atau jadwalkan <strong>Konversi Trimming (Tetelan)</strong> sebelum susut mutu.
            </p>
          </div>
        </div>

        {/* Aggregate KPI & Quick Filter Action */}
        <div className="flex flex-wrap items-center gap-2.5 self-end sm:self-auto shrink-0">
          <div className="flex items-center gap-3 bg-black/40 backdrop-blur-xs px-3.5 py-2 rounded-xl border border-rose-500/30">
            <div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">
                Total Daging Kritis
              </span>
              <div className="text-sm font-black font-mono text-rose-300">
                {totalWeightKg} KG
              </div>
            </div>
            <div className="h-6 w-px bg-slate-700" />
            <div>
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-bold">
                Nilai Modal Berisiko
              </span>
              <div className="text-sm font-black font-mono text-amber-300">
                Rp {totalValueEst.toLocaleString('id-ID')}
              </div>
            </div>
          </div>

          {onFilterCriticalLotsInWarehouse && (
            <button
              type="button"
              onClick={onFilterCriticalLotsInWarehouse}
              className="px-3 py-2 rounded-xl bg-rose-600/90 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer border border-rose-400/40 shadow-sm hover:scale-[1.02]"
              title="Buka Modul Gudang dengan filter otomatis menyembunyikan batch > 30 hari"
            >
              <Filter className="w-3.5 h-3.5 text-rose-200" />
              <span>Filter Gudang (≤30 Hari)</span>
            </button>
          )}
        </div>
      </div>

      {/* Critical Batches Horizontal List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 relative z-10">
        {criticalLots.map(lot => {
          const lotWeightKg = (lot.weightGram / 1000).toFixed(1);
          const isUrgent3Days = lot.daysLeft <= 3;

          return (
            <div
              key={lot.id}
              className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-700/80 hover:border-rose-500/60 transition-all space-y-2.5 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="text-xs font-black text-white truncate">
                      {lot.product}
                    </h4>
                    <span className="text-[11px] font-mono text-slate-400 font-bold">
                      {lot.code}
                    </span>
                  </div>

                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-black shrink-0 ${
                    isUrgent3Days
                      ? 'bg-rose-500/30 text-rose-300 border border-rose-500/60 animate-pulse'
                      : 'bg-amber-500/30 text-amber-300 border border-amber-500/60'
                  }`}>
                    {lot.daysLeft} Hari Lagi ({lot.expiryDate})
                  </span>
                </div>

                <div className="flex items-center gap-4 text-xs text-slate-300 pt-2 border-t border-slate-800 mt-2">
                  <span className="flex items-center gap-1 font-mono font-bold text-slate-200">
                    <Scale className="w-3.5 h-3.5 text-slate-400" />
                    {lotWeightKg} KG
                  </span>

                  <span className="flex items-center gap-1 font-mono text-blue-300">
                    <MapPin className="w-3.5 h-3.5 text-blue-400" />
                    {lot.loc}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-3 gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => onOpenFlashSale(lot.product)}
                  className="px-2 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center justify-center gap-1 transition-colors cursor-pointer shadow-2xs"
                  title="Aktifkan diskon bazar / flash sale untuk produk ini di POS"
                >
                  <Zap className="w-3 h-3 text-amber-300" />
                  <span>Flash Sale</span>
                </button>

                <button
                  type="button"
                  onClick={() => onOpenTrimmingConversion(lot.id, lot.weightGram / 1000)}
                  className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-[11px] border border-slate-700 flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  title="Konversi trimming potongan ini menjadi tetelan olahan"
                >
                  <Scissors className="w-3 h-3 text-rose-400" />
                  <span>Trimming</span>
                </button>

                <button
                  type="button"
                  onClick={() => onViewInWarehouse(lot.code)}
                  className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-bold text-[11px] border border-slate-700 flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  title="Tampilkan detail batch ini di Cold Storage Gudang"
                >
                  <Package className="w-3 h-3 text-blue-400" />
                  <span>Gudang</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
};
