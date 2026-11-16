/**
 * Prevents two sync cycles from pushing the same snapshot concurrently.
 * A lock is acquired synchronously before the first await and released in finally.
 */
export function createSyncLock() {
  let locked = false;
  return {
    tryAcquire(): boolean {
      if (locked) return false;
      locked = true;
      return true;
    },
    release(): void {
      locked = false;
    },
    get isLocked(): boolean {
      return locked;
    },
  };
}

/**
 * Validates the shared ordered-event pull envelope before a cursor can be
 * committed. A malformed/partial response must never advance the local cursor.
 */
export function validatePullChangesEnvelope(
  data: unknown,
  sinceSeq: number,
  adapterName: string
): PullChangesResult {
  const failure = (message: string): PullChangesResult => ({
    ok: false,
    records: [],
    message: `${adapterName} pull ditolak: ${message} Cursor lokal tidak dimajukan.`,
  });
  if (!Number.isSafeInteger(sinceSeq) || sinceSeq < 0) {
    return failure('cursor awal tidak valid.');
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return failure('respons bukan objek JSON.');
  }
  const body = data as Record<string, unknown>;
  if (body.ok === false) {
    return failure(typeof body.message === 'string' ? body.message : 'server melaporkan kegagalan.');
  }
  if (!Array.isArray(body.records)) {
    return failure('field records tidak tersedia atau bukan array.');
  }
  const cursor = body.lastServerSeq ?? body.last_server_seq;
  if (!Number.isSafeInteger(cursor) || Number(cursor) < sinceSeq) {
    return failure('lastServerSeq harus integer aman dan tidak boleh mundur.');
  }

  const records: Array<Record<string, unknown>> = [];
  const seenSequences = new Set<number>();
  let previousSequence = sinceSeq;
  for (const value of body.records) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return failure('records memuat baris yang bukan objek.');
    }
    const record = value as Record<string, unknown>;
    const rawSequence = record.serverSeq ?? record.server_seq;
    if (!Number.isSafeInteger(rawSequence)) {
      return failure('setiap event wajib memiliki serverSeq integer aman.');
    }
    const sequence = Number(rawSequence);
    if (sequence <= sinceSeq || sequence > Number(cursor) || sequence <= previousSequence || seenSequences.has(sequence)) {
      return failure('serverSeq event tidak berurutan, duplikat, atau di luar rentang cursor.');
    }
    seenSequences.add(sequence);
    previousSequence = sequence;
    records.push({
      ...record,
      serverSeq: sequence,
      uuid: record.uuid ?? record.queue_id ?? record.id,
      idempotencyKey: record.idempotencyKey ?? record.idempotency_key,
      entityType: record.entityType ?? record.entity_type,
      payload: record.payload && typeof record.payload === 'object' ? record.payload : {},
    });
  }

  return {
    ok: true,
    records,
    lastServerSeq: Number(cursor),
    message: typeof body.message === 'string' ? body.message : `${records.length} event ditarik.`,
  };
}
