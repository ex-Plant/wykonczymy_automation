# Blokada zakończonej inwestycji — Plan Brief

> Pełny plan: `context/changes/2026-08-28-investment-lock-on-completed/plan.md`
> Rekonesans: `context/changes/2026-08-28-investment-lock-on-completed/research.md`
> Rozstrzygnięcia: `context/changes/2026-08-28-investment-lock-on-completed/change.md` (sekcja „Rozstrzygnięcia")

## What & Why

Status `completed` ma przestać być etykietą i stać się zamkiem: na zakończonej inwestycji nic nie
rusza kasy — ani transakcje, ani kosztorys — dla **wszystkich** ról zarządczych. Cel jest wąski
i nazwany wprost przez właściciela: odciąć księgowanie po rozliczeniu, **nie** zamrozić kartoteki.
Inwestycja jest zakończona dopiero po rozliczeniu, wypłat włącznie, więc każda transakcja
zaksięgowana po zamknięciu jest sygnałem, że zamknięto za wcześnie.

## Starting Point

`completed` nie egzekwuje dziś niczego — cały efekt to `opacity-50` na wierszu listy i pozycja
w filtrze. W kopii produkcyjnej **69 inwestycji** ma ten status (przy 41 `active`), a **co najmniej
84 transakcje** zaksięgowano już po zakończeniu (41 × `PAYOUT`, 22 × `INVESTMENT_EXPENSE`, najnowsza
2026-08-12). Semantyka jest więc wolna do wzięcia, ale ścieżka, którą blokada zamyka, jest realnie
używana.

## Desired End State

Na zakończonej inwestycji nie powstaje ani nie zmienia się żadna transakcja (poza podpięciem skanu
faktury) i nie zmienia się nic w kosztorysie — z edytora, z `/admin` ani przez API. Edytor renderuje
się w **całości**, tylko bez możliwości pisania, z banerem tłumaczącym dlaczego. Inwestycja znika
z pickera wydatku i wpłaty. Dane kontaktowe dalej edytuje każdy. Wyjście ze statusu `completed`
wykonuje wyłącznie OWNER/ADMIN.

## Key Decisions Made

| Decyzja              | Wybór                                                     | Dlaczego                                                                                                             | Źródło             |
| -------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ------------------ |
| Dzień wdrożenia      | Wszystkie 69 od razu, bez migracji                        | Fala próśb o odblokowanie JEST listą przedwcześnie zamkniętych inwestycji                                            | Rozstrzygnięcia #1 |
| Zakres blokady       | Tylko transakcje + kosztorys; rekord inwestycji wolny     | „Celem jest zablokowanie lecenia w chuja na kasie, nie zmiany emaila"                                                | Rozstrzygnięcia #6 |
| Zamek                | Wyjście z `completed` tylko OWNER/ADMIN, w hooku kolekcji | Bez tego MANAGER odblokuje, zaksięguje i zablokuje z powrotem; `/admin` byłby drugim obejściem                       | Rozstrzygnięcia #6 |
| Ślad audytowy        | Brak                                                      | Krąg podejrzanych to właściciel i admin — ślad nie odpowiada na żadne pytanie. Wraca, gdy wyjście dostanie inna rola | Rozstrzygnięcia #2 |
| Faktury              | Otwarte                                                   | Archiwizacja, nie zmiana figury; blokowanie zmuszałoby do odblokowania dla samego PDF-a                              | Rozstrzygnięcia #3 |
| Bramka kosztorysu    | Wrapper `investmentAction`                                | Zawężenie strukturalne — nowa akcja nie może zapomnieć warunku (wzorzec `ownerOnlyAction`)                           | Plan               |
| Bramka transakcji    | Hook `validateTransfer`                                   | Transakcje nie mają ścieżki surowego SQL-a, więc hook widzi każdy zapis, `/admin` włącznie                           | Rekonesans         |
| Kasowanie inwestycji | Bramki nie dodajemy                                       | `preventDeleteWithTransactions` już blokuje wszędzie, gdzie jest co chronić                                          | Rozstrzygnięcia #8 |
| Edytor „zablokowany" | `readOnly = preview \|\| locked`                          | `preview` to dokument klienta (układ + ujawnianie), nie „bez edycji" — warstwa kolumn już te pojęcia rozdziela       | Rekonesans         |

## Scope

**W zakresie:** ~28 mutujących akcji kosztorysu · `access` czterech kolekcji kosztorysu (`/admin`) ·
hook walidacyjny transakcji · bramka wyjścia ze statusu · picker inwestycji w formularzu wydatku
i wpłaty · read-only edytora + baner · menu akcji w tabeli transakcji · dialog potwierdzenia przy
zamknięciu.

**Poza zakresem:** rekord inwestycji (osiem pól kartoteki) · ślad audytowy zmiany statusu ·
kasowanie inwestycji · lista dozwolonych przejść statusu · migracja danych · akcje czytające ·
link kliencki i ustawienia widoku klienta · `savePresetAction` · faktury · **EX-749** (audyt
powierzchni nadużyć managera).

## Architecture / Approach

Trzy bramki serwerowe, każda dobrana do profilu zapisu swojej płaszczyzny, plus warstwa UI, która
jest uprzejmością a nie bramką:

```
kosztorys   → wrapper investmentAction (bo ~12 miejsc pisze surowym SQL-em, omijając hooki)
              + access kolekcji, które domyka /admin
transakcje  → hook validateTransfer (bo transakcje piszą WYŁĄCZNIE przez Payload)
              + polski komunikat w akcjach
status      → hook beforeChange na investments (bo /admin też przestawia status)
UI          → rozszczepienie preview na readOnly (interakcja) i previewVisible (ujawnianie)
```

Fundamentem obu bramek serwerowych jest `isInvestmentLocked` plus resolver `investment_id`
z `itemId` / `sectionId` / `stageId` — możliwy, bo każda tabela kosztorysu niesie `investment_id`
jako `not null` z indeksem.

## Phases at a Glance

| Faza                 | Co dostarcza                                               | Główne ryzyko                                                                                   |
| -------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| 1. Fundament bramki  | `isInvestmentLocked`, resolver, wrapper `investmentAction` | Zgubienie `revalidate` przy kopiowaniu z `ownerOnlyAction` — cicho zabije cache w ~28 miejscach |
| 2. Kosztorys         | ~28 akcji na wrapperze + `access` czterech kolekcji        | Duży mechaniczny diff; łatwo pomylić akcję czytającą z piszącą                                  |
| 3. Transakcje        | Bramka w hooku + komunikaty + picker                       | Kolejność względem dwóch wczesnych `return` — pomyłka przepuszcza anulowanie                    |
| 4. Status jako zamek | Hook `beforeChange` + dialog potwierdzenia                 | Zbyt szeroka reguła zamurowuje jedyne wyjście                                                   |
| 5. UI read-only      | Rozszczepienie `preview`, baner, menu akcji                | Regresja widoku klienta — `preview` steruje też układem i ujawnianiem                           |

**Prerequisites:** brak — bez migracji schematu, bez zależności od EX-749.
**Szacunek:** ~2-3 sesje; faza 2 jest największa i mechaniczna, faza 3 najbardziej podchwytliwa.

## Open Risks & Assumptions

- **Pierwsze tygodnie to fala odblokowań.** Właściciel przyjął to świadomie jako sygnał, nie koszt.
  MANAGER nie odblokuje, więc każda spóźniona wypłata jest przerwaniem dla właściciela.
- **`createBulkTransferAction` zapłaci N odczytów** przy N wierszach w partii. Jeśli zaboli, jedna
  inwestycja na partię pozwala sprawdzić raz przed pętlą — ale bramką zostaje hook, bo tylko on
  widzi `/admin`.
- **Faza 5 dotyka `preview`**, który steruje układem, filtrowaniem kolumn i wygaszaniem prognoz.
  Regresja uderzyłaby w widok klienta — dlatego rozszczepienie, a nie trzecia flaga obok istniejących.
- **E2E jest należne** (ryzyko wielograniczne: formularz → akcja → hook → baza). Autorowane przy
  bramce review albo odłożone jako issue `e2e-backlog`.

## Success Criteria (Summary)

- Zakończona inwestycja odmawia każdego zapisu ruszającego kasę — z aplikacji, z `/admin` i przez
  API — dla każdej roli, z czytelnym polskim komunikatem.
- Podpięcie faktury i edycja danych kontaktowych dalej działają dla każdej roli zarządczej.
- Tylko OWNER/ADMIN wyprowadza inwestycję ze statusu „Zakończona", i wtedy edytor wraca do pełnej
  edycji.
