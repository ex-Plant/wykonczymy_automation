---
change_id: investment-lock-on-completed
title: Zakończona inwestycja jest zablokowana — read-only dla wszystkich ról
linear: EX-748
status: preparing
created: 2026-08-28
updated: 2026-08-28
archived_at: null
branch: null
worktree: null
---

## Notes

Status `completed` czyni inwestycję, jej transakcje i kosztorys tylko do odczytu dla **wszystkich**
ról, ADMIN/OWNER włącznie — blokada jest totalna, nie ma roli, która edytuje mimo blokady.

Przejście na `completed` wymaga confirmation dialogu: „inwestycja zostanie zablokowana, tylko do
odczytu" — **bez** wzmianki o możliwości odblokowania.

Jedyne wyjście to jawna zmiana statusu z powrotem na „Aktywna", dostępna wyłącznie dla OWNER/ADMIN,
również za confirmation dialogiem. Nie ma osobnej akcji „Odblokuj" — odblokowanie JEST zmianą statusu.
Powód, dla którego drzwi zostają: nieodwracalna blokada zamienia jedno błędne kliknięcie na
400-pozycyjnym kosztorysie w trwałe zamrożenie, którego jedyną naprawą jest ręczny SQL na produkcyjnym
Neonie.

### Ustalenia z rekonesansu (2026-08-28)

- `status: 'completed'` nie egzekwuje dziś **niczego** — jedyny efekt to `opacity-50`
  (`investment-data-table.tsx:53`) i pozycja w filtrze statusów.
- **Payload `access.update` nie jest punktem kontrolnym**: akcje jadą Local API (`overrideAccess`
  domyślnie `true`), a kosztorys w ~12 miejscach pisze surowym SQL-em (`getDb` + `sql`), co omija też
  hooki kolekcji. Chokepoint musi żyć w warstwie akcji — w kształcie istniejącego `ownerOnlyAction`
  (`lib/actions/owner-only-action.ts`).
- Część akcji kosztorysu dostaje `itemId`/`sectionId`/`stageId`, nie `investmentId`, więc guard
  potrzebuje resolvera; te akcje już robią taki lookup (`kosztorys.ts:526-535`, `704-713`).
- Powierzchnia zapisu: `lib/actions/kosztorys.ts` (~30 akcji), `kosztorys-import.ts`,
  `kosztorys-snapshots.ts` (restore), `kosztorys-share.ts`, `kosztorys-client-view.ts`,
  `sheets-sync.ts`, `lib/actions/transfers.ts` (7), `lib/actions/investments.ts`
  (`updateInvestmentAction`, `linkSheetAction`, `setupSheetAction`).
- **`preview` w edytorze nie nadaje się na „zablokowane"** — to dokument klienta: obcina kolumny,
  filtry, prognozy, toolbar i podmienia layout (`use-kosztorys-editor.ts:469`,
  `kosztorys-editor-body.tsx`). Do reużycia nadaje się `opts.readOnly` w
  `kosztorys-v2-columns.tsx:580` (wyłącza każdą komórkę, zdejmuje kolumnę akcji). Potrzebna osobna
  flaga `locked`, `readOnly: preview || locked`, bez podmiany layoutu.
- `InvestmentRefT` już niesie `status`, więc zakończone inwestycje da się odfiltrować z comboboxa
  wydatku/wpłaty bez nowego zapytania — plus twardy `return { success: false }` w akcji.
