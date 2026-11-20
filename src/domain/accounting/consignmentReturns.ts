import type { BatchLotEntity, ConsignmentPayableRecord, LotAllocationRecord } from '../../engine/types';

export interface ConsignmentReturnAdjustment {
  ok: boolean;
  message: string;
  isConsignment: boolean;
  totalPayableReversalRupiah: number;
  updatedPayables: ConsignmentPayableRecord[];
  ownerName?: string;
  setorPerKgRupiah?: number;
}

/**
 * A customer return reverses the consignment liability only while it is unpaid.
 * Mixed OWN/CONSIGNMENT lines or multiple owners are held for manual Owner review
 * because a single quarantine lot cannot safely represent mixed ownership.
 */
export function calculateConsignmentReturnAdjustment(input: {
  invoiceNo: string;
  productId: string;
  soldWeightGram: number;
  priorReturnedGram: number;
  returnWeightGram: number;
  allocations: LotAllocationRecord[];
  lots: BatchLotEntity[];
  payables: ConsignmentPayableRecord[];
}): ConsignmentReturnAdjustment {
  const productAllocations = input.allocations.filter((allocation) => {
    const productId = allocation.productId || input.lots.find((lot) => lot.id === allocation.lotId)?.productId;
    return productId === input.productId;
  });
  const consignmentAllocations = productAllocations.filter((allocation) => allocation.ownershipType === 'CONSIGNMENT');
  const empty = {
    ok: true, message: '', isConsignment: false, totalPayableReversalRupiah: 0,
    updatedPayables: input.payables,
  };
  if (consignmentAllocations.length === 0) return empty;
  if (productAllocations.some((allocation) => allocation.ownershipType !== 'CONSIGNMENT')) {
    return { ...empty, ok: false, message: 'Retur produk dengan lot OWN dan Konsinyasi campuran perlu pemeriksaan Owner agar kepemilikan dan HPP tidak tercampur.' };
  }
  if (!Number.isSafeInteger(input.soldWeightGram) || input.soldWeightGram <= 0 ||
      !Number.isSafeInteger(input.priorReturnedGram) || input.priorReturnedGram < 0 ||
      !Number.isSafeInteger(input.returnWeightGram) || input.returnWeightGram <= 0 ||
      input.priorReturnedGram + input.returnWeightGram > input.soldWeightGram ||
      consignmentAllocations.reduce((sum, allocation) => sum + allocation.weightGram, 0) !== input.soldWeightGram) {
    return { ...empty, ok: false, message: 'Alokasi lot konsinyasi tidak sama dengan kuantitas faktur; retur perlu rekonsiliasi Owner.' };
  }
  const consignmentLots = consignmentAllocations.map((allocation) => input.lots.find((lot) => lot.id === allocation.lotId));
  if (consignmentLots.some((lot) => !lot || lot.ownershipType !== 'CONSIGNMENT' ||
      !lot.consignmentOwnerName?.trim() ||
      !Number.isSafeInteger(lot.consignmentSetorPerKgRupiah) ||
      Number(lot.consignmentSetorPerKgRupiah) <= 0)) {
    return { ...empty, ok: false, message: 'Data pemilik/tarif lot konsinyasi tidak lengkap; retur perlu rekonsiliasi Owner.' };
  }
  const ownerKeys = new Set(consignmentLots.map((lot) => `${lot!.consignmentOwnerName!.trim().toUpperCase()}|${lot!.consignmentSetorPerKgRupiah}`));
  if (ownerKeys.size !== 1) {
    return { ...empty, ok: false, message: 'Retur dari beberapa pemilik konsinyasi perlu dipisahkan dan direkonsiliasi Owner.' };
  }
  const lotIds = new Set(consignmentAllocations.map((allocation) => allocation.lotId));
  const matchingPayables = input.payables.filter((payable) => payable.invoiceNo === input.invoiceNo && lotIds.has(payable.lotId));
  if (matchingPayables.length !== lotIds.size) {
    return { ...empty, ok: false, message: 'Subledger utang konsinyasi faktur tidak lengkap; retur ditahan agar utang tidak salah.' };
  }
  if (matchingPayables.some((payable) => payable.paidAmountRupiah > 0 || payable.status === 'PAID')) {
    return { ...empty, ok: false, message: 'Utang konsinyasi faktur sudah dibayar sebagian/penuh. Minta Owner menyelesaikan kredit pemilik sebelum retur.' };
  }
  const cumulativeReturned = input.priorReturnedGram + input.returnWeightGram;
  let totalPayableReversalRupiah = 0;
  const updatedPayables = input.payables.map((payable) => {
    if (payable.invoiceNo !== input.invoiceNo || !lotIds.has(payable.lotId)) return payable;
    if (!Number.isSafeInteger(payable.amountRupiah) || payable.amountRupiah < 0 ||
        !Number.isSafeInteger(payable.remainingAmountRupiah) || payable.remainingAmountRupiah < 0 ||
        payable.remainingAmountRupiah > payable.amountRupiah) {
      throw new RangeError('Saldo utang konsinyasi tidak valid untuk retur.');
    }
    const previousCredit = payable.amountRupiah - payable.remainingAmountRupiah;
    const cumulativeCredit = Math.round((payable.amountRupiah * cumulativeReturned) / input.soldWeightGram);
    const reversal = cumulativeCredit - previousCredit;
    if (!Number.isSafeInteger(reversal) || reversal < 0 || reversal > payable.remainingAmountRupiah) {
      throw new RangeError('Nilai reversal utang konsinyasi tidak valid.');
    }
    const remainingAmountRupiah = payable.remainingAmountRupiah - reversal;
    totalPayableReversalRupiah += reversal;
    return {
      ...payable,
      remainingAmountRupiah,
      status: remainingAmountRupiah === 0 ? 'VOIDED' as const : cumulativeCredit > 0 ? 'PARTIAL' as const : 'UNPAID' as const,
      ...(remainingAmountRupiah === 0 ? { voidedAt: new Date().toISOString(), voidReason: 'Retur pelanggan mengurangi seluruh kewajiban konsinyasi.' } : {}),
    };
  });
  if (!Number.isSafeInteger(totalPayableReversalRupiah)) {
    return { ...empty, ok: false, message: 'Nilai reversal utang konsinyasi melewati batas integer Rupiah aman.' };
  }
  const firstLot = consignmentLots[0]!;
  return {
    ok: true, message: '', isConsignment: true, totalPayableReversalRupiah,
    updatedPayables, ownerName: firstLot.consignmentOwnerName,
    setorPerKgRupiah: firstLot.consignmentSetorPerKgRupiah,
  };
}
