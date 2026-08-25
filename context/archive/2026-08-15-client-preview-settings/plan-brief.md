# Client preview settings — Plan Brief

> Full plan: `context/changes/2026-08-15-client-preview-settings/plan.md`

## What & Why

The owner needs to decide what a client sees in the kosztorys — which columns, and whether rows with
no przedmiar and no work done show up at all. Today that decision is frozen in code, and the owner's
own column preferences live in their browser, so nothing they tick can reach a client. This change
moves the decision server-side, per investment, with a firm-wide default as the starting point.

## Starting Point

`/k/<token>` and `/podglad-klienta/<id>` mount the same read-only render over the same payload. Its
columns come from a hard allowlist (`PREVIEW_VISIBLE_COLUMNS`) that overrides every reading
preference, and every row condition is cleared under `preview`. Sharing already has its own table and
its own owner-only actions; Payload has no globals yet.

## Desired End State

„Opcje" → „Klient" carries a third item, „Ustawienia podglądu…", opening a dialog with the client's
columns (grouped, tickable) and one checkbox „Ukryj pozycje bez przedmiaru i bez wykonanej pracy (N)".
Changes save on „Zapisz"; a second button stores them as the firm-wide default. „Udostępnij" opens
the same settings as step 1 and reveals the link only after „Dalej". The preview page itself gains
nothing — it stays 1:1 with what the client gets.

## Key Decisions Made

| Decision             | Choice                                                                 | Why                                                                                                                                            |
| -------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Where settings live  | New per-investment collection + a new Payload global for firm defaults | A disclosure decision is not a property of the investment record; the global is the only place a firm-wide default can be one thing            |
| Firm defaults UX     | „Zapisz jako domyślne" from the same dialog                            | The owner sets it once, where they can see what they are setting                                                                               |
| Column list          | Everything the client can currently see                                | Full control with no risk: the allowlist stays a ceiling, the owner can only subtract                                                          |
| Empty rows           | One combined rule (no przedmiar **and** no work), default on           | Such a row adds zero to both figures the client reads, so hiding it moves no total — two separate rules would each be safe for only one figure |
| Where the rule shows | Client settings only, never the „Filtry" menu                          | The menu lists `kind === 'filter'`; the new kind is invisible there by construction                                                            |
| Saving               | Explicit „Zapisz", not autosave                                        | The dialog is also the share flow's step 1 — a stray tick must not change what a client already has                                            |
| Share dialog         | Two steps: settings → link                                             | A link can never leave with unsaved settings behind it                                                                                         |
| Reading the settings | Beside the cached payload, uncached                                    | A save is live next request with no new cache tag, and a defaults change does not invalidate every investment's tree                           |
| Summary panel        | Out of scope                                                           | Different structure, second visibility mechanism, its own change                                                                               |
| Tests                | Unit now, E2E to `e2e-backlog`                                         | The risk sits in the rules, not in the clicking                                                                                                |

## Scope

**In scope:** per-investment column visibility for the client, firm-wide defaults, the combined
empty-row rule, both entrances reading it, the settings dialog and the two-step share flow.

**Out of scope:** the bottom summary panel, per-row hiding (EX-549, cancelled), hiding a section that
has przedmiar, widening the column ceiling, E2E, P13 (Przedmiar vs Pomiar z natury for the client).

## Architecture / Approach

One resolver (investment row → global → code default), read beside the cached tree payload in both
entrances, passed into the existing preview render. There it becomes two things: a hidden-key set
intersected with the existing allowlist, and one engaged row condition. The UI is a single settings
body mounted in two containers — its own menu item, and step 1 of the share dialog.

## Phases at a Glance

| Phase                      | What it delivers                                                              | Key risk                                                               |
| -------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1. Storage and resolution  | Collection, global, hand-written migration, resolver, owner-only save actions | First Payload global in this repo; migration written by hand           |
| 2. Render honours settings | Columns subtract from the ceiling; the empty-row rule applies in preview only | The ceiling must stay a ceiling — a stored key must never add a column |
| 3. Settings dialog         | „Ustawienia podglądu…" in the „Klient" group                                  | Column grouping must cover every allowlisted key                       |
| 4. Two-step share          | Settings step before the link screen                                          | Regressing the existing link flow                                      |
| 5. Tests and close-out     | Four unit specs, E2E backlog issue, docs                                      | —                                                                      |

**Prerequisites:** local DB up (`docker compose up -d`); Linear reachable for the E2E backlog issue.
**Estimated effort:** ~2 sessions.

## Open Risks & Assumptions

- The settings actions are owner/admin-only, mirroring the share actions, since they govern what a
  client is served. Managers reach the preview but do not change it.
- The Payload global brings a new pattern (and its own migration bookkeeping) — the first place this
  plan can surprise.
- Stored keys are validated against the allowlist on read, so a later removal from
  `PREVIEW_VISIBLE_COLUMNS` degrades quietly rather than breaking a saved row.

## Success Criteria (Summary)

- Unticking a column and saving removes it from the client link, with every total unchanged.
- An investment with no settings starts from the firm-wide default; a firm-wide default that was
  never set starts from the code default.
- „Widok klienta" and the token link render identically.
