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

- [ ] Sales outbox redaction removes HPP/COGS fields while GAS SALE validation currently requires them. Align the event contract without exposing sensitive cost data to Sales devices.
- [ ] Sales server projection accepts SALE payloads without fully reconciling item totals, invoice total, payment breakdown, total weight, and lot allocations.
- [ ] Sales RETURN validation does not enforce the 24-hour return window at the server boundary. Determine a defensible time-authority rule that remains compatible with offline operation; do not trust arbitrary client clocks as authoritative.
- [ ] PAYMENT protocol does not consistently recognize `PETTY_CASH_TOP_UP` across role policy and GAS validation.
- [ ] Remote reducer does not consistently apply `PETTY_CASH_OPEX` / petty-cash events before advancing the sync cursor.
- [ ] Admin authorization currently allows generic OPNAME events; `OPENING_BANK_BALANCE` must remain Owner-only.
- [ ] Confirm all rejected/invalid remote events have explicit conflict semantics and cannot silently advance past unapplied financial events.

### P0 — Accounting and inventory valuation

- [ ] Journal builder records `isBalanced` but does not enforce balance before transaction persistence.
- [ ] Standardize account-code semantics; prevent one account code from representing different meanings.
- [ ] Correct local and remote return/refund/exchange postings, including quarantine inventory carrying value, COGS reversal, and write-off treatment.
- [ ] Correct conversion valuation so source carrying cost reconciles to output inventory value plus explicitly recognized loss/write-off.
- [ ] Verify consignment liability and affiliate commission postings against PLAN business rules.
- [ ] Add reconciliation tests for inventory, COGS, cash, bank, AR, AP, journal, and financial reports.

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
