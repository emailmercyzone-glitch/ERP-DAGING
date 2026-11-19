# ERP DAGING — Stabilization & Architecture Hardening

Status: ACTIVE WORKSTREAM  
Baseline branch: `fix/p0-role-data-isolation`  
Baseline commit: `ddb044a0ce44515bc875631b47220359dcd09db0`  
Working branch: `stabilization/architecture-hardening`  
Base PR: #10 (open; not merged)  
Owner approval gates: no merge to main, no production deployment, no provider selection.

## 1. Objective

Stabilize the existing PWA + Capacitor 8 + TypeScript + IndexedDB architecture without rewriting the application, changing locked business rules, changing the backend/provider decision, or creating a second source of truth.

Priority order:
1. Transaction integrity and authorization across local engine, server gateway, GAS adapter, and remote reducers.
2. Accounting and inventory valuation integrity.
3. Offline sync, replay, idempotency, backup, and recovery integrity.
4. Modularize Business Engine by domain after behavior is protected by tests.
5. Separate operational UI from accounting/reporting UI while keeping one underlying ledger and data source.
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
- Workflow #1400 is validating the subsequent FEFO/date extraction and strict integer checks; do not mark it complete until its final conclusion is successful.
- Current working branch head at this checkpoint: `b211b0353e1699c1fe2eb55d47b4d6a1da63a018`.

The engine is not fully modularized yet. Transaction use cases, sync reducers, persistence, and backup remain in `businessEngine.ts`; further extraction is deliberately staged after regression verification.
