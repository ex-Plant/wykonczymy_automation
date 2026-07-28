# Brief — cancellation-sum-overcount

Two defects put a wrong number in the same tile („Suma wybranych transakcji"). Both are one line of
lost filter on the way to SQL.

1. **Anulowania are counted** (EX-574). `stripCancelledFilters` throws away the default
   `type: { not_in: ['CANCELLATION'] }`; the stats SQL only re-adds `cancelled IS NOT TRUE`. A
   cancellation stub copies its original's amount, so a cancelled transaction nets **+1× instead of 0**.
   March 2026: 7 192 866,38 zł shown vs 4 202 513,34 zł real. → stop stripping `type`.
2. **The amount filter's ceiling disappears.** `buildTransferFilters` emits `less_than`;
   `buildSqlConditions` has no branch for it and drops it silently. `?amount=500,00` lists 20 rows /
   10 000 zł under a tile summing every transaction ≥ 500 zł. → add the branch, and throw on any
   operator no branch consumed.

Both fixed test-first (failing spec, then the fix), one commit each, in a new bridge spec at
`src/__tests__/lib/queries/transfer-filters.test.ts` that asserts the **emitted SQL** — a `Where`-shape
assertion is what let defect 2 hide.

Third, smaller piece: in `?showCancelled=1` and audit mode the tile still disagrees with the list by
design (the SQL hardcodes `cancelled IS NOT TRUE`). Not changed — that's a product call — but the tile
now says so on screen.

Rejected: EX-574's own option (a), filtering CANCELLATION out of the `reduce` — it would print 0,00 zł
in audit mode, where every listed row is a CANCELLATION.

Blast radius is the tile only: every other money figure routes through `financialBucketOf`, where
`CANCELLATION` already buckets to `none`. The Pulpit is affected too, which EX-574 doesn't say.

Full plan: `plan.md` · repro with live figures: `repro.md`
