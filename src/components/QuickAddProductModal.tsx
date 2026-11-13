import React, { useEffect, useState, useRef } from 'react';
import {
  X,
  PackagePlus,
  Save,
  RotateCcw,
  Tag,
  DollarSign,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Camera,
  Upload,
  Image as ImageIcon
} from 'lucide-react';

export interface NewProductData {
  id: string;
  sku: string;
  name: string;
  category: string;
  basePricePerKg: number;
  stockGram: number;
  safetyStockGram: number;
  tag: string;
  estimatedHppPerKg?: number;
  openingLotExpiryDate?: string;
  openingLotLocation?: string;
  imageUrl?: string;
}

export interface QuickAddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddProductSuccess: (newProduct: NewProductData) => void;
  availableCategories?: Array<{ id: string; label: string }>;
  onAddNewCategoryInline?: (cat: { id: string; label: string }) => void;
}

export const QuickAddProductModal: React.FC<QuickAddProductModalProps> = ({
  isOpen,
  onClose,
  onAddProductSuccess,
  availableCategories,
  onAddNewCategoryInline,
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('PRIMAL');
  const [sku, setSku] = useState('');
  const [basePricePerKg, setBasePricePerKg] = useState<number>(0);
  const [estimatedHppPerKg, setEstimatedHppPerKg] = useState<number>(0);
  const [stockKg, setStockKg] = useState<number>(0);
  const [safetyStockKg, setSafetyStockKg] = useState<number>(0);
  const [tag, setTag] = useState('Produk Baru');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [openingLotExpiryDate, setOpeningLotExpiryDate] = useState('');
  const [openingLotLocation, setOpeningLotLocation] = useState('');
  const [formError, setFormError] = useState('');

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Inline Category Creation state
  const [showAddCatInline, setShowAddCatInline] = useState(false);
  const [newCatLabel, setNewCatLabel] = useState('');
  const [newCatId, setNewCatId] = useState('');
  const defaultCategoryId = availableCategories?.[0]?.id ?? 'PRIMAL';

  useEffect(() => {
    if (!isOpen) return;
    setName('');
    setCategory(defaultCategoryId);
    setSku('');
    setBasePricePerKg(0);
    setEstimatedHppPerKg(0);
    setStockKg(0);
    setSafetyStockKg(0);
    setTag('Produk Baru');
    setImageUrl('');
    setOpeningLotExpiryDate('');
    setOpeningLotLocation('');
    setFormError('');
    setShowAddCatInline(false);
    setNewCatLabel('');
    setNewCatId('');
  }, [isOpen, defaultCategoryId]);

  if (!isOpen) return null;

  const handleNameChange = (val: string) => {
    setName(val);
    if (!sku) {
      const clean = val.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase();
      setSku(`SKU-${clean}`);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setImageUrl(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !Number.isFinite(basePricePerKg) || basePricePerKg <= 0) {
      setFormError('Nama produk dan harga jual aktual wajib diisi.');
      return;
    }
    if (!Number.isFinite(stockKg) || stockKg < 0 || !Number.isFinite(safetyStockKg) || safetyStockKg < 0) {
      setFormError('Berat stok dan batas aman tidak boleh negatif.');
      return;
    }
    if (stockKg > 0 && (
      !Number.isFinite(estimatedHppPerKg) || estimatedHppPerKg <= 0 ||
      !openingLotExpiryDate || !openingLotLocation.trim()
    )) {
      setFormError('Stok awal membutuhkan HPP aktual, tanggal kedaluwarsa lot, dan lokasi freezer/rak.');
      return;
    }

    const newProd: NewProductData = {
      id: 'PROD_' + Date.now(),
      sku: sku.trim() || 'SKU-' + Date.now().toString().slice(-6),
      name: name.trim(),
      category,
      basePricePerKg: Math.round(basePricePerKg),
      stockGram: Math.round(stockKg * 1000),
      safetyStockGram: Math.round(safetyStockKg * 1000),
      tag: tag.trim() || 'Produk Baru',
      estimatedHppPerKg: estimatedHppPerKg > 0 ? Math.round(estimatedHppPerKg) : undefined,
      openingLotExpiryDate: stockKg > 0 ? openingLotExpiryDate : undefined,
      openingLotLocation: stockKg > 0 ? openingLotLocation.trim() : undefined,
      imageUrl: imageUrl.trim() || undefined,
    };

    onAddProductSuccess(newProd);
    onClose();
  };

  const marginPerKg = estimatedHppPerKg > 0 ? basePricePerKg - estimatedHppPerKg : null;
  const marginPercent = marginPerKg !== null && basePricePerKg > 0
    ? ((marginPerKg / basePricePerKg) * 100).toFixed(1)
    : '—';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
        
        {/* Header with Save and Back indication */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <PackagePlus className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base font-extrabold tracking-tight">
                Tambah Barang Baru
              </h2>
              <p className="text-xs text-slate-400">
                Catat barang baru &amp; harga jual langsung tanpa pindah halaman
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Batal / Kembali"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">
              Nama Potongan Daging <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={e => handleNameChange(e.target.value)}
              placeholder="Contoh: Picanha Top Sirloin Cap Brazil (Primal)"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:bg-white focus:ring-1 focus:ring-slate-900 focus:outline-none"
            />
          </div>

          {/* Product Photo Upload Section */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
            <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-emerald-600" />
                Foto Produk Daging (Visual Katalog &amp; POS)
              </span>
              <span className="text-[10px] text-slate-400 font-normal">Format: PNG, JPG, WebP</span>
            </label>

            <div className="flex items-center gap-3">
              <div className="relative w-16 h-16 rounded-lg bg-slate-200 border border-slate-300 overflow-hidden shrink-0 group">
                {imageUrl ? (
                  <img src={imageUrl} alt="Preview Produk" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-400">
                    <Camera className="w-5 h-5" />
                    <span className="text-[9px]">No Photo</span>
                  </div>
                )}
              </div>

              <div className="flex-1 space-y-1.5 min-w-0">
                <div className="flex items-center gap-1.5">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                  >
                    <Upload className="w-3 h-3" />
                    <span>Upload Foto</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setImageUrl('')}
                    className="px-2 py-1.5 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 text-[11px] font-semibold transition-colors"
                  >
                    Hapus
                  </button>
                </div>

                <input
                  type="url"
                  value={imageUrl}
                  onChange={e => setImageUrl(e.target.value)}
                  placeholder="Atau tempel URL gambar (https://...)"
                  className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>
            </div>


          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700">Kategori Daging</label>
                <button
                  type="button"
                  onClick={() => setShowAddCatInline(prev => !prev)}
                  className="text-[10px] text-emerald-600 hover:text-emerald-700 font-bold cursor-pointer"
                >
                  {showAddCatInline ? 'Batal' : '+ Kategori Baru'}
                </button>
              </div>

              {!showAddCatInline ? (
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:bg-white focus:ring-1 focus:ring-slate-900 focus:outline-none"
                >
                  {(availableCategories && availableCategories.length > 0) ? (
                    availableCategories.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.label} ({c.id})
                      </option>
                    ))
                  ) : (
                    <>
                      <option value="PRIMAL">PRIMAL (Steak Cut)</option>
                      <option value="SLICE">SLICE (Shabu &amp; Grill)</option>
                      <option value="TETELAN">TETELAN (Olahan Sop/Rawon)</option>
                      <option value="SECONDARY">SECONDARY (Bolar/Blade/Chuck)</option>
                      <option value="BONE_IN">BONE-IN (Iga &amp; Buntut)</option>
                      <option value="OFFAL">OFFAL (Jeroan)</option>
                      <option value="PROCESSED">PROCESSED (Olahan &amp; Sosis)</option>
                    </>
                  )}
                </select>
              ) : (
                <div className="p-2 bg-emerald-50/50 border border-emerald-200 rounded-lg space-y-1.5 animate-fade-in">
                  <input
                    type="text"
                    value={newCatLabel}
                    onChange={e => {
                      setNewCatLabel(e.target.value);
                      if (!newCatId) {
                        setNewCatId(e.target.value.trim().toUpperCase().replace(/[^A-Z0-9]/g, '_').slice(0, 12));
                      }
                    }}
                    placeholder="Nama Kategori Baru"
                    className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-xs font-semibold"
                  />
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={newCatId}
                      onChange={e => setNewCatId(e.target.value.toUpperCase().replace(/\s+/g, '_'))}
                      placeholder="KODE_ID"
                      className="w-1/2 px-2 py-1 bg-white border border-slate-200 rounded text-[10px] font-mono font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (!newCatLabel.trim()) return;
                        const finalId = newCatId.trim().toUpperCase() || `CAT_${Date.now().toString().slice(-4)}`;
                        onAddNewCategoryInline?.({ id: finalId, label: newCatLabel.trim() });
                        setCategory(finalId);
                        setNewCatLabel('');
                        setNewCatId('');
                        setShowAddCatInline(false);
                      }}
                      className="w-1/2 px-2 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] rounded cursor-pointer"
                    >
                      + Simpan Cat
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Kode Barang</label>
              <input
                type="text"
                value={sku}
                onChange={e => setSku(e.target.value)}
                placeholder="KODE-XXXX-XXX"
                className="w-full min-h-[40px] px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold focus:bg-white focus:ring-1 focus:ring-slate-900 focus:outline-none"
              />
            </div>
          </div>

          {/* Pricing Section with Margin Preview */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
              Harga Jual &amp; HPP Aktual
            </span>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-600">HPP Aktual (Rp/KG) — wajib jika stok awal > 0</label>
                <input
                  type="number"
                  step={1000}
                  min={0}
                  required={stockKg > 0}
                  value={estimatedHppPerKg}
                  onChange={e => setEstimatedHppPerKg(parseInt(e.target.value || '0', 10))}
                  className="w-full min-h-[40px] px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-right"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-600">Harga Jual Toko (Rp/KG)</label>
                <input
                  type="number"
                  step={1000}
                  min={0}
                  value={basePricePerKg}
                  onChange={e => setBasePricePerKg(parseInt(e.target.value || '0', 10))}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-right"
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-200/80">
              <span className="text-slate-500">Estimasi Margin Kotor:</span>
              {marginPerKg === null ? (
                <span className="font-semibold text-slate-500">Isi HPP aktual untuk menghitung margin</span>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="font-mono font-bold text-slate-700">Rp {marginPerKg.toLocaleString('id-ID')} / KG</span>
                  <span className="px-2 py-0.5 rounded font-mono font-extrabold text-[11px] bg-emerald-100 text-emerald-800">{marginPercent}%</span>
                </div>
              )}
            </div>>
          </div>

          {stockKg > 0 && (
            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl border border-amber-200 bg-amber-50/60">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700">Tanggal ED Lot Awal *</label>
                <input type="date" required value={openingLotExpiryDate} onChange={(e) => setOpeningLotExpiryDate(e.target.value)}
                  className="w-full min-h-[40px] px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold" />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700">Lokasi Freezer/Rak *</label>
                <input type="text" required value={openingLotLocation} onChange={(e) => setOpeningLotLocation(e.target.value)}
                  placeholder="Contoh: FREEZER-A-01"
                  className="w-full min-h-[40px] px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold" />
              </div>
            </div>
          )}

          {/* Stock Section */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">Stok Awal (KG)</label>
              <input
                type="number"
                step={0.5}
                min={0}
                value={stockKg}
                onChange={e => setStockKg(parseFloat(e.target.value || '0'))}
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-right"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">Batas Aman Stok (KG)</label>
              <input
                type="number"
                step={0.5}
                min={0}
                value={safetyStockKg}
                onChange={e => setSafetyStockKg(parseFloat(e.target.value || '0'))}
                className="w-full min-h-[40px] px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-right"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-700">Tag Produk</label>
              <input
                type="text"
                value={tag}
                onChange={e => setTag(e.target.value)}
                placeholder="Contoh: Best Seller"
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold"
              />
            </div>
          </div>

          {formError && <div role="alert" className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">{formError}</div>}

          {/* Action Buttons: Save & Back */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors flex items-center gap-1.5"
            >
              <X className="w-3.5 h-3.5" />
              Batal / Kembali
            </button>

            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs transition-all flex items-center gap-2 shadow-sm"
            >
              <Save className="w-3.5 h-3.5 text-emerald-400" />
              Simpan Produk Baru
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
