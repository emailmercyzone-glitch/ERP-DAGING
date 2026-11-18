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
  auditIntegerLedgerIntegrity,
  parseAndValidateBackupJson,
  assessBackupRestoreSafety,
  type EngineBackupMetadata,
  computeIntegrityHash,
  selectOperationalSummary,
  type EngineFallbackDefaults,
} from '../engine/businessEngine';
import { idbGetDiagnostics, idbGetAllMediaBlobs, idbGetLatestRestoreSafetySnapshotInfo, idbGetRestoreSafetySnapshot, idbGetPreference, idbSetPreference, idbRequestPersistentStorage, type IndexedDbDiagnostics, type RestoreSafetySnapshotInfo } from '../engine/indexedDbStorage';
import type { BackendAdapterConfig, BackendAdapterType, HealthCheckResult } from '../adapters/backendAdapter';
import { BACKEND_ADAPTER_OPTIONS, backendSwitchRequiresMigration } from '../adapters/adapterRegistry';
import { downloadGoogleDriveBackup, listGoogleDriveBackups, uploadGoogleDriveBackup, type GoogleDriveBackupListItem } from '../adapters/googleDriveBackup';
import { erpAuthClient } from '../auth/erpAuthClient';

export type SecondaryViewId = 'approval' | 'jurnal' | 'audit' | 'backup' | 'pajak' | 'pengaturan';

interface EnterpriseAccountabilityViewsProps {
  activeView: SecondaryViewId;
  isOwner?: boolean;
  engineState: BusinessEngineState;
  isOnline: boolean;
  backendConfig: BackendAdapterConfig;
  isSyncing?: boolean;
  onBack: () => void;
  onResolveApproval: (uuid: string, decision: 'APPROVED' | 'REJECTED', pin: string) => { ok: boolean; message: string } | Promise<{ ok: boolean; message: string }>;
  onVoidTransaction: (txUuid: string, reason: string, pin: string) => { ok: boolean; message: string } | Promise<{ ok: boolean; message: string }>;
  onRestoreState: (nextState: BusinessEngineState, pin: string, metadata: EngineBackupMetadata, attachments: Array<{ mediaId: string; blob: Blob }>, importAttachments: boolean) => Promise<{ ok: boolean; message: string }>;
  onRestoreSafetySnapshot: (snapshotId: string, snapshotState: BusinessEngineState, snapshotCreatedAt: string, pin: string) => Promise<{ ok: boolean; message: string }>;
  restoreFallbackDefaults?: EngineFallbackDefaults;
  onResetSandbox: (pin: string) => { ok: boolean; message: string } | Promise<{ ok: boolean; message: string }>;
  onUpdateOwnerPin: (currentPin: string, newPin: string) => { ok: boolean; message: string } | Promise<{ ok: boolean; message: string }>;
  onSyncNow: () => void;
  onUpdateBackendConfig: (config: BackendAdapterConfig) => void;
  onTestBackendConnection: (config: BackendAdapterConfig) => Promise<HealthCheckResult>;
  onNotify: (title: string, desc: string, type?: 'success' | 'warning' | 'info') => void;
}

export const EnterpriseAccountabilityViews: React.FC<EnterpriseAccountabilityViewsProps> = ({
  activeView,
  isOwner = false,
  engineState,
  isOnline,
  backendConfig,
  isSyncing = false,
  onBack,
  onResolveApproval,
  onVoidTransaction,
  onRestoreState,
  onRestoreSafetySnapshot,
  restoreFallbackDefaults,
  onResetSandbox,
  onUpdateOwnerPin,
  onSyncNow,
  onUpdateBackendConfig,
  onTestBackendConnection,
  onNotify,
}) => {
  const summary = selectOperationalSummary(engineState);
  const integerAudit = auditIntegerLedgerIntegrity(engineState);
  const [draftBackendConfig, setDraftBackendConfig] = useState<BackendAdapterConfig>(backendConfig);
  const backendMigrationRequired = backendSwitchRequiresMigration(backendConfig, draftBackendConfig, engineState);
  const [healthTestResult, setHealthTestResult] = useState<HealthCheckResult | null>(null);
  const [isTestingHealth, setIsTestingHealth] = useState(false);

  useEffect(() => {
    setDraftBackendConfig(backendConfig);
  }, [backendConfig]);

  // Approval PIN inline state
  const [approvalPins, setApprovalPins] = useState<Record<string, string>>({});
  const [approvalError, setApprovalError] = useState<string | null>(null);
  const [idbDiagnostics, setIdbDiagnostics] = useState<IndexedDbDiagnostics | null>(null);
  const [lastBackupCreatedAt, setLastBackupCreatedAt] = useState<string | null>(null);
  const [latestSafetySnapshot, setLatestSafetySnapshot] = useState<RestoreSafetySnapshotInfo | null>(null);
  const [safetySnapshotLoading, setSafetySnapshotLoading] = useState(false);
  const [safetySnapshotPin, setSafetySnapshotPin] = useState('');
  const [safetySnapshotError, setSafetySnapshotError] = useState<string | null>(null);
  const [showSafetySnapshotConfirm, setShowSafetySnapshotConfirm] = useState(false);

  useEffect(() => {
    if (activeView === 'backup') {
      void (async () => {
        await idbRequestPersistentStorage();
        const [diagnostics, snapshot, lastBackup] = await Promise.all([
          idbGetDiagnostics(),
          idbGetLatestRestoreSafetySnapshotInfo(),
          idbGetPreference<string>('lastBackupCreatedAt'),
        ]);
        setIdbDiagnostics(diagnostics);
        setLatestSafetySnapshot(snapshot);
        setLastBackupCreatedAt(lastBackup);
      })();
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
    attachments: Array<{ mediaId: string; mimeType: string; dataBase64: string }>;
    includesAttachments: boolean;
    metadata: EngineBackupMetadata;
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
  const [driveBackupError, setDriveBackupError] = useState<string | null>(null);
  const [driveBackups, setDriveBackups] = useState<GoogleDriveBackupListItem[]>([]);
  const [selectedDriveBackupId, setSelectedDriveBackupId] = useState('');
  const [isListingDriveBackups, setIsListingDriveBackups] = useState(false);
  const [isUploadingDriveBackup, setIsUploadingDriveBackup] = useState(false);

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

  const handleDownloadBackup = async () => {
    let url: string | null = null;
    try {
      const { filename, content } = exportEngineBackupJson(engineState);
      const mediaItems = await idbGetAllMediaBlobs();
      const attachments = await Promise.all(mediaItems.map(async ({ mediaId, blob }) => {
        if (!mediaId || !(blob instanceof Blob) || blob.size <= 0 ||
            blob.type !== 'image/jpeg' || blob.size > 1024 * 1024) {
          throw new Error(`Lampiran ${mediaId || '(tanpa ID)'} bukan JPEG valid atau melebihi 1 MB. Backup dibatalkan agar file bisa dipulihkan utuh.`);
        }
        const bytes = new Uint8Array(await blob.arrayBuffer());
        let binary = '';
        const chunkSize = 0x8000;
        for (let offset = 0; offset < bytes.length; offset += chunkSize) {
          binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
        }
        return { mediaId, mimeType: blob.type || 'application/octet-stream', dataBase64: btoa(binary) };
      }));
      const backupEnvelope = { ...JSON.parse(content), attachments, attachmentsChecksum: computeIntegrityHash(JSON.stringify(attachments)) };
      const packageContent = JSON.stringify(backupEnvelope, null, 2);
      const blob = new Blob([packageContent], { type: 'application/json;charset=utf-8' });
      url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename.replace(/\.json$/i, '_LAMPIRAN.json');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      const createdAt = new Date().toISOString();
      const preferenceSaved = await idbSetPreference('lastBackupCreatedAt', createdAt);
      setLastBackupCreatedAt(createdAt);
      onNotify('Cadangan Data Disiapkan', `File backup berisi data usaha dan ${attachments.length} lampiran sudah dibuat${preferenceSaved ? ' dan waktu pembuatannya dicatat' : ''}. Pastikan file hasil unduhan tersimpan.`, preferenceSaved ? 'success' : 'warning');
    } catch (error) {
      console.error('ERP DAGING backup export failed:', error);
      const message = error instanceof Error ? error.message : 'Gagal membuat file cadangan.';
      setRestoreError(message);
      onNotify('Backup Gagal', message, 'warning');
    } finally {
      if (url) URL.revokeObjectURL(url);
    }
  };

  const handleGoogleDriveBackup = async () => {
    setDriveBackupError(null);
    setIsUploadingDriveBackup(true);
    try {
      const sessionToken = erpAuthClient.getAccessToken();
      if (!sessionToken) throw new Error('Session ERP Owner sudah tidak aktif. Login ulang sebelum backup.');
      const { content } = exportEngineBackupJson(engineState);
      const mediaItems = await idbGetAllMediaBlobs();
      const result = await uploadGoogleDriveBackup({
        sessionToken,
        backupContent: content,
        originDeviceId: engineState.deviceId,
        storeName: engineState.storeName,
        mediaItems: mediaItems.map((item) => ({ mediaId: item.mediaId, blob: item.blob })),
      });
      const preferenceSaved = await idbSetPreference('lastBackupCreatedAt', result.uploadedAt);
      setLastBackupCreatedAt(result.uploadedAt);
      onNotify(
        'Backup Off-device Berhasil',
        `${result.backupFileName} tersimpan di folder ERP DAGING BACKUP dengan ${result.attachmentCount} lampiran terpisah.${preferenceSaved ? '' : ' Waktu backup lokal tidak berhasil dicatat.'}`,
        preferenceSaved ? 'success' : 'warning',
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal mengunggah backup ke Google Drive.';
      setDriveBackupError(message);
      onNotify('Backup Drive Gagal', message, 'warning');
    } finally {
      setIsUploadingDriveBackup(false);
    }
  };

  const handleGoogleDriveList = async () => {
    setDriveBackupError(null);
    setIsListingDriveBackups(true);
    try {
      const sessionToken = erpAuthClient.getAccessToken();
      if (!sessionToken) throw new Error('Session ERP Owner sudah tidak aktif. Login ulang untuk membaca backup.');
      const backups = await listGoogleDriveBackups({ sessionToken, deviceId: engineState.deviceId });
      setDriveBackups(backups);
      setSelectedDriveBackupId(backups[0]?.id ?? '');
      onNotify('Daftar Backup Drive Diperbarui', `${backups.length} snapshot ERP DAGING ditemukan.`, 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal membaca daftar backup Google Drive.';
      setDriveBackupError(message);
      onNotify('Gagal Membaca Backup Drive', message, 'warning');
    } finally {
      setIsListingDriveBackups(false);
    }
  };

  const handleGoogleDriveRestore = async () => {
    setDriveBackupError(null);
    const selected = driveBackups.find((item) => item.id === selectedDriveBackupId);
    if (!selected) {
      const message = 'Pilih satu snapshot backup Drive terlebih dahulu.';
      setDriveBackupError(message);
      onNotify('Restore Drive Dibatalkan', message, 'warning');
      return;
    }
    try {
      const sessionToken = erpAuthClient.getAccessToken();
      if (!sessionToken) throw new Error('Session ERP Owner sudah tidak aktif. Login ulang untuk restore backup.');
      const downloaded = await downloadGoogleDriveBackup({
        sessionToken,
        deviceId: engineState.deviceId,
        backupFileId: selected.id,
        backupFileName: selected.name,
      });
      const parsed = parseAndValidateBackupJson(JSON.stringify(downloaded.envelope), restoreFallbackDefaults, { persist: false });
      if (parsed.ok === false) throw new Error(parsed.error);
      const safety = assessBackupRestoreSafety(engineState, parsed.state, parsed.metadata);
      if (safety.ok === false) throw new Error(safety.reason);

      const attachments = await Promise.all(downloaded.attachments.map(async (attachment) => {
        const bytes = new Uint8Array(await attachment.blob.arrayBuffer());
        let binary = '';
        const chunkSize = 0x8000;
        for (let offset = 0; offset < bytes.length; offset += chunkSize) {
          binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
        }
        return { mediaId: attachment.mediaId, mimeType: 'image/jpeg', dataBase64: btoa(binary) };
      }));
      setRestoreConfirmPin('');
      setRestoreConfirmError(null);
      setPendingRestoreCandidate({
        state: parsed.state,
        filename: downloaded.backupFileName,
        attachments,
        includesAttachments: true,
        metadata: parsed.metadata,
      });
      onNotify('Backup Drive Terverifikasi', `Snapshot dan ${attachments.length} lampiran lolos pemeriksaan checksum. Masukkan PIN Owner untuk melanjutkan restore.`, 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Gagal memvalidasi backup Google Drive.';
      setDriveBackupError(message);
      onNotify('Restore Drive Dibatalkan', message, 'warning');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setRestoreError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onerror = () => {
      setRestoreError('Gagal membaca file cadangan. Coba pilih ulang file JSON.');
    };
    reader.onload = () => {
      const text = String(reader.result || '');
      const parsed = parseAndValidateBackupJson(text, restoreFallbackDefaults, { persist: false });
      if (parsed.ok === false) {
        setRestoreError(parsed.error);
        return;
      }
      const safety = assessBackupRestoreSafety(engineState, parsed.state, parsed.metadata);
      if (safety.ok === false) {
        setRestoreError(safety.reason);
        return;
      }
      let attachments: Array<{ mediaId: string; mimeType: string; dataBase64: string }> = [];
      let includesAttachments = false;
      try {
        const envelope = JSON.parse(text);
        if (envelope.attachments !== undefined) {
          includesAttachments = true;
          if (!Array.isArray(envelope.attachments) || envelope.attachments.some((item: any) =>
            !item || typeof item.mediaId !== 'string' || !item.mediaId ||
            typeof item.mimeType !== 'string' || typeof item.dataBase64 !== 'string'
          )) {
            setRestoreError('Daftar lampiran pada backup tidak valid.');
            return;
          }
          if (typeof envelope.attachmentsChecksum !== 'string' || computeIntegrityHash(JSON.stringify(envelope.attachments)) !== envelope.attachmentsChecksum) {
            setRestoreError('Pemeriksaan integritas lampiran gagal. File backup mungkin rusak atau telah diubah.');
            return;
          }
          attachments = envelope.attachments;
        }
      } catch {
        setRestoreError('File backup tidak dapat membaca metadata lampiran.');
        return;
      }
      setRestoreConfirmPin('');
      setRestoreConfirmError(null);
      setPendingRestoreCandidate({ state: parsed.state, filename: file.name, attachments, includesAttachments, metadata: parsed.metadata });
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
      {activeView === 'approval' && !isOwner && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900">
          Akses ditolak. Persetujuan sensitif hanya tersedia untuk Owner.
        </div>
      )}

      {activeView === 'approval' && isOwner && (
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
                            onClick={async () => {
                              const res = await onResolveApproval(apr.uuid, 'REJECTED', pinVal);
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
                            onClick={async () => {
                              const res = await onResolveApproval(apr.uuid, 'APPROVED', pinVal);
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
                            {tx.paymentMethod === 'CASH' ? 'Tunai' : tx.paymentMethod === 'TRANSFER' ? 'Transfer Bank' : tx.paymentMethod === 'MIX' ? 'Campuran' : `Tempo ${tx.tempoDays} Hari`}
                          </div>
                          {tx.paymentMethod === 'MIX' && tx.paymentBreakdown && (
                            <div className="mt-1 text-[10px] leading-relaxed text-slate-500">
                              {[
                                tx.paymentBreakdown.cashPaidRupiah > 0 ? `Tunai Rp ${tx.paymentBreakdown.cashPaidRupiah.toLocaleString('id-ID')}` : '',
                                tx.paymentBreakdown.transferPaidRupiah > 0 ? `Transfer Rp ${tx.paymentBreakdown.transferPaidRupiah.toLocaleString('id-ID')}` : '',
                                tx.paymentBreakdown.receivableRupiah > 0 ? `Tempo Rp ${tx.paymentBreakdown.receivableRupiah.toLocaleString('id-ID')}` : '',
                              ].filter(Boolean).join(' · ')}
                            </div>
                          )}
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
                          {tx.status === 'COMPLETED' && isOwner ? (
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
      {activeView === 'backup' && !isOwner && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900">
          Akses ditolak. Backup dan pemulihan database hanya tersedia untuk Owner.
        </div>
      )}

      {activeView === 'backup' && isOwner && (
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
                  <span className={`px-2 py-0.5 rounded border font-semibold text-[11px] shrink-0 ${idbDiagnostics.supported && idbDiagnostics.hasPersistedState ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
                    {idbDiagnostics.supported && idbDiagnostics.hasPersistedState ? 'Lokal tersimpan' : 'Perlu pemeriksaan'}
                  </span>
                </div>
              )}

              <div className="p-3 rounded-lg border border-slate-200 bg-white space-y-1.5 text-[11px]">
                <div className="font-semibold text-slate-800">Perlindungan penyimpanan browser</div>
                <div className="text-slate-600">
                  {idbDiagnostics?.persistentStorage === true
                    ? 'Browser menyatakan penyimpanan origin ini persistent; penghapusan data tetap mungkin terjadi karena tindakan pengguna atau kondisi perangkat.'
                    : idbDiagnostics?.persistentStorage === false
                      ? 'Browser belum memberi perlindungan persistent storage. Unduh backup eksternal secara berkala.'
                      : 'Browser tidak menyediakan status persistent storage; jangan mengandalkan IndexedDB sebagai satu-satunya cadangan.'}
                </div>
                <div className={`font-semibold ${!lastBackupCreatedAt || Date.now() - Date.parse(lastBackupCreatedAt) > 7 * 24 * 60 * 60 * 1000 ? 'text-amber-800' : 'text-emerald-700'}`}>
                  {!lastBackupCreatedAt
                    ? 'Belum ada file backup yang dibuat pada perangkat ini.'
                    : Date.now() - Date.parse(lastBackupCreatedAt) > 7 * 24 * 60 * 60 * 1000
                      ? `Backup terakhir dibuat lebih dari 7 hari lalu: ${new Date(lastBackupCreatedAt).toLocaleString('id-ID')}.`
                      : `Backup terakhir dibuat: ${new Date(lastBackupCreatedAt).toLocaleString('id-ID')}.`}
                </div>
              </div>
              <div className={`p-3 rounded-lg border text-[11px] space-y-1.5 ${integerAudit.ok && integerAudit.legacyKilogramFields.length === 0 ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
                <div className="font-semibold text-slate-900">Audit integritas angka (tanpa mengubah data)</div>
                <div className="text-slate-700">
                  {integerAudit.ok
                    ? 'Tidak ditemukan pecahan/overflow pada field Rupiah dan Gram yang diaudit.'
                    : `Ditemukan ${integerAudit.violations.length} nilai Rupiah/Gram yang bukan integer aman.`}
                  {integerAudit.legacyKilogramFields.length > 0 ? ` · ${integerAudit.legacyKilogramFields.length} field satuan KG lama perlu ditinjau untuk migrasi ke Gram.` : ''}
                </div>
                {!integerAudit.ok && <div className="text-amber-900">{integerAudit.violations.slice(0, 3).map((item) => item.path).join(' · ')}</div>}
              </div>
              {latestSafetySnapshot && (
                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-amber-900"><ShieldCheck className="w-4 h-4" /> Snapshot pengaman tersedia</div>
                  <div className="text-[11px] text-amber-800">Dibuat: {new Date(latestSafetySnapshot.createdAt).toLocaleString('id-ID')} · {latestSafetySnapshot.attachmentCount} lampiran</div>
                  <button type="button" onClick={() => { setSafetySnapshotPin(''); setSafetySnapshotError(null); setShowSafetySnapshotConfirm(true); }}
                    className="px-3 py-2 rounded-lg border border-amber-300 bg-white hover:bg-amber-100 text-amber-900 text-xs font-semibold cursor-pointer">
                    Pulihkan snapshot pengaman terakhir
                  </button>
                </div>
              )}
              {restoreError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">{restoreError}</div>
              )}
              {driveBackupError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">{driveBackupError}</div>
              )}
              {isOwner && (
                <div className="rounded-lg border border-sky-200 bg-sky-50/60 p-3 space-y-2">
                  <div className="text-xs font-semibold text-sky-950">Cadangan off-device milik Owner</div>
                  <p className="text-[11px] text-sky-900">File JSON dan foto bukti dikirim ke server gateway lalu disimpan terpisah di satu folder ERP DAGING BACKUP. Token Google Drive tidak pernah dikirim ke browser.</p>
                  <button
                    type="button"
                    disabled={!isOnline || isUploadingDriveBackup}
                    onClick={() => void handleGoogleDriveBackup()}
                    className="px-3 py-2 rounded-lg bg-sky-800 text-white text-xs font-semibold disabled:opacity-50"
                  >
                    {isUploadingDriveBackup ? 'Mengunggah backup…' : 'Backup ke Google Drive'}
                  </button>
                  <div className="border-t border-sky-200 pt-3 space-y-2">
                    <div className="text-xs font-semibold text-sky-950">Pulihkan dari snapshot Google Drive</div>
                    <button
                      type="button"
                      disabled={!isOnline || isListingDriveBackups}
                      onClick={() => void handleGoogleDriveList()}
                      className="px-3 py-2 rounded-lg border border-sky-300 bg-white text-sky-900 text-xs font-semibold disabled:opacity-50"
                    >
                      {isListingDriveBackups ? 'Memuat daftar backup…' : 'Tampilkan Backup di Drive'}
                    </button>
                    {driveBackups.length > 0 && (
                      <div className="space-y-2">
                        <select
                          value={selectedDriveBackupId}
                          onChange={(event) => setSelectedDriveBackupId(event.target.value)}
                          className="b2b-input w-full text-xs"
                          aria-label="Pilih snapshot Google Drive"
                        >
                          {driveBackups.map((backup) => (
                            <option key={backup.id} value={backup.id}>
                              {backup.name} · {backup.createdTime ? new Date(backup.createdTime).toLocaleString('id-ID') : 'waktu tidak tersedia'}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={!isOnline || !selectedDriveBackupId}
                          onClick={() => void handleGoogleDriveRestore()}
                          className="px-3 py-2 rounded-lg bg-sky-800 text-white text-xs font-semibold disabled:opacity-50"
                        >
                          Verifikasi & Pulihkan Snapshot Terpilih
                        </button>
                        <p className="text-[10px] text-sky-900">
                          Snapshot dan seluruh lampiran diverifikasi sebelum dialog PIN muncul. Restore hanya berjalan setelah pemeriksaan kelengkapan data dan konfirmasi PIN Owner.
                        </p>
                      </div>
                    )}
                    {driveBackups.length === 0 && (
                      <p className="text-[10px] text-sky-900">Belum ada daftar backup yang dimuat. Tekan Tampilkan Backup di Drive untuk memeriksa folder bersama.</p>
                    )}
                  </div>
                </div>
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
                    Konfigurasi server dapat disiapkan dan diuji kapan saja. Perpindahan dari server yang sudah menerima data memerlukan migrasi terverifikasi agar histori dan cursor tidak terputus.
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
                {draftBackendConfig.adapterType !== 'GOOGLE_SHEETS' ? (
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
                ) : (
                  <div className="sm:col-span-2 rounded-lg border border-slate-200 bg-white p-3 text-slate-700">
                    <div className="font-semibold">Identitas toko mengikuti membership akun ERP</div>
                    <p className="mt-1 text-[11px] text-slate-500">Store ID, URL GAS, shared secret, dan HMAC key dikelola di server. Tidak ada secret gateway yang disimpan di browser. Login ERP DAGING wajib sebelum sinkronisasi.</p>
                  </div>
                )}

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
                  <div className="sm:col-span-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
                    <div className="font-semibold">Gateway GAS melalui server aman</div>
                    <p className="mt-1 text-[11px]">PWA mengirim event ke server ERP memakai session Google Sign-In. Server menambahkan secret dan signature anti-replay saat meneruskan request ke GAS. Atur <code>GAS_WEB_APP_URL</code>, <code>GAS_SYNC_SHARED_SECRET</code>, dan <code>GAS_GATEWAY_HMAC_SECRET</code> pada environment server serta Script Properties GAS.</p>
                  </div>
                )}
              </div>
            )}

            {backendMigrationRequired && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950">
                <div className="font-bold">Aktivasi backend baru ditahan — migrasi data diperlukan</div>
                <p className="mt-1 leading-relaxed">
                  Backend sebelumnya mungkin sudah memiliki histori dari perangkat lain, meskipun perangkat ini belum pernah sinkronisasi. Mengaktifkan target berbeda sekarang dapat memutus histori, membuat cursor tidak cocok, atau menyebabkan transaksi lama tidak tersedia di server baru. Tes koneksi target tetap boleh dilakukan, tetapi aktivasi baru dibuka setelah alur migrasi backend selesai dan diverifikasi. Data lokal serta Outbox tidak dihapus.
                </p>
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
                  if (backendMigrationRequired) {
                    onNotify('Migrasi Backend Diperlukan', 'Target sudah dapat diuji, tetapi belum boleh diaktifkan karena histori sinkronisasi perlu dipindahkan dan diverifikasi terlebih dahulu. Data lokal dan Outbox tetap aman.', 'warning');
                    return;
                  }
                  const nextConfig = draftBackendConfig.adapterType === 'GOOGLE_SHEETS'
                    ? { ...draftBackendConfig, endpointUrl: undefined, apiKeyOrToken: undefined }
                    : draftBackendConfig;
                  onUpdateBackendConfig(nextConfig);
                  setDraftBackendConfig(nextConfig);
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
                  hidden={!isOwner}
                  type="button"
                  onClick={() => {
                    setShowPinEditor((prev) => !prev);
                    setPinUpdateFeedback(null);
                  }}
                  className="px-2.5 py-1 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer"
                >
                  {showPinEditor ? 'Tutup' : engineState.ownerPinHash ? 'Ubah PIN' : 'Buat PIN Owner'}
                </button>
              </div>
            </div>

            {isOwner && engineState.ownerPinNeedsChange === true && (
              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-medium">
                PIN bawaan masih aktif. Segera ganti dengan PIN pribadi pemilik melalui tombol <strong>Ubah PIN</strong> sebelum pemakaian operasional toko.
              </div>
            )}

            {isOwner && !engineState.ownerPinHash && (
              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px] font-medium">
                PIN Owner belum dibuat. Buat PIN pribadi sebelum menggunakan tindakan sensitif seperti void, persetujuan, dan pemulihan backup.
              </div>
            )}

            {isOwner && showPinEditor && (
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-2.5">
                {!engineState.ownerPinHash && (
                  <p className="text-[11px] text-slate-600">Ini pengaturan PIN pertama. Kolom PIN saat ini tidak diperlukan.</p>
                )}
                <div className={`grid grid-cols-1 ${engineState.ownerPinHash ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-2`}>
                  {engineState.ownerPinHash && (
                    <input
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      value={currentPinDraft}
                      onChange={(e) => setCurrentPinDraft(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="PIN Saat Ini (6 digit)"
                      className="b2b-input w-full font-mono"
                    />
                  )}
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
                    onClick={async () => {
                      if (newPinDraft !== confirmNewPinDraft) {
                        setPinUpdateFeedback({ ok: false, text: 'Konfirmasi PIN baru tidak cocok.' });
                        return;
                      }
                      const res = await onUpdateOwnerPin(engineState.ownerPinHash ? currentPinDraft : '', newPinDraft);
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
                onClick={async () => {
                  const cleanReason = voidReason.trim();
                  if (!cleanReason) {
                    setVoidError('Alasan pembatalan wajib diisi.');
                    return;
                  }
                  const res = await onVoidTransaction(voidTargetTx.uuid, cleanReason, voidPin);
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
                  File <strong>{pendingRestoreCandidate.filename}</strong> berisi {pendingRestoreCandidate.state.products.length} produk dan {pendingRestoreCandidate.state.transactions.length} transaksi. Restore hanya diizinkan jika berasal dari perangkat yang sama dan mencakup seluruh catatan aktif yang lebih baru.
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
                onClick={async () => {
                  let decodedAttachments: Array<{ mediaId: string; blob: Blob }> = [];
                  try {
                    decodedAttachments = pendingRestoreCandidate.attachments.map((attachment) => {
                      const binary = atob(attachment.dataBase64);
                      const bytes = new Uint8Array(binary.length);
                      for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
                      if (attachment.mimeType !== 'image/jpeg' || bytes.length <= 0 || bytes.length > 1024 * 1024) {
                        throw new Error(`Lampiran ${attachment.mediaId} bukan JPEG valid atau melebihi 1 MB.`);
                      }
                      return { mediaId: attachment.mediaId, blob: new Blob([bytes], { type: attachment.mimeType }) };
                    });
                    if (new Set(decodedAttachments.map((item) => item.mediaId)).size !== decodedAttachments.length) {
                      throw new Error('File backup memiliki ID lampiran duplikat.');
                    }
                  } catch (error) {
                    setRestoreConfirmError(error instanceof Error ? error.message : 'Gagal memeriksa lampiran backup.');
                    return;
                  }
                  // State, current attachments, and the safety snapshot are committed in one IndexedDB transaction.
                  const res = await onRestoreState(
                    pendingRestoreCandidate.state,
                    restoreConfirmPin,
                    pendingRestoreCandidate.metadata,
                    decodedAttachments,
                    pendingRestoreCandidate.includesAttachments
                  );
                  if (!res.ok) {
                    setRestoreConfirmError(res.message);
                    return;
                  }
                  setPendingRestoreCandidate(null);
                  setRestoreConfirmPin('');
                  setRestoreConfirmError(null);
                  onNotify('Backup Dipulihkan', `Data dan ${pendingRestoreCandidate.attachments.length} lampiran berhasil dipulihkan.`, 'success');
                }}
                className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer"
              >
                Konfirmasi &amp; Pulihkan
              </button>
            </div>
          </div>
        </div>
      )}


      {showSafetySnapshotConfirm && latestSafetySnapshot && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-5 space-y-4 shadow-xl">
            <div className="flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-sm font-bold text-slate-900">Pulihkan Snapshot Pengaman?</h4>
                <p className="text-xs text-slate-600 mt-1">Data aktif akan diganti dengan kondisi snapshot {new Date(latestSafetySnapshot.createdAt).toLocaleString('id-ID')}. Kondisi data aktif sekarang akan disimpan sebagai snapshot pengaman baru. PIN Owner dan ID perangkat tidak berubah.</p>
              </div>
            </div>
            <div className="space-y-1.5 text-xs">
              <label className="font-semibold text-slate-700 block">PIN Pemilik</label>
              <input type="password" inputMode="numeric" maxLength={6} value={safetySnapshotPin}
                onChange={(e) => { setSafetySnapshotPin(e.target.value.replace(/\D/g, '').slice(0, 6)); setSafetySnapshotError(null); }}
                className="b2b-input w-full font-mono" placeholder="Masukkan 6 digit PIN pemilik" />
              {safetySnapshotError && <p className="text-[11px] font-medium text-rose-700 bg-rose-50 border border-rose-200 rounded p-2">{safetySnapshotError}</p>}
            </div>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button type="button" onClick={() => { setShowSafetySnapshotConfirm(false); setSafetySnapshotPin(''); setSafetySnapshotError(null); }}
                className="px-3.5 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 cursor-pointer">Batal</button>
              <button type="button" disabled={safetySnapshotLoading || safetySnapshotPin.length < 4}
                onClick={async () => {
                  setSafetySnapshotLoading(true);
                  setSafetySnapshotError(null);
                  try {
                    const snapshot = await idbGetRestoreSafetySnapshot(latestSafetySnapshot.id);
                    if (!snapshot) { setSafetySnapshotError('Snapshot tidak ditemukan atau tidak dapat dibaca.'); return; }
                    const result = await onRestoreSafetySnapshot(latestSafetySnapshot.id, snapshot.state, latestSafetySnapshot.createdAt, safetySnapshotPin);
                    if (!result.ok) { setSafetySnapshotError(result.message); return; }
                    setShowSafetySnapshotConfirm(false);
                    setSafetySnapshotPin('');
                    setLatestSafetySnapshot(null);
                    onNotify('Snapshot Dipulihkan', result.message, 'success');
                  } catch (error) {
                    setSafetySnapshotError(error instanceof Error ? error.message : 'Gagal membaca snapshot pengaman.');
                  } finally { setSafetySnapshotLoading(false); }
                }}
                className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer">
                {safetySnapshotLoading ? 'Memulihkan…' : 'Pulihkan Snapshot'}
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
                onClick={async () => {
                  const res = await onResetSandbox(resetPin);
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
