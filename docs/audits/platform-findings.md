# Platform Findings Ledger

Cross-cutting patterns surfaced during module audits. Entries here are hypotheses or confirmed patterns that affect 2+ modules.

**Promotion rule**: a finding only lives here if it's a *pattern* (likely to recur). Local findings stay in the module report. Rules confirmed in 2+ modules graduate to `best-practices.md`.

---

## Ledger

| ID | Source module | Dimension | Pattern / check | Modules affected | Fix location | Status |
|----|---------------|-----------|-----------------|------------------|--------------|--------|
| _no findings yet_ | | | | | | |

---

## How to add an entry

1. After a module sign-off, review its findings.
2. For each finding ask: "Would I expect this in other Atlas modules?"
3. If yes → copy it here with a grep pattern or repro rule precise enough that another auditor can find it mechanically.
4. Retro-scan every already-audited module for the pattern; append confirmed hits to the "Modules affected" column.

## Status values

- `hypothesis` — found in 1 module, not yet confirmed elsewhere.
- `pattern` — confirmed in 2+ modules.
- `rule` — confirmed in 3+ modules; belongs in `best-practices.md` (and eventually `CLAUDE.md`).
- `fixed-centrally` — a shared component/hook/middleware now enforces the rule; retro-fix tasks tracked per-module.
