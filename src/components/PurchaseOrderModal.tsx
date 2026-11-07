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
  Info
} from 'lucide-react';

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
}

export const PurchaseOrderModal: React.FC<PurchaseOrderModalProps> = ({
  isOpen,
  onClose,
  onCreatePOSuccess,
}) => {
  // Form State
  const [supplier, setSupplier] = useState<string>('PT Meat Importers Indonesia');
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

  if (!isOpen) return null;

  // Zero-Float Calculations
  const meatFobCostRupiah = orderWeightKg * priceFobPerKg;
  const totalLandedCostAdditions = freightRupiah + customsDutyRupiah + portColdStorageRupiah;
  const grandTotalPoRupiah = meatFobCostRupiah + totalLandedCostAdditions;
  const landedCostAdditionPerKg = orderWeightKg > 0 ? Math.round(totalLandedCostAdditions / orderWeightKg) : 0;
  const effectiveHppPerKg = priceFobPerKg + landedCostAdditionPerKg;

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

    onCreatePOSuccess(newPO);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-tab-fade">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-blue-500/20 text-blue-400">
              <Truck className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold tracking-tight">Buat Purchase Order (PO) Impor Baru</h3>
                <span className="text-[10px] font-bold bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/30">
                  MOD-09
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Pemesanan kontainer reefer daging impor, alokasi landed cost, &amp; pembentukan utang AP
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

        {/* Modal Form */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* Section 1: Supplier & Kontainer */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Ship className="w-4 h-4 text-slate-600" />
              1. Identitas Supplier &amp; Kontainer Pendingin
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Pemasok / Importir Daging</label>
                <select
                  value={supplier}
                  onChange={e => setSupplier(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-1 focus:ring-slate-900"
                >
                  <option value="PT Meat Importers Indonesia">PT Meat Importers Indonesia (Jakarta)</option>
                  <option value="Australia Beef Direct Ltd">Australia Beef Direct Ltd (Brisbane)</option>
                  <option value="JBS USA Beef Export Inc">JBS USA Beef Export Inc (Chicago)</option>
                  <option value="Teys Australia Meat Group">Teys Australia Meat Group (Melbourne)</option>
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

          {/* Section 2: Muatan Daging & Harga FOB */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Package className="w-4 h-4 text-slate-600" />
              2. Rincian Muatan Daging &amp; Harga Beli (FOB)
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-3 space-y-1">
                <label className="text-xs font-bold text-slate-700">Pilih Potongan Daging Impor</label>
                <select
                  value={productCut}
                  onChange={e => {
                    setProductCut(e.target.value);
                    if (e.target.value.includes('Ribeye')) setSkuCode('SKU-RIBEYE-AUS');
                    else if (e.target.value.includes('Sirloin')) setSkuCode('SKU-SIRLOIN-USA');
                    else if (e.target.value.includes('Shortplate')) setSkuCode('SKU-SHORTPLATE-US');
                    else setSkuCode('SKU-TENDER-AUS');
                  }}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium focus:ring-1 focus:ring-slate-900"
                >
                  <option value="Ribeye Meltique AUS (Primal)">Ribeye Meltique Australia (Primal) · SKU-RIBEYE-AUS</option>
                  <option value="Sirloin Choice USA (Primal)">Sirloin Choice USA (Primal) · SKU-SIRLOIN-USA</option>
                  <option value="US Beef Shortplate 500g Slice">US Beef Shortplate 500g Slice · SKU-SHORTPLATE-US</option>
                  <option value="Tenderloin Grassfed AUS (Primal)">Tenderloin Grassfed Australia · SKU-TENDER-AUS</option>
                </select>
              </div>

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
                <label className="text-xs font-bold text-slate-700">Harga FOB per KG</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Rp</span>
                  <input
                    type="number"
                    step={1000}
                    value={priceFobPerKg}
                    onChange={e => setPriceFobPerKg(Math.max(0, parseInt(e.target.value || '0', 10)))}
                    className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold focus:ring-1 focus:ring-slate-900"
                    required
                  />
                </div>
                <span className="text-[10px] text-slate-400">Harga pabrik asal</span>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">Subtotal FOB</label>
                <div className="px-3 py-2 bg-slate-100 rounded-lg text-xs font-mono font-bold text-slate-900">
                  Rp {meatFobCostRupiah.toLocaleString('id-ID')}
                </div>
                <span className="text-[10px] text-slate-500">Belum termasuk biaya pelabuhan</span>
              </div>
            </div>
          </div>

          {/* Section 3: Landed Cost Allocation (Freight, Customs, Handling) */}
          <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/50 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                <Calculator className="w-4 h-4 text-blue-700" />
                3. Alokasi Landed Cost Tambahan (Sampai Gudang KARKASIA)
              </span>
              <span className="text-[10px] font-bold text-blue-800 bg-blue-100 px-2 py-0.5 rounded">
                +Rp {landedCostAdditionPerKg.toLocaleString('id-ID')} / KG
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700">Freight Kapal Laut Reefer</label>
                <input
                  type="number"
                  step={500000}
                  value={freightRupiah}
                  onChange={e => setFreightRupiah(parseInt(e.target.value || '0', 10))}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700">Bea Cukai &amp; Karantina</label>
                <input
                  type="number"
                  step={200000}
                  value={customsDutyRupiah}
                  onChange={e => setCustomsDutyRupiah(parseInt(e.target.value || '0', 10))}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-700">Cold Storage Pelabuhan</label>
                <input
                  type="number"
                  step={100000}
                  value={portColdStorageRupiah}
                  onChange={e => setPortColdStorageRupiah(parseInt(e.target.value || '0', 10))}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold"
                />
              </div>
            </div>

            {/* Effective HPP Summary Card */}
            <div className="p-3 bg-white rounded-lg border border-blue-200 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-500">HPP Efektif Masuk Gudang:</span>
                <div className="text-sm font-mono font-extrabold text-blue-900">
                  Rp {effectiveHppPerKg.toLocaleString('id-ID')} / KG
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-500">Total Komitmen PO:</span>
                <div className="text-base font-mono font-extrabold text-slate-900">
                  Rp {grandTotalPoRupiah.toLocaleString('id-ID')}
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Termin Pembayaran Supplier (Utang AP) */}
          <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2">
            <span className="text-xs font-bold text-slate-800">4. Termin Pembayaran Supplier (Accounts Payable)</span>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'TEMPO_30', label: 'Tempo 30 Hari', desc: 'Utang AP Supplier' },
                { id: 'LC_AT_SIGHT', label: 'LC at Sight', desc: 'Dokumen Bank' },
                { id: 'CASH', label: 'Tunai di Awal', desc: 'Transfer Bank BCA' },
              ].map(term => (
                <button
                  key={term.id}
                  type="button"
                  onClick={() => setPaymentTerm(term.id as any)}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    paymentTerm === term.id
                      ? 'bg-slate-900 border-slate-900 text-white shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="text-xs font-bold">{term.label}</div>
                  <div className={`text-[10px] ${paymentTerm === term.id ? 'text-slate-300' : 'text-slate-500'}`}>
                    {term.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              Terbitkan Purchase Order (PO)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
