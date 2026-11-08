import React, { useState } from 'react';
import {
  X,
  MapPin,
  CheckCircle2,
  ArrowRight,
  Package,
  Calendar,
  Scale,
  AlertTriangle,
  MoveRight,
  Building,
  RotateCcw
} from 'lucide-react';

export interface ScannedLotDetails {
  id: string;
  code: string;
  product: string;
  sku?: string;
  expiryDate: string;
  daysLeft: number;
  weightGram: number;
  loc: string;
  hppKgRupiah?: number;
}

export interface ShelfLocationPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  lot: ScannedLotDetails | null;
  onConfirmLocation: (lotId: string, newLocation: string, isMoved: boolean) => void;
}

const PRESET_SHELF_LOCATIONS = [
  { id: 'FREEZER-A-01', label: 'FREEZER-A-01 (Chiller Sapi Primal 1 - Aus Meltique)' },
  { id: 'FREEZER-A-02', label: 'FREEZER-A-02 (Chiller Sapi Primal 2 - USA Choice)' },
  { id: 'FREEZER-B-01', label: 'FREEZER-B-01 (Cold Storage Tetelan & Trimming Sop)' },
  { id: 'FREEZER-B-02', label: 'FREEZER-B-02 (Freezer Slice Shabu & Sukiyaki)' },
  { id: 'FREEZER-C-01', label: 'FREEZER-C-01 (Freezer Bone-In Iga Konro & Buntut)' },
  { id: 'COLD-ROOM-THAW', label: 'COLD-ROOM-THAW (Chamber Thawing & Pemotongan)' },
  { id: 'QUARANTINE-01', label: 'QUARANTINE-01 (Area Karantina Retur Mutu Daging)' },
];

export const ShelfLocationPromptModal: React.FC<ShelfLocationPromptModalProps> = ({
  isOpen,
  onClose,
  lot,
  onConfirmLocation,
}) => {
  const [selectedLocation, setSelectedLocation] = useState<string>(lot?.loc || 'FREEZER-A-01');
  const [customLocation, setCustomLocation] = useState<string>('');
  const [useCustom, setUseCustom] = useState<boolean>(false);

  // Sync when lot changes
  React.useEffect(() => {
    if (lot) {
      setSelectedLocation(lot.loc);
      setCustomLocation('');
      setUseCustom(false);
    }
  }, [lot]);

  if (!isOpen || !lot) return null;

  const currentLoc = lot.loc;
  const targetLoc = useCustom ? customLocation.trim().toUpperCase() : selectedLocation;
  const isMoved = targetLoc !== currentLoc && targetLoc.length > 0;

  const handleConfirmSame = () => {
    onConfirmLocation(lot.id, currentLoc, false);
    onClose();
  };

  const handleConfirmMoved = () => {
    if (!targetLoc) return;
    onConfirmLocation(lot.id, targetLoc, true);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col">
        
        {/* Header Bar */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="p-2 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30">
              <MapPin className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base font-extrabold tracking-tight">
                Konfirmasi Lokasi Rak Penyimpanan
              </h2>
              <p className="text-xs text-slate-400">
                Verifikasi QR batch berhasil. Pastikan posisi rak fisik cold storage sesuai
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

        {/* Modal Body */}
        <div className="p-5 space-y-4 overflow-y-auto">
          
          {/* Detected Lot Metadata Card */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                  Batch Daging Terdeteksi
                </span>
                <h3 className="text-sm font-extrabold text-slate-900 leading-snug">
                  {lot.product}
                </h3>
              </div>
              <span className="px-2 py-0.5 rounded font-mono font-bold text-[11px] bg-slate-200 text-slate-800 shrink-0">
                {lot.code}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-200/80">
              <div className="flex items-center gap-1.5 text-slate-600">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Exp: <strong className="text-slate-800">{lot.expiryDate}</strong></span>
              </div>

              <div className="flex items-center gap-1.5 text-slate-600">
                <Scale className="w-3.5 h-3.5 text-slate-400" />
                <span>Berat: <strong className="text-slate-800">{(lot.weightGram / 1000).toFixed(1)} KG</strong></span>
              </div>
            </div>

            {/* Current vs New Location Preview */}
            <div className="p-3 bg-white border border-slate-200 rounded-lg flex items-center justify-between gap-3">
              <div className="space-y-0.5">
                <span className="text-[10px] text-slate-400 uppercase block font-semibold">
                  Lokasi Tercatat di Sistem
                </span>
                <span className="font-mono font-extrabold text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 inline-block">
                  {currentLoc}
                </span>
              </div>

              <div className="flex items-center justify-center text-slate-400">
                <MoveRight className="w-4 h-4" />
              </div>

              <div className="space-y-0.5 text-right">
                <span className="text-[10px] text-slate-400 uppercase block font-semibold">
                  Lokasi Terpilih Saat Ini
                </span>
                <span className={`font-mono font-extrabold text-xs px-2 py-0.5 rounded border inline-block ${
                  isMoved 
                    ? 'bg-blue-50 text-blue-700 border-blue-300 ring-2 ring-blue-500/20' 
                    : 'bg-emerald-50 text-emerald-700 border-emerald-300'
                }`}>
                  {targetLoc || currentLoc}
                </span>
              </div>
            </div>
          </div>

          {/* Relocation Selection Form */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                <Building className="w-3.5 h-3.5 text-blue-600" />
                Pilih / Update Rak Penyimpanan Baru:
              </label>
              <button
                type="button"
                onClick={() => setUseCustom(prev => !prev)}
                className="text-[11px] text-blue-600 hover:text-blue-700 font-bold cursor-pointer"
              >
                {useCustom ? 'Pilih dari Daftar Preset' : '+ Ketik Lokasi Rak Custom'}
              </button>
            </div>

            {!useCustom ? (
              <select
                value={selectedLocation}
                onChange={e => setSelectedLocation(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:bg-white focus:ring-1 focus:ring-slate-900 focus:outline-none"
              >
                {PRESET_SHELF_LOCATIONS.map(loc => (
                  <option key={loc.id} value={loc.id}>
                    {loc.label}
                  </option>
                ))}
              </select>
            ) : (
              <div className="space-y-1">
                <input
                  type="text"
                  value={customLocation}
                  onChange={e => setCustomLocation(e.target.value.toUpperCase())}
                  placeholder="Contoh: FREEZER-A-03 / BIN-CHILLER-09"
                  className="w-full px-3 py-2 bg-white border border-blue-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  autoFocus
                />
                <p className="text-[10px] text-slate-400">
                  Gunakan format penamaan rak standar gudang KARKASIA
                </p>
              </div>
            )}
          </div>

          {/* Notice Banner */}
          {isMoved && (
            <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl flex items-start gap-2.5 text-xs text-blue-900">
              <AlertTriangle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Batch Terdeteksi Berpindah Rak</span>
                <span>
                  Lokasi lot <strong>{lot.code}</strong> akan diperbarui dari <strong>{currentLoc}</strong> ke <strong>{targetLoc}</strong> di database gudang.
                </span>
              </div>
            </div>
          )}

        </div>

        {/* Action Buttons */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-end gap-2.5 shrink-0">
          <button
            type="button"
            onClick={handleConfirmSame}
            className="w-full sm:w-auto px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Lokasi Tetap ({currentLoc})</span>
          </button>

          <button
            type="button"
            onClick={handleConfirmMoved}
            className={`w-full sm:w-auto px-5 py-2 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer ${
              isMoved
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : 'bg-slate-900 hover:bg-slate-800 text-white'
            }`}
          >
            <MapPin className="w-3.5 h-3.5 text-emerald-400" />
            <span>{isMoved ? `Simpan Perpindahan ke ${targetLoc}` : 'Konfirmasi & Tampilkan Detail'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
