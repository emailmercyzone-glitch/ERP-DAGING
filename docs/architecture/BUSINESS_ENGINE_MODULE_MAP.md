# ERP DAGING — Business Engine Module Map

Status: TARGET ARCHITECTURE / EXTRACTION PLAN  
Baseline: `src/engine/businessEngine.ts` on `stabilization/architecture-hardening`  
Rule: preserve public imports and behavior while extracting; do not rewrite the engine in one pass.

## 1. Current-state observation

The current `businessEngine.ts` exposes 56 functions and mixes:
- pure calculations and domain policies;
- transaction use cases and journal posting;
- IndexedDB/localStorage persistence and migration;
- sync outbox and remote event reducers;
- backup/restore;
- reporting selectors.

This is a responsibility-boundary problem, not evidence that the entire engine should be replaced. Keep the current TypeScript engine and extract modules incrementally.

## 2. Target boundaries

```text
src/
├── domain/
│   ├── shared/             # Rupiah/Gram integer rules, IDs, time, validation
│   ├── pricing/             # tier, promo, price priority
│   ├── inventory/           # FEFO, lot eligibility, stock movement rules
│   ├── costing/             # HPP, yield, lot carrying value
│   └── accounting/
│       ├── chart-of-accounts.ts
│       ├── journal-integrity.ts
│       ├── posting-rules/
│       └── reconciliation/
├── application/
│   ├── use-cases/
│   │   ├── sales/
│   │   ├── purchasing/
│   │   ├── inventory/
│   │   ├── returns/
│   │   ├── receivables/
│   │   ├── payables/
│   │   └── cash-management/
│   ├── sync/                # event contracts, push ACK, pull reducers
│   └── reporting/           # read-only selectors from validated ledgers
├── infrastructure/
│   ├── persistence/         # IndexedDB, localStorage migration
│   ├── adapters/            # backend-neutral sync adapters
│   └── backup/              # export, validation, restore
├── presentation/
│   ├── operations/          # POS, sales, stock, purchasing, customers
│   └── accounting/          # journal, ledger, AR/AP, P&L, balance sheet
└── engine/                  # temporary compatibility facade / stable exports
```

## 3. Existing function ownership map

| Current function(s) | Target owner |
|---|---|
| `generateUUID`, `computeIntegrityHash`, `nowIso`, `formatTimeId` | `domain/shared` |
| `validateSalePayload` | `domain/sales/saleIntegrity.ts` (extracted; shared by server and pull reducer) |\n| `getChartAccount`, `canonicalizeJournalLines`, `CHART_OF_ACCOUNTS` | `domain/accounting/chartOfAccounts.ts` (extracted; canonical labels and codes) |\n| `validateJournalLinesIntegrity`, `auditIntegerLedgerIntegrity` | `domain/accounting` |
| `calculateMovingAverageHppPerKg` | `domain/costing` |
| `computeDaysLeftFromExpiry`, `isLotExpired`, `isLotEligibleForSale`, `getProductAvailableStockGram`, `allocateLotsFEFO` | `domain/inventory` |
| `getBazarPromoRemainingGram`, `isBazarPromoEligible`, `normalizePricingTier`, `calculateProductTierPrice` | `domain/pricing` |
| `createSeededEngineState`, `normalizePersistedState` | `infrastructure/persistence` / state factory |
| `loadEngineState`, `hydrateEngineStateFromIdb`, `subscribePersistenceErrors`, `runWithoutEngineAutoPersistence`, `setEnginePersistenceAdapterForTests`, `persistEngineState` | `infrastructure/persistence` |
| `resetPinAttemptGuard`, `checkPinAttemptGuard`, `recordPinAttemptOutcome`, `verifyOwnerPin`, `updateOwnerPin` | `domain/security` |
| `addProductWithOpeningLot`, `addProductCategory`, `deleteProductCategory`, `addSupplierRecord`, `updateMasterData`, `updateSupplierPhoneRecord` | `application/use-cases/master-data` |
| `toggleBazarPromo`, `createBazarPromo` | `application/use-cases/pricing` |
| `commitSaleTransaction`, `voidSaleTransaction` | `application/use-cases/sales` |
| `receiveInboundPurchase`, `recordSupplierPayablePayment` | `application/use-cases/purchasing` / `payables` |
| `executeTrimmingConversion`, `executeStockOpname` | `application/use-cases/inventory` |
| `executeCustomerReturn` | `application/use-cases/returns` |
| `recordCustomerReceivablePayment`, `revertCustomerReceivablePayment` | `application/use-cases/receivables` |
| `setOpeningBankBalance`, `recordPettyCashTopUp`, `recordPettyCashOpex` | `application/use-cases/cash-management` |
| `resolveApprovalRequest` | `application/use-cases/approvals` |
| `applyOutboxSyncResults`, `applyPulledSyncRecords` | `application/sync` |
| `assessBackupRestoreSafety`, `exportEngineBackupJson`, `parseAndValidateBackupJson` | `infrastructure/backup` |
| `selectOperationalSummary` | `application/reporting` |

## 4. Dependency rules

1. Domain modules are pure TypeScript wherever possible. They do not import React, IndexedDB, browser storage, network clients, or provider SDKs.
2. Application use cases orchestrate domain rules and return explicit success/conflict/error results. They do not access browser storage directly.
3. Infrastructure implements persistence, backend adapters, media, and backup contracts. It does not redefine pricing, HPP, authorization, or accounting policy.
4. Presentation calls use cases and read-only selectors. It never writes journal entries, stock ledger rows, or payment balances directly.
5. Accounting posting rules consume validated business facts. They do not become a second transaction database.
6. Sync reducers call the same domain rules/posting functions as local use cases. Local and remote events must produce equivalent state and journal effects.
7. `businessEngine.ts` remains a compatibility facade during extraction; existing import paths are not changed all at once.

## 5. UI separation

Operational screens and accounting screens should be separate navigation/workflow areas, but not separate data stores.

- Operational UI: POS, sales, customers, stock, lots, purchasing, supplier payments, returns, petty cash.
- Accounting UI: automatic journals, account ledger, trial balance, AR/AP aging, P&L, balance sheet, cash-flow report, reconciliation and audit trail.
- Owner/Admin/Sales access is enforced by application selectors and server projections, not by hiding controls alone.
- Sales users never receive HPP/COGS, bank balances, Owner-only balances, or other Sales users' data.
- Financial reports must be derived from one validated journal/stock/payment source. Dashboard estimates must be clearly labeled as estimates.

## 6. Extraction order

1. Freeze behavior with focused tests and accounting/data invariants.
2. Extract pure shared money/ID/time and journal integrity helpers.
3. Extract pricing and FEFO/inventory calculations.
4. Centralize Chart of Accounts and posting rules.
5. Extract use cases one domain at a time, keeping facade exports stable.
6. Extract sync reducers and ensure local/remote parity.
7. Extract persistence and backup adapters.
8. Split operational/accounting presentation after data contracts are stable.
9. Remove compatibility wrappers only after all imports and regression tests are migrated.

## 7. Explicit non-goals

- No rewrite to Flutter or another framework.
- No microservices.
- No second database or separate accounting store.
- No provider/hosting selection.
- No change to business scope, roles, device limit, offline-first behavior, or locked PLAN rules.
- No mass file move before the transaction and accounting tests pass.


## 8. Extraction progress (2026-11-19)

- [x] Shared Sales payload integrity extracted to `src/domain/sales/saleIntegrity.ts`.
- [x] Canonical Chart of Accounts extracted to `src/domain/accounting/chartOfAccounts.ts`.
- [ ] Extract remaining pure pricing/FEFO/costing helpers.
- [ ] Extract transaction use cases from `businessEngine.ts`.
- [ ] Extract sync reducers, persistence, and backup in separate steps.
- [ ] Split operational and accounting presentation after source contracts and reports are reconciled.
