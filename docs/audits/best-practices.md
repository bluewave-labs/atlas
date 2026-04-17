# Atlas Best Practices (Audit-Derived)

Rules that have been **confirmed across 2+ modules** during the audit process. These are candidates for promotion to `CLAUDE.md`.

A rule lives here when:
- It was surfaced as a pattern in `platform-findings.md`.
- The same finding was confirmed in at least 2 modules.
- A concrete check (grep pattern / code review rule) exists.

---

## Rules

_No rules yet. Rules are added here after 2+ confirmed module hits on a pattern._

---

## Template

```
### {Rule title}

**Why**: {the observed bug this prevents — cite module findings}
**How to check**: {grep pattern / code review step}
**How to apply**: {the correct pattern, with a code snippet}
**Confirmed in**: {module list}
**Promoted to CLAUDE.md**: {date or "no"}
```
