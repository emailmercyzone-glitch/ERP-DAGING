import React, { useState } from 'react';
import {
  X,
  DollarSign,
  Save,
  RotateCcw,
  TrendingUp,
  Percent,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  ShieldCheck,
  Tag,
  Layers,
  Building2,
  Crown
} from 'lucide-react';

export interface MeatTierPrices {
  RETAIL: number;
  HOREKA: number;
  VIP: number;
}

export interface ProductPriceItem {
  id: string;
  sku: string;
  name: string;
  category: string;
  basePricePerKg: number;
  tierPrices?: MeatTierPrices;
  stockGram: number;
  safetyStockGram: number;
  tag: string;
  estimatedHppPerKg?: number;
}

export interface QuickPriceManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: ProductPriceItem[];
  onSavePrices: (updatedProducts: ProductPriceItem[]) => void;
  targetProductId?: string | null;
}

export const QuickPriceManagerModal: React.FC<QuickPriceManagerModalProps> = ({
  isOpen,
  onClose,
  products,
  onSavePrices,
  targetProductId = null,
}) => {
  // Temporary edited prices map: id -> MeatTierPrices
  const [editedTierPrices, setEditedTierPrices] = useState<Record<string, MeatTierPrices>>({});
  const [filterCategory, setFilterCategory] = useState<string>('ALL');
  const [savedSuccess, setSavedSuccess] = useState<boolean>(false);

  // Sync state when modal opens or products change
  React.useEffect(() => {
    if (isOpen) {
      const initialMap: Record<string, MeatTierPrices> = {};
      products.forEach(p => {
        initialMap[p.id] = {
          RETAIL: p.tierPrices?.RETAIL || p.basePricePerKg,
          HOREKA: p.tierPrices?.HOREKA || Math.round(p.basePricePerKg * 0.9),
          VIP: p.tierPrices?.VIP || Math.round(p.basePricePerKg * 0.82),
        };
      });
      setEditedTierPrices(initialMap);
      setSavedSuccess(false);
    }
  }, [isOpen, products]);

  if (!isOpen) return null;

  const handlePriceChange = (id: string, tier: keyof MeatTierPrices, newPrice: number) => {
    setEditedTierPrices(prev => ({
      ...prev,
      [id]: {
        ...(prev[id] || { RETAIL: 0, HOREKA: 0, VIP: 0 }),
        [tier]: Math.max(0, newPrice),
      },
    }));
  };

  const handleSaveAll = () => {
    const updated = products.map(p => {
      const currentTiers = editedTierPrices[p.id] || {
        RETAIL: p.basePricePerKg,
        HOREKA: p.tierPrices?.HOREKA || Math.round(p.basePricePerKg * 0.9),
        VIP: p.tierPrices?.VIP || Math.round(p.basePricePerKg * 0.82),
      };

      return {
        ...p,
        basePricePerKg: currentTiers.RETAIL,
        tierPrices: currentTiers,
      };
    });

    onSavePrices(updated);
    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 900);
  };

  const handleReset = () => {
    const initialMap: Record<string, MeatTierPrices> = {};
    products.forEach(p => {
      initialMap[p.id] = {
        RETAIL: p.tierPrices?.RETAIL || p.basePricePerKg,
        HOREKA: p.tierPrices?.HOREKA || Math.round(p.basePricePerKg * 0.9),
        VIP: p.tierPrices?.VIP || Math.round(p.basePricePerKg * 0.82),
      };
    });
    setEditedTierPrices(initialMap);
  };

  const categories = ['ALL', ...Array.from(new Set(products.map(p => p.category)))];

  const displayedProducts = products.filter(p => {
    if (targetProductId) return p.id === targetProductId;
    if (filterCategory === 'ALL') return true;
    return p.category === filterCategory;
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Header with Title and Quick Back */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Layers className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold tracking-tight">
                  Master Harga Bertingkat Daging (MOD-05)
                </h2>
                <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded font-mono">
                  PLAN.md COMPLIANT
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Atur harga otomatis per tier: <strong>Retail (1-5 kg)</strong>, <strong>Horeka (5-20 kg)</strong>, dan <strong>VIP Grosir (≥20 kg)</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Tutup / Kembali"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter bar if not single product */}
        {!targetProductId && (
          <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3 text-xs shrink-0">
            <div className="flex items-center gap-1.5 overflow-x-auto">
              <span className="text-slate-500 font-medium">Kategori:</span>
              {categories.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setFilterCategory(cat)}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    filterCategory === cat
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {cat === 'ALL' ? 'Semua Produk' : cat}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-3 text-[11px] text-slate-500 font-medium hidden sm:flex">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-slate-400" />
                Tier 1: Retail (Eceran)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                Tier 2: HOREKA (Resto)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                Tier 3: VIP (Grosir/Box)
              </span>
            </div>
          </div>
        )}

        {/* Product Price Table / List */}
        <div className="p-5 overflow-y-auto space-y-3 flex-1">
          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100/90 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Produk &amp; Kategori</th>
                  <th className="px-3 py-3 text-right">HPP Landed</th>
                  <th className="px-3 py-3 text-center min-w-[150px]">
                    <div className="text-slate-900 font-extrabold flex items-center justify-center gap-1">
                      <span>Tier 1: Retail</span>
                    </div>
                    <div className="text-[10px] text-slate-500 font-normal">Umum / 1-4.9 KG</div>
                  </th>
                  <th className="px-3 py-3 text-center min-w-[150px] bg-blue-50/50">
                    <div className="text-blue-900 font-extrabold flex items-center justify-center gap-1">
                      <Building2 className="w-3.5 h-3.5 text-blue-600" />
                      <span>Tier 2: HOREKA</span>
                    </div>
                    <div className="text-[10px] text-blue-700 font-normal">Resto / 5-19.9 KG</div>
                  </th>
                  <th className="px-3 py-3 text-center min-w-[150px] bg-emerald-50/50">
                    <div className="text-emerald-900 font-extrabold flex items-center justify-center gap-1">
                      <Crown className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Tier 3: VIP Grosir</span>
                    </div>
                    <div className="text-[10px] text-emerald-700 font-normal">Box Pabrik / ≥20 KG</div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {displayedProducts.map(prod => {
                  const hppPerKg = prod.estimatedHppPerKg || Math.round(prod.basePricePerKg * 0.65);
                  const tiers = editedTierPrices[prod.id] || {
                    RETAIL: prod.tierPrices?.RETAIL || prod.basePricePerKg,
                    HOREKA: prod.tierPrices?.HOREKA || Math.round(prod.basePricePerKg * 0.9),
                    VIP: prod.tierPrices?.VIP || Math.round(prod.basePricePerKg * 0.82),
                  };

                  const marginRetail = tiers.RETAIL - hppPerKg;
                  const marginRetailPct = tiers.RETAIL > 0 ? ((marginRetail / tiers.RETAIL) * 100).toFixed(1) : '0';

                  const marginHoreka = tiers.HOREKA - hppPerKg;
                  const marginHorekaPct = tiers.HOREKA > 0 ? ((marginHoreka / tiers.HOREKA) * 100).toFixed(1) : '0';

                  const marginVip = tiers.VIP - hppPerKg;
                  const marginVipPct = tiers.VIP > 0 ? ((marginVip / tiers.VIP) * 100).toFixed(1) : '0';

                  return (
                    <tr key={prod.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-900">{prod.name}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono text-[10px] text-slate-500">{prod.sku}</span>
                          <span className="text-[10px] text-slate-400">•</span>
                          <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-100 text-slate-700">
                            {prod.category}
                          </span>
                        </div>
                      </td>

                      <td className="px-3 py-3 text-right font-mono text-slate-500 font-medium">
                        Rp {hppPerKg.toLocaleString('id-ID')}
                      </td>

                      {/* Tier 1: Retail Price */}
                      <td className="px-3 py-3">
                        <div className="flex flex-col items-center gap-1">
                          <div className="flex items-center gap-1">
                            <span className="text-slate-400 text-[10px] font-bold">Rp</span>
                            <input
                              type="number"
                              step={1000}
                              min={0}
                              value={tiers.RETAIL}
                              onChange={e => handlePriceChange(prod.id, 'RETAIL', parseInt(e.target.value || '0', 10))}
                              className="w-24 px-2 py-1 text-right font-mono font-bold text-xs rounded border border-slate-300 bg-white focus:ring-1 focus:ring-slate-900"
                            />
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-slate-500">
                            <span>Margin:</span>
                            <span className="font-mono font-bold text-slate-800">{marginRetailPct}%</span>
                          </div>
                        </div>
                      </td>

                      {/* Tier 2: HOREKA Price */}
                      <td className="px-3 py-3 bg-blue-50/30">
                        <div className="flex flex-col items-center gap-1">
                          <div className="flex items-center gap-1">
                            <span className="text-blue-400 text-[10px] font-bold">Rp</span>
                            <input
                              type="number"
                              step={1000}
                              min={0}
                              value={tiers.HOREKA}
                              onChange={e => handlePriceChange(prod.id, 'HOREKA', parseInt(e.target.value || '0', 10))}
                              className="w-24 px-2 py-1 text-right font-mono font-bold text-xs rounded border border-blue-300 bg-white focus:ring-1 focus:ring-blue-700 text-blue-900"
                            />
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-blue-700">
                            <span>Margin:</span>
                            <span className="font-mono font-bold">{marginHorekaPct}%</span>
                            <span className="text-[9px] text-slate-400">(-{Math.round(((tiers.RETAIL - tiers.HOREKA) / tiers.RETAIL) * 100)}%)</span>
                          </div>
                        </div>
                      </td>

                      {/* Tier 3: VIP Grosir Price */}
                      <td className="px-3 py-3 bg-emerald-50/30">
                        <div className="flex flex-col items-center gap-1">
                          <div className="flex items-center gap-1">
                            <span className="text-emerald-400 text-[10px] font-bold">Rp</span>
                            <input
                              type="number"
                              step={1000}
                              min={0}
                              value={tiers.VIP}
                              onChange={e => handlePriceChange(prod.id, 'VIP', parseInt(e.target.value || '0', 10))}
                              className="w-24 px-2 py-1 text-right font-mono font-bold text-xs rounded border border-emerald-300 bg-white focus:ring-1 focus:ring-emerald-700 text-emerald-900"
                            />
                          </div>
                          <div className="flex items-center gap-1 text-[10px] text-emerald-700">
                            <span>Margin:</span>
                            <span className="font-mono font-bold">{marginVipPct}%</span>
                            <span className="text-[9px] text-slate-400">(-{Math.round(((tiers.RETAIL - tiers.VIP) / tiers.RETAIL) * 100)}%)</span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs text-blue-900 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <div>
              <strong>Kaidah Otomasi POS (MOD-05):</strong> Saat kasir memilih akun pelanggan, harga katalog langsung mengikuti Tier Pelanggan (Retail, Horeka, atau VIP). Bila pelanggan Retail belanja $\ge$ 5 KG, sistem otomatis memberikan harga Horeka; dan jika $\ge$ 20 KG (karton/box), otomatis ditingkatkan ke harga VIP Grosir.
            </div>
          </div>
        </div>

        {/* Footer: Save, Back / Batal, and Reset Buttons */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reset Perubahan
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              Kembali / Batal
            </button>

            <button
              type="button"
              onClick={handleSaveAll}
              disabled={savedSuccess}
              className={`px-5 py-2 rounded-xl text-white font-extrabold text-xs transition-all flex items-center gap-2 shadow-sm cursor-pointer ${
                savedSuccess
                  ? 'bg-emerald-600'
                  : 'bg-slate-900 hover:bg-slate-800 active:scale-95'
              }`}
            >
              {savedSuccess ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-white" />
                  <span>Harga Bertingkat Disimpan!</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 text-emerald-400" />
                  <span>Simpan Semua Tier Harga</span>
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
