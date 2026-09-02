---
change_id: snapshot-retention-thinning
title: Thin kosztorys snapshots by age instead of deleting them
status: archived
created: 2026-09-02
updated: 2026-09-02
archived_at: 2026-09-02T11:27:19Z
branch: snapshot-retention-thinning
worktree: null
---

## Notes

Przerzedzanie zamiast kasowania: pełna gęstość 30 dni (usuwamy cap AUTO_KEEP), 1/dzień do 120 dni,
1/tydzień do 365 dni; manual bez zmian 365. Auto i manual kończą się w tym samym miejscu — 365 dni.

Ustalenia z rozmowy (2026-09-02):

- Dzisiaj: `AUTO_KEEP = 50` (inline cap przy każdym insercie) + `AUTO_MAX_AGE_DAYS = 7`,
  `MANUAL_MAX_AGE_DAYS = 365`, GC w dziennym cronie `/api/cron/cleanup` (3:00 UTC).
- Argument miejsca nie broni obecnej retencji. Zmierzone na lokalnej bazie: jsonb payload
  ~380-pozycyjnego kosztorysu to ~140 KB tekstem i **~23 KB** po kompresji TOAST; 1000-pozycyjny
  perf-seed to ~416 KB / **~31 KB**. Cały dzisiejszy sufit (50 × 23 KB) to ~1,2 MB na inwestycję.
- Reprezentantem koszyka jest **najnowszy** snapshot (stan na koniec dnia/tygodnia), nie najstarszy.
- Doba/tydzień liczone w `Europe/Warsaw`, nie UTC — inaczej edycja po północy wpada w poprzedni
  koszyk UTC.
- Przemiatanie jest bezstanowe i idempotentne: cron co noc przypisuje każdy wiersz do pasma wg wieku
  i zostawia jednego reprezentanta na koszyk. Raz przerzedzona doba nie ma już czego tracić.
- Dni bez edycji nie produkują wpisów — historia jest zdarzeniowa, nie kalendarzowa.
- Lista snapshotów (czytelność UI) nie jest zmartwieniem właściciela — nie projektujemy pod nią.
- Realny wolumen będzie znacznie niższy niż górne oszacowania: nikt nie edytuje arkusza całymi dniami.

Do sprawdzenia w researchu (nie rozstrzygnięte):

- `assertReadableSchemaVersion` / `SNAPSHOT_SCHEMA_VERSION` — przy retencji rocznej realne staje się
  trzymanie wierszy, których dzisiejszy kod nie odczyta. Czy roczna historia jest prawdziwa, czy
  pozorna? Co robimy ze starą wersją schematu (migracja payloadu vs oznaczenie jako nieodtwarzalne).

## Zakres ustalony po researchu (2026-09-02)

1. **Przerzedzanie w `gcSnapshots`** — pełna gęstość 30 dni, 1/dobę do 120 dni, 1/tydzień do 365 dni.
   Reprezentant koszyka = **najnowszy** (stan na koniec dnia/tygodnia). Koszyki po `Europe/Warsaw`
   (`date_trunc(... AT TIME ZONE 'Europe/Warsaw')` — pierwszy taki w repo, całe dotychczasowe
   bucketowanie dat siedzi w JS, `src/lib/fleet/days.ts`; komentarz przy zapytaniu ma to odnotować).
   Sweep zostaje **bezstanowy i idempotentny** — liczba ocalałych wierszy w koszyku JEST stanem,
   dlatego pominięty przebieg crona jest nieszkodliwy.
2. **`AUTO_KEEP` i `pruneAutoCount` znikają.** Pełna gęstość przez 30 dni zastępuje cap ilościowy;
   `capture-auto-snapshot.ts` traci wywołanie. `MANUAL_MAX_AGE_DAYS` bez zmian (365) — auto i manual
   kończą się w tym samym miejscu.
3. **`?? <default>` na surowych bindach `NOT NULL`** w `insert-rows.ts` / `insert-kosztorys-tree.ts`.
   Dziś brakujący klucz w starym payloadzie binduje `NULL`, a jawny NULL nie bierze DEFAULT-a → 23502.
   To jedyne realne zagrożenie dla rocznej historii (reguła wersjonowania go nie łapie, bo „additive
   NOT NULL" to nie „non-additive").
4. **Reguła bumpu — do `snapshot-format.ts` + `lessons.md`:** bump `SNAPSHOT_SCHEMA_VERSION` jest
   niekompletny bez **decyzji**, co ze starymi wierszami. Trzy wyjścia: **nie bumpuj** (zmiana
   addytywna albo dotyczy klucza, którego mapper nie czyta — dotąd zawsze to, pięć dropów bez bumpa i
   bez awarii), **przenieś** (presety — ręcznie kurowana biblioteka, kasowanie to strata pracy),
   **skasuj** (snapshoty — ambientowa historia, tania do odtworzenia). Zakazane: zbumpować i zostawić.
   Skutkiem jest inwariant: **każdy wiersz w `kosztorys_snapshots` jest czytelny przez bieżący kod** —
   więc `listSnapshots` NIE dostaje filtra po `schema_version`, a `assertReadableSchemaVersion`
   w `getSnapshot` zostaje pasem bezpieczeństwa na sytuację, która nie powinna zajść.
   Wartość nieodczytywalnego snapshotu jest zerowa — to nie historia, tylko wiersz, który kłamie na
   liście.
5. **Zdanie w dialogu przywracania** o tym, że wraca zakres prac, a rabat globalny / `settlementMode`
   / `materialsNetRate` pozostają dzisiejsze. Bez zmiany logiki — to poprawne zachowanie (snapshot
   celowo nie zamraża rabatu, `snapshot-format.ts:32-34`), ale przy roku różnica prawie na pewno jest
   niezerowa, więc „przywróć wersję" przestaje znaczyć to, co brzmi.

## Doprecyzowanie (2026-09-02)

Wszystko, co dziś leży w `kosztorys_snapshots` i w bibliotece presetów, to **dane testowe** —
właściciel uznaje je za jednorazowe. Żaden krok tej zmiany nie jest im nic winien: bez backfillu, bez
dumpa przed przemiataniem, a wyczyszczenie którejkolwiek z tych tabel jest dopuszczalnym ruchem
naprawczym w dowolnym środowisku. To **nie** rozmiękcza fazy 2 ani 3 — obie patrzą w przód. Dzisiejsze
wiersze są jednorazowe właśnie dlatego, że nikt jeszcze nie zapisał payloadu, którego by żałował;
sensem zmiany jest to, że od wdrożenia zacznie.

Poza zakresem (odnotowane, nie robimy): paginacja/wirtualizacja drawera wersji — właściciel nie
uznaje listy za problem, choć zdjęcie capu zdejmuje jedyne ograniczenie liczby wierszy wewnątrz okna
30 dni.
