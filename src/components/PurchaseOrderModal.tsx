import React, { useState } from 'react';
import {
  X,
  Truck,
  Plus,
  Ship,
  CheckCircle2,
  Calendar,
  Building2,
  DollarSign,
  Package,
  Layers,
  ArrowRight,
  Calculator,
  ShieldCheck,
  Info,
  Save,
  RotateCcw
} from 'lucide-react';
import { idbSetPreference } from '../engine/indexedDbStorage';

export interface InboundPOItem {
  id: string;
  poNumber: string;
  supplier: string;
  container: string;
  eta: string;
  items: string;
  status: 'DALAM_PERJALANAN' | 'SELESAI_BONGKAR';
  totalRupiah: number;
  weightKg: number;
  landedCostRupiah: number;
  effectiveHppPerKg: number;
  paymentTerm: 'TEMPO_30' | 'LC_AT_SIGHT' | 'CASH';
  invoiceDueDate: string;
}

export interface PurchaseOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreatePOSuccess: (newPO: InboundPOItem) => void;
  initialData?: Partial<{
    supplier: string;
    containerNumber: string;
    containerType: string;
    productCut: string;
    skuCode: string;
    orderWeightKg: number;
    priceFobPerKg: number;
    paymentTerm: 'TEMPO_30' | 'LC_AT_SIGHT' | 'CASH';
    etaDays: number;
  }> | null;
  availableSuppliers?: string[];
  onAddNewSupplier?: (supplierName: string, contactPhone?: string) => void;
  availableProducts?: Array<{ id: string; name: string; sku: string; category: string; basePricePerKg: number }>;
  onAddNewProductCut?: (product: { name: string; sku: string; category: string; basePricePerKg: number; defaultFobKg: number }) => void;
  availableCategories?: Array<{ id: string; label: string }>;
}

export const PurchaseOrderModal: React.FC<PurchaseOrderModalProps> = ({
  isOpen,
  onClose,
  onCreatePOSuccess,
  initialData = null,
  availableSuppliers,
  onAddNewSupplier,
  availableProducts,
  onAddNewProductCut,
  availableCategories,
}) => {
  // Supplier List State with Defaults
  const [supplierList, setSupplierList] = useState<string[]>([
    'PT Meat Importers Indonesia',
    'Australia Beef Direct Ltd',
    'JBS USA Beef Export Inc',
    'Teys Australia Meat Group',
  ]);

  // Product Cut List State
  const [productCutList, setProductCutList] = useState<Array<{ name: string; sku: string; defaultFob: number }>>([
    { name: 'Ribeye Meltique AUS (Primal)', sku: 'SKU-RIBEYE-AUS', defaultFob: 165000 },
    { name: 'Sirloin Choice USA (Primal)', sku: 'SKU-SIRLOIN-USA', defaultFob: 145000 },
    { name: 'US Beef Shortplate 500g Slice', sku: 'SKU-SHORTPLATE-US', defaultFob: 95000 },
    { name: 'Tenderloin Grassfed AUS (Primal)', sku: 'SKU-TENDER-AUS', defaultFob: 195000 },
    { name: 'Tetelan Rawon Super KARKASIA', sku: 'SKU-TETELAN-SP', defaultFob: 55000 },
  ]);

  // Form State with Smart Default for Last Supplier
  const [supplier, setSupplier] = useState<string>(() => {
    try {
      return localStorage.getItem('karkasia_last_supplier') || 'PT Meat Importers Indonesia';
    } catch {
      return 'PT Meat Importers Indonesia';
    }
  });
  const [containerNumber, setContainerNumber] = useState<string>('TGHU-772910');
  const [containerType, setContainerType] = useState<string>('40ft Reefer (-25°C)');
  const [productCut, setProductCut] = useState<string>('Ribeye Meltique AUS (Primal)');
  const [skuCode, setSkuCode] = useState<string>('SKU-RIBEYE-AUS');
  const [orderWeightKg, setOrderWeightKg] = useState<number>(500); // 500 KG
  const [priceFobPerKg, setPriceFobPerKg] = useState<number>(165000); // Rp 165.000 / KG
  
  // Landed Cost Components (Biaya Pengiriman & Masuk Pelabuhan)
  const [freightRupiah, setFreightRupiah] = useState<number>(7500000);     // Freight Kapal Laut
  const [customsDutyRupiah, setCustomsDutyRupiah] = useState<number>(4500000); // Bea Masuk & Karantina
  const [portColdStorageRupiah, setPortColdStorageRupiah] = useState<number>(2500000); // Handling Pelabuhan

  // Payment Term
  const [paymentTerm, setPaymentTerm] = useState<'TEMPO_30' | 'LC_AT_SIGHT' | 'CASH'>('TEMPO_30');
  const [etaDays, setEtaDays] = useState<number>(3);

  // Quick Action Inline: Tambah Supplier Baru tanpa keluar modal
  const [showAddSupplierInline, setShowAddSupplierInline] = useState<boolean>(false);
  const [newSupplierName, setNewSupplierName] = useState<string>('');
  const [newSupplierOrigin, setNewSupplierOrigin] = useState<string>('Australia');
  const [newSupplierContact, setNewSupplierContact] = useState<string>('');

  // Quick Action Inline: Tambah Cut Daging Baru tanpa keluar modal
  const [showAddCutInline, setShowAddCutInline] = useState<boolean>(false);
  const [newCutName, setNewCutName] = useState<string>('');
  const [newCutCategory, setNewCutCategory] = useState<string>('PRIMAL');
  const [newCutSku, setNewCutSku] = useState<string>('');
  const [newCutFob, setNewCutFob] = useState<number>(150000);
  const [newCutSellingPrice, setNewCutSellingPrice] = useState<number>(225000);

  // Sync external available suppliers & products if provided
  React.useEffect(() => {
    if (availableSuppliers && availableSuppliers.length > 0) {
      setSupplierList(prev => Array.from(new Set([...prev, ...availableSuppliers])));
    }
  }, [availableSuppliers]);

  React.useEffect(() => {
    if (availableProducts && availableProducts.length > 0) {
      const mapped = availableProducts.map(p => ({
        name: p.name,
        sku: p.sku,
        defaultFob: Math.round(p.basePricePerKg * 0.65),
      }));
      setProductCutList(prev => {
        const existingSkus = new Set(prev.map(item => item.sku));
        const filteredNew = mapped.filter(item => !existingSkus.has(item.sku));
        return [...prev, ...filteredNew];
      });
    }
  }, [availableProducts]);

  // Sync with initialData whenever it changes or modal opens
  React.useEffect(() => {
    if (initialData) {
      if (initialData.supplier) {
        setSupplier(initialData.supplier);
        setSupplierList(prev => prev.includes(initialData.supplier!) ? prev : [initialData.supplier!, ...prev]);
      }
      if (initialData.containerNumber) setContainerNumber(initialData.containerNumber);
      if (initialData.containerType) setContainerType(initialData.containerType);
      if (initialData.productCut) {
        setProductCut(initialData.productCut);
        setProductCutList(prev => {
          if (prev.some(p => p.name === initialData.productCut)) return prev;
          return [{ name: initialData.productCut!, sku: initialData.skuCode || 'SKU-CUSTOM', defaultFob: initialData.priceFobPerKg || 150000 }, ...prev];
        });
      }
      if (initialData.skuCode) setSkuCode(initialData.skuCode);
      if (initialData.orderWeightKg !== undefined) setOrderWeightKg(initialData.orderWeightKg);
      if (initialData.priceFobPerKg !== undefined) setPriceFobPerKg(initialData.priceFobPerKg);
      if (initialData.paymentTerm) setPaymentTerm(initialData.paymentTerm);
      if (initialData.etaDays !== undefined) setEtaDays(initialData.etaDays);
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  // Zero-Float Calculations
  const meatFobCostRupiah = orderWeightKg * priceFobPerKg;
  const totalLandedCostAdditions = freightRupiah + customsDutyRupiah + portColdStorageRupiah;
  const grandTotalPoRupiah = meatFobCostRupiah + totalLandedCostAdditions;
  const landedCostAdditionPerKg = orderWeightKg > 0 ? Math.round(totalLandedCostAdditions / orderWeightKg) : 0;
  const effectiveHppPerKg = priceFobPerKg + landedCostAdditionPerKg;

  // Save Inline Supplier
  const handleSaveInlineSupplier = () => {
    if (!newSupplierName.trim()) return;
    const finalName = `${newSupplierName.trim()} (${newSupplierOrigin})`;
    setSupplierList(prev => [finalName, ...prev]);
    setSupplier(finalName);
    onAddNewSupplier?.(finalName, newSupplierContact.trim() || undefined);
    setNewSupplierName('');
    setNewSupplierContact('');
    setShowAddSupplierInline(false);
  };

  // Save Inline Product Cut
  const handleSaveInlineCut = () => {
    if (!newCutName.trim()) return;
    const autoSku = newCutSku.trim() || `SKU-${newCutName.slice(0, 6).toUpperCase().replace(/\s+/g, '')}`;
    const newCutObj = {
      name: newCutName.trim(),
      sku: autoSku,
      defaultFob: newCutFob,
    };
    setProductCutList(prev => [newCutObj, ...prev]);
    setProductCut(newCutObj.name);
    setSkuCode(autoSku);
    setPriceFobPerKg(newCutFob);
    onAddNewProductCut?.({
      name: newCutName.trim(),
      sku: autoSku,
      category: newCutCategory,
      basePricePerKg: newCutSellingPrice,
      defaultFobKg: newCutFob,
    });
    setNewCutName('');
    setNewCutSku('');
    setShowAddCutInline(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (orderWeightKg <= 0 || priceFobPerKg <= 0) return;

    const now = new Date();
    const nowStr = now.toISOString().slice(2, 10).replace(/-/g, '');
    const randSeq = Math.floor(100 + Math.random() * 900);
    const poNumber = `PO-${nowStr}-${randSeq}`;

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);
    const dueStr = `${dueDate.getDate()} ${dueDate.toLocaleString('id-ID', { month: 'short' })} ${dueDate.getFullYear()}`;

    const newPO: InboundPOItem = {
      id: `PO_${Date.now()}`,
      poNumber,
      supplier,
      container: `${containerNumber} (${containerType})`,
      eta: `${etaDays} Hari Lagi (Est. Pelabuhan Tg. Priok)`,
      items: `${productCut} (${orderWeightKg} KG)`,
      status: 'DALAM_PERJALANAN',
      totalRupiah: grandTotalPoRupiah,
      weightKg: orderWeightKg,
      landedCostRupiah: totalLandedCostAdditions,
      effectiveHppPerKg,
      paymentTerm,
      invoiceDueDate: dueStr,
    };

    try {
      localStorage.setItem('karkasia_last_supplier', supplier);
    } catch {
      // ignore storage errors
    }
    void idbSetPreference('last_supplier', supplier);

    onCreatePOSuccess(newPO);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Header Modal */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Truck className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base font-extrabold tracking-tight">
                Catat Pembelian Stok Masuk
              </h2>
              <p className="text-xs text-slate-400">
                Pesan stok daging dari supplier, hitung ongkos kirim masuk, &amp; catat tagihan supplier
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

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Section 1: Supplier & Kontainer */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Ship className="w-4 h-4 text-slate-600" />
              1. Identitas Supplier &amp; Kontainer Pendingin
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Supplier Dropdown with Inline Quick Add Button */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">Pemasok / Importir Daging</label>
                  {!showAddSupplierInline && (
                    <button
                      type="button"
                      onClick={() => setShowAddSupplierInline(true)}
                      className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-0.5 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      Tambah Supplier
                    </button>
                  )}
                </div>

                <select
                  value={supplier}
                  onChange={e => setSupplier(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-1 focus:ring-slate-900"
                >
                  {supplierList.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Nomor Kontainer Reefer</label>
                <input
                  type="text"
                  value={containerNumber}
                  onChange={e => setContainerNumber(e.target.value)}
                  placeholder="Contoh: TGHU-772910"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold focus:ring-1 focus:ring-slate-900"
                  required
                />
              </div>

              {/* INLINE FORM: Tambah Supplier Baru tanpa keluar modal */}
              {showAddSupplierInline && (
                <div className="sm:col-span-2 p-3 bg-blue-50/80 border border-blue-200 rounded-xl space-y-2.5 animate-fade-in">
                  <div className="flex items-center justify-between text-xs font-bold text-blue-900">
                    <span className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-blue-700" />
                      Quick Action: Tambah Supplier Baru
                    </span>
                    <span className="text-[10px] text-blue-600 font-normal">
                      Tidak perlu pindah halaman
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <input
                      type="text"
                      placeholder="Nama PT / Perusahaan Supplier"
                      value={newSupplierName}
                      onChange={e => setNewSupplierName(e.target.value)}
                      className="px-2.5 py-1.5 bg-white border border-blue-200 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-blue-700"
                      autoFocus
                    />
                    <select
                      value={newSupplierOrigin}
                      onChange={e => setNewSupplierOrigin(e.target.value)}
                      className="px-2.5 py-1.5 bg-white border border-blue-200 rounded-lg text-xs font-medium"
                    >
                      <option value="Australia">Australia</option>
                      <option value="USA">USA</option>
                      <option value="New Zealand">New Zealand</option>
                      <option value="Jepang">Jepang</option>
                      <option value="Lokal Indonesia">Lokal Indonesia</option>
                    </select>
                    <input
                      type="text"
                      placeholder="No Telp / PIC (Opsional)"
                      value={newSupplierContact}
                      onChange={e => setNewSupplierContact(e.target.value)}
                      className="px-2.5 py-1.5 bg-white border border-blue-200 rounded-lg text-xs font-mono"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAddSupplierInline(false)}
                      className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1"
                    >
                      <X className="w-3 h-3" />
                      Batal / Back
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveInlineSupplier}
                      disabled={!newSupplierName.trim()}
                      className="px-3 py-1 rounded-lg bg-blue-700 hover:bg-blue-800 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1 shadow-xs"
                    >
                      <Save className="w-3 h-3" />
                      Simpan Supplier
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Tipe Kontainer Reefer</label>
                <select
                  value={containerType}
                  onChange={e => setContainerType(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-1 focus:ring-slate-900"
                >
                  <option value="40ft Reefer (-25°C)">40ft High-Cube Reefer (-25°C)</option>
                  <option value="20ft Reefer (-20°C)">20ft Standard Reefer (-20°C)</option>
                  <option value="L300 Reefer Chilled (-4°C)">L300 Reefer Box Lokal (-4°C)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Estimasi Tiba (ETA)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={etaDays}
                    onChange={e => setEtaDays(parseInt(e.target.value || '1', 10))}
                    className="w-20 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold font-mono focus:ring-1 focus:ring-slate-900"
                  />
                  <span className="text-xs text-slate-500 font-medium">Hari lagi di pelabuhan</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Muatan Daging & Harga Beli Supplier */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Package className="w-4 h-4 text-slate-600" />
              2. Rincian Barang &amp; Harga Beli Supplier
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Product Cut Dropdown with Inline Quick Add Button */}
              <div className="sm:col-span-3 space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700">Pilih Potongan Daging Impor</label>
                  {!showAddCutInline && (
                    <button
                      type="button"
                      onClick={() => setShowAddCutInline(true)}
                      className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-0.5 transition-colors cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      Tambah Cut/Produk Baru
                    </button>
                  )}
                </div>

                <select
                  value={productCut}
                  onChange={e => {
                    const selectedName = e.target.value;
                    setProductCut(selectedName);
                    const found = productCutList.find(p => p.name === selectedName);
                    if (found) {
                      setSkuCode(found.sku);
                      setPriceFobPerKg(found.defaultFob);
                    }
                  }}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-1 focus:ring-slate-900"
                >
                  {productCutList.map(item => (
                    <option key={item.name} value={item.name}>
                      {item.name} · {item.sku}
                    </option>
                  ))}
                </select>
              </div>

              {/* INLINE FORM: Tambah Cut Daging Baru tanpa keluar modal */}
              {showAddCutInline && (
                <div className="sm:col-span-3 p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl space-y-2.5 animate-fade-in">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-900">
                    <span className="flex items-center gap-1.5">
                      <Package className="w-3.5 h-3.5 text-emerald-700" />
                      Quick Action: Tambah Jenis Potongan Daging / SKU Baru
                    </span>
                    <span className="text-[10px] text-emerald-700 font-normal">
                      Tersimpan ke master katalog toko
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-600">Nama Potongan Daging</label>
                      <input
                        type="text"
                        placeholder="Contoh: Wagyu MB5 Striploin"
                        value={newCutName}
                        onChange={e => {
                          setNewCutName(e.target.value);
                          if (!newCutSku) {
                            setNewCutSku(`SKU-${e.target.value.slice(0, 7).toUpperCase().replace(/\s+/g, '')}`);
                          }
                        }}
                        className="w-full px-2.5 py-1.5 bg-white border border-emerald-200 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-emerald-700"
                        autoFocus
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-600">Kategori</label>
                      <select
                        value={newCutCategory}
                        onChange={e => setNewCutCategory(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-emerald-200 rounded-lg text-xs font-medium"
                      >
                        {availableCategories && availableCategories.length > 0 ? (
                          availableCategories.map(c => (
                            <option key={c.id} value={c.id}>
                              {c.label} ({c.id})
                            </option>
                          ))
                        ) : (
                          <>
                            <option value="PRIMAL">PRIMAL (Steak Cut)</option>
                            <option value="SLICE">SLICE (Shabu/Yakiniku)</option>
                            <option value="TETELAN">TETELAN (Olahan/Sop)</option>
                            <option value="SECONDARY">SECONDARY (Bolar/Blade)</option>
                            <option value="BONE_IN">BONE-IN (Iga &amp; Buntut)</option>
                            <option value="OFFAL">OFFAL (Jeroan)</option>
                            <option value="PROCESSED">PROCESSED (Olahan)</option>
                          </>
                        )}
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-600">Kode Barang</label>
                      <input
                        type="text"
                        placeholder="KODE-XXXX"
                        value={newCutSku}
                        onChange={e => setNewCutSku(e.target.value)}
                        className="w-full px-2.5 py-1.5 bg-white border border-emerald-200 rounded-lg text-xs font-mono font-bold"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-600">Harga Beli Supplier (Rp/KG)</label>
                      <input
                        type="number"
                        step={5000}
                        value={newCutFob}
                        onChange={e => setNewCutFob(parseInt(e.target.value || '0', 10))}
                        className="w-full px-2.5 py-1.5 bg-white border border-emerald-200 rounded-lg text-xs font-mono font-bold text-right"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-600">Rencana Jual Toko (Rp/KG)</label>
                      <input
                        type="number"
                        step={5000}
                        value={newCutSellingPrice}
                        onChange={e => setNewCutSellingPrice(parseInt(e.target.value || '0', 10))}
                        className="w-full px-2.5 py-1.5 bg-white border border-emerald-200 rounded-lg text-xs font-mono font-bold text-right"
                      />
                    </div>

                    <div className="flex items-end justify-end gap-2 pb-0.5">
                      <button
                        type="button"
                        onClick={() => setShowAddCutInline(false)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center gap-1"
                      >
                        <X className="w-3 h-3" />
                        Batal
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveInlineCut}
                        disabled={!newCutName.trim()}
                        className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1 shadow-xs"
                      >
                        <Save className="w-3 h-3" />
                        Simpan Cut Daging
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Total Berat (KG)</label>
                <input
                  type="number"
                  min={10}
                  step={5}
                  value={orderWeightKg}
                  onChange={e => setOrderWeightKg(Math.max(1, parseFloat(e.target.value || '0')))}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold focus:ring-1 focus:ring-slate-900"
                  required
                />
                <span className="text-[10px] text-slate-400 font-mono">
                  {(orderWeightKg * 1000).toLocaleString('id-ID')} Gram
                </span>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Harga Beli Supplier (Rp / KG)</label>
                <input
                  type="number"
                  step={1000}
                  value={priceFobPerKg}
                  onChange={e => setPriceFobPerKg(Math.max(0, parseInt(e.target.value || '0', 10)))}
                  className="w-full min-h-[40px] px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-right focus:ring-1 focus:ring-slate-900"
                  required
                />
                <div className="text-[10px] text-slate-500 font-mono text-right">
                  Subtotal Barang: Rp {meatFobCostRupiah.toLocaleString('id-ID')}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Cara Bayar ke Supplier</label>
                <select
                  value={paymentTerm}
                  onChange={e => setPaymentTerm(e.target.value as any)}
                  className="w-full min-h-[40px] px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:ring-1 focus:ring-slate-900"
                >
                  <option value="TEMPO_30">Tempo 30 Hari (Tagihan Supplier)</option>
                  <option value="LC_AT_SIGHT">Bayar Saat Dokumen Tiba</option>
                  <option value="CASH">Tunai / Transfer di Muka</option>
                </select>
                <span className="text-[10px] text-slate-400">
                  {paymentTerm === 'TEMPO_30' ? 'Masuk ke daftar tagihan supplier (jatuh tempo 30 hari)' : 'Lunas langsung saat kiriman masuk'}
                </span>
              </div>
            </div>
          </div>

          {/* Section 3: Biaya Pengiriman & Masuk */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Calculator className="w-4 h-4 text-emerald-600" />
                3. Biaya Pengiriman &amp; Masuk (Ongkos Kirim, Bea Masuk, Gudang)
              </span>
              <span className="text-[10px] font-mono font-bold text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                +Rp {landedCostAdditionPerKg.toLocaleString('id-ID')} / KG
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-600">Ongkos Kirim / Kapal</label>
                <input
                  type="number"
                  step={500000}
                  value={freightRupiah}
                  onChange={e => setFreightRupiah(Math.max(0, parseInt(e.target.value || '0', 10)))}
                  className="w-full min-h-[40px] px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-right"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-600">Bea Masuk &amp; Karantina</label>
                <input
                  type="number"
                  step={500000}
                  value={customsDutyRupiah}
                  onChange={e => setCustomsDutyRupiah(Math.max(0, parseInt(e.target.value || '0', 10)))}
                  className="w-full min-h-[40px] px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-right"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-600">Biaya Bongkar &amp; Freezer Pelabuhan</label>
                <input
                  type="number"
                  step={500000}
                  value={portColdStorageRupiah}
                  onChange={e => setPortColdStorageRupiah(Math.max(0, parseInt(e.target.value || '0', 10)))}
                  className="w-full min-h-[40px] px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-right"
                />
              </div>
            </div>

            {/* Landed Cost Breakdown Summary */}
            <div className="p-3 bg-white rounded-lg border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
              <div>
                <span className="text-slate-500">Perkiraan Harga Modal Masuk:</span>
                <div className="text-base font-extrabold text-slate-900 font-mono tabular-nums">
                  Rp {effectiveHppPerKg.toLocaleString('id-ID')} / KG
                </div>
              </div>
              <div className="text-right text-[11px] text-slate-500">
                <div>Harga Beli: Rp {priceFobPerKg.toLocaleString('id-ID')}</div>
                <div>Biaya Masuk: +Rp {landedCostAdditionPerKg.toLocaleString('id-ID')}</div>
              </div>
            </div>
          </div>

          {/* Grand Total Summary Box */}
          <div className="p-4 bg-slate-900 text-white rounded-xl flex items-center justify-between">
            <div>
              <span className="text-xs text-slate-400 uppercase tracking-wider font-bold">
                Total Tagihan Pembelian
              </span>
              <div className="text-xl font-extrabold font-mono tabular-nums text-emerald-400">
                Rp {grandTotalPoRupiah.toLocaleString('id-ID')}
              </div>
            </div>
            <div className="text-right text-xs text-slate-300">
              <div>Berat: <strong>{orderWeightKg} KG</strong></div>
              <div>Supplier: <strong>{supplier}</strong></div>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[40px] px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              Kembali / Batal
            </button>

            <button
              type="submit"
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold text-xs transition-all flex items-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 text-white" />
              Simpan Pesanan &amp; Catat Tagihan
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
