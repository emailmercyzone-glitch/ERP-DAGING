import React, { useState, useEffect } from 'react';
import {
  X,
  CreditCard,
  ShieldCheck,
  Check,
  MessageSquare,
  Phone,
  ExternalLink,
  CheckCircle2,
  Clock
} from 'lucide-react';

export interface SupplierInvoice {
  id: string;
  invoiceNumber: string;
  poNumber: string;
  supplier: string;
  supplierPhone?: string;
  originCountry: string;
  totalAmountRupiah: number;
  paidAmountRupiah: number;
  remainingAmountRupiah: number;
  dueDate: string;
  daysDiff: number;
  status: 'BELUM_LUNAS' | 'CICILAN' | 'LUNAS';
}

export function formatSupplierPhoneForWa(phone?: string): string {
  if (!phone) return '';
  const digits = phone.replace(/[^0-9]/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) {
    return `62${digits.slice(1)}`;
  }
  return digits;
}

export function buildSupplierPaymentFollowUpMessage(invoice: SupplierInvoice): string {
  if (invoice.status === 'LUNAS') {
    return `Halo Tim ${invoice.supplier}, kami dari Toko Daging KARKASIA mengonfirmasi bahwa tagihan ${invoice.invoiceNumber} (No. Pesanan ${invoice.poNumber}) sebesar Rp ${invoice.totalAmountRupiah.toLocaleString('id-ID')} sudah kami lunasi. Mohon konfirmasi penerimaannya. Terima kasih.`;
  }
  if (invoice.status === 'CICILAN') {
    return `Halo Tim ${invoice.supplier}, kami dari Toko Daging KARKASIA ingin menindaklanjuti pembayaran tagihan ${invoice.invoiceNumber} (No. Pesanan ${invoice.poNumber}). Sudah terbayar Rp ${invoice.paidAmountRupiah.toLocaleString('id-ID')}, sisa tagihan Rp ${invoice.remainingAmountRupiah.toLocaleString('id-ID')} (jatuh tempo ${invoice.dueDate}). Mohon konfirmasi jadwal transfer berikutnya. Terima kasih.`;
  }
  return `Halo Tim ${invoice.supplier}, kami dari Toko Daging KARKASIA ingin menindaklanjuti pembayaran tagihan ${invoice.invoiceNumber} (No. Pesanan ${invoice.poNumber}) sebesar Rp ${invoice.remainingAmountRupiah.toLocaleString('id-ID')} dengan jatuh tempo ${invoice.dueDate}. Mohon konfirmasi detail pembayaran agar segera kami proses. Terima kasih.`;
}

export function buildSupplierPaymentFollowUpUrl(
  invoice: SupplierInvoice,
  phoneOverride?: string
): string | null {
  const normalized = formatSupplierPhoneForWa(phoneOverride || invoice.supplierPhone);
  if (!normalized) return null;
  const message = buildSupplierPaymentFollowUpMessage(invoice);
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

export interface SupplierPayableModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: SupplierInvoice | null;
  supplierPhone?: string;
  onPaymentSuccess: (invoiceId: string, amountPaid: number, newRemaining: number) => void;
}

export const SupplierPayableModal: React.FC<SupplierPayableModalProps> = ({
  isOpen,
  onClose,
  invoice,
  supplierPhone,
  onPaymentSuccess,
}) => {
  const [paymentAmountStr, setPaymentAmountStr] = useState<string>(
    invoice ? invoice.remainingAmountRupiah.toString() : '0'
  );
  const [sourceAccount, setSourceAccount] = useState<'BANK_BCA' | 'KAS_UTAMA'>('BANK_BCA');
  const [bankRefNumber, setBankRefNumber] = useState<string>('TRF-BCA-7729104');
  const [notes, setNotes] = useState<string>('Pelunasan tagihan kontainer daging impor');

  useEffect(() => {
    if (invoice) {
      setPaymentAmountStr(invoice.remainingAmountRupiah.toString());
    }
  }, [invoice?.id, invoice?.remainingAmountRupiah]);

  if (!isOpen || !invoice) return null;

  const resolvedPhone = supplierPhone || invoice.supplierPhone || '';
  const waUrl = buildSupplierPaymentFollowUpUrl(invoice, resolvedPhone);

  const paymentAmount = parseInt(paymentAmountStr || '0', 10);
  const isAmountValid = paymentAmount > 0 && paymentAmount <= invoice.remainingAmountRupiah;

  const handleConfirmPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAmountValid) return;

    const newRemaining = Math.max(0, invoice.remainingAmountRupiah - paymentAmount);
    onPaymentSuccess(invoice.id, paymentAmount, newRemaining);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-tab-fade">
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400">
              <CreditCard className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-extrabold tracking-tight">Bayar Tagihan Supplier</h3>
              <p className="text-xs text-slate-400">
                Catat pembayaran tagihan barang masuk ke supplier
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Invoice Summary Box */}
        <div className="p-4 bg-slate-50 border-b border-slate-200/80 space-y-2.5">
          <div className="flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono font-bold text-slate-900 truncate">{invoice.invoiceNumber}</span>
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border shrink-0 ${
                  invoice.status === 'LUNAS'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : invoice.status === 'CICILAN'
                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                    : 'bg-rose-50 text-rose-800 border-rose-200 animate-pulse'
                }`}
              >
                {invoice.status === 'LUNAS' ? (
                  <CheckCircle2 className="w-3 h-3" />
                ) : (
                  <Clock className="w-3 h-3" />
                )}
                <span>
                  {invoice.status === 'LUNAS'
                    ? 'Lunas'
                    : invoice.status === 'CICILAN'
                    ? 'Cicilan'
                    : 'Belum Lunas'}
                </span>
              </span>
            </div>
            <span className="text-slate-500 font-medium shrink-0">Ref: {invoice.poNumber}</span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-bold text-slate-800">{invoice.supplier}</div>
              <span className="text-[11px] text-slate-500 block">Jatuh Tempo: {invoice.dueDate}</span>
              {resolvedPhone && (
                <span className="text-[11px] text-slate-600 font-mono inline-flex items-center gap-1 mt-0.5">
                  <Phone className="w-3 h-3 text-slate-400" />
                  {resolvedPhone}
                </span>
              )}
            </div>
            <div className="text-right shrink-0">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Sisa Utang:</span>
              <span className="text-base font-mono font-extrabold text-rose-600">
                Rp {invoice.remainingAmountRupiah.toLocaleString('id-ID')}
              </span>
            </div>
          </div>

          {waUrl && (
            <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between gap-2">
              <span className="text-[11px] text-slate-500">Butuh konfirmasi pembayaran ke pemasok?</span>
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[40px] px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold inline-flex items-center gap-1.5 transition-colors shrink-0"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>Quick Contact</span>
                <ExternalLink className="w-3 h-3 opacity-80" />
              </a>
            </div>
          )}
        </div>

        {/* Payment Form */}
        <form onSubmit={handleConfirmPayment} className="p-5 space-y-4">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700">Nominal Pembayaran (IDR)</label>
              <button
                type="button"
                onClick={() => setPaymentAmountStr(invoice.remainingAmountRupiah.toString())}
                className="text-[11px] text-blue-600 hover:underline font-bold"
              >
                Lunasi Penuh (100%)
              </button>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Rp</span>
              <input
                type="number"
                value={paymentAmountStr}
                onChange={e => setPaymentAmountStr(e.target.value)}
                max={invoice.remainingAmountRupiah}
                className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono font-bold focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                required
              />
            </div>
          </div>

          {/* Quick Preset Buttons */}
          <div className="flex items-center gap-1.5">
            {[10000000, 25000000, 50000000].map(val => (
              <button
                key={val}
                type="button"
                onClick={() => setPaymentAmountStr(val.toString())}
                className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700"
              >
                Rp {val / 1000000} Jt
              </button>
            ))}
          </div>

          {/* Sumber Rekening Pembayaran */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Rekening Pengirim (Sumber Dana)</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSourceAccount('BANK_BCA')}
                className={`p-2.5 rounded-lg border text-xs font-bold text-left transition-all ${
                  sourceAccount === 'BANK_BCA'
                    ? 'bg-indigo-50 border-indigo-500 text-indigo-900 shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-700'
                }`}
              >
                🏦 Bank BCA KARKASIA
                <div className="text-[10px] text-slate-500 font-normal mt-0.5">Rek: 1120-4491-990</div>
              </button>
              <button
                type="button"
                onClick={() => setSourceAccount('KAS_UTAMA')}
                className={`p-2.5 rounded-lg border text-xs font-bold text-left transition-all ${
                  sourceAccount === 'KAS_UTAMA'
                    ? 'bg-indigo-50 border-indigo-500 text-indigo-900 shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-700'
                }`}
              >
                💵 Brankas Kas Utama Toko
                <div className="text-[10px] text-slate-500 font-normal mt-0.5">Saldo Tunai Toko</div>
              </button>
            </div>
          </div>

          {/* No Referensi Bukti Transfer */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Nomor Referensi Bank / Bukti Transfer</label>
            <input
              type="text"
              value={bankRefNumber}
              onChange={e => setBankRefNumber(e.target.value)}
              placeholder="Contoh: TRF-BCA-8829104"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
              required
            />
          </div>

          {/* Catatan */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">Catatan Pelunasan</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
            />
          </div>

          {/* Plain Confirmation Note */}
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Saldo tagihan supplier dan catatan keluar dari {sourceAccount === 'BANK_BCA' ? 'Bank BCA' : 'Kas Toko'} akan diperbarui otomatis.
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[40px] px-4 py-2 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={!isAmountValid}
              className="min-h-[44px] px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Check className="w-4 h-4 text-emerald-400" />
              Konfirmasi Bayar Tagihan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
