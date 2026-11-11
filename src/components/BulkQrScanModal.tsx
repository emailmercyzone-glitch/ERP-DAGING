import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  QrCode,
  CheckCircle2,
  AlertTriangle,
  Trash2,
  Scale,
  RefreshCw,
  Plus,
  Play,
  Check,
  Package,
  Layers,
  Sparkles,
  Zap,
  ArrowRight,
  ShieldCheck
} from 'lucide-react';

export interface ScannedOpnameItem {
  id: string;
  code: string;
  product: string;
  loc: string;
  expiryDate: string;
  daysLeft: number;
  systemWeightGram: number;
  physicalWeightGram: number;
  hppKgRupiah: number;
  scannedAt: string;
}

export interface BulkQrScanModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableLots: Array<{
    id: string;
    code: string;
    product: string;
    daysLeft: number;
    expiryDate: string;
    weightGram: number;
    maxCapacityGram?: number;
    hppKgRupiah: number;
    loc: string;
    isFefo?: boolean;
    isQuarantined?: boolean;
  }>;
  onCommitBulkOpname: (updatedLots: Array<{ id: string; physicalWeightGram: number }>) => void;
}

export const BulkQrScanModal: React.FC<BulkQrScanModalProps> = ({
  isOpen,
  onClose,
  availableLots,
  onCommitBulkOpname,
}) => {
  const [scannedItems, setScannedItems] = useState<ScannedOpnameItem[]>([]);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [flashMessage, setFlashMessage] = useState<{ title: string; desc: string; type: 'success' | 'warning' } | null>(null);
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const startCamera = async () => {
    setCameraError(null);
    setIsCameraActive(false);
    try {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setCameraError('Sensors kamera tidak tersedia. Silakan gunakan tombol simulasi scan bulk di bawah.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(() => {});
      }
      setIsCameraActive(true);

      if (typeof window !== 'undefined' && 'BarcodeDetector' in window) {
        try {
          const detector = new (window as any).BarcodeDetector({
            formats: ['qr_code', 'code_128', 'ean_13', 'data_matrix']
          });
          const intervalId = setInterval(async () => {
            if (!videoRef.current || !streamRef.current) {
              clearInterval(intervalId);
              return;
            }
            try {
              const barcodes = await detector.detect(videoRef.current);
              if (barcodes.length > 0) {
                const value = barcodes[0].rawValue;
                handleAddLotByCode(value);
              }
            } catch {
              // ignore frame scan errors
            }
          }, 450);
        } catch {
          // ignore detector init error
        }
      }
    } catch (err: any) {
      console.warn('Bulk Camera sensor error:', err);
      setCameraError('Kamera tidak dapat diakses di lingkungan iFrame/preview. Gunakan tombol simulasi scan beruntun di bawah.');
    }
  };

  useEffect(() => {
    if (isOpen) {
      setScannedItems([]);
      setFlashMessage(null);
      startCamera();
    } else {
      stopCamera();
    }
    return () => {
      stopCamera();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddLotByCode = (rawCode: string) => {
    const cleanCode = rawCode.trim();
    let matched = availableLots.find(l => 
      l.code.toLowerCase() === cleanCode.toLowerCase() ||
      cleanCode.toLowerCase().includes(l.code.toLowerCase()) ||
      l.product.toLowerCase().includes(cleanCode.toLowerCase())
    );

    if (!matched && cleanCode.startsWith('{') && cleanCode.endsWith('}')) {
      try {
        const parsed = JSON.parse(cleanCode);
        if (parsed.batch) {
          matched = availableLots.find(l => l.code === parsed.batch);
        }
      } catch {
        // ignore JSON parse error
      }
    }

    if (!matched) {
      triggerFlash('QR Tidak Dikenali', `Kode "${cleanCode}" tidak ditemukan di database stok`, 'warning');
      return;
    }

    // Check if already in queue
    const alreadyExists = scannedItems.some(item => item.id === matched!.id);
    if (alreadyExists) {
      triggerFlash('Batch Sudah Ada', `Lot ${matched.code} sudah masuk di daftar antrean bulk scan`, 'warning');
      return;
    }

    const newItem: ScannedOpnameItem = {
      id: matched.id,
      code: matched.code,
      product: matched.product,
      loc: matched.loc,
      expiryDate: matched.expiryDate,
      daysLeft: matched.daysLeft,
      systemWeightGram: matched.weightGram,
      physicalWeightGram: matched.weightGram, // Default physical = system weight
      hppKgRupiah: matched.hppKgRupiah,
      scannedAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };

    setScannedItems(prev => [newItem, ...prev]);
    triggerFlash('QR Batch Terdeteksi! 🥩', `${matched.code} • ${matched.product} (${(matched.weightGram / 1000).toFixed(1)} KG)`, 'success');
  };

  const triggerFlash = (title: string, desc: string, type: 'success' | 'warning') => {
    setFlashMessage({ title, desc, type });
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(type === 'success' ? [40, 30, 40] : [100, 50, 100]);
      } catch (_) {}
    }
    setTimeout(() => {
      setFlashMessage(null);
    }, 2500);
  };

  const handleUpdatePhysicalWeight = (id: string, newGram: number) => {
    setScannedItems(prev => prev.map(item => item.id === id ? { ...item, physicalWeightGram: newGram } : item));
  };

  const handleRemoveFromQueue = (id: string) => {
    setScannedItems(prev => prev.filter(item => item.id !== id));
  };

  const handleSimulateScanAllActive = () => {
    const unScanned = availableLots.filter(l => !scannedItems.some(s => s.id === l.id));
    if (unScanned.length === 0) {
      triggerFlash('Semua Batch Ter-Scan', 'Semua lot batch yang ada sudah masuk antrean opname', 'warning');
      return;
    }

    const newItems: ScannedOpnameItem[] = unScanned.map(matched => ({
      id: matched.id,
      code: matched.code,
      product: matched.product,
      loc: matched.loc,
      expiryDate: matched.expiryDate,
      daysLeft: matched.daysLeft,
      systemWeightGram: matched.weightGram,
      physicalWeightGram: matched.weightGram,
      hppKgRupiah: matched.hppKgRupiah,
      scannedAt: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    }));

    setScannedItems(prev => [...newItems, ...prev]);
    triggerFlash('Rapid Bulk Scan Berhasil! 🚀', `+${newItems.length} batch karton daging otomatis ter-scan beruntun.`, 'success');
  };

  const handleCommit = () => {
    if (scannedItems.length === 0) return;
    const payload = scannedItems.map(item => ({
      id: item.id,
      physicalWeightGram: item.physicalWeightGram
    }));
    onCommitBulkOpname(payload);
    onClose();
  };

  // Calculations
  const totalScannedCount = scannedItems.length;
  const totalSystemWeightKg = scannedItems.reduce((acc, item) => acc + item.systemWeightGram, 0) / 1000;
  const totalPhysicalWeightKg = scannedItems.reduce((acc, item) => acc + item.physicalWeightGram, 0) / 1000;
  const totalDiscrepancyKg = totalPhysicalWeightKg - totalSystemWeightKg;
  const totalHppValue = Math.round(scannedItems.reduce((acc, item) => acc + (item.physicalWeightGram * item.hppKgRupiah) / 1000, 0));

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-5xl overflow-hidden flex flex-col max-h-[94vh]">
        
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <QrCode className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold tracking-tight">Bulk QR Scan — Stock Opname Beruntun</h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Continuous Mode
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Scan multiple label QR batch karton daging berturut-turut tanpa menutup scanner.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Tutup Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 overflow-y-auto divide-y lg:divide-y-0 lg:divide-x divide-slate-200 flex-1">
          
          {/* LEFT: SCANNER VIEWER & SIMULATOR (5 COLS) */}
          <div className="lg:col-span-5 p-4 space-y-4 bg-slate-950 text-white flex flex-col justify-between">
            <div className="space-y-3">
              {/* Camera Scanner Container */}
              <div className="relative aspect-4/3 w-full rounded-xl bg-slate-900 overflow-hidden border border-slate-800 flex flex-col items-center justify-center">
                <video
                  ref={videoRef}
                  className="w-full h-full object-cover"
                  playsInline
                  muted
                />

                {/* Overlaid Target Reticle */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-48 h-48 border-2 border-dashed border-emerald-400 rounded-xl flex items-center justify-center bg-emerald-500/10 animate-pulse">
                    <span className="text-[10px] font-mono text-emerald-300 font-bold bg-slate-900/80 px-2 py-1 rounded">
                      Arahkan QR Karton
                    </span>
                  </div>
                </div>

                {/* Camera Status or Error Overlay */}
                {cameraError && (
                  <div className="absolute inset-0 bg-slate-900/90 p-4 flex flex-col items-center justify-center text-center text-xs space-y-2 z-10">
                    <AlertTriangle className="w-8 h-8 text-amber-400" />
                    <p className="text-slate-300">{cameraError}</p>
                  </div>
                )}

                {/* Flash Message Banner overlay */}
                {flashMessage && (
                  <div className={`absolute top-3 inset-x-3 p-2.5 rounded-xl z-20 backdrop-blur-md flex items-center gap-2 border shadow-lg animate-bounce ${
                    flashMessage.type === 'success' ? 'bg-emerald-950/90 border-emerald-500 text-emerald-200' : 'bg-amber-950/90 border-amber-500 text-amber-200'
                  }`}>
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <div className="text-left min-w-0">
                      <div className="font-extrabold text-xs">{flashMessage.title}</div>
                      <div className="text-[10px] truncate">{flashMessage.desc}</div>
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Simulation Options for Web Sandboxes */}
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-300 font-bold">
                  <span className="flex items-center gap-1.5 text-emerald-400">
                    <Zap className="w-4 h-4" />
                    Simulasi Rapid Bulk Scan (Demo):
                  </span>
                  <button
                    type="button"
                    onClick={handleSimulateScanAllActive}
                    className="px-2 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[10px] flex items-center gap-1 cursor-pointer shadow-2xs"
                  >
                    <Play className="w-3 h-3 fill-white" />
                    Scan Semua ({availableLots.length})
                  </button>
                </div>
                <p className="text-[11px] text-slate-400">
                  Klik kode batch karton di bawah untuk men-simulasikan hasil scan kamera secara beruntun:
                </p>

                <div className="grid grid-cols-1 gap-1.5 max-h-44 overflow-y-auto pr-1">
                  {availableLots.map(lot => {
                    const isAlready = scannedItems.some(s => s.id === lot.id);
                    return (
                      <button
                        key={lot.id}
                        type="button"
                        onClick={() => handleAddLotByCode(lot.code)}
                        disabled={isAlready}
                        className={`p-2 rounded-lg border text-left flex items-center justify-between transition-all cursor-pointer ${
                          isAlready
                            ? 'bg-slate-950 border-slate-800 text-slate-600 opacity-60 cursor-not-allowed'
                            : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                        }`}
                      >
                        <div>
                          <div className="font-mono font-bold text-xs flex items-center gap-1.5">
                            <QrCode className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span>{lot.code}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 truncate max-w-[200px]">{lot.product}</div>
                        </div>

                        <div className="text-right">
                          <div className="font-mono font-bold text-xs text-emerald-400">{(lot.weightGram / 1000).toFixed(1)} KG</div>
                          <span className="text-[9px] text-slate-400">{lot.loc}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="text-[10px] text-slate-400 text-center font-mono">
              Mode Continuous Scanner • Bebas scan berulang tanpa modal tertutup
            </div>
          </div>

          {/* RIGHT: PROCESSING QUEUE & AUDIT SHEET (7 COLS) */}
          <div className="lg:col-span-7 p-5 flex flex-col justify-between space-y-4 bg-white">
            
            <div className="space-y-3">
              {/* Queue Header & Summary Strip */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <div>
                  <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-600" />
                    Daftar Antrean Batch Ter-Scan ({totalScannedCount} Box)
                  </h4>
                  <p className="text-xs text-slate-500">
                    Masukkan hasil timbangan fisik aktual untuk setiap batch jika terjadi susut drip loss.
                  </p>
                </div>

                {totalScannedCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setScannedItems([])}
                    className="text-xs text-rose-600 hover:text-rose-700 font-bold flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Reset</span>
                  </button>
                )}
              </div>

              {/* Summary KPIs */}
              <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Total Bobot Fisik</div>
                  <div className="text-sm font-mono font-black text-slate-900">{totalPhysicalWeightKg.toFixed(1)} KG</div>
                </div>

                <div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Selisih Opname</div>
                  <div className={`text-sm font-mono font-black ${totalDiscrepancyKg < 0 ? 'text-rose-600' : totalDiscrepancyKg > 0 ? 'text-emerald-600' : 'text-slate-700'}`}>
                    {totalDiscrepancyKg > 0 ? `+${totalDiscrepancyKg.toFixed(2)}` : totalDiscrepancyKg.toFixed(2)} KG
                  </div>
                </div>

                <div>
                  <div className="text-[10px] font-bold text-slate-500 uppercase">Est. Nilai HPP Batch</div>
                  <div className="text-sm font-mono font-black text-emerald-800">Rp {totalHppValue.toLocaleString('id-ID')}</div>
                </div>
              </div>

              {/* Scanned List Table */}
              {scannedItems.length === 0 ? (
                <div className="p-8 text-center border-2 border-dashed border-slate-200 rounded-xl bg-slate-50 space-y-2">
                  <Package className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-slate-600">Belum ada label QR batch yang ter-scan</p>
                  <p className="text-[11px] text-slate-400">
                    Arahkan kamera ke QR karton atau gunakan tombol simulasi di sebelah kiri untuk menambah antrean scan.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                  {scannedItems.map((item, index) => {
                    const sysKg = item.systemWeightGram / 1000;
                    const physKg = item.physicalWeightGram / 1000;
                    const diffKg = physKg - sysKg;

                    return (
                      <div key={item.id} className="p-3 bg-white border border-slate-200 rounded-xl space-y-2 hover:border-slate-300 transition-colors shadow-2xs">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="w-5 h-5 rounded-full bg-slate-900 text-white font-mono font-bold text-[10px] flex items-center justify-center shrink-0">
                              {scannedItems.length - index}
                            </span>
                            <div>
                              <div className="font-mono font-extrabold text-xs text-slate-900 flex items-center gap-1.5">
                                <span>{item.code}</span>
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                  {item.loc}
                                </span>
                              </div>
                              <div className="text-xs font-semibold text-slate-800 line-clamp-1">{item.product}</div>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveFromQueue(item.id)}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                            title="Hapus dari antrean"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {/* Weight adjustment inline row */}
                        <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
                          <div className="text-slate-500 text-[11px]">
                            Stok Sistem: <span className="font-mono font-bold text-slate-800">{sysKg.toFixed(1)} KG</span>
                          </div>

                          <div className="flex items-center gap-2">
                            <label className="text-[11px] font-bold text-slate-700">Hasil Timbangan Fisik:</label>
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                step={100}
                                min={0}
                                value={item.physicalWeightGram}
                                onChange={e => handleUpdatePhysicalWeight(item.id, parseInt(e.target.value || '0', 10))}
                                className="w-24 px-2 py-1 bg-slate-50 border border-slate-300 rounded font-mono font-bold text-xs text-right focus:bg-white focus:ring-1 focus:ring-slate-900"
                              />
                              <span className="text-[10px] font-mono text-slate-500 font-bold">gram</span>
                            </div>
                          </div>
                        </div>

                        {/* Discrepancy indicator */}
                        {diffKg !== 0 && (
                          <div className={`p-1.5 rounded-lg text-[11px] font-bold flex items-center justify-between ${
                            diffKg < 0 ? 'bg-amber-50 text-amber-900 border border-amber-200' : 'bg-emerald-50 text-emerald-900 border border-emerald-200'
                          }`}>
                            <span>Selisih Timbangan Opname:</span>
                            <span className="font-mono font-extrabold">
                              {diffKg > 0 ? `+${diffKg.toFixed(2)}` : diffKg.toFixed(2)} KG ({diffKg < 0 ? 'Susut Thawing / Drip Loss' : 'Lebih Timbang'})
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Submit Action Footer */}
            <div className="pt-3 border-t border-slate-200 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors"
              >
                Batal
              </button>

              <button
                type="button"
                onClick={handleCommit}
                disabled={scannedItems.length === 0}
                className={`px-6 py-2.5 rounded-xl font-extrabold text-xs flex items-center gap-2 shadow-md transition-all cursor-pointer ${
                  scannedItems.length > 0
                    ? 'bg-slate-900 hover:bg-slate-800 text-white'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Simpan Stock Opname Bulk ({totalScannedCount} Batch)</span>
              </button>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
};
