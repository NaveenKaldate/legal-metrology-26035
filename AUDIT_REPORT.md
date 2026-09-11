# AUDIT REPORT — SIH 2026 PS 26035 (NAWI Test Report Platform)

**Audited commit:** `9c96b59` "Final Changes Commited" (branch `main`, working tree clean)
**Audit date:** 2026-09-11
**Scope:** full codebase read — app/, components/, lib/, types/, supabase/, config files
**Code changed during audit:** none (this file only)

> **Verification limit — read this first.** No `.env` / `.env.local` exists in the repo (correctly
> gitignored), so I had **no Supabase credentials**. Everything below is derived from the SQL files
> and TypeScript source. I could **not** verify the live database, the deployed RLS policies, or the
> real end-to-end data flow. The deployed schema may have drifted from `supabase/schema.sql`.
> Items that need a live database are marked **[UNVERIFIED — needs DB]**.

---

## Baseline: lint and build

Recorded on a clean clone after `npm install` (390 packages, 0 vulnerabilities).

| Command | Result |
|---|---|
| `npm run lint` | **Passes.** Zero errors, zero warnings. |
| `npm run build` | **Passes.** Next.js 16.3.4 (Turbopack), compiled in ~3.6 s, 13 routes, TypeScript step OK. |
| `npx tsx lib/compliance/__tests__/compliance-engine.test.ts` | Prints `11/11 TESTS PASSED` but **exits with code 1** (see C4). |

There is **no `npm test` script**. Any future change must keep lint and build at zero errors.

---

## A. What is implemented and actually working

| Feature | Files | State |
|---|---|---|
| Supabase auth (login, signup, session) | `app/login/page.tsx`, `app/signup/page.tsx`, `components/auth/*`, `lib/supabase/{client,server}.ts` | Working |
| Route protection | `proxy.ts` (Next 16 renamed middleware → proxy) | Working |
| Auto-profile creation on signup | `supabase/schema.sql:150` trigger `handle_new_user` | Working |
| Instruments: register / list / detail / edit | `app/dashboard/instruments/**`, `components/instruments/*` | Working |
| Instrument input validation | `lib/validations/instrument.ts` | Working (gaps — see C11) |
| 6-step inspection wizard | `components/inspections/inspection-form.tsx` (1650 lines) | Working |
| T01–T06 live deterministic calculation | `lib/compliance/calculation-engine.ts` | Working (defects in C/D) |
| DB-driven rule framework (5 tables) | `supabase/schema.sql`, `supabase/migrations/20260905_phase3b_rules.sql` | Working |
| Rule-set loading | `lib/compliance/rule-engine.ts` | Working |
| MPE lookup by rule set / class / stage / load / e | `lib/compliance/mpe-engine.ts` | Working, **critical defect C1** |
| Test applicability / plan generation | `lib/compliance/{applicability,test-plan}-engine.ts` | Working (hard-coding — D3) |
| Inspection history + search + 2 filters | `components/inspections/inspection-list.tsx` | Working |
| Inspection detail + audit JSON viewer | `components/inspections/inspection-detail.tsx` | Working |
| Report view + print-to-PDF | `app/dashboard/reports/[inspectionId]/page.tsx`, `components/reports/*` | Working (defects C7, C8, C10) |
| Dashboard stats | `app/dashboard/page.tsx`, `components/dashboard/stat-cards.tsx` | Working |

**Confirmed correct:** `inspections.overall_result` (header) and `inspection_tests.result` (per test)
are used consistently and never confused. The dashboard reads `inspections.overall_result`
(`app/dashboard/page.tsx:68-74`). No bug here.

**Also confirmed (contradicts a common assumption):** T01 **already supports FAIL**. The six
checklist items are real interactive checkboxes (`inspection-form.tsx:948-965`); unchecking any one
produces FAIL via `calculateT01` (`calculation-engine.ts:37`). No work needed. Note only that all
six **default to `true`** (`inspection-form.tsx:80-87`), so an untouched T01 auto-passes.

---

## B. What is incomplete

1. **Admin / rule management (Priority 6): absent.** No admin pages. `role` is read for a badge only
   (`components/dashboard/header.tsx:31,48`); **no RBAC is enforced anywhere**.
2. **Attachments (Priority 7): absent.** No Supabase Storage usage, no buckets, no storage policies.
3. **Report integrity (Priority 5): absent.** No DRAFT/FINAL status, no audit log, no report number.
4. **History (Priority 2):** search + result filter + stage filter exist. **Missing:** date-range
   filter, instrument filter, and a direct "view report / download PDF" action per row.
5. **Report (Priority 4):** missing observed values, per-test remarks, applied clause, page numbers,
   and the stored `rule_version`. Also missing the prototype disclaimer (see C10).
6. **Dashboard (Priority 8):** no pending count, no recent list, no trend, no type distribution.
7. **"PDF generation" is browser print.** `components/reports/print-controls.tsx:20` calls
   `window.print()`. There is no PDF library and no real "Download PDF" that emits a file. It works
   for a demo, but describe it accurately.
8. **Dead orchestration layer.** All 353 lines of `lib/compliance/compliance-service.ts`
   (`evaluateInspectionCompliance`, `saveInspectionRecord`, `mapInstrumentToEngineInput`) are
   **imported by nothing** outside its own test. Verified by grep across `app/`, `components/`, `lib/`.

---

## C. Bugs and issues found

### C1 — MPE band overlap makes PASS/FAIL non-deterministic — **CRITICAL**
**Files:** `lib/compliance/mpe-engine.ts:79-86`, `lib/compliance/rule-engine.ts:110-113`

The lookup matches `n >= lower_load_e && n <= upper_load_e`. The seeded bands are `0–500`,
`500–2000`, `2000–10000`. **At exactly 500e, two rules match**, and `.find()` returns whichever row
Postgres returned first. The query has **no `ORDER BY`**, so that order is not guaranteed.

Reproduced locally:
```
load = 5 kg, e = 0.01  ->  n = 500 exactly
   rules in ascending order -> 0.5e  (MPE 0.005)
   rules in reverse order   -> 1.0e  (MPE 0.010)
```
**This lands exactly on the demo case.** The failing demo (5.007 kg, error 0.007) is supposed to FAIL
against 0.005, but under the other row order it **passes** against 0.010. Same ambiguity at 2000e.

Correct reading of the band table is a **half-open** range: `0 ≤ m ≤ 500e`, then `500e < m ≤ 2000e`.
Fix = exclusive lower bound (inclusive only for the `0` band) **plus** a deterministic `ORDER BY`.

### C2 — `PENDING` test result violates the database CHECK constraint — **CRITICAL**
**Files:** `supabase/schema.sql:134`, `types/database.ts:13`, `lib/validations/inspection.ts:3`,
`components/inspections/inspection-form.tsx:464,474`

`inspection_tests.result` allows only `PASS / FAIL / NOT_APPLICABLE`. But the TypeScript `TestResult`
type, the Zod schema, and every engine function also produce **`PENDING`**.

The save inserts the **header first**, then the tests. So any incomplete test — missing `e`,
`AUTOMATIC`/`ZERO_TRACKING` zero config (`calculation-engine.ts:79`), or no applicable MPE rule —
makes the test insert fail with a constraint violation while the header is already committed. Result:
**an inspection row with an overall result and zero test rows**, and the user sees
`"Inspection header saved, but test items failed"`. This is silent data corruption, not just an
error message. There is no transaction and no rollback.

### C3 — Seed data is not idempotent; duplicates MPE rules — **HIGH**
**Files:** `supabase/schema.sql:283`, `supabase/migrations/20260905_phase3b_rules.sql:150`,
`lib/compliance/__tests__/seed-rules.ts:100`

Three separate scripts insert into `mpe_rules`, **all with plain `INSERT`**, no `ON CONFLICT`, and the
table has **no unique constraint**. `schema.sql` says "Phase 1 & Phase 3B" and the migration says "run
if upgrading an existing database" — running both (a natural reading) duplicates every MPE row.
`test_applicability_rules` has the same problem (`schema.sql:243`). Duplicate rows feed directly into
C1 and make the verdict even less predictable. **[UNVERIFIED — needs DB]** to confirm whether the live
table already holds duplicates. This must be checked before anything else is trusted.

### C4 — The engine test suite is false-green — **HIGH**
**File:** `lib/compliance/__tests__/compliance-engine.test.ts:71-83`

It prints `SUMMARY: 11 / 11 TESTS PASSED` and then **exits 1** with an unhandled rejection. `runTest`
is synchronous, so the three async tests (9, 10, 11) hand it a promise it never awaits; they are
counted as passed instantly and their assertions never run. Tests 1 and 2 also sit exactly on the
ambiguous 500e boundary and pass only because the **mock array happens to be in ascending order** —
they would not catch C1 in production.

### C5 — `TYPE_EVALUATION` is a dead end — **MEDIUM**
**Files:** `supabase/schema.sql:80` (CHECK allows it), `inspection-form.tsx` (selectable in Step 1)

**Zero `mpe_rules` rows are seeded for `TYPE_EVALUATION`** — only `INITIAL` and `IN_SERVICE` exist.
Choosing it makes every metrological test return PENDING, which then triggers C2 and the save fails.

### C6 — Regulatory logic duplicated in the UI, and the two copies disagree — **MEDIUM**
**Files:** `inspection-form.tsx:310-319` vs `calculation-engine.ts:609-637`

The form re-implements the overall-result rule instead of calling `calculateOverallResult`. They
differ: when every test is NOT_APPLICABLE, the **UI returns PASS**, the **engine returns PENDING**.
Directly violates "no regulatory logic in UI components".

### C7 — Report display defects — **MEDIUM**
**File:** `components/reports/report-details.tsx:33`, `components/reports/report-tests-table.tsx:60-70`
- `Class {instrument.accuracy_class}` renders **"Class Class III"** (the value already says "Class III").
- Errors and MPE print as **raw unrounded floats** — e.g. `0.0039999999999995595` instead of `0.004`.
- **No Observed-value column**, no reference value, no remarks, no applied clause.

### C8 — "Reproducible historical report" claim is false — **MEDIUM**
**File:** `lib/reports/report-data.ts:44-47`

The comment says joining `rule_sets` "guarantees we are using the EXACT rules used at the time of
inspection". It is a **live join** on `rule_set_id`. Edit a rule set and every past report changes.

What *is* genuinely preserved: `inspections.rule_set_id` + `rule_version` are stored per inspection
(`inspection-form.tsx:395-399`), and the resolved MPE value, `mpe_rule_id` and full audit inputs are
snapshotted into `inspection_tests.mpe` / `.calculation_details`. So the **numbers** reproduce; the
**rule metadata and clause text** do not. Priority 1's reproducibility goal is therefore *partly* met.

### C9 — Debug logging ships to production — **LOW**
`mpe-engine.ts:88-96`, `rule-engine.ts:38-43,116-121`, `calculation-engine.ts:180,263,323`,
`app/dashboard/inspections/new/page.tsx:31,117-124`, `inspection-form.tsx:61,246,338,...`
Dumps full rule sets and user IDs to the console on every calculation.

### C10 — The report overclaims legal status — **LOW (but a rule violation)**
`components/reports/report-header.tsx:9` — "**Official Test Report**";
`report-summary.tsx:57` — "legally binding rule set";
`report-summary.tsx:78` — "Legal Metrology Officer".
This breaks Golden Rule 10. No prototype/demo disclaimer anywhere.

### C11 — Instrument validation gaps — **LOW**
`lib/validations/instrument.ts` checks each field alone but never the **relationships**:
no `min_capacity < max_capacity`, no check of `d` against `e`, no check that `accuracy_class` is one of
the four values the `mpe_rules` CHECK accepts. A free-text class like `"III"` would save fine and then
match no MPE rule at all.

### C12 — No test load range validation — **LOW**
Nothing checks that a test load lies within Min…Max. A 500 kg load on a 30 kg instrument is accepted.

---

## D. Compliance engine review

### D1 — MPE boundary handling
**Broken — see C1.** Overlap (not gap) at every internal band edge: 500e, 2000e, and the class-specific
edges. The database values themselves are **correct and match the expected Class III bands**; the
defect is in the lookup comparison, not the data. No change to rule data is needed.

Also: `mpe-engine.ts` has **no `TYPE_EVALUATION` data** (C5), and the top band for Class I uses
`upper_load_e = NULL` meaning unbounded, which the code handles correctly (`mpe-engine.ts:82-85`).

### D2 — Floating-point arithmetic risks — **real, with reproduced failures**
All arithmetic is raw JS `number`. Two distinct risks:

**(a) Verdict flips at the MPE limit.** R-76 treats an error *equal* to the MPE as acceptable (`≤`).
Float breaks this. Reproduced, with e = 0.01 and MPE = 1.0e:
```
L = 0.03, O = 0.04  ->  |error| = 0.010000000000000002  >  MPE 0.01  ->  WRONGLY FAILS
L = 0.09, O = 0.10  ->  |error| = 0.010000000000000009  >  MPE 0.01  ->  WRONGLY FAILS
```
Decimal-exact, all of these are exactly at the limit and must PASS.

**(b) Band selection.** `load / e` is inexact: `5.01 / 0.01 = 500.99999999999994`, not 501. Harmless
here (still inside `500 < n ≤ 2000`), but it is luck, not correctness.

**Good news for the demo:** I checked every supplied demo number and **float does not change any of
their verdicts** — 0.004 vs 0.005, 0.007 vs 0.005, 0.007 vs 0.010 in-service, the T04 range 0.002, and
the T05 max error 0.004 all evaluate correctly today. The demo will look right; the engine is still
wrong at the limit. This justifies Priority 1's exact-decimal requirement on evidence, not theory.

### D3 — Regulatory logic duplicated or hard-coded
| Location | Issue |
|---|---|
| `calculation-engine.ts:120` | **`0.25 * e` zero-setting limit hard-coded in TypeScript.** Not in any table. |
| `calculation-engine.ts:171,213` etc. | `0.5 * e` changeover constant hard-coded (defensible — it is a method constant, not a tolerance — but should be documented). |
| `applicability-engine.ts:20-33` | **T06 tare applicability hard-coded**, and it `return`s *before* consulting `test_applicability_rules`, so the seeded CONDITIONAL rows are dead data. |
| `inspection-form.tsx:310-319` | Overall-result logic duplicated (C6). |
| `inspection-form.tsx:262-270` | T06 NOT_APPLICABLE branch re-implemented in the component. |
| `calculation_rules` table | Seeded/queried but **never used** by any calculation. The formulas live in code. |

No MPE *values* are hard-coded in React — Golden Rule 5 is respected for MPE specifically. The
`0.25e` zero limit is the one true violation of the spirit of that rule.

### D4 — Does each inspection store the exact rule set used?
**Partly.** `rule_set_id` **and** `rule_version` are both stored on the inspection
(`inspection-form.tsx:395-399`), and per-test `mpe_rule_id` + resolved MPE + full audit JSON are
stored. That is a good foundation. **But** there is no snapshot of the rule *content*, and the report
re-reads it live (C8). Editing or deactivating a rule set changes how old reports *read*, though not
the stored numbers. True reproducibility needs either immutable rule-set versions (never edit, only
supersede) or a snapshot column.

### D5 — Missing-input handling
Better than expected. `getApplicableMPE` returns a structured PENDING with a human reason for: missing
rule set, missing accuracy class, missing/invalid `e`, missing test load, and no applicable rule
(`mpe-engine.ts:15-107`). Each test guards its own inputs.

**The problem is what happens next:** every one of those paths produces `result = 'PENDING'`, which
**cannot be saved** (C2). So good validation is wired to a broken outcome. Also missing: no
load-outside-range check (C12), and the reasons surface only in remarks, not as prominent UI errors.

### D6 — T01–T06 against OIML R-76

I am flagging rather than asserting wherever the exact requirement is not something I can confirm
from the source text. **Do not implement anything marked NEEDS VERIFICATION without checking R-76.**

**T01 Visual & administrative** — 6-item checklist, supports PASS and FAIL correctly.
*Gap:* all items default to checked, so an untouched T01 silently passes. Suggest defaulting to
unset/indeterminate. Clause `8.3.2` — **NEEDS VERIFICATION**.

**T02 Zero-setting** — uses `E_0 = I_0 + 0.5e − ΔL` and a **±0.25e** limit.
The ±0.25e figure is consistent with the commonly cited R-76 requirement that zero-setting accuracy
must not affect the result by more than ±0.25e, but the **exact clause number (4.5.2) is NEEDS
VERIFICATION**, and the value is hard-coded rather than table-driven (D3).
*Bug:* the remark prints `${error} e` (`calculation-engine.ts:151`) but `error` is in kg — **wrong unit
label**. `AUTOMATIC` and `ZERO_TRACKING` configs are accepted in the UI but always return PENDING.

**T03 Errors of indication** — changeover method `P = I + 0.5e − ΔL; E = P − L` is implemented and
matches the formula named in the seeded test definition.
*Gap (largest in the project):* **only ONE load can be tested.** R-76 error-of-indication testing
normally covers multiple loads including Min, Max and the band change points, with increasing and
decreasing (loading/unloading) series. The exact required number and selection of test loads is
**NEEDS VERIFICATION**. This is the single biggest coverage gap versus the problem statement.

**Note on `d` vs `e`:** the demo instrument has `e = 0.01`, `d = 0.001` (d < e). The changeover-point
method with ΔL is the method for instruments where `d = e`. Whether ΔL applies unchanged when `d < e`
(auxiliary indicating device) is **NEEDS VERIFICATION**. The code applies it regardless of `d`; `d`
is stored but never used in any calculation. Flagging, not changing.

**T04 Repeatability** — computes `max − min` and compares against the MPE at that load. The
comparison basis is plausible and matches the seeded description.
*NEEDS VERIFICATION:* the **required number of weighings** (code allows any ≥ 2; UI defaults to 3) and
whether **more than one load** is required, and whether these vary by accuracy class.

**T05 Eccentric loading** — 5 positions (centre + 4 corners), each compared against MPE; UI defaults
the load to **Max/3**, consistent with the ≤4-support-point case. Structure looks right.
*NEEDS VERIFICATION:* the exact rule for >4 support points (the seeded text says 1/4 Max), and whether
position count/layout changes by load-receptor type. `support_count` exists in `EngineInput`
(`types.ts:23`) but is **never used**.

**T06 Tare** — `expectedNet = gross − tare`, error vs MPE looked up at the **net** load. Plausible.
*NEEDS VERIFICATION:* whether R-76 requires MPE at the net value or the gross value for tared
weighing, and whether the tare device itself needs separate accuracy checks.

**Missing tests (present in R-76, absent here) — all NEEDS VERIFICATION for exact procedure:**
- **Discrimination test** — not implemented at all.
- **Tilting / warm-up / temperature / stability-of-equilibrium** — not implemented (may be out of
  scope for a field-inspection prototype; a deliberate scope decision, not necessarily a defect).
- **Standard test weights used** (class, certificate number, validity) — **not recorded anywhere**.
  There is no table, no column, no UI. For a defensible test report this is a notable omission.

---

## E. Database / schema concerns

Current schema is sound in shape: sensible FKs, `ON DELETE CASCADE` where appropriate, 6 useful
indexes, and a correct `SECURITY DEFINER` profile trigger. **No destructive change is needed anywhere.**

Proposed **additive, non-destructive** migrations (for approval — none applied):

| # | Change | Reason |
|---|---|---|
| E1 | `UNIQUE (rule_set_id, accuracy_class, control_stage, lower_load_e)` on `mpe_rules` | Makes seeds idempotent; prevents C3 duplicates |
| E2 | Unique key on `test_applicability_rules` | Same |
| E3 | Add `'PENDING'` to the `inspection_tests.result` CHECK | Resolves C2 — *only if you choose option A below* |
| E4 | `UNIQUE (inspection_id, test_type)` on `inspection_tests` | Prevents duplicate test rows on re-save |
| E5 | Seed `TYPE_EVALUATION` MPE rows **or** remove the option from the UI | Resolves C5 |
| E6 | `WITH CHECK` on the profiles UPDATE policy | Closes the privilege escalation in F2 |
| E7 | Later: `report_status`, `report_number`, audit-log table, attachments table | Priorities 5 and 7 |

Note E1 uses `CREATE UNIQUE INDEX` semantics — if the live table already has duplicates (C3), the
index creation **will fail until duplicates are cleaned**. That cleanup touches existing data and
needs your explicit approval; I will not run it unasked.

---

## F. Security concerns

RLS is enabled on **all nine tables** and no policy uses a dangerous bypass. Good starting point.
However:

**F1 — Every authenticated user can read everything. [UNVERIFIED — needs DB]**
All SELECT policies are `USING (true)` — `profiles`, `instruments`, `inspections`,
`inspection_tests` (`schema.sql:171-231`). Any logged-in user reads **all** inspections and **all**
profiles. Acceptable for a demo; state it deliberately rather than by accident.

**F2 — Privilege escalation via self-service role change — most serious finding**
`schema.sql:176`:
```sql
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);
```
No `WITH CHECK`, no column restriction. **A user can set their own `role` to `ADMIN`.** Harmless today
because `role` controls nothing — but it becomes the hole the moment Priority 6 lands. Fix before, not
after, building admin features.

**F3 — Rule tables are read-only for everyone, including admins.** Only SELECT policies exist; no
INSERT/UPDATE/DELETE policy means all writes are denied. Secure by default, and it means inspectors
genuinely cannot modify rules today. But Priority 6 requires **admin-only write policies** to be
added. Per Golden Rule 7, these must be added as policies, never by disabling RLS.

**F4 — No DELETE policies anywhere.** All deletes silently fail. Probably intended; worth confirming.

**F5 — Write policies are broad.** Any authenticated user can insert/update **any** instrument
(`schema.sql:182-189`). Inspection writes are correctly scoped to `inspector_id = auth.uid()`.

**F6 — Storage:** no buckets, no storage policies (feature absent).

**F7 — Secrets handling is correct.** `.env*` is gitignored; no secret is committed. Note that
`lib/compliance/__tests__/seed-rules.ts:5-19` reads and parses `.env.local` — it does not print
secrets, but it is a test-folder script that writes to the database; keep it out of any build path.

---

## G. Recommended implementation order

This matches your stated priorities with one change: **C2 must be fixed alongside C1**, because
fixing the boundary makes more tests resolve, but any PENDING test still corrupts a save.

| Step | Work | Why first |
|---|---|---|
| **0** | Create branch `hardening/priority-1`; confirm C3 duplicates on the live DB | Rollback safety (Golden Rule 11); C3 invalidates all other verdicts |
| **1** | **Priority 1** — C1 boundary + `ORDER BY`, C2 PENDING decision, exact decimal arithmetic, validation messages, C6 de-duplication, real Vitest suite with the demo + boundary cases (replacing the false-green C4 runner) | Core of the project; everything else rests on it |
| **2** | C3 + C5 + E1/E2/E4/E5 migrations | Makes rule data trustworthy and repeatable |
| **3** | **Priority 2** — date range filter, instrument filter, per-row report/PDF action | Small, visible, low risk |
| **4** | **Priority 4** + C7/C8/C10 — observed values, rounding, clause, page numbers, disclaimer | High demo value |
| **5** | **Priority 3** — T03 multiple loads (biggest real gap), then discrimination test and test-weight recording **after** verifying R-76 | Needs your R-76 confirmation first |
| **6** | **F2 fix**, then **Priority 6** admin + RBAC | Fix escalation *before* roles gain power |
| **7** | Priorities 5, 7, 8, 10 | Polish |
| **8** | C9 logging cleanup | Trivial, do last |

---

## Questions I need answered before Step 1

1. **C2 — how should an incomplete test be saved?**
   **(A)** Persist `PENDING` (migration E3). An inspection can be honestly saved half-finished;
   matches `inspections.overall_result`, which already allows PENDING.
   **(B)** Block the save until every applicable test resolves. No schema change; `PENDING` never
   reaches the database.
   *I lean toward A*, but it changes what a saved inspection means — your call.

2. **Exact-decimal library.** `decimal.js` is ~32 kB and the standard choice. Approve the dependency?
   (Alternative: integer-milligram arithmetic, no dependency, more code.)

3. **Supabase credentials.** Without `.env.local` I cannot verify the live schema, the deployed RLS,
   the C3 duplicate question, or run the required end-to-end flow. If you add it locally I will use it
   read-mostly and never print, commit or modify it.

4. **R-76 source text.** For the NEEDS VERIFICATION items in D6 — especially T03 multiple loads — do
   you have the actual R-76 document? I will not invent these requirements.
