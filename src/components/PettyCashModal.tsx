import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Wallet,
  Plus,
  Receipt,
  Camera,
  CheckCircle2,
  AlertTriangle,
  ArrowDownRight,
  TrendingUp,
  Snowflake,
  Package,
  Truck,
  Zap,
  Wrench,
  Clock,
  Download,
  Image as ImageIcon,
  Check,
  RefreshCw,
  ExternalLink
} from 'lucide-react';

export interface OpexVoucher {
  id: string;
  voucherNo: string;
  category: 'COLD_CHAIN' | 'PACKAGING' | 'LOGISTICS' | 'OPERATIONAL' | 'MAINTENANCE';
  categoryLabel: string;
  amountRupiah: number; // Integer IDR (Zero-Float)
  recipient: string;
  description: string;
  timestamp: string;
  receiptPhotoUrl?: string;
  paidBy: string;
  journalRef: string;
}

export interface PettyCashModalProps {
  isOpen: boolean;
  onClose: () => void;
  pettyCashBalance: number;
  initialVouchers: OpexVoucher[];
  onRecordOpexSuccess: (newVoucher: OpexVoucher) => { ok: boolean; message: string };
  onTopUpSuccess: (amountRupiah: number, source: 'KAS_UTAMA' | 'BANK_BCA') => { ok: boolean; message: string };
}

export const PettyCashModal: React.FC<PettyCashModalProps> = ({
  isOpen,
  onClose,
  pettyCashBalance,
  initialVouchers,
  onRecordOpexSuccess,
  onTopUpSuccess,
}) => {
  const [vouchers, setVouchers] = useState<OpexVoucher[]>(initialVouchers);
  const [viewMode, setViewMode] = useState<'LIST' | 'FORM' | 'TOPUP'>('LIST');

  useEffect(() => {
    setVouchers(initialVouchers);
  }, [initialVouchers]);

  // Form State
  const [category, setCategory] = useState<OpexVoucher['category']>('OPERATIONAL');
  const [amountStr, setAmountStr] = useState<string>('');
  const [recipient, setRecipient] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [receiptPhoto, setReceiptPhoto] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Top Up Form State
  const [topUpAmountStr, setTopUpAmountStr] = useState<string>('');
  const [topUpSource, setTopUpSource] = useState<'KAS_UTAMA' | 'BANK_BCA'>('KAS_UTAMA');

  // Camera State
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [zoomReceiptUrl, setZoomReceiptUrl] = useState<string | null>(null);

  // Start Camera
  const startCamera = async () => {
    try {
      setIsCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.warn('Camera inaccessible', err);
      setIsCameraActive(false);
      setFormError('Kamera tidak dapat diakses. Periksa izin kamera perangkat lalu coba lagi.');
    }
  };

  // Stop Camera
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  // Take Snapshot
  const captureSnapshot = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setReceiptPhoto(dataUrl);
      }
    }
    stopCamera();
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  if (!isOpen) return null;

  const totalOpexToday = vouchers.reduce((acc, v) => acc + v.amountRupiah, 0);
  const parsedAmount = Number(amountStr || '0');
  const isBalanceEnough = pettyCashBalance >= parsedAmount;

  // Submit Opex Voucher
  const handleSaveOpex = (e: React.FormEvent) => {
    e.preventDefault();
    if (!Number.isSafeInteger(parsedAmount) || parsedAmount <= 0) {
      setFormError('Nominal biaya harus bilangan bulat Rupiah lebih dari Rp 0.');
      return;
    }
    if (!isBalanceEnough) {
      setFormError('Saldo kas kecil tidak mencukupi. Silakan isi ulang kas kecil terlebih dahulu.');
      return;
    }
    if (!receiptPhoto) {
      setFormError('Foto bukti struk wajib dilampirkan sebelum biaya dicatat.');
      return;
    }
    setFormError(null);

    const categoryLabels: Record<OpexVoucher['category'], string> = {
      COLD_CHAIN: 'Cold Chain & Es Balok',
      PACKAGING: 'Kemasan & Plastik Vakum',
      LOGISTICS: 'BBM & Tol Armada Box',
      OPERATIONAL: 'Operasional & Toko',
      MAINTENANCE: 'Servis Chiller & Timbangan',
    };

    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} WIB`;
    const seq = vouchers.length + 1;
    const voucherNo = `VCH-${now.toISOString().slice(2, 10).replace(/-/g, '')}-${seq.toString().padStart(3, '0')}`;

    const newVoucher: OpexVoucher = {
      id: `OPEX_${Date.now()}`,
      voucherNo,
      category,
      categoryLabel: categoryLabels[category],
      amountRupiah: parsedAmount,
      recipient: recipient.trim() || 'Toko Rekanan',
      description: description.trim() || 'Biaya operasional kasir kecil',
      timestamp: `${timeStr} (Hari Ini)`,
      ...(receiptPhoto ? { receiptPhotoUrl: receiptPhoto } : {}),
      paidBy: 'Kasir Toko',
      journalRef: voucherNo,
    };

    const result = onRecordOpexSuccess(newVoucher);
    if (!result.ok) {
      setFormError(result.message);
      return;
    }
    setViewMode('LIST');

    // Reset Form
    setAmountStr('');
    setRecipient('');
    setDescription('');
    setReceiptPhoto(null);
    stopCamera();

  };

  // Submit Top-Up
  const handleSaveTopUp = (e: React.FormEvent) => {
    e.preventDefault();
    const topUpAmount = Number(topUpAmountStr || '0');
    if (!Number.isSafeInteger(topUpAmount) || topUpAmount <= 0) {
      setFormError('Nominal isi saldo harus bilangan bulat Rupiah lebih dari Rp 0.');
      return;
    }
    const result = onTopUpSuccess(topUpAmount, topUpSource);
    if (!result.ok) {
      setFormError(result.message);
      return;
    }
    setFormError(null);
    setTopUpAmountStr('');
    setViewMode('LIST');
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-tab-fade">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400">
              <Wallet className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-extrabold tracking-tight">Kas Kecil &amp; Biaya Harian Toko</h3>
              <p className="text-xs text-slate-400">
                Catat pengeluaran harian toko &amp; simpan foto nota belanja
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-w-[40px] min-h-[40px] p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors flex items-center justify-center cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Balance Ribbon & Navigation Switcher */}
        <div className="p-4 bg-slate-50 border-b border-slate-200/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-[11px] font-semibold text-slate-500 block">
                Sisa Saldo Laci Kasir
              </span>
              <div className="text-lg font-mono tabular-nums font-extrabold text-slate-900">
                Rp {pettyCashBalance.toLocaleString('id-ID')}
              </div>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div>
              <span className="text-[11px] font-semibold text-slate-500 block">
                Total Biaya Hari Ini
              </span>
              <div className="text-sm font-mono tabular-nums font-bold text-rose-600 flex items-center gap-1">
                <ArrowDownRight className="w-4 h-4" />
                Rp {totalOpexToday.toLocaleString('id-ID')}
              </div>
            </div>
          </div>

          {/* Action Tabs */}
          <div className="flex items-center gap-1.5 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => { setViewMode('LIST'); stopCamera(); }}
              className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                viewMode === 'LIST'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              Riwayat ({vouchers.length})
            </button>
            <button
              type="button"
              onClick={() => { setViewMode('FORM'); }}
              className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                viewMode === 'FORM'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              Catat Biaya
            </button>
            <button
              type="button"
              onClick={() => { setViewMode('TOPUP'); stopCamera(); }}
              className={`min-h-[40px] px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                viewMode === 'TOPUP'
                  ? 'bg-blue-600 text-white'
                  : 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
              }`}
            >
              Isi Saldo Kas
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {/* VIEW 1: FORM INPUT BEBAN OPEX */}
          {viewMode === 'FORM' && (
            <form onSubmit={handleSaveOpex} className="space-y-4 animate-tab-fade">
              {formError && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                  {formError}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Kategori Pengeluaran */}
                <div className="sm:col-span-2 space-y-1.5">
                  <label className="text-xs font-bold text-slate-700 block">Kategori Biaya Operasional</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      { id: 'COLD_CHAIN', label: '🧊 Es Balok & Dry Ice', icon: Snowflake },
                      { id: 'PACKAGING', label: '📦 Plastik Vakum Roll', icon: Package },
                      { id: 'LOGISTICS', label: '⛽ BBM Truk L300 / Tol', icon: Truck },
                      { id: 'OPERATIONAL', label: '⚡ Operasional / Makan', icon: Zap },
                      { id: 'MAINTENANCE', label: '🛠️ Servis Kompresor', icon: Wrench },
                    ].map(cat => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setCategory(cat.id as any)}
                        className={`p-2 rounded-lg border text-left text-xs font-bold transition-all flex items-center gap-2 ${
                          category === cat.id
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-900 shadow-2xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <cat.icon className="w-4 h-4 shrink-0 text-slate-600" />
                        <span className="truncate">{cat.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Jumlah Pengeluaran */}
                <div className="space-y-1.5 sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700">Nominal Pengeluaran (IDR)</label>
                    <span className="text-[11px] text-slate-500 font-mono">
                      Saldo Kasir: Rp {pettyCashBalance.toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">Rp</span>
                    <input
                      type="number"
                      value={amountStr}
                      onChange={e => setAmountStr(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono font-bold focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                      placeholder="Contoh: 75000"
                      required
                    />
                  </div>

                  {/* Quick Preset Buttons */}
                  <div className="flex items-center gap-1.5 pt-1">
                    {[50000, 75000, 100000, 200000, 350000].map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setAmountStr(val.toString())}
                        className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700"
                      >
                        +{val / 1000}rb
                      </button>
                    ))}
                  </div>

                  {!isBalanceEnough && (
                    <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>Saldo kasir kecil tidak cukup! Harap kurangi nominal atau isi ulang kasir.</span>
                    </div>
                  )}
                </div>

                {/* Nama Penerima / Vendor */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Nama Penerima / Toko</label>
                  <input
                    type="text"
                    value={recipient}
                    onChange={e => setRecipient(e.target.value)}
                    placeholder="Contoh: Pabrik Es Serang Jaya"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                    required
                  />
                </div>

                {/* Keterangan Pengeluaran */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Keterangan Transaksi</label>
                  <input
                    type="text"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Contoh: Beli 6 batang es pendingin pengiriman Horeka"
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                    required
                  />
                </div>
              </div>

              {/* Bukti Foto Nota / Struk Fisik (Kamera & Upload) */}
              <div className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/70 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Receipt className="w-3.5 h-3.5 text-slate-600" />
                    Lampiran Foto Bukti Struk Fisik
                  </span>
                  {receiptPhoto && (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                      ✓ Foto Terlampir
                    </span>
                  )}
                </div>

                {/* Live Camera Viewfinder */}
                {isCameraActive ? (
                  <div className="relative rounded-xl overflow-hidden bg-black aspect-video flex items-center justify-center border-2 border-emerald-500">
                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                    <div className="absolute inset-0 border-2 border-dashed border-white/50 m-6 rounded-lg pointer-events-none" />
                    <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-3">
                      <button
                        type="button"
                        onClick={captureSnapshot}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-full shadow-lg flex items-center gap-1.5"
                      >
                        <Camera className="w-4 h-4" />
                        Jepret Foto Struk
                      </button>
                      <button
                        type="button"
                        onClick={stopCamera}
                        className="px-3 py-2 bg-slate-800/80 hover:bg-slate-900 text-white text-xs rounded-full"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col sm:flex-row items-center gap-3">
                    {receiptPhoto ? (
                      <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-slate-300 shrink-0 group">
                        <img src={receiptPhoto} alt="Struk OPEX" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setReceiptPhoto(null)}
                          className="absolute inset-0 bg-black/60 text-white text-xs opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                        >
                          Hapus
                        </button>
                      </div>
                    ) : (
                      <div className="w-20 h-20 rounded-lg border-2 border-dashed border-slate-300 bg-white flex flex-col items-center justify-center text-slate-400 shrink-0">
                        <ImageIcon className="w-6 h-6 mb-1" />
                        <span className="text-[10px]">Belum Ada</span>
                      </div>
                    )}

                    <div className="space-y-1.5 flex-1">
                      <p className="text-[11px] text-slate-500">
                        Foto nota fisik diperlukan untuk verifikasi pembukuan pajak UMKM dan pencegahan fraud laci kasir.
                      </p>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={startCamera}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg flex items-center gap-1.5"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          Buka Kamera Struk
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Form Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => { setViewMode('LIST'); stopCamera(); }}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={!isBalanceEnough || parsedAmount <= 0}
                  className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Keluarkan Kas &amp; Terbitkan Voucher
                </button>
              </div>
            </form>
          )}

          {/* VIEW 2: FORM TOP-UP SALDO KASIR KECIL */}
          {viewMode === 'TOPUP' && (
            <form onSubmit={handleSaveTopUp} className="space-y-4 animate-tab-fade">
              <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200 space-y-2">
                <div className="flex items-center gap-2 text-blue-900 font-bold text-xs">
                  <Wallet className="w-4 h-4 text-blue-600" />
                  <span>Isi Ulang Saldo Laci Kasir (Imprest Petty Cash)</span>
                </div>
                <p className="text-xs text-blue-700 leading-relaxed">
                  Tarik dana dari Rekening Bank Toko atau Kas Utama untuk mengisi kembali saldo kas kecil. Pastikan transfer bank benar-benar dilakukan sebelum dikonfirmasi.
                </p>
              </div>

              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Sumber Dana</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTopUpSource('BANK_BCA')}
                      className={`p-2.5 rounded-lg border text-xs font-bold text-left transition-all ${
                        topUpSource === 'BANK_BCA'
                          ? 'bg-blue-50 border-blue-500 text-blue-900 shadow-2xs'
                          : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      🏦 Bank Toko (BCA)
                    </button>
                    <button
                      type="button"
                      onClick={() => setTopUpSource('KAS_UTAMA')}
                      className={`p-2.5 rounded-lg border text-xs font-bold text-left transition-all ${
                        topUpSource === 'KAS_UTAMA'
                          ? 'bg-blue-50 border-blue-500 text-blue-900 shadow-2xs'
                          : 'bg-white border-slate-200 text-slate-700'
                      }`}
                    >
                      💵 Brankas Kas Utama Toko
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Nominal Isi Ulang (IDR)</label>
                  <input
                    type="number"
                    value={topUpAmountStr}
                    onChange={e => setTopUpAmountStr(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm font-mono font-bold focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-900"
                    placeholder="Masukkan nominal isi saldo"
                    required
                  />
                  <div className="flex items-center gap-2 pt-1">
                    {[500000, 1000000, 2000000].map(val => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setTopUpAmountStr(val.toString())}
                        className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700"
                      >
                        +{val.toLocaleString('id-ID')}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

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
                  className="px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors"
                >
                  <Check className="w-4 h-4" />
                  Konfirmasi Isi Saldo
                </button>
              </div>
            </form>
          )}

          {/* VIEW 3: DAFTAR PENGELUARAN HARIAN */}
          {viewMode === 'LIST' && (
            <div className="space-y-3 animate-tab-fade">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span>Daftar Pengeluaran Hari Ini:</span>
                <span className="text-slate-500 font-normal">Semua biaya langsung masuk catatan toko</span>
              </div>

              <div className="space-y-2">
                {vouchers.map(v => (
                  <div
                    key={v.id}
                    className="p-3 rounded-xl border border-slate-200 hover:border-slate-300 bg-white transition-colors flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-3">
                      {v.receiptPhotoUrl ? (
                        <button
                          type="button"
                          onClick={() => setZoomReceiptUrl(v.receiptPhotoUrl!)}
                          className="w-12 h-12 rounded-lg overflow-hidden border border-slate-200 shrink-0 relative group cursor-pointer"
                          title="Klik untuk perbesar foto nota"
                        >
                          <img src={v.receiptPhotoUrl} alt="Nota Biaya" className="w-full h-full object-cover" />
                          <span className="absolute inset-0 bg-black/40 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] font-bold transition-opacity">
                            Lihat
                          </span>
                        </button>
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                          <Receipt className="w-5 h-5" />
                        </div>
                      )}

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-xs text-slate-900">{v.voucherNo}</span>
                          <span className="text-[11px] font-medium text-slate-500">
                            · {v.categoryLabel}
                          </span>
                        </div>
                        <div className="text-xs text-slate-600 font-medium mt-0.5">{v.description}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-2">
                          <span>Penerima: <strong className="text-slate-600">{v.recipient}</strong></span>
                          <span>·</span>
                          <span>{v.timestamp}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right self-end sm:self-center shrink-0">
                      <span className="text-sm font-mono tabular-nums font-extrabold text-rose-600 block">
                        -Rp {v.amountRupiah.toLocaleString('id-ID')}
                      </span>
                      <span className="text-[11px] text-emerald-700 font-semibold inline-flex items-center justify-end gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Tersimpan ✓
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Plain Confirmation Note */}
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-slate-500 shrink-0" />
                <span>
                  Semua pengeluaran kas kecil langsung tercatat di laporan harian toko. Rincian lengkap ada di Menu Lainnya.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>ERP DAGING · Kas Kecil Operasional</span>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[40px] px-4 py-1.5 rounded-lg bg-white border border-slate-300 font-bold text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>

      {/* Modal Zoom Struk */}
      {zoomReceiptUrl && (
        <div className="fixed inset-0 z-60 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-4 max-w-sm w-full space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-900">Bukti Struk Pengeluaran Asli</h4>
              <button
                type="button"
                onClick={() => setZoomReceiptUrl(null)}
                className="p-1 rounded text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="rounded-xl overflow-hidden border border-slate-200 aspect-3/4">
              <img src={zoomReceiptUrl} alt="Bukti Struk Zoom" className="w-full h-full object-contain bg-slate-900" />
            </div>
            <button
              type="button"
              onClick={() => setZoomReceiptUrl(null)}
              className="w-full py-1.5 bg-slate-900 text-white font-bold text-xs rounded-lg"
            >
              Tutup Preview
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
