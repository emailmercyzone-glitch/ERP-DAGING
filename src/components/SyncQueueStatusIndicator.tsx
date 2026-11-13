import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Clock,
  Cloud,
  CloudOff,
  HardDrive,
  RefreshCw,
  Server,
  UploadCloud,
  Wifi,
  WifiOff,
} from 'lucide-react';
import type { SyncOutboxItem } from '../engine/types';
import type { BackendAdapterType } from '../adapters/backendAdapter';

interface SyncQueueStatusIndicatorProps {
  isOnline: boolean;
  syncOutbox: SyncOutboxItem[];
  adapterType?: BackendAdapterType;
  adapterLabel?: string;
  isSyncing?: boolean;
  onToggleOfflineSimulation: () => void;
  onSyncNow: () => void;
  onOpenBackendSettings?: () => void;
}

const ENTITY_LABELS: Record<SyncOutboxItem['entityType'], string> = {
  SALE: 'Penjualan',
  PURCHASE: 'Barang Masuk',
  OPNAME: 'Cek Stok',
  CONVERSION: 'Potong & Olah',
  RETURN: 'Retur Barang',
  PAYMENT: 'Pembayaran',
  VOID: 'Pembatalan',
  APPROVAL: 'Persetujuan',
};

export const SyncQueueStatusIndicator: React.FC<SyncQueueStatusIndicatorProps> = ({
  isOnline,
  syncOutbox,
  adapterType = 'LOCAL_ONLY',
  adapterLabel = 'Lokal Mandiri',
  isSyncing = false,
  onToggleOfflineSimulation,
  onSyncNow,
  onOpenBackendSettings,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const pendingItems = syncOutbox.filter((item) => item.status === 'PENDING' || item.status === 'FAILED');
  const failedItems = syncOutbox.filter((item) => item.status === 'FAILED');
  const pendingCount = pendingItems.length;
  const hasPending = pendingCount > 0;
  const hasFailed = failedItems.length > 0;
  const isLocalOnly = adapterType === 'LOCAL_ONLY';

  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const queueSlots = [1, 2, 3, 4, 5];
  const filledSlots = Math.min(5, pendingCount);

  const buttonClasses = !isOnline
    ? hasPending
      ? 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100/80'
      : 'bg-slate-100 border-slate-300 text-slate-700 hover:bg-slate-200/80'
    : hasFailed
    ? 'bg-rose-50 border-rose-300 text-rose-900 hover:bg-rose-100/80'
    : hasPending
    ? 'bg-amber-50 border-amber-300 text-amber-900 hover:bg-amber-100/80'
    : 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100/80';

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-label={
          !isOnline
            ? `Status offline, ${pendingCount} transaksi di antrean lokal`
            : hasPending
            ? `${adapterLabel}, ${pendingCount} transaksi menunggu konfirmasi backend`
            : `${adapterLabel}, data tersimpan aman`
        }
        className={`min-h-[40px] flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${buttonClasses}`}
      >
        {!isOnline ? (
          <>
            <WifiOff className={`w-3.5 h-3.5 shrink-0 ${hasPending ? 'text-amber-700' : 'text-slate-600'}`} />
            <span>Offline</span>
            <span className="h-3.5 w-px bg-slate-300/80 shrink-0" aria-hidden="true" />
            <span className="flex items-center gap-0.5" title={`${pendingCount} transaksi menunggu dikirim`}>
              {queueSlots.map((slot) => (
                <span
                  key={slot}
                  className={`w-1.5 h-3 rounded-[2px] transition-colors ${
                    slot <= filledSlots ? 'bg-amber-600' : 'bg-slate-300/80'
                  }`}
                />
              ))}
            </span>
            <span
              className={`font-mono tabular-nums font-bold px-1.5 py-0.5 rounded text-[11px] leading-none ${
                hasPending ? 'bg-amber-200/80 text-amber-950' : 'bg-slate-200/80 text-slate-700'
              }`}
            >
              {pendingCount}
            </span>
          </>
        ) : hasFailed ? (
          <>
            <AlertCircle className="w-3.5 h-3.5 text-rose-700 shrink-0" />
            <span>Perlu Kirim Ulang</span>
            <span className="font-mono tabular-nums font-bold px-1.5 py-0.5 rounded bg-rose-200/80 text-rose-950 text-[11px] leading-none">
              {pendingCount}
            </span>
          </>
        ) : hasPending ? (
          <>
            {isLocalOnly ? (
              <HardDrive className="w-3.5 h-3.5 text-amber-700 shrink-0" />
            ) : (
              <UploadCloud className="w-3.5 h-3.5 text-amber-700 shrink-0" />
            )}
            <span>{isLocalOnly ? 'Antrean Lokal' : 'Menunggu Kirim'}</span>
            <span className="flex items-center gap-0.5" title={`${pendingCount} transaksi di Outbox`}>
              {queueSlots.map((slot) => (
                <span
                  key={slot}
                  className={`w-1.5 h-3 rounded-[2px] transition-colors ${
                    slot <= filledSlots ? 'bg-amber-600' : 'bg-amber-200'
                  }`}
                />
              ))}
            </span>
            <span className="font-mono tabular-nums font-bold px-1.5 py-0.5 rounded bg-amber-200/80 text-amber-950 text-[11px] leading-none">
              {pendingCount}
            </span>
          </>
        ) : isLocalOnly ? (
          <>
            <HardDrive className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Lokal Aman ✓</span>
          </>
        ) : (
          <>
            <Cloud className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span>Tersinkron ✓</span>
          </>
        )}
        <ChevronDown
          className={`w-3.5 h-3.5 opacity-60 transition-transform hidden sm:inline ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label="Status Koneksi dan Antrean Outbox"
          className="absolute left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0 mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white border border-slate-200 rounded-xl shadow-lg p-4 space-y-3 z-50"
        >
          {/* Connectivity & Adapter Header */}
          <div className="flex items-start justify-between gap-2.5">
            <div className="flex items-start gap-2.5">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                  !isOnline
                    ? 'bg-slate-100 border-slate-200 text-slate-700'
                    : hasFailed
                    ? 'bg-rose-50 border-rose-200 text-rose-700'
                    : hasPending
                    ? 'bg-amber-50 border-amber-200 text-amber-700'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                }`}
              >
                {!isOnline ? (
                  <CloudOff className="w-4 h-4" />
                ) : isLocalOnly ? (
                  <HardDrive className="w-4 h-4" />
                ) : hasPending ? (
                  <UploadCloud className="w-4 h-4" />
                ) : (
                  <Wifi className="w-4 h-4" />
                )}
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">
                  {!isOnline
                    ? 'Mode Offline Aktif'
                    : isLocalOnly
                    ? 'Mode Lokal Mandiri (Tanpa Server)'
                    : hasFailed
                    ? `${adapterLabel} · Gagal Kirim Sebagian`
                    : hasPending
                    ? `${adapterLabel} · Menunggu ACK`
                    : `${adapterLabel} · Tersinkron ✓`}
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                  {!isOnline
                    ? 'Kasir tetap berjalan lancar. Semua transaksi disimpan di database perangkat.'
                    : isLocalOnly
                    ? 'Semua transaksi beroperasi penuh di perangkat ini. Status berubah SYNCED hanya setelah server eksternal dihubungkan & mengonfirmasi.'
                    : hasFailed
                    ? `${failedItems.length} transaksi gagal terkirim dan menunggu kirim ulang.`
                    : hasPending
                    ? 'Transaksi tersimpan aman di Outbox dan siap dikirim ke adapter server.'
                    : 'Semua catatan telah dikonfirmasi diterima oleh adapter server.'}
                </p>
              </div>
            </div>
          </div>

          {/* Sync Queue Length Summary */}
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">Antrean Outbox (PENDING/FAILED)</span>
              <span className="font-mono tabular-nums font-bold text-slate-900">
                {pendingCount} transaksi
              </span>
            </div>

            <div className="grid grid-cols-5 gap-1" aria-hidden="true">
              {queueSlots.map((slot) => (
                <div
                  key={slot}
                  className={`h-1.5 rounded-sm transition-colors ${
                    slot <= filledSlots
                      ? hasFailed
                        ? 'bg-rose-500'
                        : 'bg-amber-500'
                      : 'bg-slate-200'
                  }`}
                />
              ))}
            </div>

            {pendingCount > 0 ? (
              <div className="pt-1.5 border-t border-slate-200/80 space-y-1.5 max-h-40 overflow-y-auto">
                {pendingItems.slice(0, 5).map((item) => (
                  <div
                    key={item.uuid}
                    className="flex items-start justify-between gap-2 text-[11px] bg-white border border-slate-200/80 rounded-md px-2.5 py-1.5"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-800 truncate flex items-center gap-1.5">
                        <span>{ENTITY_LABELS[item.entityType] || 'Transaksi'}</span>
                        {item.status === 'FAILED' && (
                          <span className="px-1 py-0.2 rounded bg-rose-100 text-rose-800 text-[9px] font-bold">
                            FAILED
                          </span>
                        )}
                      </div>
                      <div className="text-slate-500 truncate">{item.summary}</div>
                      {item.lastError && (
                        <div className="text-rose-600 text-[10px] truncate mt-0.5">{item.lastError}</div>
                      )}
                    </div>
                    <span className="inline-flex items-center gap-1 text-[10px] font-mono text-amber-700 shrink-0 mt-0.5">
                      <Clock className="w-3 h-3" />
                      {new Date(item.createdAt).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                ))}
                {pendingCount > 5 && (
                  <div className="text-[11px] text-center text-slate-500 font-medium pt-0.5">
                    +{pendingCount - 5} transaksi lainnya di antrean
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-medium pt-0.5">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Tidak ada antrean tertunda</span>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            {hasPending && isOnline && !isLocalOnly && (
              <button
                type="button"
                disabled={isSyncing}
                onClick={() => {
                  onSyncNow();
                  setIsOpen(false);
                }}
                className="min-h-[40px] w-full px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Mengirim...' : `Kirim ${pendingCount} Transaksi ke ${adapterLabel}`}</span>
              </button>
            )}

            {onOpenBackendSettings && (
              <button
                type="button"
                onClick={() => {
                  onOpenBackendSettings();
                  setIsOpen(false);
                }}
                className="min-h-[38px] w-full px-3 py-2 rounded-lg border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Server className="w-3.5 h-3.5 text-slate-600" />
                <span>Atur Adapter Server ({adapterLabel})</span>
              </button>
            )}

            <button
              type="button"
              onClick={onToggleOfflineSimulation}
              className="min-h-[38px] w-full px-3 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              {isOnline ? (
                <>
                  <WifiOff className="w-3.5 h-3.5 text-slate-500" />
                  <span>Uji Mode Offline</span>
                </>
              ) : (
                <>
                  <Wifi className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Sambungkan Kembali Online</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
