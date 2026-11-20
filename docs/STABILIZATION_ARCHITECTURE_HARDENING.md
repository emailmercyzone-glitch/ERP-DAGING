# ERP DAGING — Stabilization & Architecture Hardening

Status: ACTIVE WORKSTREAM  
Baseline branch: `fix/p0-role-data-isolation`  
Baseline commit: `ddb044a0ce44515bc875631b47220359dcd09db0`  
Working branch: `stabilization/architecture-hardening`  
Base PR: #10 (open; not merged)  
Owner approval gates: no merge to main, no production deployment, no provider selection.

## 1. Objective

Stabilize the existing PWA + Capacitor 8 + TypeScript + IndexedDB architecture without rewriting the application, changing locked business rules, changing the backend/provider decision, or creating a second source of truth.

Priority order (locked for this workstream):
1. **Accounting Reconciliation** — prove journal, cash/bank, AR/AP, inventory valuation, HPP, returns, discounts, and reporting agree across local and remote paths.
2. **Transaction Integrity** — make each business transaction atomic across projections, ledgers, journal, audit trail, and outbox.
3. **Sync & Recovery** — prove idempotent replay, conflict handling, multi-device convergence, backup, and replacement-device recovery.
4. **Gradual Modularization** — extract domain/application/infrastructure boundaries only after the relevant behavior is protected by regression tests.
5. **UI separation** — separate operational screens from accounting/reporting screens while retaining one underlying ledger and shared use cases.
6. Keep build/release evidence aligned with the exact tested commit.

## 2. Confirmed baseline

- Active platform is React 18 + TypeScript + Vite PWA + IndexedDB + Capacitor 8 Android wrapper.
- Flutter rewrite is out of scope.
- Backend remains configurable and vendor-neutral; hosting/provider/domain are not selected.
- Main branch at audit time: `4736f61b91d27e51e1b2fab5c06d78e9a79c7a5f`.
- PR #10 head at audit time: `ddb044a0ce44515bc875631b47220359dcd09db0`.
- PR #10 is Open, not merged, and GitHub reports `draft: false`; existing HANDOVER/PR prose contains stale Draft wording.
- Workflow #1338 passed on the baseline SHA. PR-triggered workflow #1339 completed with `action_required`; this is not equivalent to a green PR check.
- No live backend/OAuth/Drive integration or physical Android/printer/scale acceptance is claimed.

## 3. Initial issue register

These findings require reproduction and targeted tests before changing behavior.

### P0 — Transaction, authorization, and sync integrity

- [x] Sales outbox redaction no longer conflicts with GAS validation: HPP/COGS are optional and are recalculated by receiving devices from local lots.
- [x] Shared `src/domain/sales/saleIntegrity.ts` validates item totals, invoice totals, payment breakdown, weight, and per-product lot allocations. Used by Sales server authorization and remote pull reducer; GAS mirrors the contract.
- [x] Sales RETURN authorization and ownership-index reconstruction now reject event timestamps outside the 24-hour invoice window. **Limitation:** both timestamps originate from the client event envelope; PWA has no trusted hardware clock, so this is server-boundary consistency validation, not tamper-proof proof of real elapsed time. A stronger offline-proof design remains an explicit open risk.
- [ ] PAYMENT protocol does not consistently recognize `PETTY_CASH_TOP_UP` across role policy and GAS validation.
- [x] Remote reducer applies petty-cash top-up and OPEX events to balances, vouchers, journals, and audit trail, with invalid/insufficient funding recorded as conflicts.
- [x] Server role authorization explicitly denies Admin `OPNAME:OPENING_BANK_BALANCE`; Owner remains allowed.
- [ ] Confirm all rejected/invalid remote events have explicit conflict semantics and cannot silently advance past unapplied financial events.

### P0 — Accounting and inventory valuation

- [x] Journal builder now enforces safe-integer, non-negative, one-sided debit/credit lines and equal totals before journal creation. Invalid journals throw before persistence.
- [x] Added a canonical Chart of Accounts for all 17 active account codes; journal builder canonicalizes account labels and rejects unknown codes. Historical persisted labels still need a compatibility normalization/audit pass.
- [x] Local and remote returns now carry returned goods into quarantine at original invoice HPP, reverse the returned COGS, and classify refunds under contra-revenue. Exchange replacement stock posts its HPP. A separate quarantine disposition/write-off workflow remains to be validated.
- [x] Conversion valuation is capped by source carrying cost; output inventory value plus cutting-loss expense now reconciles to the source lot carrying cost. Remote reducers recalculate from receiving-device source HPP.
- [ ] Verify consignment liability and affiliate commission postings against PLAN business rules.
- [ ] Complete full cross-domain reconciliation tests for inventory, COGS, cash, bank, AR, AP, and formal financial reports.

### P1 — Architecture and maintainability

- [ ] Map current Business Engine exports, callers, state mutation boundaries, persistence calls, and event emission before moving code.
- [ ] Establish domain boundaries: sales/pricing, purchasing, inventory, costing, receivables, payables, returns, accounting, and sync.
- [ ] Keep Application/use-case orchestration separate from domain calculations and infrastructure adapters.
- [ ] Move code incrementally with behavior-preserving tests; avoid a big-bang rewrite.
- [ ] UI screens may be separated by operational/accounting purpose, but must read from the same validated source of truth.

### P1 — Offline, backup, and release evidence

- [ ] Test sync push/pull, duplicate retries, partial batches, cursor advancement, conflicts, and replacement-device replay.
- [ ] Test backup manifest/checksum, attachment deduplication, partial upload, retry, and restore rollback.
- [ ] Update HANDOVER and build reports only with commit-specific evidence.
- [ ] Keep live OAuth/Drive/backend and physical hardware verification explicitly pending until real credentials/devices are available.

## 4. Non-negotiable invariants

- A transaction must not persist if its required accounting posting or inventory mutation fails.
- Every persisted journal must have safe integer amounts, non-negative debit/credit lines, and equal total debit and credit.
- A rejected remote event must not be silently treated as successfully applied.
- Outbox ACK must be explicit and idempotent.
- Sales devices must not receive Owner/Admin cost or financial data outside their allowed projection.
- UI must not write journals or ledger entries directly.
- No second accounting database or duplicate source of truth.
- Preserve UUID, integer Rupiah/Gram, append-only ledger, offline-first operation, and existing locked business rules.

## 5. Delivery sequence

1. Reproduce and close the P0 sync/authorization findings with focused tests.
2. Enforce accounting invariants and repair accounting/valuation defects.
3. Add cross-domain reconciliation and full E2E regression coverage.
4. Produce a dependency map for Business Engine and define target module boundaries.
5. Extract modules incrementally without changing behavior.
6. Separate operational and accounting presentation only after domain contracts are stable.
7. Run full CI on one exact commit and record the artifact/evidence.
8. Request Owner review. Do not merge PRs or deploy without explicit approval.

## 6. Working rules

- This branch is based on PR #10 head to preserve the current implementation. It is not a replacement for PR #10 and does not authorize merging either branch.
- Do not modify `main`.
- Do not merge PR #10 or this workstream without explicit Owner approval.
- Do not deploy production.
- Do not choose hosting/provider/domain.
- Do not change PLAN business rules silently. If a code fix exposes a genuine PLAN ambiguity, document the conflict and request a decision rather than inventing a rule.
- Report every change as: what changed, why, evidence/tests, and remaining risks.


## 7. Progress log

### 2026-11-19 — first stabilization patch set

Working branch: `stabilization/architecture-hardening`

Changes committed:
- Restrict `OPNAME:OPENING_BANK_BALANCE` to Owner at the server role boundary; add authorization tests.
- Permit Admin petty-cash top-up events in the sync authorization policy and validate the top-up payload in GAS.
- Apply remote petty-cash top-up and OPEX events in the receiving-device reducer, including cash/bank/petty-cash balances, voucher, journal, audit trail, and conflict handling.
- Add reducer tests for successful replay and insufficient/invalid funding.
- Allow Sales-projected SALE events to omit HPP/COGS fields; receiving devices recalculate cost from their own authoritative lot data.
- Validate Sales invoice arithmetic and per-product lot allocation totals at the Sales sync authorization boundary.
- Enforce the 24-hour return timestamp window in new Sales return authorization and when rebuilding Sales ownership indexes.

Pending verification:
- Run full CI on the current stabilization branch head.
- Verify the new sale-reconciliation validator against every real checkout/payment variant and legacy event shape.
- The 24-hour timestamp rule remains vulnerable to a manipulated client clock; do not represent it as tamper-proof.
- Accounting journal balance enforcement, return accounting, conversion valuation, COA, consignment/affiliate posting, and Business Engine modularization remain open.


### 2026-11-19 — accounting integrity and shared domain extraction

Additional changes on `stabilization/architecture-hardening`:
- Added `src/domain/accounting/chartOfAccounts.ts` with canonical definitions for all 17 account codes. New journals use canonical account labels and unknown codes are rejected.
- Added `src/domain/sales/saleIntegrity.ts`; both Sales server authorization and local remote-event reducer now call the same pure sale payload validator.
- Corrected local and remote sale/void journal postings so revenue, shipping income, and contra-revenue discounts reverse their original accounts.
- Returned stock is valued at original invoice carrying HPP in quarantine; return postings reverse COGS, and exchange postings record replacement COGS.
- Conversion valuation now reconciles source carrying cost to output inventory plus cutting-loss expense. The ledger uses the PLAN movement type `OUT_CUTTING_LOSS`; legacy `OUT_LOSS` remains accepted for old records.
- Added regression tests for journal integrity, canonical COA, return carrying value, conversion cost caps/losses, remote event validation, and local/remote sale reversals.

CI evidence:
- Workflow #1366 completed successfully on the accounting-hardening patch set: [run #1366](https://github.com/emailmercyzone-glitch/ERP-DAGING/actions/runs/44564372377).
- Workflow #1374's Android build was blocked by Maven Central HTTP 429 rate limiting; this is an external dependency-fetch failure, not a compiler error. Earlier and later APK build attempts must be checked independently.
- Latest shared-validator/COA changes are being revalidated by the current branch workflow; do not treat intermediate failed runs as final.

Still open:
- Consignment and affiliate accounting are described in PLAN but dedicated transaction/posting logic was not found in Business Engine. Do not invent their settlement/commission accounting; resolve the exact event and posting contract before implementing.
- Complete financial statements and reconciliation are not yet accounting-grade. Dashboard weekly KPI and 0.5% tax estimate remain indicative only.
- Return 24-hour enforcement remains vulnerable to manipulated client clocks.
- Historical journal label normalization and legacy journal integrity audit remain open.
- Live backend/OAuth/Drive, physical Android/printer/scale acceptance, and production deployment remain unverified.


### 2026-11-19 — first modular extraction and CI confirmation

Extracted from the Business Engine while preserving its existing public import facade:
- `src/domain/sales/saleIntegrity.ts` — shared invoice/payment/lot allocation validator used by server authorization and local pull reducer.
- `src/domain/accounting/chartOfAccounts.ts` — canonical 17-code COA, label normalization, and unknown-code rejection.
- `src/domain/costing/movingAverageHpp.ts` — integer-only moving-average HPP helper.
- `src/domain/shared/localDate.ts` — local date and expiry-day calculations.
- `src/domain/inventory/fefo.ts` — FEFO eligibility, available stock, and lot allocation. Fractional Gram/HPP lots are excluded and fractional allocation requests rejected.

Verification:
- Workflow #1387 passed both PWA/Chromium IndexedDB replacement-device recovery tests and Android debug APK build: [run #1387](https://github.com/emailmercyzone-glitch/ERP-DAGING/actions/runs/44567899017).
- Workflow #1400 passed after the FEFO/date extraction and strict integer checks; both PWA/Chromium and Android debug APK jobs succeeded: [run #1400](https://github.com/emailmercyzone-glitch/ERP-DAGING/actions/runs/44569729489).
- Current working branch head at this checkpoint: `b211b0353e1699c1fe2eb55d47b4d6a1da63a018`.

The engine is not fully modularized yet. Transaction use cases, sync reducers, persistence, and backup remain in `businessEngine.ts`; further extraction is deliberately staged after regression verification.


## 7. Accounting Reconciliation — active work (2026-11-20)

### Confirmed defect and patch
- Local `receiveInboundPurchase` posted additional unloading/clearance cost as a credit to cash account `1101`, but did not reduce `cashInHandRupiah`. This made the cash projection disagree with the journal.
- The local path now rejects fractional/unsafe Gram and Rupiah values, validates PO/landed-cost integer bounds, rejects receipt when the cash balance cannot pay the additional cost, and deducts the exact cost from cash when receipt succeeds.
- The remote PURCHASE reducer now applies the same cash sufficiency rule and deducts the additional cost on successful replay. It recalculates incoming HPP and moving-average HPP from the receiving device's local stock/cost rather than trusting remote HPP fields.
- Regression tests cover local receipt, insufficient cash rollback, fractional inputs, remote replay, remote insufficient-cash conflict, and balanced purchase journal totals.

### Verification
- CI run #1404 passed on the local purchase accounting patch before the new regression tests were added.
- CI run #1407 passed the combined local + remote purchase fix and regression tests: [run #1407](https://github.com/emailmercyzone-glitch/ERP-DAGING/actions/runs/44667194847).
- CI run #1418 passed after lot-account mapping and remote return guard: [run #1418](https://github.com/emailmercyzone-glitch/ERP-DAGING/actions/runs/44668373354).
- CI run #1422 passed opening AR/AP journal reconciliation: [run #1422](https://github.com/emailmercyzone-glitch/ERP-DAGING/actions/runs/44668753029).
- CI run #1425 passed read-only control-account audit: [run #1425](https://github.com/emailmercyzone-glitch/ERP-DAGING/actions/runs/44669035467).
- CI run #1428 is verifying the latest bank-initialization guard and supplier lifecycle test: [run #1428](https://github.com/emailmercyzone-glitch/ERP-DAGING/actions/runs/44669462210).

### Inventory subaccount mapping and postings
- Added `src/domain/accounting/inventoryAccounts.ts` as the shared lot-to-control-account resolver and cost grouper.
- Current persisted lot identity conventions are explicit: quarantine flag → `1304`; `LOT-CUT-` code → `1302`; `PROD_03`, `LOT_03`, or `LOT-TET-` → `1303`; other lots → `1301`. The cut-lot prefix takes precedence over the source product ID.
- Local and remote journal posting now use lot-level account grouping for opening inventory, purchase receipt, sales, voids, trimming source inventory, stock opname, and exchange replacement stock.
- Remote SALE COGS and inventory credits are recalculated from allocations physically applied on the receiving device. A shortage is still recorded as a sync conflict; the transaction is not silently discarded. Local/remote void reversals restore only the stock allocations actually applied on that device.
- Regression tests cover opening inventory grouping, sale/void of steak and tetelan lots, and remote shortage followed by void. Invalid/non-positive seed lots are excluded from opening inventory value rather than becoming invalid journal lines.
- The current mapping uses stable legacy identifiers/prefixes. A future schema-level `inventoryAccountCode` field would be safer than relying indefinitely on naming conventions; do not migrate the persisted lot schema in this pass without a migration test.

### Opening AR/AP and control-account audit
- `createSeededEngineState` now creates one balanced opening journal for valid opening inventory, unpaid customer receivables, and remaining supplier payables. The equity account `3101` is the balancing residual; it is debited when opening liabilities exceed opening assets.
- Opening AR/AP amounts must be safe integer Rupiah values. Invalid opening amounts fail fast rather than silently rounding.
- Added read-only `src/domain/accounting/reconciliation/controlAccounts.ts`. It compares journal balances against cash, verified bank balance, petty cash, open AR, open AP, and lot carrying values by inventory account. It also checks journal balance and unknown account codes; it never mutates or repairs data.
- The audit does not declare bank reconciliation complete until `bankBalanceInitialized === true`. A matching temporary bank projection is not proof that the opening bank balance was verified.
- CI #1422 passed the opening AR/AP journal tests; CI #1425 passed the control-account audit tests: [run #1425](https://github.com/emailmercyzone-glitch/ERP-DAGING/actions/runs/44669035467).

### Confirmed unresolved supplier purchase lifecycle mismatch
- `src/App.tsx` creates a `SupplierInvoice` as soon as a PO is issued. For `paymentTerm === 'CASH'`, it marks the invoice `LUNAS` with paid amount equal to the PO total before any payment journal is created.
- On goods receipt, `receiveInboundPurchase` always credits AP account `2101` for the full PO value, regardless of the invoice's paid status/payment term. It does not create the corresponding cash/bank payment for a CASH PO.
- A regression test now proves the read-only reconciliation audit detects the mismatch: a CASH invoice has AP subledger balance zero, while the receipt journal creates AP credit equal to the PO total.
- The PO form does not capture whether the payment source is Kas Utama or Bank, and its helper copy says payment occurs when the shipment arrives while the term label says payment in advance. Do not guess the source account or change payment timing until this business rule is confirmed.

### Remaining accounting reconciliation gates
- End-to-end test the Opening Balance CSV workflow. The state factory now journals seeded AR/AP, but no complete CSV import/Go-Live workflow has been proven in this workstream.
- Prove inventory control account balance (`1301`–`1304`) against the value of all active and quarantined lots after purchases, FEFO sales, returns, voids, trimming, and stock opname.
- Complete cross-scenario tests using the new control-account audit for cash/bank/petty-cash/AR/AP across local actions and remote replay.
- Complete business acceptance for remote SALE shortages. Current behavior records a conflict, caps physical stock at zero, posts COGS only for the quantity physically applied on that device, and reverses only that applied quantity on void. The missing quantity still requires cross-device/stock-opname reconciliation.
- Supplier PO CASH lifecycle: business timing is now locked (pay after Goods Receipt); implementation moves invoice creation to Goods Receipt and creates the same AP subledger entry on local/remote replay. Regression coverage was added for legacy false-LUNAS correction, actual cash payment, control-account reconciliation, and remote idempotent replay. CI verification is still pending. LC_AT_SIGHT remains separate and is not automated by this decision.
- Consignment and affiliate settlement/posting rules remain unspecified in the Business Engine; do not invent accounting entries until the exact event and settlement rules are approved in the business plan.
- Dashboard weekly profit and 0.5% tax values remain indicative, not a formal P&L or tax report. Formal report acceptance needs a reconciled account mapping and period rules.
- Historical journal integrity audit is read-only and has not yet been run against a real exported business dataset. A green test does not prove existing production data is clean.

No accounting-grade sign-off is claimed at this checkpoint.


### Keputusan supplier PO CASH — 2026-11-20

Owner menetapkan pola UMKM yang proporsional: term CASH dibayar saat Goods Receipt berhasil, bukan saat PO dibuat. PO tidak boleh otomatis melunasi invoice atau membuat pengurangan kas/bank. Saat barang diterima, stok/HPP dan AP dibentuk; AP langsung jatuh tempo untuk term CASH dan pembayaran dicatat melalui workflow AP Payment dengan sumber dana aktual (Kas Utama atau Bank). Transfer wajib melewati guard saldo bank terverifikasi; kas wajib cukup. Pembayaran sebelum penerimaan, bila kelak diperlukan, harus menjadi fitur uang muka supplier terpisah. Term TEMPO_30 tidak berubah; LC_AT_SIGHT belum diubah dan tetap memerlukan pemicu bisnis yang jelas.

Pekerjaan implementasi berikutnya: sinkronkan invoice lifecycle pada PO creation/Goods Receipt, local dan remote reducer, AP Payment, control-account reconciliation, dan regression tests. Jangan menyatakan Accounting Reconciliation selesai sampai seluruh jalur lokal/remote konsisten dan test lulus.


### 2026-11-20 — implementasi PO CASH / Goods Receipt

- PO creation tidak lagi membuat Supplier Invoice atau mengubah status pembayaran. Kontak supplier disimpan pada PO agar tersedia untuk perangkat penerima.
- Goods Receipt membuat Supplier Invoice dan saldo AP. CASH jatuh tempo pada tanggal Goods Receipt; TEMPO_30 jatuh tempo 30 hari setelah Goods Receipt. LC_AT_SIGHT tetap mengikuti dokumen yang berlaku dan belum mendapat otomasi pembayaran.
- Pembayaran tetap melalui AP Payment dengan sumber dana aktual; jurnal pembayaran menjadi bukti pelunasan. Invoice lama yang pernah ditandai LUNAS otomatis tanpa jurnal pembayaran AP dikoreksi menjadi belum dibayar saat Goods Receipt.
- Remote PURCHASE reducer membentuk subledger invoice yang sama, dan event tetap idempotent.
- Regression tests mencakup rekonsiliasi AP sebelum/sesudah pembayaran kas serta penerimaan remote. Belum ada klaim lulus sebelum CI menjalankan test suite pada commit terkini.


**Catatan migrasi historis:** invoice PO yang masih dalam perjalanan tanpa jurnal pembayaran AP tidak lagi dihitung sebagai utang pada normalisasi state. Invoice tersebut dibuat ulang pada Goods Receipt. Jika ditemukan pembayaran pra-penerimaan yang memang memiliki jurnal AP debit, data invoice dan jurnal dipertahankan agar tidak menghapus bukti; saldo AP negatif pra-penerimaan harus ditandai sebagai exception historis dan belum otomatis direklasifikasi menjadi uang muka supplier.
