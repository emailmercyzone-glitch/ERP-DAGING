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
    <div className="b2b-card bg-slate-900 border border-slate-800 p-4 sm:p-5 text-white space-y-4">

      {/* Header Alert Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-xl bg-rose-500/20 text-rose-300 border border-rose-500/30 mt-0.5 shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-extrabold tracking-tight text-white">
                Perlu Segera Dijual: {criticalLots.length} Batch Daging Masa Simpan &lt; 7 Hari
              </h3>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-rose-500/20 text-rose-200 border border-rose-500/40">
                <AlertTriangle className="w-3 h-3" />
                Perlu dicek
              </span>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              Prioritaskan penjualan lewat <strong>Promo Kasir</strong> atau jadwalkan <strong>Potong &amp; Olah Ulang</strong> agar kualitas tetap terjaga.
            </p>
          </div>
        </div>

        {/* Aggregate KPI & Quick Filter Action */}
        <div className="flex flex-wrap items-center gap-2.5 self-end sm:self-auto shrink-0">
          <div className="flex items-center gap-3 bg-slate-800/80 px-3.5 py-2 rounded-xl border border-slate-700">
            <div>
              <span className="text-[11px] text-slate-400 block font-medium">
                Total Daging Perlu Cek
              </span>
              <div className="text-sm font-bold font-mono tabular-nums text-rose-300">
                {totalWeightKg} KG
              </div>
            </div>
            <div className="h-6 w-px bg-slate-700" />
            <div>
              <span className="text-[11px] text-slate-400 block font-medium">
                Nilai Modal Barang
              </span>
              <div className="text-sm font-bold font-mono tabular-nums text-amber-300">
                Rp {totalValueEst.toLocaleString('id-ID')}
              </div>
            </div>
          </div>

          {onFilterCriticalLotsInWarehouse && (
            <button
              type="button"
              onClick={onFilterCriticalLotsInWarehouse}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Buka Stok Gudang dengan filter masa simpan ≤30 hari"
            >
              <Filter className="w-3.5 h-3.5 text-rose-100" />
              <span>Lihat Stok (≤30 Hari)</span>
            </button>
          )}
        </div>
      </div>

      {/* Critical Batches List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {criticalLots.map(lot => {
          const lotWeightKg = (lot.weightGram / 1000).toFixed(1);
          const isUrgent3Days = lot.daysLeft <= 3;

          return (
            <div
              key={lot.id}
              className="p-3.5 rounded-xl bg-slate-800/70 border border-slate-700 space-y-3 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-white truncate">
                      {lot.product}
                    </h4>
                    <span className="text-[11px] font-mono text-slate-400 font-medium">
                      {lot.code}
                    </span>
                  </div>

                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-mono font-semibold shrink-0 ${
                    isUrgent3Days
                      ? 'bg-rose-500/20 text-rose-200 border border-rose-500/40'
                      : 'bg-amber-500/20 text-amber-200 border border-amber-500/40'
                  }`}>
                    <Clock className="w-3 h-3" />
                    {lot.daysLeft} Hari ({lot.expiryDate})
                  </span>
                </div>

                <div className="flex items-center gap-4 text-xs text-slate-300 pt-2 border-t border-slate-700/80 mt-2">
                  <span className="flex items-center gap-1 font-mono font-semibold text-slate-100">
                    <Scale className="w-3.5 h-3.5 text-slate-400" />
                    {lotWeightKg} KG
                  </span>

                  <span className="flex items-center gap-1 font-mono text-slate-300">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {lot.loc}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => onOpenFlashSale(lot.product)}
                  className="min-h-[40px] px-2 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  title="Aktifkan harga promo untuk barang ini di Kasir"
                >
                  <Zap className="w-3.5 h-3.5 text-amber-200" />
                  <span>Promo</span>
                </button>

                <button
                  type="button"
                  onClick={() => onOpenTrimmingConversion(lot.id, lot.weightGram / 1000)}
                  className="min-h-[40px] px-2 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-100 font-bold text-xs border border-slate-600 flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  title="Olah potongan ini menjadi daging cincang / tetelan"
                >
                  <Scissors className="w-3.5 h-3.5 text-rose-300" />
                  <span>Olah</span>
                </button>

                <button
                  type="button"
                  onClick={() => onViewInWarehouse(lot.code)}
                  className="min-h-[40px] px-2 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-100 font-bold text-xs border border-slate-600 flex items-center justify-center gap-1 transition-colors cursor-pointer"
                  title="Lihat lokasi barang di Gudang"
                >
                  <Package className="w-3.5 h-3.5 text-blue-300" />
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
