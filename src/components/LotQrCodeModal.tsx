import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  X,
  QrCode,
  Printer,
  Download,
  Package,
  Calendar,
  MapPin,
  Scale,
  Clock,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Tag
} from 'lucide-react';

export interface LotItemForQr {
  id: string;
  code: string;
  product: string;
  sku?: string;
  daysLeft: number;
  expiryDate: string;
  weightGram: number;
  loc: string;
  hppKgRupiah?: number;
}

export interface LotQrCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  lot: LotItemForQr | null;
  onSimulateScan?: (lotCode: string) => void;
}

export const LotQrCodeModal: React.FC<LotQrCodeModalProps> = ({
  isOpen,
  onClose,
  lot,
  onSimulateScan,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    if (!lot) return;

    // Standardized Payload for cold storage meat boxes
    // Format JSON contains SKU, Batch, Expiry, Weight, Location
    const payload = JSON.stringify({
      prefix: 'KARKASIA_COLD_CHAIN',
      sku: lot.sku || `SKU-${lot.code.split('-')[1] || 'MEAT'}`,
      batch: lot.code,
      product: lot.product,
      expiryDate: lot.expiryDate,
      daysLeft: lot.daysLeft,
      weightKg: Number((lot.weightGram / 1000).toFixed(2)),
      location: lot.loc,
      generatedAt: new Date().toISOString().slice(0, 10),
    });

    QRCode.toDataURL(payload, {
      width: 320,
      margin: 1.5,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })
      .then(url => setQrDataUrl(url))
      .catch(err => console.error('Failed to generate QR Code:', err));
  }, [lot]);

  if (!isOpen || !lot) return null;

  const skuCode = lot.sku || `SKU-${lot.code.split('-')[1] || 'MEAT'}`;
  const weightKg = (lot.weightGram / 1000).toFixed(2);

  const handleDownload = () => {
    if (!qrDataUrl) return;
    const link = document.createElement('a');
    link.download = `QR-${lot.code}-${skuCode}.png`;
    link.href = qrDataUrl;
    link.click();
  };

  const handlePrint = () => {
    window.print();
  };

  const handleCopyCode = () => {
    navigator.clipboard?.writeText(lot.code);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col">
        
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <QrCode className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base font-extrabold tracking-tight">
                QR Code &amp; Label Batch Daging
              </h2>
              <p className="text-xs text-slate-400">
                Informasi SKU, Batch, &amp; Tanggal Kadaluwarsa untuk label karton cold storage
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          
          {/* Printable Thermal Label Card */}
          <div className="p-4 bg-white border-2 border-slate-900 rounded-xl space-y-3.5 shadow-sm text-slate-900 relative">
            {/* Label Header */}
            <div className="flex items-center justify-between border-b-2 border-slate-900 pb-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded bg-slate-900 text-white flex items-center justify-center font-black text-xs font-mono">
                  K
                </div>
                <div>
                  <div className="text-[11px] font-black tracking-wider uppercase">
                    KARKASIA COLD STORAGE
                  </div>
                  <div className="text-[9px] text-slate-500 font-mono">
                    MEAT LOT BATCH IDENTIFICATION
                  </div>
                </div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-black bg-slate-100 text-slate-800 border border-slate-300">
                PRIORITAS KELUAR
              </span>
            </div>

            {/* Split: QR Code + Batch Metadata */}
            <div className="flex flex-col sm:flex-row items-center gap-4">
              {/* QR Image */}
              <div className="p-2 bg-white border border-slate-200 rounded-lg shadow-2xs shrink-0 flex flex-col items-center">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt={`QR Code ${lot.code}`}
                    className="w-36 h-36 object-contain"
                  />
                ) : (
                  <div className="w-36 h-36 flex items-center justify-center bg-slate-50 text-slate-400 text-xs">
                    Membuat QR...
                  </div>
                )}
                <span className="text-[9px] font-mono text-slate-500 mt-1">
                  SCAN FOR LOT DETAILS
                </span>
              </div>

              {/* Lot Metadata */}
              <div className="flex-1 space-y-2 text-xs w-full">
                <div>
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                    Nama Potongan Daging
                  </span>
                  <div className="font-extrabold text-slate-900 text-sm leading-snug">
                    {lot.product}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-200">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Kode SKU:</span>
                    <span className="font-mono font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                      {skuCode}
                    </span>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 block">Nomor Batch / Lot:</span>
                    <span className="font-mono font-bold text-slate-900">
                      {lot.code}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-slate-200">
                  <div>
                    <span className="text-[10px] text-slate-500 block">Tanggal Kadaluwarsa:</span>
                    <span className={`font-mono font-extrabold ${lot.daysLeft <= 7 ? 'text-rose-700' : 'text-slate-900'}`}>
                      {lot.expiryDate}
                    </span>
                    <div className="text-[10px] text-slate-500">
                      ({lot.daysLeft} hari lagi)
                    </div>
                  </div>

                  <div>
                    <span className="text-[10px] text-slate-500 block">Lokasi Rak Freezer:</span>
                    <span className="font-mono font-extrabold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 inline-block">
                      {lot.loc}
                    </span>
                  </div>
                </div>

                <div className="pt-1 border-t border-slate-200 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500">Berat Bersih (Netto):</span>
                  <span className="font-mono font-black text-slate-900 text-xs">
                    {weightKg} KG ({lot.weightGram.toLocaleString('id-ID')} g)
                  </span>
                </div>
              </div>
            </div>

            {/* Bottom Barcode String Simulation */}
            <div className="pt-2 border-t border-dashed border-slate-300 flex items-center justify-between text-[10px] font-mono text-slate-500">
              <span>*KARKASIA-{lot.code}*</span>
              <span>SUHU COLD STORAGE: -18&deg;C</span>
            </div>
          </div>

          {/* Quick Simulation Button for Scanner */}
          {onSimulateScan && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center justify-between gap-2">
              <div className="text-xs">
                <span className="font-bold text-emerald-900 block">Uji Coba Scan di Aplikasi</span>
                <span className="text-[11px] text-emerald-700">
                  Simulasikan pemindaian QR ini untuk konfirmasi lokasi rak penyimpanan
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onSimulateScan(lot.code);
                  onClose();
                }}
                className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shrink-0 transition-colors shadow-2xs cursor-pointer flex items-center gap-1"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Simulasi Scan</span>
              </button>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyCode}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
            >
              {isCopied ? 'Tersalin!' : 'Salin Kode Batch'}
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownload}
              className="px-3.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-slate-800 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-slate-600" />
              <span>Unduh PNG</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-emerald-400" />
              <span>Cetak Label</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
