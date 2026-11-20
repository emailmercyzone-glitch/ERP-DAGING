import React, { useMemo, useState } from 'react';
import type { AffiliateCommissionRecord, BusinessEngineState, ConsignmentPayableRecord, ProductEntity } from '../engine/types';

type Result = { ok: boolean; message: string };

interface Props {
  state: BusinessEngineState;
  products: ProductEntity[];
  onReceiveConsignment: (input: {
    productId: string; lotCode: string; expiryDate: string; weightGram: number;
    ownerName: string; supplierCode?: string; setorPerKgRupiah: number;
  }) => Promise<Result>;
  onPayConsignment: (id: string, amount: number, method: 'CASH' | 'TRANSFER', reference: string) => Promise<Result>;
  onRecordAffiliate: (input: {
    productId: string; referenceNo: string; grossReferenceRupiah?: number; weightGram?: number; pcs?: number;
  }) => Promise<Result>;
  onSettleAffiliate: (id: string, amount: number, method: 'CASH' | 'TRANSFER', reference: string) => Promise<Result>;
}

const rupiah = (value: number) => `Rp ${value.toLocaleString('id-ID')}`;
const parsePositive = (value: string) => /^\\d+$/.test(value.trim()) && Number.isSafeInteger(Number(value)) && Number(value) > 0;

export const ConsignmentAffiliatePanel: React.FC<Props> = ({
  state, products, onReceiveConsignment, onPayConsignment, onRecordAffiliate, onSettleAffiliate,
}) => {
  const consignmentProducts = useMemo(() => products.filter((item) => item.supplyType === 'CONSIGNMENT'), [products]);
  const affiliateProducts = useMemo(() => products.filter((item) => item.supplyType === 'AFFILIATE'), [products]);
  const [productId, setProductId] = useState('');
  const [lotCode, setLotCode] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [weightGram, setWeightGram] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [setorRate, setSetorRate] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [payAmounts, setPayAmounts] = useState<Record<string, string>>({});
  const [payMethods, setPayMethods] = useState<Record<string, 'CASH' | 'TRANSFER'>>({});
  const [payRefs, setPayRefs] = useState<Record<string, string>>({});
  const [affiliateProductId, setAffiliateProductId] = useState('');
  const [affiliateReference, setAffiliateReference] = useState('');
  const [affiliateGross, setAffiliateGross] = useState('');
  const [affiliateWeight, setAffiliateWeight] = useState('');
  const [affiliatePcs, setAffiliatePcs] = useState('');
  const [affiliateAmounts, setAffiliateAmounts] = useState<Record<string, string>>({});
  const [affiliateMethods, setAffiliateMethods] = useState<Record<string, 'CASH' | 'TRANSFER'>>({});
  const [affiliateRefs, setAffiliateRefs] = useState<Record<string, string>>({});

  const run = async (key: string, action: () => Promise<Result>) => {
    setBusyKey(key); setError(''); setSuccess('');
    try {
      const result = await action();
      if (result.ok) setSuccess(result.message);
      else setError(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Transaksi gagal diproses.');
    } finally { setBusyKey(''); }
  };

  const submitConsignment = (event: React.FormEvent) => {
    event.preventDefault();
    if (!productId || !lotCode.trim() || !expiryDate || !ownerName.trim() ||
        !parsePositive(weightGram) || !parsePositive(setorRate)) {
      setError('Lengkapi produk, lot, kedaluwarsa, pemilik, berat Gram, dan tarif setor/kg.');
      return;
    }
    void run('receive', () => onReceiveConsignment({
      productId, lotCode: lotCode.trim(), expiryDate, ownerName: ownerName.trim(),
      weightGram: Number(weightGram), setorPerKgRupiah: Number(setorRate), supplierCode: ownerName.trim(),
    }));
  };

  const submitAffiliate = (event: React.FormEvent) => {
    event.preventDefault();
    if (!affiliateProductId || !affiliateReference.trim()) {
      setError('Pilih produk Affiliate dan isi nomor referensi transaksi eksternal.');
      return;
    }
    void run('affiliate-record', () => onRecordAffiliate({
      productId: affiliateProductId, referenceNo: affiliateReference.trim(),
      ...(affiliateGross ? { grossReferenceRupiah: Number(affiliateGross) } : {}),
      ...(affiliateWeight ? { weightGram: Number(affiliateWeight) } : {}),
      ...(affiliatePcs ? { pcs: Number(affiliatePcs) } : {}),
    }));
  };

  const payableRows = (state.consignmentPayables ?? []).filter((item) => item.status === 'UNPAID' || item.status === 'PARTIAL');
  const commissionRows = (state.affiliateCommissions ?? []).filter((item) => item.status === 'UNPAID' || item.status === 'PARTIAL');

  const paymentForm = (
    id: string, remaining: number, kind: 'consignment' | 'affiliate',
    onSubmit: (id: string, amount: number, method: 'CASH' | 'TRANSFER', reference: string) => Promise<Result>
  ) => (
    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_130px_130px_auto]">
      <input value={(kind === 'consignment' ? payAmounts : affiliateAmounts)[id] ?? String(remaining)}
        onChange={(e) => (kind === 'consignment' ? setPayAmounts : setAffiliateAmounts)((current) => ({ ...current, [id]: e.target.value }))}
        inputMode="numeric" className="b2b-input w-full" aria-label="Nominal pembayaran" />
      <select value={(kind === 'consignment' ? payMethods : affiliateMethods)[id] ?? 'TRANSFER'}
        onChange={(e) => (kind === 'consignment' ? setPayMethods : setAffiliateMethods)((current) => ({ ...current, [id]: e.target.value as 'CASH' | 'TRANSFER' }))}
        className="b2b-input w-full"><option value="TRANSFER">Bank</option><option value="CASH">Kas</option></select>
      <input value={(kind === 'consignment' ? payRefs : affiliateRefs)[id] ?? ''}
        onChange={(e) => (kind === 'consignment' ? setPayRefs : setAffiliateRefs)((current) => ({ ...current, [id]: e.target.value }))}
        className="b2b-input w-full" placeholder="Ref pembayaran" />
      <button type="button" disabled={!!busyKey || !parsePositive((kind === 'consignment' ? payAmounts : affiliateAmounts)[id] ?? String(remaining))}
        onClick={() => {
          const amount = Number((kind === 'consignment' ? payAmounts : affiliateAmounts)[id] ?? remaining);
          const method = (kind === 'consignment' ? payMethods : affiliateMethods)[id] ?? 'TRANSFER';
          const reference = (kind === 'consignment' ? payRefs : affiliateRefs)[id] ?? '';
          void run(`${kind}-${id}`, () => onSubmit(id, amount, method, reference));
        }}
        className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">
        {busyKey === `${kind}-${id}` ? 'Proses…' : 'Bayar'}
      </button>
    </div>
  );

  return (
    <section className="mt-5 space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
      <div>
        <h3 className="text-sm font-extrabold text-slate-900">Mitra: Konsinyasi & Affiliate</h3>
        <p className="mt-1 text-xs text-slate-500">Stok titipan dihitung sebagai kewajiban saat terjual. Affiliate dicatat sebagai komisi/piutang tanpa stok fisik.</p>
      </div>
      {(error || success) && <div className={error ? 'rounded-lg bg-rose-50 p-3 text-xs text-rose-700' : 'rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700'}>{error || success}</div>}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="space-y-3 rounded-xl border border-slate-200 p-3">
          <div><h4 className="text-xs font-bold text-slate-800">Terima stok konsinyasi</h4><p className="text-[10px] text-slate-500">Tidak menambah nilai aset persediaan sendiri.</p></div>
          <form onSubmit={submitConsignment} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <select value={productId} onChange={(e) => setProductId(e.target.value)} className="b2b-input sm:col-span-2">
              <option value="">Pilih produk konsinyasi</option>{consignmentProducts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <input value={lotCode} onChange={(e) => setLotCode(e.target.value)} className="b2b-input" placeholder="Kode lot unik" />
            <input type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} className="b2b-input" />
            <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} className="b2b-input" placeholder="Nama pemilik barang" />
            <input value={weightGram} onChange={(e) => setWeightGram(e.target.value)} inputMode="numeric" className="b2b-input" placeholder="Berat (Gram)" />
            <input value={setorRate} onChange={(e) => setSetorRate(e.target.value)} inputMode="numeric" className="b2b-input sm:col-span-2" placeholder="Tarif setor pemilik per KG (Rp)" />
            <button type="submit" disabled={!!busyKey || consignmentProducts.length === 0} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40 sm:col-span-2">
              {busyKey === 'receive' ? 'Menyimpan…' : 'Terima stok titipan'}
            </button>
          </form>
          <div className="space-y-2 border-t border-slate-100 pt-3">
            <h5 className="text-xs font-bold text-slate-700">Utang pemilik barang</h5>
            {payableRows.length === 0 && <p className="text-xs text-slate-500">Belum ada utang konsinyasi.</p>}
            {payableRows.map((item: ConsignmentPayableRecord) => (
              <div key={item.id} className="rounded-lg bg-slate-50 p-3 text-xs">
                <div className="flex justify-between gap-2"><strong>{item.ownerName}</strong><span className="font-semibold">{rupiah(item.remainingAmountRupiah)}</span></div>
                <p className="mt-1 text-[10px] text-slate-500">{item.invoiceNo} · {item.lotCode} · {(item.weightGram / 1000).toFixed(3)} kg</p>
                {paymentForm(item.id, item.remainingAmountRupiah, 'consignment', onPayConsignment)}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-slate-200 p-3">
          <div><h4 className="text-xs font-bold text-slate-800">Catat konversi Affiliate</h4><p className="text-[10px] text-slate-500">Masukkan referensi penjualan eksternal; sistem menghitung komisi dan membentuk piutang otomatis.</p></div>
          <form onSubmit={submitAffiliate} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <select value={affiliateProductId} onChange={(e) => setAffiliateProductId(e.target.value)} className="b2b-input sm:col-span-2">
              <option value="">Pilih produk Affiliate</option>{affiliateProducts.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.affiliatePartner}</option>)}
            </select>
            <input value={affiliateReference} onChange={(e) => setAffiliateReference(e.target.value)} className="b2b-input sm:col-span-2" placeholder="No. referensi transaksi eksternal" />
            <input value={affiliateGross} onChange={(e) => setAffiliateGross(e.target.value)} inputMode="numeric" className="b2b-input" placeholder="Nilai transaksi (Rp) · untuk %" />
            <input value={affiliateWeight} onChange={(e) => setAffiliateWeight(e.target.value)} inputMode="numeric" className="b2b-input" placeholder="Berat (Gram) · per KG" />
            <input value={affiliatePcs} onChange={(e) => setAffiliatePcs(e.target.value)} inputMode="numeric" className="b2b-input" placeholder="Jumlah Pcs · per Pcs" />
            <button type="submit" disabled={!!busyKey || affiliateProducts.length === 0} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40 sm:col-span-2">
              {busyKey === 'affiliate-record' ? 'Menyimpan…' : 'Hitung & catat komisi'}
            </button>
          </form>
          <div className="space-y-2 border-t border-slate-100 pt-3">
            <h5 className="text-xs font-bold text-slate-700">Piutang komisi Affiliate</h5>
            {commissionRows.length === 0 && <p className="text-xs text-slate-500">Belum ada komisi Affiliate.</p>}
            {commissionRows.map((item: AffiliateCommissionRecord) => (
              <div key={item.id} className="rounded-lg bg-slate-50 p-3 text-xs">
                <div className="flex justify-between gap-2"><strong>{item.partner}</strong><span className="font-semibold">{rupiah(item.remainingAmountRupiah)}</span></div>
                <p className="mt-1 text-[10px] text-slate-500">{item.referenceNo} · Komisi {rupiah(item.commissionRupiah)}</p>
                {paymentForm(item.id, item.remainingAmountRupiah, 'affiliate', onSettleAffiliate)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
