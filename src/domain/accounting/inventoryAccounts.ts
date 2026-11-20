export type InventoryAccountCode = '1301' | '1302' | '1303' | '1304';

export interface InventoryLotAccountIdentity {
  id: string;
  code: string;
  productId?: string;
  isQuarantined: boolean;
}

export interface InventoryCostAllocation {
  lotId: string;
  cogsRupiah: number;
}

export type InventoryCostByAccount = Record<InventoryAccountCode, number>;

/**
 * Resolve the carrying-value account from the lot's persisted identity.
 * Raw lots use 1301, trimmed primary-cut lots use 1302, tetelan lots use
 * 1303, and returned/quarantined lots use 1304.
 *
 * The legacy PROD_03 / LOT_03 identity is retained for existing tetelan lots.
 */
export function resolveInventoryAccountCode(lot: InventoryLotAccountIdentity): InventoryAccountCode {
  if (lot.isQuarantined) return '1304';
  if (lot.productId === 'PROD_03' || lot.id === 'LOT_03' || lot.code.startsWith('LOT-TET-')) return '1303';
  if (lot.code.startsWith('LOT-CUT-')) return '1302';
  return '1301';
}

/** Group lot-level carrying costs into the correct inventory control accounts. */
export function groupInventoryCostsByAccount(
  allocations: InventoryCostAllocation[],
  lots: InventoryLotAccountIdentity[]
): InventoryCostByAccount {
  const totals: InventoryCostByAccount = { '1301': 0, '1302': 0, '1303': 0, '1304': 0 };
  const lotsById = new Map(lots.map((lot) => [lot.id, lot]));

  for (const allocation of allocations) {
    if (!Number.isSafeInteger(allocation.cogsRupiah) || allocation.cogsRupiah < 0) {
      throw new RangeError('Nilai alokasi persediaan harus berupa integer Rupiah aman non-negatif.');
    }
    const lot = lotsById.get(allocation.lotId);
    if (!lot) throw new Error(`Lot ${allocation.lotId} tidak ditemukan untuk pemetaan akun persediaan.`);
    const accountCode = resolveInventoryAccountCode(lot);
    const next = totals[accountCode] + allocation.cogsRupiah;
    if (!Number.isSafeInteger(next)) throw new RangeError('Total akun persediaan melewati batas integer aman.');
    totals[accountCode] = next;
  }

  return totals;
}
