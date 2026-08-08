---
change_id: kosztorys-client-invoices
title: Client-facing „Pobierz faktury" in the kosztorys Wydatki tab
status: archived
linear: EX-569
created: 2026-07-25
updated: 2026-07-26
archived_at: 2026-07-26T14:43:01Z
branch: feat/ex-569-kosztorys-client-invoices
worktree: .claude/worktrees/kosztorys-client-invoices
---

## Notes

Client-facing „Pobierz faktury" in the kosztorys Podsumowanie → Wydatki tab (both settled tabs), on
top of the just-landed wydatki-list visibility fix.

### Already landed (prerequisite, commit `0675e8d2`)

The Wydatki list was absent entirely on the client share path — `buildClientKosztorysEditorData`
never supplied `materialTransactions`, and `MaterialsTransactionsTable` force-hid the settled toggle
under `clientView`. Fixed: shared `fetchMaterialTransactionsForInvestment` in
`lib/queries/reference-data.ts` feeds both the owner page and the client read, both settled states
show in every view, and `materialTransactions` is now a required prop. `getRowHref` stays gated on
`clientView` (it points into the app).

### The remaining work

- No server action. Media is `read: () => true` on Vercel Blob, so invoice URLs are already public
  and the browser-side `fetch` → JSZip loop needs no session. Rows arrive as props.
- **`fetchFilteredTransfers` must not be exposed.** It takes a caller-supplied `Where` with no
  investment scoping, so dropping its `requireAuth` would hand anyone the whole transfers table.
- `MaterialTransactionRowT` gains `invoiceUrl` / `invoiceFilename`, joined via the existing
  `fetchMediaByIds` + `extractInvoiceIds` (at `depth: 0` `doc.invoice` is a raw id).
- The zip/batch/toast loop in `components/transfers/invoice-download-button.tsx` splits out to take
  rows; the transfers toolbar keeps its `where`+action variant. `buildUniqueFilename` /
  `triggerDownload` / `pluralizeInvoice` reuse unchanged.
- Button sits next to the dataset `ToggleGroup` and follows the active tab. Archive name should
  carry the investment name, not the generic `faktury-<date>.zip`.

### Open question the owner has to answer

This puts supplier invoices — supplier names, their prices, hence the margin — in the client's hands,
and the settled tab („Materiały wliczone w robociznę") is a margin figure by construction. The owner
already accepted „full tree, no projection" for the kosztorys itself (`client-kosztorys.ts:18`) and
has now ruled that the settled tab shows in every view, so the direction is consistent — but
invoices go further than numbers. Confirm before shipping.

### Resolved before shipping (owner)

Invoices in the client's hands is the point of the feature, so the margin exposure is accepted and
intended, not an oversight. One caveat recorded with it: **Blob URLs are public, unguessable and
permanent** — whoever obtains one keeps access even after the share token is revoked. Consistent with
the existing `read: () => true` media rule; closing it would mean a proxy or signed URLs, a separate
decision.

`plan.md` / `plan-brief.md` deleted at the archive audit (2026-08-08); `git log --follow` reaches
them. One claim in them has since gone stale: the „media has no cache tag / no revalidation hook"
gap is closed — `CACHE_TAGS.media` exists and `collections/media.ts` runs
`makeRevalidateAfterChange('media')`.
