import 'package:drift/drift.dart';

/// ============================================================================
/// OFFLINE-FIRST SYNC ENGINE & OUTBOX PATTERN (Rule 4)
/// Table: sync_outbox
/// 
/// Strict Specifications:
/// 1. Stores mutated records destined for cloud synchronization.
/// 2. Payload schema MUST store full mutated state in JSON text format.
/// 3. Status column MUST accept strict enum string values: 'PENDING', 'SYNCED', 'FAILED'.
/// ============================================================================
@DataClassName('SyncOutboxEntry')
class SyncOutboxTable extends Table {
  @override
  String get tableName => 'sync_outbox';

  TextColumn get id => text()(); // UUID v4 (Outbox Entry ID)

  // Target table name in Supabase cloud (e.g. transactions, stock_ledger, customers)
  TextColumn get targetTable => text()();

  // Primary key of mutated entity
  TextColumn get recordId => text()();

  // Mutation operation type: INSERT, UPDATE, DELETE
  TextColumn get mutationType => text().withLength(min: 3, max: 20)();

  // Payload schema: Full mutated state in JSON text format
  TextColumn get payload => text()();

  // Status column: Strict enum string values: 'PENDING', 'SYNCED', 'FAILED'
  TextColumn get status => text().withDefault(const Constant('PENDING'))();

  // Official server sequence after Supabase ACK handshake
  IntColumn get serverSeq => integer().nullable()();

  // Retry count & error tracking
  IntColumn get retryCount => integer().withDefault(const Constant(0))();
  TextColumn get lastError => text().nullable()();

  DateTimeColumn get createdAt => dateTime().withDefault(currentDateAndTime)();
  DateTimeColumn get syncedAt => dateTime().nullable()();

  @override
  Set<Column> get primaryKey => {id};
}

/// Strict enum for Outbox Status values
enum SyncOutboxStatus {
  pending('PENDING'),
  synced('SYNCED'),
  failed('FAILED');

  final String value;
  const SyncOutboxStatus(this.value);

  static bool isValid(String val) =>
      val == 'PENDING' || val == 'SYNCED' || val == 'FAILED';
}
