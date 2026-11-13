import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Cloud,
  Download,
  FileCheck,
  History,
  Lock,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Upload,
  XCircle,
  BookOpen,
  Receipt,
  AlertTriangle,
  HelpCircle,
  HardDrive,
  Server,
  PlugZap,
} from 'lucide-react';
import type {
  ApprovalRequest,
  AuditTrailEntry,
  BusinessEngineState,
  JournalEntry,
  SalesTransactionRecord,
  StockLedgerEntry,
} from '../engine/types';
import {
  exportEngineBackupJson,
  parseAndValidateBackupJson,
  selectOperationalSummary,
  type EngineFallbackDefaults,
} from '../engine/businessEngine';
import { idbGetDiagnostics, type IndexedDbDiagnostics } from '../engine/indexedDbStorage';
import type { BackendAdapterConfig, BackendAdapterType, HealthCheckResult } from '../adapters/backendAdapter';
import { BACKEND_ADAPTER_OPTIONS } from '../adapters/adapterRegistry';

export type SecondaryViewId = 'approval' | 'jurnal' | 'audit' | 'backup' | 'pajak' | 'pengaturan';

interface EnterpriseAccountabilityViewsProps {
  activeView: SecondaryViewId;
  engineState: BusinessEngineState;
  isOnline: boolean;
  backendConfig: BackendAdapterConfig;
  isSyncing?: boolean;
  onBack: () => void;
  onResolveApproval: (uuid: string, decision: 'APPROVED' | 'REJECTED', pin: string) => { ok: boolean; message: string };
  onVoidTransaction: (txUuid: string, reason: string, pin: string) => { ok: boolean; message: string };
  onRestoreState: (nextState: BusinessEngineState, pin: string) => { ok: boolean; message: string };
  restoreFallbackDefaults?: EngineFallbackDefaults;
  onResetSandbox: (pin: string) => { ok: boolean; message: string };
  onUpdateOwnerPin: (currentPin: string, newPin: string) => { ok: boolean; message: string };
  onSyncNow: () => void;
  onUpdateBackendConfig: (config: BackendAdapterConfig) => void;
  onTestBackendConnection: (config: BackendAdapterConfig) => Promise<HealthCheckResult>;
  onNotify: (title: string, desc: string, type?: 'success' | 'warning' | 'info') => void;
}

export const EnterpriseAccountabilityViews: React.FC<EnterpriseAccountabilityViewsProps> = ({
  activeView,
  engineState,
  isOnline,
  backendConfig,
  isSyncing = false,
  onBack,
  onResolveApproval,
  onVoidTransaction,
  onRestoreState,
  restoreFallbackDefaults,
  onResetSandbox,
  onUpdateOwnerPin,
  onSyncNow,
  onUpdateBackendConfig,
  onTestBackendConnection,
  onNotify,
}) => {
  const summary = selectOperationalSummary(engineState);
  const [draftBackendConfig, setDraftBackendConfig] = useState<BackendAdapterConfig>(backendConfig);
  const [healthTestResult, setHealthTestResult] = useState<HealthCheckResult | null>(null);
  const [isTestingHealth, setIsTestingHealth] = useState(false);

  useEffect(() => {
    setDraftBackendConfig(backendConfig);
  }, [backendConfig]);

  // Approval PIN inline state
  const [approvalPins, setApprovalPins] = useState<Record<string, string>>({});
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [idbDiagnostics, setIdbDiagnostics] = useState<IndexedDbDiagnostics | null>(null);

  useEffect(() => {
    if (activeView === 'backup') {
      void idbGetDiagnostics().then(setIdbDiagnostics);
    }
  }, [activeView, engineState.lastUpdatedAt]);

  // Void transaction inline dialog state (PIN protected)
  const [voidTargetTx, setVoidTargetTx] = useState<SalesTransactionRecord | null>(null);
  const [voidReason, setVoidReason] = useState<string>('Salah input pesanan / pelanggan batal');
  const [voidPin, setVoidPin] = useState<string>('');
  const [voidError, setVoidError] = useState<string | null>(null);

  // Restore & Reset Sandbox PIN confirmation state
  const [pendingRestoreCandidate, setPendingRestoreCandidate] = useState<{
    state: BusinessEngineState;
    filename: string;
  } | null>(null);
  const [restoreConfirmPin, setRestoreConfirmPin] = useState<string>('');
  const [restoreConfirmError, setRestoreConfirmError] = useState<string | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState<boolean>(false);
  const [resetPin, setResetPin] = useState<string>('');
  const [resetError, setResetError] = useState<string | null>(null);

  // Change Owner PIN inline form state
  const [showPinEditor, setShowPinEditor] = useState<boolean>(false);
  const [currentPinDraft, setCurrentPinDraft] = useState<string>('');
  const [newPinDraft, setNewPinDraft] = useState<string>('');
  const [confirmNewPinDraft, setConfirmNewPinDraft] = useState<string>('');
  const [pinUpdateFeedback, setPinUpdateFeedback] = useState<{ ok: boolean; text: string } | null>(null);

  // Audit filter tab
  const [auditSubTab, setAuditSubTab] = useState<'TRANSAKSI' | 'STOK' | 'AKTIVITAS'>('TRANSAKSI');

  // Backup file input ref
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const viewMeta: Record<SecondaryViewId, { title: string; subtitle: string }> = {
    approval: {
      title: 'Persetujuan Pemilik',
      subtitle: 'Tinjau permintaan izin kasir & sales lapangan sebelum transaksi berjalan.',
    },
    jurnal: {
      title: 'Catatan Akuntansi Otomatis',
      subtitle: 'Jurnal pemasukan, modal stok, dan biaya yang dibuat otomatis di belakang layar.',
    },
    audit: {
      title: 'Riwayat Stok & Catatan Perubahan',
      subtitle: 'Semua transaksi tersimpan permanen. Pembatalan selalu membuat catatan pembalik yang rapi.',
    },
    backup: {
      title: 'Backup, Pulihkan & Sinkronisasi',
      subtitle: 'Simpan salinan aman data usaha Anda atau pindahkan ke perangkat lain kapan saja.',
    },
    pajak: {
      title: 'Perhitungan Pajak Usaha (0,5%)',
      subtitle: 'Ringkasan estimasi pajak final UMKM berdasarkan omzet usaha yang tercatat.',
    },
    pengaturan: {
      title: 'Pengaturan Toko & Keamanan',
      subtitle: 'Kelola identitas toko, perangkat kasir, dan aturan izin pemilik.',
    },
  };

  const currentMeta = viewMeta[activeView];

  const handleDownloadBackup = () => {
    const { filename, content } = exportEngineBackupJson(engineState);
    const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    onNotify('Cadangan Data Diunduh', `File ${filename} siap disimpan di perangkat atau dikirim via WhatsApp.`, 'success');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRestoreError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      const parsed = parseAndValidateBackupJson(text, restoreFallbackDefaults, { persist: false });
      if (parsed.ok === false) {
        setRestoreError(parsed.error);
        return;
      }
      setRestoreConfirmPin('');
      setRestoreConfirmError(null);
      setPendingRestoreCandidate({ state: parsed.state, filename: file.name });
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-5 animate-tab-fade">
      {/* Top Contextual Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer shrink-0"
            aria-label="Kembali ke layar utama"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-base font-bold text-slate-900">{currentMeta.title}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{currentMeta.subtitle}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 self-end sm:self-auto whitespace-nowrap shrink-0 cursor-pointer"
        >
          Kembali ke Operasional
        </button>
      </div>

      {/* =====================================================================
          1. PERSETUJUAN PEMILIK (APPROVAL WORKFLOW)
         ===================================================================== */}
      {activeView === 'approval' && (
        <div className="space-y-4">
          {approvalError && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center justify-between">
              <span>{approvalError}</span>
              <button type="button" onClick={() => setApprovalError(null)} className="text-rose-700 font-bold">
                Tutup
              </button>
            </div>
          )}

          {engineState.approvals.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-xs text-slate-500">
              Belum ada permintaan persetujuan dari kasir atau sales lapangan.
            </div>
          ) : (
            <div className="space-y-3">
              {engineState.approvals.map((apr: ApprovalRequest) => {
                const isPending = apr.status === 'PENDING';
                const pinVal = approvalPins[apr.uuid] || '';
                return (
                  <div key={apr.uuid} className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <div className="text-sm font-bold text-slate-900">{apr.title}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          Diajukan oleh {apr.requestedBy} · {new Date(apr.createdAt).toLocaleString('id-ID')}
                        </div>
                      </div>
                      <span
                        className={`text-xs font-semibold px-2.5 py-1 rounded-md self-start sm:self-auto whitespace-nowrap ${
                          isPending
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : apr.status === 'APPROVED'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-rose-50 text-rose-800 border border-rose-200'
                        }`}
                      >
                        {isPending ? 'Menunggu Izin' : apr.status === 'APPROVED' ? 'Disetujui' : 'Ditolak'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100">
                      {apr.plainDescription}
                    </p>

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                      <div className="text-xs text-slate-600">
                        Nilai Terkait:{' '}
                        <strong className="font-mono tabular-nums text-slate-900">
                          Rp {apr.amountRupiah.toLocaleString('id-ID')}
                        </strong>
                      </div>

                      {isPending ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="password"
                            inputMode="numeric"
                            maxLength={6}
                            placeholder="Masukkan 6 digit PIN"
                            value={pinVal}
                            onChange={(e) => setApprovalPins((prev) => ({ ...prev, [apr.uuid]: e.target.value }))}
                            className="b2b-input w-40 font-mono text-xs py-1.5"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              const res = onResolveApproval(apr.uuid, 'REJECTED', pinVal);
                              if (!res.ok) setApprovalError(res.message);
                              else {
                                setApprovalError(null);
                                setApprovalPins((prev) => ({ ...prev, [apr.uuid]: '' }));
                              }
                            }}
                            className="px-3 py-2 rounded-lg border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Tolak
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const res = onResolveApproval(apr.uuid, 'APPROVED', pinVal);
                              if (!res.ok) setApprovalError(res.message);
                              else {
                                setApprovalError(null);
                                setApprovalPins((prev) => ({ ...prev, [apr.uuid]: '' }));
                              }
                            }}
                            className="px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1 cursor-pointer"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Setujui
                          </button>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500">
                          Diputuskan oleh {apr.resolvedBy} ·{' '}
                          {apr.resolvedAt ? new Date(apr.resolvedAt).toLocaleTimeString('id-ID') : ''}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          2. JURNAL OTOMATIS (JURNAL TURUNAN)
         ===================================================================== */}
      {activeView === 'jurnal' && (
        <div className="space-y-4">
          <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 flex items-start gap-3 text-xs text-emerald-900">
            <HelpCircle className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
            <div>
              <strong>Tidak perlu input jurnal manual.</strong> Setiap penjualan di kasir, pembelian stok, pemotongan daging, hingga pelunasan tagihan otomatis dicatat seimbang (Debit = Kredit) oleh sistem di belakang layar.
            </div>
          </div>

          <div className="space-y-3">
            {engineState.journals.map((j: JournalEntry) => (
              <div key={j.uuid} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 flex-wrap">
                    <BookOpen className="w-3.5 h-3.5 text-slate-600" />
                    <span className="font-bold text-slate-900">{j.description}</span>
                    <span className="text-slate-400">·</span>
                    <span className="font-mono text-slate-600">{j.referenceNo}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-500 whitespace-nowrap">
                    <span>{new Date(j.timestamp).toLocaleString('id-ID')}</span>
                    <span className="text-emerald-700 font-semibold">
                      {j.isBalanced ? 'Seimbang' : 'Perlu Cek'}
                    </span>
                  </div>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-500 text-[11px]">
                      <th className="text-left px-4 py-2 font-semibold">Pos Akun</th>
                      <th className="text-right px-4 py-2 font-semibold">Masuk (Debit)</th>
                      <th className="text-right px-4 py-2 font-semibold">Keluar (Kredit)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {j.lines.map((line, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-2 text-slate-800">
                          <span className="font-mono text-slate-400 mr-2">{line.accountCode}</span>
                          {line.accountName}
                        </td>
                        <td className="px-4 py-2 text-right font-mono tabular-nums text-slate-900">
                          {line.debit > 0 ? `Rp ${line.debit.toLocaleString('id-ID')}` : '-'}
                        </td>
                        <td className="px-4 py-2 text-right font-mono tabular-nums text-slate-900">
                          {line.credit > 0 ? `Rp ${line.credit.toLocaleString('id-ID')}` : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =====================================================================
          3. RIWAYAT STOK, PEMBATALAN TRANSAKSI & AUDIT TRAIL
         ===================================================================== */}
      {activeView === 'audit' && (
        <div className="space-y-4">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg self-start w-fit text-xs font-semibold">
            {[
              { id: 'TRANSAKSI', label: `Daftar Penjualan (${engineState.transactions.length})` },
              { id: 'STOK', label: `Buku Keluar Masuk Stok (${engineState.stockLedger.length})` },
              { id: 'AKTIVITAS', label: `Jejak Aktivitas (${engineState.auditTrail.length})` },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setAuditSubTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  auditSubTab === tab.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Subtab: Sales Transactions with Safe Void (No Silent Modification) */}
          {auditSubTab === 'TRANSAKSI' && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              {engineState.transactions.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500">
                  Belum ada transaksi baru di sesi ini. Lakukan transaksi di tab Kasir untuk melihat riwayat faktur dan fitur pembatalan aman.
                </div>
              ) : (
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Nomor Faktur</th>
                      <th className="px-4 py-3 font-semibold">Pelanggan &amp; Cara Bayar</th>
                      <th className="px-4 py-3 text-right font-semibold">Berat</th>
                      <th className="px-4 py-3 text-right font-semibold">Total Tagihan</th>
                      <th className="px-4 py-3 text-center font-semibold">Status</th>
                      <th className="px-4 py-3 text-right font-semibold">Tindakan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {engineState.transactions.map((tx) => (
                      <tr key={tx.uuid} className="hover:bg-slate-50/70">
                        <td className="px-4 py-3">
                          <div className="font-mono font-bold text-slate-900">{tx.invoiceNumber}</div>
                          <div className="text-[11px] text-slate-500">{new Date(tx.timestamp).toLocaleString('id-ID')}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">{tx.customerName}</div>
                          <div className="text-[11px] text-slate-500">
                            {tx.paymentMethod === 'CASH' ? 'Tunai' : tx.paymentMethod === 'TRANSFER' ? 'Transfer Bank' : `Tempo ${tx.tempoDays} Hari`}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-700">
                          {(tx.totalWeightGram / 1000).toFixed(2)} kg
                        </td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums font-bold text-slate-900">
                          Rp {tx.grandTotalRupiah.toLocaleString('id-ID')}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`text-xs font-semibold ${
                              tx.status === 'VOIDED' ? 'text-rose-700' : 'text-emerald-700'
                            }`}
                          >
                            {tx.status === 'VOIDED' ? 'Dibatalkan' : 'Selesai'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {tx.status === 'COMPLETED' ? (
                            <button
                              type="button"
                              onClick={() => setVoidTargetTx(tx)}
                              className="px-2.5 py-1 rounded-md border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <RotateCcw className="w-3 h-3" />
                              Batalkan
                            </button>
                          ) : (
                            <span className="text-[11px] text-slate-400">{tx.voidReason}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Subtab: Immutable Stock & Value Ledger */}
          {auditSubTab === 'STOK' && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Waktu &amp; Jenis</th>
                    <th className="px-4 py-3 font-semibold">Produk &amp; Batch</th>
                    <th className="px-4 py-3 text-right font-semibold">Perubahan Berat</th>
                    <th className="px-4 py-3 text-right font-semibold">Harga Modal Rata-rata</th>
                    <th className="px-4 py-3 font-semibold">Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {engineState.stockLedger.slice(0, 40).map((entry: StockLedgerEntry) => (
                    <tr key={entry.uuid} className="hover:bg-slate-50/70">
                      <td className="px-4 py-2.5">
                        <div className="font-semibold text-slate-900">{entry.humanLabel}</div>
                        <div className="text-[11px] text-slate-500">
                          {new Date(entry.timestamp).toLocaleTimeString('id-ID')} · {entry.referenceNo}
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-slate-800">{entry.productName}</div>
                        <div className="font-mono text-[11px] text-slate-500">{entry.lotCode}</div>
                      </td>
                      <td
                        className={`px-4 py-2.5 text-right font-mono tabular-nums font-bold ${
                          entry.weightGramDelta >= 0 ? 'text-emerald-700' : 'text-rose-700'
                        }`}
                      >
                        {entry.weightGramDelta >= 0 ? '+' : ''}
                        {(entry.weightGramDelta / 1000).toFixed(2)} kg
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono tabular-nums text-slate-700">
                        Rp {entry.movingAvgHppAfterKg.toLocaleString('id-ID')}/kg
                      </td>
                      <td className="px-4 py-2.5 text-slate-600 max-w-xs truncate" title={entry.note}>
                        {entry.note}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Subtab: Audit Trail */}
          {auditSubTab === 'AKTIVITAS' && (
            <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
              {engineState.auditTrail.slice(0, 40).map((log: AuditTrailEntry) => (
                <div key={log.uuid} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="space-y-0.5">
                    <div className="font-semibold text-slate-900">{log.humanSummary}</div>
                    <div className="text-[11px] text-slate-500">
                      Oleh {log.actorName} · Ref: <span className="font-mono">{log.referenceId}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[11px] text-slate-500">{new Date(log.timestamp).toLocaleString('id-ID')}</div>
                    <div className="font-mono text-[10px] text-slate-400">Kode Verifikasi: {log.integrityHash}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          4. BACKUP, PULIHKAN & ADAPTER SINKRONISASI LOCAL-FIRST
         ===================================================================== */}
      {activeView === 'backup' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-2.5">
                <Download className="w-5 h-5 text-slate-800" />
                <h3 className="text-sm font-bold text-slate-900">Simpan &amp; Pulihkan File Cadangan</h3>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">
                Seluruh data stok, pelanggan, tagihan, dan catatan kasir tersimpan otomatis di memori perangkat (IndexedDB &amp; PWA Offline) meskipun tanpa internet atau server.
              </p>
              {idbDiagnostics && (
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <HardDrive className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-800">
                        {idbDiagnostics.supported
                          ? 'Penyimpanan Offline Aktif (IndexedDB)'
                          : 'Penyimpanan Cadangan Browser Aktif'}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {idbDiagnostics.hasPersistedState
                          ? `Ukuran tersimpan ~${Math.max(1, Math.round(idbDiagnostics.approxBytes / 1024))} KB`
                          : 'Menunggu pencatatan transaksi pertama'}
                      </div>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold text-[11px] shrink-0">
                    Tersimpan ✓
                  </span>
                </div>
              )}
              {restoreError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">{restoreError}</div>
              )}
              <div className="flex flex-wrap gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={handleDownloadBackup}
                  className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Unduh Cadangan (.json)
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5" />
                  Pulihkan dari File
                </button>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="flex items-center gap-2.5">
                <Cloud className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">Antrean Outbox Perangkat</h3>
              </div>
              <div className="grid grid-cols-3 gap-2.5 text-xs">
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-slate-500">Koneksi</div>
                  <div className="font-bold text-slate-900 mt-1">{isOnline ? 'Online' : 'Offline'}</div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-slate-500">PENDING / Gagal</div>
                  <div className="font-bold font-mono tabular-nums text-amber-700 mt-1">
                    {summary.pendingSyncCount} ({summary.failedSyncCount} gagal)
                  </div>
                </div>
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <div className="text-slate-500">SYNCED (ACK)</div>
                  <div className="font-bold font-mono tabular-nums text-emerald-700 mt-1">
                    {summary.syncedCount} catatan
                  </div>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Status <span className="font-mono font-semibold text-slate-700">SYNCED</span> hanya diberikan setelah server tujuan menerima dan mengonfirmasi (ACK). Dalam Mode Lokal Mandiri, transaksi tetap berstatus <span className="font-mono font-semibold text-slate-700">PENDING</span> secara jujur.
              </p>
              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  disabled={!isOnline || summary.pendingSyncCount === 0 || isSyncing || backendConfig.adapterType === 'LOCAL_ONLY'}
                  onClick={onSyncNow}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  {backendConfig.adapterType === 'LOCAL_ONLY'
                    ? 'Mode Lokal Mandiri (Tanpa Kirim)'
                    : isSyncing
                    ? 'Mengirim Outbox...'
                    : 'Kirim Outbox ke Adapter'}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setResetPin('');
                    setResetError(null);
                    setShowResetConfirm(true);
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-600 text-xs font-semibold cursor-pointer"
                >
                  Kembalikan Data Awal Contoh
                </button>
              </div>
            </div>
          </div>

          {/* Swappable Backend Adapter Configurator */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <Server className="w-5 h-5 text-slate-800" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Adapter Server &amp; Database Tujuan (Opsional)</h3>
                  <p className="text-xs text-slate-500">
                    Ganti server tujuan kapan saja tanpa mengubah aturan kasir, stok FEFO, maupun laporan akuntansi.
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-[11px] font-bold text-slate-700 self-start sm:self-auto">
                Aktif: {BACKEND_ADAPTER_OPTIONS.find((o) => o.type === backendConfig.adapterType)?.shortLabel || 'Lokal Mandiri'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {BACKEND_ADAPTER_OPTIONS.map((opt) => {
                const isSelected = draftBackendConfig.adapterType === opt.type;
                return (
                  <button
                    key={opt.type}
                    type="button"
                    onClick={() => {
                      setDraftBackendConfig((prev) => ({ ...prev, adapterType: opt.type as BackendAdapterType }));
                      setHealthTestResult(null);
                    }}
                    className={`text-left p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50/50 ring-1 ring-emerald-600'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-900">{opt.label}</span>
                      {!opt.requiresNetwork && (
                        <span className="px-1.5 py-0.5 rounded bg-slate-900 text-white text-[10px] font-bold">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">{opt.description}</p>
                  </button>
                );
              })}
            </div>

            {draftBackendConfig.adapterType !== 'LOCAL_ONLY' && (
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">ID Toko / Cabang</label>
                  <input
                    type="text"
                    value={draftBackendConfig.storeId}
                    onChange={(e) => setDraftBackendConfig((prev) => ({ ...prev, storeId: e.target.value }))}
                    placeholder="TOKO_KARKASIA_01"
                    className="b2b-input w-full"
                  />
                </div>

                {(draftBackendConfig.adapterType === 'REST_API' ||
                  draftBackendConfig.adapterType === 'ZIMAOS' ||
                  draftBackendConfig.adapterType === 'POSTGRES_BRIDGE') && (
                  <>
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">URL Endpoint Server</label>
                      <input
                        type="url"
                        value={draftBackendConfig.endpointUrl || ''}
                        onChange={(e) => setDraftBackendConfig((prev) => ({ ...prev, endpointUrl: e.target.value }))}
                        placeholder={
                          draftBackendConfig.adapterType === 'ZIMAOS'
                            ? 'http://192.168.1.50:8080/api'
                            : 'https://api.tokosaya.id/erp'
                        }
                        className="b2b-input w-full"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="font-semibold text-slate-700 block mb-1">Bearer Token / API Key (Opsional)</label>
                      <input
                        type="password"
                        value={draftBackendConfig.apiKeyOrToken || ''}
                        onChange={(e) => setDraftBackendConfig((prev) => ({ ...prev, apiKeyOrToken: e.target.value }))}
                        placeholder="Opsional untuk server privat"
                        className="b2b-input w-full"
                      />
                    </div>
                  </>
                )}

                {draftBackendConfig.adapterType === 'SUPABASE' && (
                  <>
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Supabase Project URL</label>
                      <input
                        type="url"
                        value={draftBackendConfig.supabaseUrl || ''}
                        onChange={(e) => setDraftBackendConfig((prev) => ({ ...prev, supabaseUrl: e.target.value }))}
                        placeholder="https://xyzcompany.supabase.co"
                        className="b2b-input w-full"
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="font-semibold text-slate-700 block mb-1">Supabase Anon Key</label>
                      <input
                        type="password"
                        value={draftBackendConfig.supabaseAnonKey || ''}
                        onChange={(e) => setDraftBackendConfig((prev) => ({ ...prev, supabaseAnonKey: e.target.value }))}
                        placeholder="eyJhbGciOi..."
                        className="b2b-input w-full"
                      />
                    </div>
                  </>
                )}

                {draftBackendConfig.adapterType === 'GOOGLE_SHEETS' && (
                  <>
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">
                        Apps Script Web App URL (Direkomendasikan)
                      </label>
                      <input
                        type="url"
                        value={draftBackendConfig.endpointUrl || ''}
                        onChange={(e) => setDraftBackendConfig((prev) => ({ ...prev, endpointUrl: e.target.value }))}
                        placeholder="https://script.google.com/macros/s/.../exec"
                        className="b2b-input w-full"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">
                        Atau Google Spreadsheet ID (API v4)
                      </label>
                      <input
                        type="text"
                        value={draftBackendConfig.googleSheetId || ''}
                        onChange={(e) => setDraftBackendConfig((prev) => ({ ...prev, googleSheetId: e.target.value }))}
                        placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
                        className="b2b-input w-full"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">Nama Sheet &amp; Range</label>
                      <input
                        type="text"
                        value={draftBackendConfig.googleSheetRange || 'OutboxSync!A:H'}
                        onChange={(e) => setDraftBackendConfig((prev) => ({ ...prev, googleSheetRange: e.target.value }))}
                        placeholder="OutboxSync!A:H"
                        className="b2b-input w-full"
                      />
                    </div>
                    <div>
                      <label className="font-semibold text-slate-700 block mb-1">OAuth Token (Jika pakai API v4)</label>
                      <input
                        type="password"
                        value={draftBackendConfig.apiKeyOrToken || ''}
                        onChange={(e) => setDraftBackendConfig((prev) => ({ ...prev, apiKeyOrToken: e.target.value }))}
                        placeholder="Bearer token opsional"
                        className="b2b-input w-full"
                      />
                    </div>
                  </>
                )}
              </div>
            )}

            {healthTestResult && (
              <div
                className={`p-3 rounded-lg border text-xs flex items-center gap-2 ${
                  healthTestResult.ok
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                {healthTestResult.ok ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{healthTestResult.message}</span>
              </div>
            )}

            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => {
                  onUpdateBackendConfig(draftBackendConfig);
                  setHealthTestResult(null);
                }}
                className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
              >
                Simpan Konfigurasi Adapter
              </button>

              <button
                type="button"
                disabled={isTestingHealth}
                onClick={async () => {
                  setIsTestingHealth(true);
                  try {
                    const res = await onTestBackendConnection(draftBackendConfig);
                    setHealthTestResult(res);
                  } finally {
                    setIsTestingHealth(false);
                  }
                }}
                className="px-4 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <PlugZap className={`w-3.5 h-3.5 text-emerald-600 ${isTestingHealth ? 'animate-pulse' : ''}`} />
                {isTestingHealth ? 'Menguji Koneksi...' : 'Tes Koneksi Adapter'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          5. PAJAK USAHA (0.5%)
         ===================================================================== */}
      {activeView === 'pajak' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
            <Receipt className="w-4 h-4 text-emerald-600" />
            Estimasi Pajak Final UMKM (0,5% dari Omzet)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-xs text-slate-500">Total Penjualan (7 Hari)</span>
              <div className="text-base font-bold font-mono tabular-nums text-slate-900 mt-1">
                Rp {summary.weeklyRevenue.toLocaleString('id-ID')}
              </div>
            </div>
            <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-xs text-slate-500">Tarif Pajak UMKM</span>
              <div className="text-base font-bold font-mono tabular-nums text-emerald-700 mt-1">0,5%</div>
            </div>
            <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200">
              <span className="text-xs text-slate-500">Estimasi Pajak Disiapkan</span>
              <div className="text-base font-bold font-mono tabular-nums text-rose-700 mt-1">
                Rp {summary.estimatedUmkmTax.toLocaleString('id-ID')}
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-600">
            Angka di atas dihitung otomatis dari seluruh penjualan yang tercatat selesai dan tidak termasuk faktur yang dibatalkan.
          </p>
        </div>
      )}

      {/* =====================================================================
          6. PENGATURAN TOKO & STAF
         ===================================================================== */}
      {activeView === 'pengaturan' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 text-xs">
          <div className="p-3.5 rounded-lg border border-slate-200 flex justify-between items-center">
            <div>
              <div className="font-bold text-slate-900">Nama Usaha Aktif</div>
              <div className="text-slate-500 mt-0.5">{engineState.storeName}</div>
            </div>
            <span className="text-emerald-700 font-semibold flex items-center gap-1">
              <ShieldCheck className="w-4 h-4" />
              Aktif
            </span>
          </div>
          <div className="p-3.5 rounded-lg border border-slate-200 flex justify-between items-center">
            <div>
              <div className="font-bold text-slate-900">Mode Arsitektur Penyimpanan</div>
              <div className="text-slate-500 mt-0.5">
                Local-First (IndexedDB) · Adapter aktif:{' '}
                <span className="font-semibold text-slate-700">
                  {BACKEND_ADAPTER_OPTIONS.find((o) => o.type === backendConfig.adapterType)?.label ||
                    'Mode Lokal Mandiri'}
                </span>
              </div>
            </div>
            <span className="font-semibold text-emerald-700">Independen</span>
          </div>
          <div className="p-3.5 rounded-lg border border-slate-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="font-bold text-slate-900">PIN Persetujuan Pemilik</div>
                <div className="text-slate-500 mt-0.5">
                  Digunakan untuk menyetujui tempo melebihi batas, pembatalan transaksi, pemulihan cadangan, dan reset data
                </div>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                <span className="font-mono font-bold text-slate-900 inline-flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                  •••••• (Terlindungi)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setShowPinEditor((prev) => !prev);
                    setPinUpdateFeedback(null);
                  }}
                  className="px-2.5 py-1 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer"
                >
                  {showPinEditor ? 'Tutup' : 'Ubah PIN'}
                </button>
              </div>
            </div>

            {engineState.ownerPinNeedsChange === true && (
              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-medium">
                PIN bawaan masih aktif. Segera ganti dengan PIN pribadi pemilik melalui tombol <strong>Ubah PIN</strong> sebelum pemakaian operasional toko.
              </div>
            )}

            {showPinEditor && (
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={currentPinDraft}
                    onChange={(e) => setCurrentPinDraft(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="PIN Saat Ini (6 digit)"
                    className="b2b-input w-full font-mono"
                  />
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={newPinDraft}
                    onChange={(e) => setNewPinDraft(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="PIN Baru (6 digit)"
                    className="b2b-input w-full font-mono"
                  />
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={confirmNewPinDraft}
                    onChange={(e) => setConfirmNewPinDraft(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="Ulangi PIN Baru"
                    className="b2b-input w-full font-mono"
                  />
                </div>
                {pinUpdateFeedback && (
                  <div
                    className={`p-2 rounded text-[11px] font-medium ${
                      pinUpdateFeedback.ok
                        ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                        : 'bg-rose-50 border border-rose-200 text-rose-800'
                    }`}
                  >
                    {pinUpdateFeedback.text}
                  </div>
                )}
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      if (newPinDraft !== confirmNewPinDraft) {
                        setPinUpdateFeedback({ ok: false, text: 'Konfirmasi PIN baru tidak cocok.' });
                        return;
                      }
                      const res = onUpdateOwnerPin(currentPinDraft, newPinDraft);
                      setPinUpdateFeedback({ ok: res.ok, text: res.message });
                      if (res.ok) {
                        setCurrentPinDraft('');
                        setNewPinDraft('');
                        setConfirmNewPinDraft('');
                      }
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-semibold cursor-pointer"
                  >
                    Simpan PIN Baru
                  </button>
                </div>
              </div>
            )}
          </div>
          <div className="p-3.5 rounded-lg border border-slate-200 flex justify-between items-center">
            <div>
              <div className="font-bold text-slate-900">Metode Hitung Harga Modal</div>
              <div className="text-slate-500 mt-0.5">Rata-rata bergerak otomatis setiap ada barang masuk baru</div>
            </div>
            <span className="font-semibold text-slate-700">Otomatis</span>
          </div>
        </div>
      )}

      {/* =====================================================================
          INLINE CONFIRMATION DIALOG: BATALKAN TRANSAKSI (VOID + PIN PEMILIK)
         ===================================================================== */}
      {voidTargetTx && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-slate-900">Batalkan Transaksi {voidTargetTx.invoiceNumber}?</h4>
                <p className="text-xs text-slate-600 mt-1">
                  Catatan asli tidak akan dihapus. Sistem akan membuat catatan pembalik resmi untuk mengembalikan stok daging (
                  {(voidTargetTx.totalWeightGram / 1000).toFixed(2)} kg) dan saldo pelanggan secara otomatis.
                </p>
              </div>
            </div>

            <div className="space-y-1.5 text-xs">
              <label className="font-semibold text-slate-700 block">Alasan Pembatalan</label>
              <input
                type="text"
                value={voidReason}
                onChange={(e) => setVoidReason(e.target.value)}
                className="b2b-input w-full"
                placeholder="Contoh: Salah input berat / pelanggan batal"
              />
            </div>

            <div className="space-y-1.5 text-xs">
              <label className="font-semibold text-slate-700 block">PIN Pemilik (Wajib untuk Pembatalan)</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={voidPin}
                onChange={(e) => {
                  setVoidPin(e.target.value.replace(/\D/g, '').slice(0, 6));
                  if (voidError) setVoidError(null);
                }}
                className="b2b-input w-full font-mono"
                placeholder="Masukkan 6 digit PIN pemilik"
              />
              {voidError && (
                <p className="text-[11px] font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded p-2">
                  {voidError}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setVoidTargetTx(null);
                  setVoidPin('');
                  setVoidError(null);
                }}
                className="px-3.5 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Kembali
              </button>
              <button
                type="button"
                onClick={() => {
                  const cleanReason = voidReason.trim();
                  if (!cleanReason) {
                    setVoidError('Alasan pembatalan wajib diisi.');
                    return;
                  }
                  const res = onVoidTransaction(voidTargetTx.uuid, cleanReason, voidPin);
                  if (!res.ok) {
                    setVoidError(res.message);
                    return;
                  }
                  setVoidTargetTx(null);
                  setVoidPin('');
                  setVoidError(null);
                }}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer"
              >
                Ya, Batalkan Resmi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          KONFIRMASI + PIN PEMILIK: PULIHKAN DARI FILE CADANGAN
         ===================================================================== */}
      {pendingRestoreCandidate && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-start gap-3">
              <Upload className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-slate-900">Pulihkan Data dari File Cadangan?</h4>
                <p className="text-xs text-slate-600 mt-1">
                  File <strong>{pendingRestoreCandidate.filename}</strong> ({pendingRestoreCandidate.state.products.length} produk,{' '}
                  {pendingRestoreCandidate.state.transactions.length} transaksi) akan menggantikan data aktif saat ini.
                </p>
              </div>
            </div>

            <div className="space-y-1.5 text-xs">
              <label className="font-semibold text-slate-700 block">PIN Pemilik</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={restoreConfirmPin}
                onChange={(e) => {
                  setRestoreConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6));
                  if (restoreConfirmError) setRestoreConfirmError(null);
                }}
                className="b2b-input w-full font-mono"
                placeholder="Masukkan 6 digit PIN pemilik"
              />
              {restoreConfirmError && (
                <p className="text-[11px] font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded p-2">
                  {restoreConfirmError}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setPendingRestoreCandidate(null);
                  setRestoreConfirmPin('');
                  setRestoreConfirmError(null);
                }}
                className="px-3.5 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  const res = onRestoreState(pendingRestoreCandidate.state, restoreConfirmPin);
                  if (!res.ok) {
                    setRestoreConfirmError(res.message);
                    return;
                  }
                  setPendingRestoreCandidate(null);
                  setRestoreConfirmPin('');
                  setRestoreConfirmError(null);
                }}
                className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
              >
                Konfirmasi &amp; Pulihkan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          KONFIRMASI + PIN PEMILIK: RESET KE DATA AWAL CONTOH
         ===================================================================== */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-slate-900">Kembalikan ke Data Awal Contoh?</h4>
                <p className="text-xs text-slate-600 mt-1">
                  Tindakan ini akan menghapus seluruh transaksi, perubahan stok, pelanggan, dan catatan yang belum dicadangkan. Unduh cadangan (.json) terlebih dahulu sebelum melanjutkan.
                </p>
              </div>
            </div>

            <div className="space-y-1.5 text-xs">
              <label className="font-semibold text-slate-700 block">PIN Pemilik</label>
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={resetPin}
                onChange={(e) => {
                  setResetPin(e.target.value.replace(/\D/g, '').slice(0, 6));
                  if (resetError) setResetError(null);
                }}
                className="b2b-input w-full font-mono"
                placeholder="Masukkan 6 digit PIN pemilik"
              />
              {resetError && (
                <p className="text-[11px] font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded p-2">
                  {resetError}
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setShowResetConfirm(false);
                  setResetPin('');
                  setResetError(null);
                }}
                className="px-3.5 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  const res = onResetSandbox(resetPin);
                  if (!res.ok) {
                    setResetError(res.message);
                    return;
                  }
                  setShowResetConfirm(false);
                  setResetPin('');
                  setResetError(null);
                }}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold cursor-pointer"
              >
                Ya, Reset Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
