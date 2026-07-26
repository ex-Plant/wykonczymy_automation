# Client-facing „Pobierz faktury" in the kosztorys Wydatki tab — Plan Brief

> Full plan: `context/changes/2026-07-25-kosztorys-client-invoices/plan.md`

## What & Why

The client should be able to pull the supplier invoices behind the Wydatki list straight from the
kosztorys share link, without an account. Today bulk invoice download exists only inside the
authenticated transfers table.

## Starting Point

Commit `0675e8d2` already fixed the prerequisite: the Wydatki list renders on `/k/<token>`, both
settled datasets, fed by a shared `fetchMaterialTransactionsForInvestment`. Those rows carry no
invoice data yet, and the existing „Faktury" button is welded to an authenticated server action.

## Desired End State

A „Faktury" button next to the dataset toggle in the Wydatki tab, in the owner's app view and the
client share link alike. It packs the invoices of the **currently visible** dataset into
`faktury-<inwestycja>-<zestaw>-<data>.zip` and says honestly how many of the visible rows actually
had a downloadable invoice.

## Key Decisions Made

| Decision                 | Choice                               | Why                                                                                                 |
| ------------------------ | ------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Auth for the client      | No server action at all              | Media is `read: () => true` on Vercel Blob — URLs are public, and the rows arrive as props          |
| `fetchFilteredTransfers` | Left untouched, stays authenticated  | It takes an unscoped caller-supplied `Where`; exposing it would leak every transfer in the DB       |
| Client scope             | Bulk ZIP only, no per-row preview    | `InvoiceCell` also carries upload and delete — reusing it publicly means decomposing it first       |
| Archive contents         | Follows the active dataset toggle    | What you see is what you download; one download = one dataset                                       |
| Missing invoices         | Report the shortfall explicitly      | A silent partial archive reads as a complete set — the transfers export inherits the better message |
| Code split               | Extract a `useInvoiceZip` hook       | One home for the zip/batch/toast loop instead of two copies that drift on the first fix             |
| Archive naming           | Investment name + dataset + date     | Two investments downloaded the same day would otherwise collide in Downloads                        |
| Testing                  | Unit now, E2E filed to `e2e-backlog` | The pure logic is guarded immediately; the `(share)` group has no browser harness to build on yet   |

## Scope

**In scope:** invoice fields on `MaterialTransactionRowT`; the media join in the shared fetcher; the
`useInvoiceZip` extraction; the button in the Wydatki list; archive-naming and reporting helpers plus
their unit tests; a filed E2E backlog issue.

**Out of scope:** per-row invoice preview; any change to `fetchFilteredTransfers` or the transfers
toolbar's data path; a cross-dataset archive; an E2E spec in this change; any signed-URL or proxy
scheme for blob access.

## Architecture / Approach

`fetchMaterialTransactionsForInvestment` (already shared by the owner page and the client read) gains
the `extractInvoiceIds` + `fetchMediaByIds` join, so both surfaces see the same invoice data. The
zip/batch/toast loop moves out of `InvoiceDownloadButton` into `useInvoiceZip`, leaving two thin
callers: the transfers button fetches rows via its action first, the kosztorys button passes rows
straight from props. Nothing about the download path touches the server.

## Phases at a Glance

| Phase                              | What it delivers                                      | Key risk                                                                    |
| ---------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------- |
| 1. Invoice fields on material rows | `invoiceUrl` / `invoiceFilename` on both entry points | Grows a cached payload; invalidation already covered by the transfers tag   |
| 2. Extract `useInvoiceZip`         | One shared zip loop, two thin buttons                 | Touches a working authenticated export — regression must be caught manually |
| 3. Mount the button + tests        | The client-facing feature, unit-tested helpers        | `investmentName` has to be threaded down two component levels               |

**Prerequisites:** commit `0675e8d2` (landed). A share token against a seeded investment with
materiały invoices, for the manual pass.
**Estimated effort:** ~1 session across 3 phases.

## Open Risks & Assumptions

- **This hands the client supplier invoices** — supplier names, their prices, hence the margin — and
  the settled tab („Materiały wliczone w robociznę") is a margin figure by construction. The owner has
  already ruled that the settled tab shows in every view and that invoices are the point of the
  feature, so the direction is settled; naming it here so nobody rediscovers it as a surprise.
- Blob URLs are public and unguessable but permanent — anyone who obtains a URL keeps access
  regardless of whether the share token is later revoked. Accepted, consistent with the existing
  media access rule; a proxy would be a separate change.
- The `(share)` group has no E2E coverage, so this ships verified by hand only.

## Success Criteria (Summary)

- A logged-out client on `/k/<token>` downloads the invoices for the dataset they are looking at
- Switching datasets changes what the archive contains, and the archive name says which is which
- A dataset with missing invoices reports the shortfall instead of implying a complete set
