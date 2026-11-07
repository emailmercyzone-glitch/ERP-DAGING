import React, { useState } from 'react';
import { X, UserPlus, Save, ShieldCheck, Phone, MapPin, CreditCard, Clock } from 'lucide-react';

export interface NewCustomerData {
  id: string;
  code: string;
  name: string;
  tier: 'RETAIL' | 'HOREKA' | 'VIP';
  creditLimit: number;
  currentReceivable: number;
  termDays: number;
  phone: string;
  address: string;
}

export type CustomerItem = NewCustomerData;

export interface QuickAddCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddCustomerSuccess: (customer: NewCustomerData) => void;
}

export const QuickAddCustomerModal: React.FC<QuickAddCustomerModalProps> = ({
  isOpen,
  onClose,
  onAddCustomerSuccess,
}) => {
  const [name, setName] = useState('');
  const [tier, setTier] = useState<'RETAIL' | 'HOREKA' | 'VIP'>('HOREKA');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [creditLimit, setCreditLimit] = useState<number>(10000000);
  const [termDays, setTermDays] = useState<number>(14);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const prefix = tier === 'VIP' ? 'CUST-VIP' : tier === 'HOREKA' ? 'CUST-RESTO' : 'CUST-RETAIL';
    const newCust: NewCustomerData = {
      id: `CUST_${Date.now()}`,
      code: `${prefix}-${Math.floor(100 + Math.random() * 900)}`,
      name: name.trim(),
      tier,
      creditLimit: tier === 'RETAIL' ? 0 : creditLimit,
      currentReceivable: 0,
      termDays: tier === 'RETAIL' ? 0 : termDays,
      phone: phone.trim() || '-',
      address: address.trim() || 'Alamat Belum Diisi',
    };

    onAddCustomerSuccess(newCust);
    setName('');
    setPhone('');
    setAddress('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden">
        
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <UserPlus className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base font-extrabold tracking-tight">
                Tambah Pelanggan Baru Cepat
              </h2>
              <p className="text-xs text-slate-400">
                Daftarkan resto, hotel, atau katering langsung dari kasir tanpa keluar halaman
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">
              Nama Pelanggan / Usaha <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Contoh: Resto Soto Betawi Pak Mamat / Hotel Horison"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:bg-white focus:ring-1 focus:ring-slate-900 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Tier Harga &amp; Tipe</label>
              <select
                value={tier}
                onChange={e => {
                  const newTier = e.target.value as 'RETAIL' | 'HOREKA' | 'VIP';
                  setTier(newTier);
                  if (newTier === 'RETAIL') {
                    setCreditLimit(0);
                    setTermDays(0);
                  } else if (newTier === 'HOREKA') {
                    setCreditLimit(10000000);
                    setTermDays(14);
                  } else {
                    setCreditLimit(25000000);
                    setTermDays(30);
                  }
                }}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold focus:bg-white focus:ring-1 focus:ring-slate-900 focus:outline-none"
              >
                <option value="HOREKA">HOREKA (Hotel/Resto - Tier 2)</option>
                <option value="VIP">VIP (Grosir/Distributor - Tier 3)</option>
                <option value="RETAIL">RETAIL (Konsumen Umum - Tier 1)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <Phone className="w-3 h-3 text-slate-500" />
                No. WhatsApp / HP
              </label>
              <input
                type="text"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="0812-XXXX-XXXX"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-semibold focus:bg-white focus:ring-1 focus:ring-slate-900 focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
              <MapPin className="w-3 h-3 text-slate-500" />
              Alamat Pengiriman
            </label>
            <input
              type="text"
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="Jl. Raya / Kawasan Ruko..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:ring-1 focus:ring-slate-900 focus:outline-none"
            />
          </div>

          {/* Credit Limit & Terms */}
          {tier !== 'RETAIL' && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-blue-600" />
                Plafon Kredit &amp; Syarat Pembayaran (TOP)
              </span>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600">Plafon Utang Maksimal (Rp)</label>
                  <input
                    type="number"
                    step={1000000}
                    min={0}
                    value={creditLimit}
                    onChange={e => setCreditLimit(parseInt(e.target.value || '0', 10))}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-right"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    Tempo Pembayaran (Hari)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={90}
                    value={termDays}
                    onChange={e => setTermDays(parseInt(e.target.value || '0', 10))}
                    className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono font-bold text-right"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs transition-colors"
            >
              Batal / Kembali
            </button>

            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-extrabold text-xs transition-all flex items-center gap-2 shadow-sm"
            >
              <Save className="w-3.5 h-3.5 text-emerald-400" />
              Simpan Pelanggan &amp; Pilih Langsung
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
