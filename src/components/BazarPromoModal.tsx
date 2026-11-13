import React, { useState } from 'react';
import {
  X,
  Tag,
  Plus,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Percent,
  TrendingDown,
  ShoppingBag,
  Flame,
  Check
} from 'lucide-react';

export interface BazarPromoItem {
  id: string;
  title: string;
  sku: string;
  productName: string;
  normalPricePerKg: number;
  promoPricePerKg: number;
  discountRupiahPerKg: number;
  discountPercent: number;
  startDate: string;
  endDate: string;
  quotaKg: number;
  soldKg: number;
  isActive: boolean;
  badgeLabel: string;
}

export const INITIAL_BAZAR_PROMOS: BazarPromoItem[] = [
  {
    id: 'PROMO_01',
    title: 'Weekend Steakhouse Flash Promo',
    sku: 'SKU-RIBEYE-AUS',
    productName: 'Ribeye Meltique Australia (Primal)',
    normalPricePerKg: 240000,
    promoPricePerKg: 215000,
    discountRupiahPerKg: 25000,
    discountPercent: 10.4,
    startDate: '2026-11-06 00:00',
    endDate: '2026-11-08 23:59',
    quotaKg: 50.0,
    soldKg: 22.5,
    isActive: true,
    badgeLabel: '🔥 Flash Sale Weekend',
  },
  {
    id: 'PROMO_02',
    title: 'Bazar Shabu Shabu & Grill Katering',
    sku: 'SKU-SHORTPLATE-US',
    productName: 'US Beef Shortplate 500g Slice',
    normalPricePerKg: 125000,
    promoPricePerKg: 109000,
    discountRupiahPerKg: 16000,
    discountPercent: 12.8,
    startDate: '2026-11-01 00:00',
    endDate: '2026-11-10 23:59',
    quotaKg: 100.0,
    soldKg: 68.0,
    isActive: true,
    badgeLabel: '🥩 Bazar Awal Bulan',
  },
];

export interface BazarPromoModalProps {
  isOpen: boolean;
  onClose: () => void;
  promos: BazarPromoItem[];
  onTogglePromo: (promoId: string) => void;
  onCreatePromo: (newPromo: BazarPromoItem) => void;
}

export const BazarPromoModal: React.FC<BazarPromoModalProps> = ({
  isOpen,
  onClose,
  promos,
  onTogglePromo,
  onCreatePromo,
}) => {
  const [viewMode, setViewMode] = useState<'LIST' | 'CREATE'>('LIST');

  // Form State
  const [title, setTitle] = useState<string>('Promo Festival Daging KARKASIA');
  const [sku, setSku] = useState<string>('SKU-SIRLOIN-USA');
  const [productName, setProductName] = useState<string>('Sirloin Choice USA (Primal)');
  const [normalPrice, setNormalPrice] = useState<number>(210000);
  const [promoPrice, setPromoPrice] = useState<number>(185000);
  const [quotaKg, setQuotaKg] = useState<number>(40);
  const [badgeLabel, setBadgeLabel] = useState<string>('🎉 Promo Spesial');
  const [endDateStr, setEndDateStr] = useState<string>('2026-11-12');
  const [formError, setFormError] = useState<string | null>(null);

  if (!isOpen) return null;

  const discountRupiah = Math.max(0, normalPrice - promoPrice);
  const discountPercent = normalPrice > 0 ? Number(((discountRupiah / normalPrice) * 100).toFixed(1)) : 0;

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (promoPrice <= 0 || promoPrice >= normalPrice) {
      setFormError('Harga promo harus lebih rendah daripada harga normal!');
      return;
    }
    setFormError(null);

    const newPromo: BazarPromoItem = {
      id: `PROMO_${Date.now()}`,
      title,
      sku,
      productName,
      normalPricePerKg: normalPrice,
      promoPricePerKg: promoPrice,
      discountRupiahPerKg: discountRupiah,
      discountPercent,
      startDate: new Date().toISOString().slice(0, 10),
      endDate: endDateStr,
      quotaKg,
      soldKg: 0,
      isActive: true,
      badgeLabel,
    };

    onCreatePromo(newPromo);
    setViewMode('LIST');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-tab-fade">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400">
              <Flame className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold tracking-tight">Promo Bazar Berjadwal &amp; Flash Sale</h3>
                <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30">
                  Diskon Event
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Pemberlakuan harga spesial event pameran, kuota kilogram, &amp; sinkronisasi ke mesin kasir
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
            <span>Event Aktif: <strong>{promos.filter(p => p.isActive).length} Promo</strong></span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setViewMode(viewMode === 'LIST' ? 'CREATE' : 'LIST')}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-1.5 shadow-xs"
            >
              {viewMode === 'LIST' ? (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  Tambah Promo Bazar
                </>
              ) : (
                'Kembali ke Daftar'
              )}
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {viewMode === 'CREATE' ? (
            <form onSubmit={handleCreateSubmit} className="space-y-4 animate-tab-fade">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-bold text-slate-700">Nama Event / Judul Promo</label>
                  <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="Contoh: Bazar Daging Awal Bulan KARKASIA"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:ring-1 focus:ring-slate-900"
                    required
                  />
                </div>

                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-bold text-slate-700">Pilih Produk Daging</label>
                  <select
                    value={sku}
                    onChange={e => {
                      const selected = e.target.value;
                      setSku(selected);
                      if (selected === 'SKU-RIBEYE-AUS') {
                        setProductName('Ribeye Meltique Australia (Primal)');
                        setNormalPrice(240000);
                        setPromoPrice(215000);
                      } else if (selected === 'SKU-SIRLOIN-USA') {
                        setProductName('Sirloin Choice USA (Primal)');
                        setNormalPrice(210000);
                        setPromoPrice(185000);
                      } else if (selected === 'SKU-SHORTPLATE-US') {
                        setProductName('US Beef Shortplate 500g Slice');
                        setNormalPrice(125000);
                        setPromoPrice(109000);
                      } else {
                        setProductName('Tetelan Rawon Super KARKASIA');
                        setNormalPrice(85000);
                        setPromoPrice(75000);
                      }
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-1 focus:ring-slate-900"
                  >
                    <option value="SKU-RIBEYE-AUS">Ribeye Meltique AUS (Normal: Rp 240.000/KG)</option>
                    <option value="SKU-SIRLOIN-USA">Sirloin Choice USA (Normal: Rp 210.000/KG)</option>
                    <option value="SKU-SHORTPLATE-US">US Beef Shortplate 500g Slice (Normal: Rp 125.000/KG)</option>
                    <option value="SKU-TETELAN-SP">Tetelan Rawon Super KARKASIA (Normal: Rp 85.000/KG)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Harga Normal (IDR/KG)</label>
                  <input
                    type="number"
                    value={normalPrice}
                    readOnly
                    className="w-full px-3 py-2 bg-slate-100 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-600"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700">Harga Promo Bazar (IDR/KG)</label>
                    <span className="text-[11px] font-bold text-emerald-600">
                      Diskon {discountPercent}% (-Rp {discountRupiah.toLocaleString('id-ID')})
                    </span>
                  </div>
                  <input
                    type="number"
                    step={1000}
                    value={promoPrice}
                    onChange={e => {
                      setFormError(null);
                      setPromoPrice(parseInt(e.target.value || '0', 10));
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold focus:bg-white focus:ring-1 focus:ring-slate-900"
                    required
                  />
                  {formError && (
                    <p className="text-[11px] font-semibold text-rose-600 mt-1">{formError}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Batas Kuota Promo (KG)</label>
                  <input
                    type="number"
                    min={1}
                    value={quotaKg}
                    onChange={e => setQuotaKg(parseFloat(e.target.value || '1'))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold focus:bg-white focus:ring-1 focus:ring-slate-900"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Berlaku Sampai Tanggal</label>
                  <input
                    type="date"
                    value={endDateStr}
                    onChange={e => setEndDateStr(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:bg-white focus:ring-1 focus:ring-slate-900"
                    required
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setViewMode('LIST')}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  <Check className="w-4 h-4" />
                  Aktifkan Promo Bazar Sekarang
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-3 animate-tab-fade">
              {promos.map(promo => {
                const soldPercent = Math.min(100, Math.round((promo.soldKg / promo.quotaKg) * 100));
                return (
                  <div
                    key={promo.id}
                    className={`p-4 rounded-xl border transition-all space-y-3 ${
                      promo.isActive
                        ? 'bg-white border-amber-200 shadow-2xs'
                        : 'bg-slate-50 border-slate-200 opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                            {promo.badgeLabel}
                          </span>
                          <span className="text-xs font-bold text-slate-900">{promo.title}</span>
                        </div>
                        <div className="text-xs font-medium text-slate-600 mt-1">
                          {promo.productName} ({promo.sku})
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onTogglePromo(promo.id)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                            promo.isActive
                              ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                              : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                          }`}
                        >
                          {promo.isActive ? '✓ Aktif' : 'Non-Aktif'}
                        </button>
                      </div>
                    </div>

                    {/* Price Comparison */}
                    <div className="flex items-baseline gap-3 pt-1 border-t border-slate-100">
                      <div>
                        <span className="text-[10px] text-slate-400 block line-through">
                          Rp {promo.normalPricePerKg.toLocaleString('id-ID')} / KG
                        </span>
                        <div className="text-base font-mono font-extrabold text-amber-700">
                          Rp {promo.promoPricePerKg.toLocaleString('id-ID')}
                          <span className="text-xs font-normal text-slate-500"> / KG</span>
                        </div>
                      </div>

                      <div className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        Hemat Rp {promo.discountRupiahPerKg.toLocaleString('id-ID')} / KG ({promo.discountPercent}%)
                      </div>
                    </div>

                    {/* Quota Progress */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>Penjualan Promo: <strong className="text-slate-800">{promo.soldKg} KG</strong> dari {promo.quotaKg} KG</span>
                        <span className="font-bold text-slate-700">{soldPercent}% Terjual</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className="h-full bg-amber-500 rounded-full transition-all duration-500"
                          style={{ width: `${soldPercent}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>Otomatis diaplikasikan ke Keranjang Kasir POS Toko KARKASIA</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-white border border-slate-300 font-bold text-slate-700 hover:bg-slate-100"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
