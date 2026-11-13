import React, { useState, useEffect } from 'react';
import { 
  X, 
  Scale, 
  Wifi, 
  CheckCircle2, 
  RotateCcw, 
  Plus, 
  Minus, 
  ShoppingCart, 
  Sparkles,
  Zap,
  Info
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
  effectivePricePerKg
}) => {
  const [weightGram, setWeightGram] = useState<number>(1750);
  const [isStable, setIsStable] = useState<boolean>(true);
  const [tareApplied, setTareApplied] = useState<boolean>(false);
  const [isConnecting, setIsConnecting] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && product) {
      setWeightGram(1750); // Default simulation 1.750 kg
      setIsStable(true);
      setTareApplied(false);
    }
  }, [isOpen, product]);

  if (!isOpen || !product) return null;

  const unitPrice = effectivePricePerKg || product.basePricePerKg;
  const netWeightGram = Math.max(0, tareApplied ? weightGram - 120 : weightGram); // 120g tray tare
  const totalRupiah = Math.round((netWeightGram * unitPrice) / 1000);
  const weightKgFormatted = (netWeightGram / 1000).toFixed(3);

  const handleAdjustWeight = (deltaGram: number) => {
    setIsStable(false);
    setWeightGram(prev => Math.max(50, prev + deltaGram));
    setTimeout(() => setIsStable(true), 180);
  };

  const handleSetPreset = (targetGram: number) => {
    setIsStable(false);
    setWeightGram(targetGram);
    setTimeout(() => setIsStable(true), 180);
  };

  const handleZeroTare = () => {
    setTareApplied(prev => !prev);
    setIsStable(false);
    setTimeout(() => setIsStable(true), 150);
  };

  const handleConfirmAddToCart = () => {
    onAddToCart(product, netWeightGram);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end justify-center p-0 sm:p-4 animate-tab-fade">
      
      {/* Backdrop overlay listener */}
      <div className="absolute inset-0" onClick={onClose} />

      {/* Floating Modal Sheet Container */}
      <div className="relative w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-100 overflow-hidden z-10 animate-slide-up flex flex-col max-h-[90vh]">
        
        {/* Top Handle bar for mobile drag feeling */}
        <div className="w-12 h-1.5 bg-slate-200 rounded-full mx-auto mt-3 mb-1 shrink-0" />

        {/* Modal Header */}
        <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold text-slate-900">Timbang Barang</h3>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <Wifi className="w-3 h-3 text-emerald-600" />
                  Timbangan Terhubung
                </span>
              </div>
              <p className="text-[11px] text-slate-500">Timbangan Otomatis · Kasir Toko Sampora</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 space-y-4 overflow-y-auto">

          {/* Product Header Card */}
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

          {/* GIANT DIGITAL SCALE DISPLAY (LED SCREEN LOOK) */}
          <div className="bg-slate-950 rounded-2xl p-5 text-white border border-slate-800 shadow-inner space-y-3 relative overflow-hidden">
            <div className="flex items-center justify-between text-xs border-b border-slate-800/80 pb-2.5">
              <div className="flex items-center gap-2">
                <Wifi className="w-4 h-4 text-emerald-400" />
                <span className="font-mono text-slate-300 text-[11px]">Sinyal BT: 98% (-42 dBm)</span>
              </div>
              
              {isStable ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 bg-emerald-950/80 px-2.5 py-0.5 rounded-md border border-emerald-500/30">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  Berat Stabil
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-300 bg-amber-950/80 px-2.5 py-0.5 rounded-md border border-amber-500/30">
                  <RotateCcw className="w-3.5 h-3.5 text-amber-300" />
                  Menimbang...
                </span>
              )}
            </div>

            {/* Scale Giant Weight Number */}
            <div className="text-center py-2">
              <span className="text-[11px] text-slate-400 block font-medium">BOBOT TIMBANGAN DIGITAL</span>
              <div className="text-4xl sm:text-5xl font-extrabold font-mono text-emerald-400 tracking-tight my-1">
                {weightKgFormatted} <span className="text-2xl text-slate-400 font-normal">KG</span>
              </div>
              <span className="text-xs font-mono text-slate-400">
                ({netWeightGram.toLocaleString('id-ID')} Gram {tareApplied ? '• Tray Tare -120g' : ''})
              </span>
            </div>

            {/* Instant IDR Calculation */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-between bg-slate-900/90 -mx-5 -mb-5 p-4 rounded-b-2xl">
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 font-medium">TOTAL HARGA RUPIAH (INSTAN)</span>
                <span className="text-[10px] text-emerald-400 font-semibold">Bebas Desimal • Bulat Otomatis</span>
              </div>
              <div className="text-xl sm:text-2xl font-extrabold font-mono text-white">
                Rp {totalRupiah.toLocaleString('id-ID')}
              </div>
            </div>
          </div>

          {/* Zero/Tare Button & Weight Fine Controls */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleZeroTare}
              className={`flex-1 py-2.5 px-3 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer border ${
                tareApplied 
                  ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-xs' 
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200'
              }`}
            >
              <RotateCcw className="w-4 h-4" />
              <span>{tareApplied ? 'TARE Aktif (-120g)' : 'ZERO / TARE (Nolkan Tray)'}</span>
            </button>

            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => handleAdjustWeight(-50)}
                className="w-10 h-10 bg-white hover:bg-slate-50 text-slate-800 font-extrabold rounded-lg flex items-center justify-center cursor-pointer"
                title="Kurangi 50g"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="text-[11px] font-bold text-slate-600 px-1.5">±50g</span>
              <button
                type="button"
                onClick={() => handleAdjustWeight(50)}
                className="w-10 h-10 bg-white hover:bg-slate-50 text-slate-800 font-extrabold rounded-lg flex items-center justify-center cursor-pointer"
                title="Tambah 50g"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Preset Chip Gramatur Cepat (1-Tap Chips) */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>Preset Gramatur Cepat (1-Tap):</span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: '+250g', gram: 250 },
                { label: '+500g', gram: 500 },
                { label: '+1.000g', gram: 1000 },
                { label: '+2.500g', gram: 2500 }
              ].map(chip => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => handleSetPreset(chip.gram)}
                  className={`py-2 px-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                    netWeightGram === chip.gram
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-white hover:bg-slate-50 text-slate-800 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* STICKY BOTTOM BAR ACTION */}
        <div className="p-4 bg-white border-t border-slate-100 shrink-0">
          <button
            type="button"
            onClick={handleConfirmAddToCart}
            className="w-full py-3.5 px-5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-extrabold text-sm rounded-2xl shadow-xl flex items-center justify-between transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-emerald-200 group-hover:scale-110 transition-transform" />
              <span>Masukkan ke Keranjang</span>
            </div>
            <div className="flex items-baseline gap-1.5 bg-emerald-700/80 px-3 py-1 rounded-xl text-white font-mono">
              <span className="text-xs opacity-80">{(netWeightGram/1000).toFixed(2)} KG =</span>
              <span className="text-sm font-extrabold">Rp {totalRupiah.toLocaleString('id-ID')}</span>
            </div>
          </button>
        </div>

      </div>
    </div>
  );
};
