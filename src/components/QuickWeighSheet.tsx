import React, { useEffect, useState } from 'react';
import {
  X,
  Scale,
  RotateCcw,
  Plus,
  Minus,
  ShoppingCart,
  Zap,
  Info,
} from 'lucide-react';

export interface WeighableProduct {
  id: string;
  sku: string;
  name: string;
  basePricePerKg: number;
  imageUrl?: string;
  category?: string;
  stockGram?: number;
}

interface QuickWeighSheetProps {
  isOpen: boolean;
  product: WeighableProduct | null;
  onClose: () => void;
  onAddToCart: (product: WeighableProduct, weightGram: number) => void;
  customerTier?: string;
  effectivePricePerKg?: number;
}

export const QuickWeighSheet: React.FC<QuickWeighSheetProps> = ({
  isOpen,
  product,
  onClose,
  onAddToCart,
  customerTier = 'RETAIL',
  effectivePricePerKg,
}) => {
  const [grossWeightGram, setGrossWeightGram] = useState<number>(0);
  const [tareGram, setTareGram] = useState<number>(0);

  useEffect(() => {
    if (isOpen && product) {
      setGrossWeightGram(0);
      setTareGram(0);
    }
  }, [isOpen, product]);

  if (!isOpen || !product) return null;

  const unitPrice = effectivePricePerKg ?? product.basePricePerKg;
  const netWeightGram = Math.max(0, Math.round(grossWeightGram - tareGram));
  const totalRupiah = Math.round((netWeightGram * unitPrice) / 1000);
  const weightKgFormatted = (netWeightGram / 1000).toFixed(3);

  const handleAdjustWeight = (deltaGram: number) => {
    setGrossWeightGram((current) => Math.max(0, current + deltaGram));
  };

  const handleSetPreset = (targetGram: number) => {
    setGrossWeightGram(targetGram);
  };

  const handleResetTare = () => {
    setTareGram(0);
  };

  const handleConfirmAddToCart = () => {
    if (netWeightGram <= 0) return;
    onAddToCart(product, netWeightGram);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end justify-center p-0 sm:p-4 animate-tab-fade">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-100 overflow-hidden z-10 animate-slide-up flex flex-col max-h-[90vh]">
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mt-3 mb-1 shrink-0" />

        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold text-slate-900">Input Berat Barang</h3>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                  Manual
                </span>
              </div>
              <p className="text-[11px] text-slate-500">Masukkan berat aktual · ERP DAGING</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup input berat"
            className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="flex items-center gap-3.5 p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.name}
                className="w-16 h-16 rounded-xl object-cover border border-slate-200 shrink-0 shadow-2xs"
              />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-slate-200 text-slate-500 flex items-center justify-center text-xs font-bold shrink-0">
                MEAT
              </div>
            )}

            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-mono text-slate-400 font-semibold">{product.sku}</span>
              <h4 className="text-sm font-extrabold text-slate-900 truncate leading-tight">{product.name}</h4>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-xs font-extrabold text-slate-900 font-mono">
                  Rp {unitPrice.toLocaleString('id-ID')}
                </span>
                <span className="text-[10px] text-slate-500">/ KG ({customerTier})</span>
              </div>
            </div>
          </div>

          <div className="bg-slate-950 rounded-2xl p-5 text-white border border-slate-800 shadow-inner space-y-3">
            <div className="flex items-center justify-between text-xs border-b border-slate-800/80 pb-2.5">
              <span className="font-semibold text-slate-300">BERAT BERSIH</span>
              <span className="font-semibold text-amber-300">Input manual · Bluetooth belum terhubung</span>
            </div>

            <div className="text-center py-2">
              <div className="text-4xl sm:text-5xl font-extrabold font-mono text-emerald-400 tracking-tight my-1">
                {weightKgFormatted} <span className="text-2xl text-slate-400 font-normal">KG</span>
              </div>
              <span className="text-xs font-mono text-slate-400">
                {netWeightGram.toLocaleString('id-ID')} gram bersih
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <label className="space-y-1">
                <span className="block text-[11px] text-slate-300 font-semibold">Berat bruto (gram)</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  value={grossWeightGram || ''}
                  onChange={(event) => setGrossWeightGram(Math.max(0, Math.round(Number(event.target.value) || 0)))}
                  placeholder="0"
                  className="w-full rounded-lg bg-white text-slate-900 px-3 py-2 text-sm font-mono font-bold"
                />
              </label>
              <label className="space-y-1">
                <span className="block text-[11px] text-slate-300 font-semibold">Tare wadah (gram)</span>
                <input
                  type="number"
                  min={0}
                  step={1}
                  inputMode="numeric"
                  value={tareGram || ''}
                  onChange={(event) => setTareGram(Math.max(0, Math.round(Number(event.target.value) || 0)))}
                  placeholder="0"
                  className="w-full rounded-lg bg-white text-slate-900 px-3 py-2 text-sm font-mono font-bold"
                />
              </label>
            </div>

            <div className="pt-3 border-t border-slate-800 flex items-center justify-between bg-slate-900/90 -mx-5 -mb-5 p-4 rounded-b-2xl">
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 font-medium">TOTAL HARGA</span>
                <span className="text-[10px] text-emerald-400 font-semibold">Rupiah bulat · tanpa desimal</span>
              </div>
              <div className="text-xl sm:text-2xl font-extrabold font-mono text-white">
                Rp {totalRupiah.toLocaleString('id-ID')}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetTare}
              className="flex-1 py-2.5 px-3 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer border bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200"
            >
              <RotateCcw className="w-4 h-4" />
              Reset tare
            </button>

            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => handleAdjustWeight(-50)}
                className="w-10 h-10 bg-white hover:bg-slate-50 text-slate-800 font-extrabold rounded-lg flex items-center justify-center cursor-pointer"
                title="Kurangi 50 gram"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="text-[11px] font-bold text-slate-600 px-1.5">±50g</span>
              <button
                type="button"
                onClick={() => handleAdjustWeight(50)}
                className="w-10 h-10 bg-white hover:bg-slate-50 text-slate-800 font-extrabold rounded-lg flex items-center justify-center cursor-pointer"
                title="Tambah 50 gram"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>Set berat bruto cepat:</span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: '250g', gram: 250 },
                { label: '500g', gram: 500 },
                { label: '1.000g', gram: 1000 },
                { label: '2.500g', gram: 2500 },
              ].map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => handleSetPreset(chip.gram)}
                  className={`py-2 px-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                    grossWeightGram === chip.gram
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900">
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <p className="text-[11px] leading-relaxed">
              Integrasi timbangan Bluetooth belum tersedia. Masukkan angka dari timbangan secara manual; berat contoh tidak diisi otomatis.
            </p>
          </div>
        </div>

        <div className="p-4 bg-white border-t border-slate-100 shrink-0">
          <button
            type="button"
            onClick={handleConfirmAddToCart}
            disabled={netWeightGram <= 0}
            className="w-full py-3.5 px-5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-extrabold text-sm rounded-2xl shadow-xl flex items-center justify-between transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-emerald-200 group-hover:scale-110 transition-transform" />
              <span>Masukkan ke Keranjang</span>
            </div>
            <div className="flex items-baseline gap-1.5 bg-emerald-700/80 px-3 py-1 rounded-xl text-white font-mono">
              <span className="text-xs opacity-80">{(netWeightGram / 1000).toFixed(2)} KG =</span>
              <span className="text-sm font-extrabold">Rp {totalRupiah.toLocaleString('id-ID')}</span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};
