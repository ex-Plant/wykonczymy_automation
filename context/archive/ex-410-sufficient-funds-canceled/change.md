---
change_id: ex-410-sufficient-funds-canceled
title: EX-410 — restore the AUXILIARY-register sufficient-funds guard (CANCELED, premise false)
status: archived
created: 2026-07-08
updated: 2026-08-08
---

## Notes

**Canceled, never implemented.** A DDD distillation exercise picked "an AUXILIARY register must not go
negative" as the most core ∧ least-enforced invariant, on the evidence that its guard survived only as
a commented-out block in `src/lib/actions/transfers.ts` plus a `// TODO re-add` stub — zero layers
enforcing it. A full guardian design was written against that premise.

**The premise was false.** Git confirmed the guard was dropped in `76dd757` and had flip-flopped four
times: registers are **allowed** to go negative, by a deliberate client decision. EX-410 was canceled
and the 267-line plan (`02-invariant-aggregate-refactor.md`) deleted 2026-08-08 — `git log --follow`
still reaches it.

Current truth: `context/domain/01-domain-distillation.md` (§C and the intentional-non-targets list).
The generalisation is in `context/foundation/lessons.md` — "a commented-out guard is a candidate
finding, not a dropped invariant".

### The one design observation worth keeping

Had it been real, a classic load-mutate-save aggregate would **not** have fit: register balance is not
a stored column, it is `SUM(CASE …)` computed on read (`sum-transfers.ts`), and migration
`20260222_drop_materialized_columns.ts` dropped the materialized column deliberately. The guardian
would have had to be one pure precondition function consulting the read model, enforced at a single
choke point — and that choke point is the **`beforeValidate` hook, not the server action**: the old
action-level check never covered writes through the Payload admin panel or the REST/Local API. That
asymmetry is still true of every other action-level guard in this repo.
