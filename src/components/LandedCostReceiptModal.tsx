import React, { useEffect, useState } from 'react';
import { Plus, Trash2, X, Ship } from 'lucide-react';
import type { LandedCostComponentInput, LandedCostComponentType, PurchaseOrderEntity } from '../engine/types';

interface ComponentDraft {
  type: LandedCostComponentType;
  description: string;
  vendor: string;
  invoiceReference: string;
  currency: 'IDR' | 'USD';
  amount: string;
  exchangeRate: string;
  paymentStatus: 'PAID' | 'PAYABLE';
  paymentMethod: 'CASH' | 'TRANSFER';
  dueDate: string;
}

interface Props {
  po: PurchaseOrderEntity | null;
  onClose: () => void;
  onSubmit: (actualWeightGram: number, components: LandedCostComponentInput[]) => Promise<{ ok: boolean; message: string }>;
}

const blankComponent = (): ComponentDraft => ({
  type: 'FREIGHT', description: '', vendor: '', invoiceReference: '',
  currency: 'IDR', amount: '', exchangeRate: '',
  paymentStatus: 'PAYABLE', paymentMethod: 'CASH', dueDate: '',
});

const TYPES: Array<{ value: LandedCostComponentType; label: string }> = [
  { value: 'FREIGHT', label: 'Freight / Pengiriman' },
  { value: 'DUTY', label: 'Bea Masuk / Pajak Impor' },
  { value: 'HANDLING', label: 'Handling / Bongkar' },
  { value: 'CLEARANCE', label: 'Customs Clearance' },
  { value: 'COLD_STORAGE', label: 'Cold Storage' },
  { value: 'OTHER', label: 'Lainnya' },
];

export const LandedCostReceiptModal: React.FC<Props> = ({ po, onClose, onSubmit }) => {
  const [actualWeightGram, setActualWeightGram] = useState(String(Math.round((po?.orderWeightKg || 0) * 1000)));
  const [components, setComponents] = useState<ComponentDraft[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!po) return;
    setActualWeightGram(String(Math.round((po.orderWeightKg || 0) * 1000)));
    setComponents([]);
    setError('');
  }, [po?.id, po?.orderWeightKg]);

  if (!po) return null;

  const updateComponent = (index: number, patch: Partial<ComponentDraft>) => {
    setComponents((current) => current.map((item, i) => i === index ? { ...item, ...patch } : item));
    setError('');
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    const weight = Number(actualWeightGram);
    if (!Number.isSafeInteger(weight) || weight <= 0) {
      setError('Berat aktual harus integer Gram positif.');
      return;
    }
    const inputs: LandedCostComponentInput[] = [];
    for (let index = 0; index < components.length; index += 1) {
      const item = components[index];
      const amount = Number(item.amount);
      const exchangeRate = item.currency === 'USD' ? Number(item.exchangeRate) : undefined;
      if (!item.description.trim() || !item.vendor.trim() || !item.invoiceReference.trim() ||
          !Number.isSafeInteger(amount) || amount <= 0 ||
          (item.currency === 'USD' && (!Number.isSafeInteger(exchangeRate) || Number(exchangeRate) <= 0)) ||
          (item.paymentStatus === 'PAYABLE' && !item.dueDate)) {
        setError(`Komponen #${index + 1} belum lengkap atau nominal/kurs tidak valid.`);
        return;
      }
      inputs.push({
        type: item.type, description: item.description.trim(), vendor: item.vendor.trim(),
        invoiceReference: item.invoiceReference.trim(), currency: item.currency, amount,
        ...(exchangeRate ? { exchangeRateIdrPerUsd: exchangeRate } : {}),
        paymentStatus: item.paymentStatus,
        ...(item.paymentStatus === 'PAID' ? { paymentMethod: item.paymentMethod } : {}),
        ...(item.paymentStatus === 'PAYABLE' ? { dueDate: item.dueDate } : {}),
      });
    }
    setBusy(true);
    try {
      const result = await onSubmit(weight, inputs);
      if (!result.ok) setError(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan penerimaan dan landed cost.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <form onSubmit={submit} className="w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl space-y-4">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-extrabold text-slate-900">Penerimaan Barang & Landed Cost</h3>
            <p className="mt-1 text-xs text-slate-500">{po.poNumber} · {po.supplier} · Nilai barang (FOB) Rp {po.totalRupiah.toLocaleString('id-ID')}</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-700">Berat Aktual Diterima (Gram)</span>
            <input value={actualWeightGram} onChange={(e) => setActualWeightGram(e.target.value)} inputMode="numeric" className="b2b-input w-full" />
          </label>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs">
            <div className="flex items-center gap-2 font-semibold text-slate-700"><Ship className="h-4 w-4" /> Estimasi landed cost saat PO</div>
            <div className="mt-1 font-mono font-bold text-slate-900">Rp {(po.landedCostRupiah ?? 0).toLocaleString('id-ID')}</div>
            <p className="mt-1 text-[10px] text-slate-500">Angka estimasi ini tidak otomatis diposting. Masukkan invoice dan pembayaran aktual di bawah.</p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-bold text-slate-900">Komponen biaya aktual</h4>
              <p className="text-[11px] text-slate-500">Setiap vendor/invoice dicatat terpisah; USD memakai kurs manual yang disimpan sebagai snapshot.</p>
            </div>
            <button type="button" onClick={() => setComponents((current) => [...current, blankComponent()])}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              <Plus className="h-3.5 w-3.5" /> Tambah Komponen
            </button>
          </div>

          {components.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500">
              Belum ada biaya tambahan aktual. Jika ada freight, bea, handling, clearance, atau cold storage, tambahkan invoice-nya.
            </div>
          )}

          {components.map((item, index) => (
            <div key={index} className="rounded-xl border border-slate-200 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">Komponen #{index + 1}</span>
                <button type="button" onClick={() => setComponents((current) => current.filter((_, i) => i !== index))}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-rose-600 hover:bg-rose-50">
                  <Trash2 className="h-3 w-3" /> Hapus
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <label className="space-y-1">
                  <span className="text-[11px] font-semibold text-slate-600">Jenis Biaya</span>
                  <select value={item.type} onChange={(e) => updateComponent(index, { type: e.target.value as LandedCostComponentType })} className="b2b-input w-full">
                    {TYPES.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
                  </select>
                </label>
                <label className="space-y-1 sm:col-span-2">
                  <span className="text-[11px] font-semibold text-slate-600">Keterangan</span>
                  <input value={item.description} onChange={(e) => updateComponent(index, { description: e.target.value })} className="b2b-input w-full" placeholder="Contoh: Freight kontainer reefer" />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] font-semibold text-slate-600">Vendor</span>
                  <input value={item.vendor} onChange={(e) => updateComponent(index, { vendor: e.target.value })} className="b2b-input w-full" placeholder="Nama vendor" />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] font-semibold text-slate-600">No. Invoice / Referensi</span>
                  <input value={item.invoiceReference} onChange={(e) => updateComponent(index, { invoiceReference: e.target.value })} className="b2b-input w-full" placeholder="INV-001" />
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] font-semibold text-slate-600">Mata Uang</span>
                  <select value={item.currency} onChange={(e) => updateComponent(index, { currency: e.target.value as 'IDR' | 'USD', exchangeRate: e.target.value === 'USD' ? item.exchangeRate : '' })} className="b2b-input w-full">
                    <option value="IDR">IDR</option><option value="USD">USD</option>
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-[11px] font-semibold text-slate-600">Nominal Asli</span>
                  <input value={item.amount} onChange={(e) => updateComponent(index, { amount: e.target.value })} inputMode="numeric" className="b2b-input w-full" placeholder="100000" />
                </label>
                {item.currency === 'USD' && (
                  <label className="space-y-1">
                    <span className="text-[11px] font-semibold text-slate-600">Kurs Manual (IDR/USD)</span>
                    <input value={item.exchangeRate} onChange={(e) => updateComponent(index, { exchangeRate: e.target.value })} inputMode="numeric" className="b2b-input w-full" placeholder="16000" />
                  </label>
                )}
                <label className="space-y-1">
                  <span className="text-[11px] font-semibold text-slate-600">Status Pembayaran</span>
                  <select value={item.paymentStatus} onChange={(e) => updateComponent(index, { paymentStatus: e.target.value as 'PAID' | 'PAYABLE' })} className="b2b-input w-full">
                    <option value="PAID">Sudah Dibayar</option><option value="PAYABLE">Belum Dibayar (AP)</option>
                  </select>
                </label>
                {item.paymentStatus === 'PAID' ? (
                  <label className="space-y-1">
                    <span className="text-[11px] font-semibold text-slate-600">Sumber Dana</span>
                    <select value={item.paymentMethod} onChange={(e) => updateComponent(index, { paymentMethod: e.target.value as 'CASH' | 'TRANSFER' })} className="b2b-input w-full">
                      <option value="CASH">Kas</option><option value="TRANSFER">Bank</option>
                    </select>
                  </label>
                ) : (
                  <label className="space-y-1">
                    <span className="text-[11px] font-semibold text-slate-600">Jatuh Tempo</span>
                    <input type="date" value={item.dueDate} onChange={(e) => updateComponent(index, { dueDate: e.target.value })} className="b2b-input w-full" />
                  </label>
                )}
              </div>
            </div>
          ))}
        </div>

        {error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">{error}</div>}
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3">
          <button type="button" onClick={onClose} disabled={busy} className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700">Batal</button>
          <button type="submit" disabled={busy} className="rounded-lg bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">
            {busy ? 'Memvalidasi & Posting…' : 'Terima Barang & Posting HPP/AP'}
          </button>
        </div>
      </form>
    </div>
  );
};
