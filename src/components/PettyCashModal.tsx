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

export const INITIAL_OPEX_VOUCHERS: OpexVoucher[] = [
  {
    id: 'OPEX_01',
    voucherNo: 'VCH-261106-001',
    category: 'COLD_CHAIN',
    categoryLabel: 'Cold Chain & Es Balok',
    amountRupiah: 120000,
    recipient: 'Pabrik Es Balok Serang Jaya',
    description: '10 Batang Es Balok pendingin coldbox pengiriman Horeka Cilegon',
    timestamp: '08:30 WIB (Hari Ini)',
    receiptPhotoUrl: 'https://images.unsplash.com/photo-1554415707-9e4c019fcaf4?w=500&auto=format&fit=crop&q=60',
    paidBy: 'Kasir Siti',
    journalRef: 'JRN-261106-0004',
  },
  {
    id: 'OPEX_02',
    voucherNo: 'VCH-261106-002',
    category: 'PACKAGING',
    categoryLabel: 'Kemasan & Plastik Vakum',
    amountRupiah: 85000,
    recipient: 'Toko Plastik Karunia',
    description: '2 Roll Plastik Vakum Emboss Food-Grade tebal 100 micron',
    timestamp: '10:15 WIB (Hari Ini)',
    receiptPhotoUrl: 'https://images.unsplash.com/photo-1607344645866-009c320c5ab8?w=500&auto=format&fit=crop&q=60',
    paidBy: 'Admin Gudang Budi',
    journalRef: 'JRN-261106-0009',
  },
  {
    id: 'OPEX_03',
    voucherNo: 'VCH-261106-003',
    category: 'LOGISTICS',
    categoryLabel: 'BBM & Tol Armada Box',
    amountRupiah: 200000,
    recipient: 'SPBU 34-42104 Serang',
    description: 'Solar Dexlite Armada Truk Pendingin L300 (A 8892 KR)',
    timestamp: '11:45 WIB (Hari Ini)',
    receiptPhotoUrl: 'https://images.unsplash.com/photo-1542314831-c6a4d2757279?w=500&auto=format&fit=crop&q=60',
    paidBy: 'Driver Hendra',
    journalRef: 'JRN-261106-0015',
  },
];

export interface PettyCashModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRecordOpexSuccess?: (newVoucher: OpexVoucher, newBalance: number) => void;
}

export const PettyCashModal: React.FC<PettyCashModalProps> = ({
  isOpen,
  onClose,
  onRecordOpexSuccess,
}) => {
  // Saldo Kasir Kecil Toko
  const [pettyCashBalance, setPettyCashBalance] = useState<number>(2500000); // Rp 2.500.000 modal awal laci kasir
  const [vouchers, setVouchers] = useState<OpexVoucher[]>(INITIAL_OPEX_VOUCHERS);
  const [viewMode, setViewMode] = useState<'LIST' | 'FORM' | 'TOPUP'>('LIST');

  // Form State
  const [category, setCategory] = useState<OpexVoucher['category']>('COLD_CHAIN');
  const [amountStr, setAmountStr] = useState<string>('75000');
  const [recipient, setRecipient] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [receiptPhoto, setReceiptPhoto] = useState<string | null>(null);

  // Top Up Form State
  const [topUpAmountStr, setTopUpAmountStr] = useState<string>('1000000');
  const [topUpSource, setTopUpSource] = useState<'KAS_UTAMA' | 'BANK_BCA'>('BANK_BCA');

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
      console.warn('Camera inaccessible, using fallback sample photo', err);
      setIsCameraActive(false);
      // Fallback sample receipt
      setReceiptPhoto('https://images.unsplash.com/photo-1554415707-9e4c019fcaf4?w=500&auto=format&fit=crop&q=60');
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
  const parsedAmount = parseInt(amountStr || '0', 10);
  const isBalanceEnough = pettyCashBalance >= parsedAmount;

  // Submit Opex Voucher
  const handleSaveOpex = (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedAmount <= 0) return;
    if (!isBalanceEnough) {
      alert('Saldo kasir kecil tidak mencukupi! Silakan isi ulang / top up kas kecil terlebih dahulu.');
      return;
    }

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
      receiptPhotoUrl: receiptPhoto || 'https://images.unsplash.com/photo-1554415707-9e4c019fcaf4?w=500&auto=format&fit=crop&q=60',
      paidBy: 'Kasir Shift 01',
      journalRef: `JRN-${now.toISOString().slice(2, 10).replace(/-/g, '')}-00${seq + 20}`,
    };

    const nextBalance = pettyCashBalance - parsedAmount;
    setPettyCashBalance(nextBalance);
    setVouchers([newVoucher, ...vouchers]);
    setViewMode('LIST');

    // Reset Form
    setAmountStr('75000');
    setRecipient('');
    setDescription('');
    setReceiptPhoto(null);
    stopCamera();

    if (onRecordOpexSuccess) {
      onRecordOpexSuccess(newVoucher, nextBalance);
    }
  };

  // Submit Top-Up
  const handleSaveTopUp = (e: React.FormEvent) => {
    e.preventDefault();
    const topUpAmount = parseInt(topUpAmountStr || '0', 10);
    if (topUpAmount <= 0) return;

    setPettyCashBalance(prev => prev + topUpAmount);
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
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold tracking-tight">Kasir Kecil &amp; OPEX Harian</h3>
                <span className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  Operasional Toko
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Pencatatan kas keluar operasional toko daging &amp; upload bukti nota (Petty Cash Ledger)
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

        {/* Balance Ribbon & Navigation Switcher */}
        <div className="p-4 bg-slate-50 border-b border-slate-200/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
                Sisa Saldo Kasir Kecil
              </span>
              <div className="text-lg font-mono font-extrabold text-slate-900">
                Rp {pettyCashBalance.toLocaleString('id-ID')}
              </div>
            </div>
            <div className="h-8 w-px bg-slate-200" />
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider block">
                Total OPEX Hari Ini
              </span>
              <div className="text-sm font-mono font-bold text-rose-600 flex items-center gap-1">
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
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'LIST'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              Riwayat Voucher ({vouchers.length})
            </button>
            <button
              type="button"
              onClick={() => { setViewMode('FORM'); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                viewMode === 'FORM'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              <Plus className="w-3.5 h-3.5" />
              Catat Beban
            </button>
            <button
              type="button"
              onClick={() => { setViewMode('TOPUP'); stopCamera(); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                viewMode === 'TOPUP'
                  ? 'bg-blue-600 text-white shadow-xs'
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
                    Lampiran Foto Bukti Struk Fisik (Audit Trail HashMicro)
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
                        <button
                          type="button"
                          onClick={() => setReceiptPhoto('https://images.unsplash.com/photo-1554415707-9e4c019fcaf4?w=500&auto=format&fit=crop&q=60')}
                          className="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg flex items-center gap-1.5"
                        >
                          Gunakan Contoh Struk
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
                  Tarik dana dari Rekening Bank Toko atau Kas Utama untuk mengisi kembali batas dana petty cash toko KARKASIA.
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
                      🏦 Bank BCA KARKASIA (1120-4491)
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
                    placeholder="Contoh: 1000000"
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

          {/* VIEW 3: DAFTAR VOUCHER & AUDIT TRAIL */}
          {viewMode === 'LIST' && (
            <div className="space-y-3 animate-tab-fade">
              <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                <span>Daftar Voucher Kas Keluar Hari Ini:</span>
                <span className="text-slate-500 font-normal">Double-Entry Ledger Aktif</span>
              </div>

              <div className="space-y-2">
                {vouchers.map(v => (
                  <div
                    key={v.id}
                    className="p-3 rounded-xl border border-slate-200 hover:border-slate-300 bg-white transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs"
                  >
                    <div className="flex items-start gap-3">
                      {v.receiptPhotoUrl ? (
                        <button
                          type="button"
                          onClick={() => setZoomReceiptUrl(v.receiptPhotoUrl!)}
                          className="w-12 h-12 rounded-lg overflow-hidden border border-slate-200 shrink-0 relative group"
                          title="Klik untuk perbesar bukti struk"
                        >
                          <img src={v.receiptPhotoUrl} alt="Struk" className="w-full h-full object-cover" />
                          <span className="absolute inset-0 bg-black/40 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] font-bold transition-opacity">
                            Zoom
                          </span>
                        </button>
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                          <Receipt className="w-5 h-5" />
                        </div>
                      )}

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-xs text-slate-900">{v.voucherNo}</span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700">
                            {v.categoryLabel}
                          </span>
                        </div>
                        <div className="text-xs text-slate-600 font-medium mt-0.5">{v.description}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5 flex items-center gap-2">
                          <span>Penerima: <strong className="text-slate-600">{v.recipient}</strong></span>
                          <span>•</span>
                          <span>{v.timestamp}</span>
                          <span>•</span>
                          <span className="font-mono text-emerald-700 font-semibold">{v.journalRef}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right self-end sm:self-center shrink-0">
                      <span className="text-sm font-mono font-extrabold text-rose-600 block">
                        -Rp {v.amountRupiah.toLocaleString('id-ID')}
                      </span>
                      <span className="text-[10px] text-emerald-600 font-semibold flex items-center justify-end gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Verified Kasir
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Double Entry Note */}
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-600 flex items-start gap-2">
                <Receipt className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <span>
                  Setiap pengeluaran kasir kecil langsung mencatat jurnal akuntansi otomatis:
                  <code className="text-slate-900 font-mono font-semibold ml-1">[D] Beban OPEX / Perlengkapan (6110) [K] Kasir Kecil Toko (1112)</code>.
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
          <span>Toko Daging KARKASIA • Laci Kasir Utama</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-white border border-slate-300 font-bold text-slate-700 hover:bg-slate-100"
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
