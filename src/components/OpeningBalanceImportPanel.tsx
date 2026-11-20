import React, { useState } from 'react';
import type { BusinessEngineState } from '../engine/types';

export interface OpeningBalanceImportFormInput {
  lotsCsv: string;
  receivablesCsv: string;
  payablesCsv: string;
  cashBalanceRupiah: number;
  bankBalanceRupiah: number;
  pettyCashBalanceRupiah: number;
  referenceNo: string;
  ownerPin: string;
}

interface Props {
  engineState: BusinessEngineState;
  onCommit: (input: OpeningBalanceImportFormInput) => Promise<{ ok: boolean; message: string }>;
}

type CsvKey = 'lotsCsv' | 'receivablesCsv' | 'payablesCsv';

export const OpeningBalanceImportPanel: React.FC<Props> = ({ engineState, onCommit }) => {
  const [csv, setCsv] = useState<Record<CsvKey, string>>({ lotsCsv: '', receivablesCsv: '', payablesCsv: '' });
  const [files, setFiles] = useState<Record<CsvKey, string>>({ lotsCsv: '', receivablesCsv: '', payablesCsv: '' });
  const [cash, setCash] = useState('0');
  const [bank, setBank] = useState('0');
  const [pettyCash, setPettyCash] = useState('0');
  const [referenceNo, setReferenceNo] = useState('CUTOVER-01');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  const locked = Boolean(engineState.openingBalanceCommittedAt || engineState.openingBalanceIdempotencyKey);

  const readCsv = async (key: CsvKey, file?: File) => {
    if (!file) return;
    try {
      const content = await file.text();
      setCsv((current) => ({ ...current, [key]: content }));
      setFiles((current) => ({ ...current, [key]: file.name }));
      setFeedback(null);
    } catch {
      setFeedback({ ok: false, message: `File ${file.name} gagal dibaca. Coba simpan ulang sebagai CSV UTF-8.` });
    }
  };

  const parseRupiah = (value: string, label: string): number => {
    if (!/^(0|[1-9]\d*)$/.test(value.trim())) throw new Error(`${label} harus angka bulat Rupiah tanpa titik atau koma.`);
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed)) throw new Error(`${label} melewati batas integer Rupiah aman.`);
    return parsed;
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFeedback(null);
    try {
      if (!referenceNo.trim()) throw new Error('Nomor referensi cut-over wajib diisi.');
      if (!/^\d{6}$/.test(pin)) throw new Error('PIN Owner harus tepat 6 digit.');
      setBusy(true);
      const result = await onCommit({
        ...csv,
        cashBalanceRupiah: parseRupiah(cash, 'Saldo kas'),
        bankBalanceRupiah: parseRupiah(bank, 'Saldo bank'),
        pettyCashBalanceRupiah: parseRupiah(pettyCash, 'Saldo kas kecil'),
        referenceNo: referenceNo.trim(),
        ownerPin: pin,
      });
      setFeedback(result);
      if (result.ok) {
        setPin('');
        setCsv({ lotsCsv: '', receivablesCsv: '', payablesCsv: '' });
        setFiles({ lotsCsv: '', receivablesCsv: '', payablesCsv: '' });
      }
    } catch (error) {
      setFeedback({ ok: false, message: error instanceof Error ? error.message : 'Input Opening Balance tidak valid.' });
    } finally {
      setBusy(false);
    }
  };

  const fileField = (key: CsvKey, label: string) => (
    <label className="block space-y-1.5">
      <span className="font-semibold text-slate-700">{label}</span>
      <input type="file" accept=".csv,text/csv" onChange={(event) => void readCsv(key, event.target.files?.[0])}
        className="block w-full text-[11px] text-slate-600 file:mr-2 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-[11px] file:font-semibold file:text-slate-700" />
      <span className="text-[10px] text-slate-500">{files[key] || 'Opsional jika tidak ada saldo pada kategori ini'}</span>
    </label>
  );

  return (
    <section className="mt-4 rounded-xl border border-slate-200 bg-white p-5 space-y-4 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Opening Balance & Go-Live Lock</h3>
          <p className="mt-1 text-slate-500">Import stok lot, piutang, utang, kas, bank, dan kas kecil dalam satu posting atomik sebelum operasional dimulai.</p>
        </div>
        <span className={locked ? 'rounded-md bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700' : 'rounded-md bg-amber-50 px-2.5 py-1 font-semibold text-amber-800'}>
          {locked ? 'Terkunci' : 'Belum dikunci'}
        </span>
      </div>

      {locked ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-900">
          Go-Live Lock aktif sejak {engineState.openingBalanceCommittedAt ? new Date(engineState.openingBalanceCommittedAt).toLocaleString('id-ID') : 'waktu tidak tersedia'}.
          <div className="mt-1">Referensi: <strong>{engineState.openingBalanceReferenceNo || '—'}</strong>. Import ulang ditolak; koreksi dilakukan lewat transaksi penyesuaian resmi.</div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {fileField('lotsCsv', 'CSV Stok Lot')}
            {fileField('receivablesCsv', 'CSV Piutang Pelanggan')}
            {fileField('payablesCsv', 'CSV Utang Supplier')}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="space-y-1.5">
              <span className="font-semibold text-slate-700">Saldo Kas (Rp)</span>
              <input value={cash} onChange={(e) => setCash(e.target.value)} inputMode="numeric" className="b2b-input w-full" />
            </label>
            <label className="space-y-1.5">
              <span className="font-semibold text-slate-700">Saldo Bank (Rp)</span>
              <input value={bank} onChange={(e) => setBank(e.target.value)} inputMode="numeric" className="b2b-input w-full" />
            </label>
            <label className="space-y-1.5">
              <span className="font-semibold text-slate-700">Saldo Kas Kecil (Rp)</span>
              <input value={pettyCash} onChange={(e) => setPettyCash(e.target.value)} inputMode="numeric" className="b2b-input w-full" />
            </label>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="font-semibold text-slate-700">Referensi Cut-over</span>
              <input value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} className="b2b-input w-full" maxLength={80} />
            </label>
            <label className="space-y-1.5">
              <span className="font-semibold text-slate-700">PIN Owner (6 digit)</span>
              <input type="password" inputMode="numeric" maxLength={6} value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="b2b-input w-full font-mono" />
            </label>
          </div>
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900 space-y-1">
            <p className="font-semibold">Penting sebelum posting</p>
            <p>Pastikan SKU dan customer code cocok dengan master. supplier_code harus sama persis dengan nama supplier yang sudah tersimpan pada master saat ini. Nilai uang wajib angka bulat tanpa pemisah ribuan. Kolom total_pcs harus 0 karena kontrol stok Pcs belum aktif end-to-end.</p>
            <p>Posting ini hanya dapat dilakukan sekali pada data pra-operasional yang bersih. Setelah berhasil, sistem mengunci import ulang dan mengirim event pembukaan ke perangkat lain.</p>
          </div>
          {feedback && <div className={feedback.ok ? 'rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-800' : 'rounded-lg border border-rose-200 bg-rose-50 p-3 text-rose-800'}>{feedback.message}</div>}
          <div className="flex justify-end">
            <button type="submit" disabled={busy || !isOwnerSafe(engineState)}
              className="rounded-lg bg-slate-900 px-4 py-2.5 font-semibold text-white disabled:opacity-50">
              {busy ? 'Memvalidasi & Posting…' : 'Validasi, Posting & Kunci Go-Live'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
};

function isOwnerSafe(state: BusinessEngineState): boolean {
  return Boolean(state.ownerPinHash && state.ownerPinSalt && state.ownerPinNeedsChange !== true);
}
