import React, { useState } from 'react';
import {
  X,
  CreditCard,
  Building2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Receipt,
  Check
} from 'lucide-react';

export interface SupplierInvoice {
  id: string;
  invoiceNumber: string;
  poNumber: string;
  supplier: string;
  originCountry: string;
  totalAmountRupiah: number;
  paidAmountRupiah: number;
  remainingAmountRupiah: number;
  dueDate: string;
  daysDiff: number;
  status: 'BELUM_LUNAS' | 'CICILAN' | 'LUNAS';
}

export interface SupplierPayableModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: SupplierInvoice | null;
  onPaymentSuccess: (invoiceId: string, amountPaid: number, newRemaining: number) => void;
}

export const SupplierPayableModal: React.FC<SupplierPayableModalProps> = ({
  isOpen,
  onClose,
  invoice,
  onPaymentSuccess,
}) => {
  if (!isOpen || !invoice) return null;

  const [paymentAmountStr, setPaymentAmountStr] = useState<string>(
    invoice.remainingAmountRupiah.toString()
  );
  const [sourceAccount, setSourceAccount] = useState<'BANK_BCA' | 'KAS_UTAMA'>('BANK_BCA');
  const [bankRefNumber, setBankRefNumber] = useState<string>('TRF-BCA-7729104');
  const [notes, setNotes] = useState<string>('Pelunasan tagihan kontainer daging impor');

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
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold tracking-tight">Pelunasan Utang Supplier Impor</h3>
                <span className="text-[10px] font-bold bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30">
                  AP Payment
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Pencatatan pembayaran utang dagang kontainer ke rekening supplier importir
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

        {/* Invoice Summary Box */}
        <div className="p-4 bg-slate-50 border-b border-slate-200/80 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-mono font-bold text-slate-900">{invoice.invoiceNumber}</span>
            <span className="text-slate-500 font-medium">Ref: {invoice.poNumber}</span>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-slate-800">{invoice.supplier}</div>
              <span className="text-[11px] text-slate-500">Jatuh Tempo: {invoice.dueDate}</span>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-slate-500 block">Sisa Utang:</span>
              <span className="text-base font-mono font-extrabold text-rose-600">
                Rp {invoice.remainingAmountRupiah.toLocaleString('id-ID')}
              </span>
            </div>
          </div>
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

          {/* Double-Entry Journal Preview */}
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600 space-y-1">
            <div className="font-bold text-slate-800 flex items-center gap-1">
              <Receipt className="w-3.5 h-3.5 text-slate-500" />
              <span>Otomatisasi Jurnal Double-Entry:</span>
            </div>
            <div className="font-mono text-[10px] text-slate-700">
              <div>[D] Utang Usaha Supplier (2110) : Rp {paymentAmount.toLocaleString('id-ID')}</div>
              <div>[K] {sourceAccount === 'BANK_BCA' ? 'Bank BCA KARKASIA (1120)' : 'Kas Utama (1111)'} : Rp {paymentAmount.toLocaleString('id-ID')}</div>
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
              disabled={!isAmountValid}
              className="px-5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
            >
              <Check className="w-4 h-4" />
              Konfirmasi Pembayaran Utang
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
