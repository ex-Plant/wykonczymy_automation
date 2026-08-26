---
change_id: sheet-write-env-guard
title: Zapisy do Google Sheets tylko z produkcji — localhost nadpisywał żywy arkusz klienta
status: implementing
created: 2026-08-26
updated: 2026-08-26
archived_at: null
branch: null
worktree: null
---

## Notes

zapisy do Google Sheets tylko z produkcji; localhost i preview nadpisywały wiersze w żywym arkuszu klienta

Dowód (2026-08-26): transakcje 4536/4537 `INVESTMENT_EXPENSE` na inwestycji 42 istnieją wyłącznie
w lokalnej bazie (docker 5433, lokalne `max(id)`=4537; dump przywrócony 2026-08-20 kończył się na
4534), a mimo to wyszły do arkusza. Kosztorys inwestycji 42 to `kosztoryses.id=8` →
`google_sheet_id = 13dx8IMs…`, czyli prawdziwy arkusz klienta — lokalna baza jest przywróconym
zrzutem produkcji, więc niesie **produkcyjne** id arkuszy.

Mechanizm: `src/hooks/transfers/sync-sheet.ts` (`afterChange`/`afterDelete` na `transactions`)
odpala `syncSingleTransferToSheet` po każdym zapisie, z każdego środowiska. W całej ścieżce
`src/lib/google/*` i `src/lib/actions/sheets-sync.ts` **nie ma ani jednego strażnika `VERCEL_ENV`**
(zweryfikowane grepem). Jedyne miejsca w repo, które w ogóle pilnują środowiska, to strażnik tokenu
Blob (`src/lib/env/schema.ts`, `src/payload.config.ts:43`) i plakietka `env-badge.tsx`.

Zaostrzenie: sekwencje id rozjechały się po przywróceniu dumpa 2026-08-20, więc lokalne id trafia
na **inny** wiersz produkcyjny o tym samym id, a upsert w arkuszu kluczuje po id — czyli nie tylko
dopisuje śmieci, ale **nadpisuje** cudze wiersze.

Zakres do rozstrzygnięcia w planie:

1. Twardy strażnik na szwie **zapisu** w `src/lib/google/sheets.ts` (nie w hooku — hook to jedna
   z wielu ścieżek): zapis tylko przy `VERCEL_ENV === 'production'`, chyba że jawnie ustawiono
   arkusz-piaskownicę. Odczyty zostają otwarte (iframe, podgląd, `scripts/inspect-sheet.mjs`).
2. Zdjęcie celu — post-restore SQL w `db:import` / `db:import:test` czyszczący
   `kosztoryses.google_sheet_id`, żeby baza testowa nie miała do czego pisać.

(1) to stop krwawienia i podstawa; (2) usuwa cel, ale samo w sobie nie wystarcza.

Regression test jest wymagany: hook/szew nie strzela poza produkcją.

**Brama manualna `staging → main` jest zamrożona** na sekcjach dotykających arkuszy
(`sheet-live-compare`, `kosztorys-importer`, `import-etapy-z-arkusza`, `sheet-column-mapping`,
`EX-686`, `sheet-measured-qty-from-formula`) do czasu wejścia strażnika —
`context/changes/staging-to-main-gate/ledger.md`.

Do posprzątania po fixie: wiersze, które localhost zdążył wpisać/nadpisać w arkuszu
„Bialostocka 5/152 Wojtek - ekipa hulko".

**Korekta po researchu (2026-08-26).** 4536/4537 **nie dotarły** do arkusza inwestycji 42 —
sprawdzono wszystkie trzy zakładki. Punkt odtworzenia lokalnej bazy to ~id 4479 (2026-08-12/13),
nie 4534. Wyciek jest jednak potwierdzony innymi wierszami: 36 obcych wierszy na 8 produkcyjnych
arkuszach, z czego 4507 (localhost) oraz 4586 i 4598 (preview) przypisane do dzisiejszego stanu baz.
Destrukcji nie było, ale 36 to **dolna granica**: „Zresetuj wydatki inwestycyjne" czyści zakładkę
i odbudowuje ją z bazy, która kliknęła — arkusz 42 przeszedł taki reset z produkcji 2026-08-20, więc
nieobecność wiersza niczego nie dowodzi. Właściwy wektor to reset+sync z bazy nieprodukcyjnej, który
wyciera całą zakładkę klienta. Pełne ustalenia: `research.md`.
