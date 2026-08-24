# Nadmiarowe odczyty na trasach kosztorysu — Plan Brief

> Pełny plan: `context/changes/2026-08-19-kosztorys-page-fetch-dedup/plan.md`
> Linear: EX-720 · branch: `liner_issues_fixing`

## What & Why

Zlecenie brzmiało „usuń nadmiarowe odczyty", ale przesłanka pod nim — że liczba round-tripów kosztuje
— została obalona przez własny zapis EX-597. Odczyty na `kosztorys_v2` już lecą równolegle, więc
usunięcie jednego kupuje ~0 ms. Zostaje to, co zostaje po odjęciu wydajności: **jeden realny defekt**
(wyścig auth, który wysyła `EMPLOYEE` na stronę błędu zamiast na logowanie), **dwa miejsca w kształcie
EX-680** (suma i lista, z których jest liczona, przyjeżdżają z dwóch niezależnych zapytań) oraz trzy
komentarze, które już wygenerowały złe decyzje w dwóch slice'ach. Nic w tej zmianie nie jest
uzasadniane milisekundami.

## Starting Point

`kosztorys_v2/page.tsx` rozpala dziewięć równoległych promisów. W jednym `Promise.all` siedzą dwa
sprzeczne tryby porażki auth: `getKosztorysTree` **rzuca** (`kosztorys.ts:18`), a
`requireInvestmentOr404` **przekierowuje** (`investments.ts:63`). Kto pierwszy, ten sprawia — a
`treePromise` jest tworzony wcześniej i ma mniej roboty przed porażką. Do tego
`requireInvestmentOr404` płaci `findByID` za samą nazwę inwestycji, którą strona i tak ma w
`refData.investments` (linia 80), a jego własny docstring tego użycia zabrania.
`fetchPayoutsByWorkerForInvestment` to `GROUP BY` po dokładnie tych samych wierszach, które oddaje
`fetchPayoutTransactionsForInvestment` — dwa osobne wpisy `unstable_cache`.
`SummaryExpensesTab` dostaje agregat materiałów i wiersze materiałów z dwóch różnych zapytań i pozwala
agregatowi bramkować bloki, które renderują wiersze.

## Desired End State

Sesja bez roli zarządczej wchodząca na `/inwestycje/<id>/kosztorys_v2` **zawsze** ląduje na
`/zaloguj`. Strona robi siedem odczytów zamiast dziewięciu i żadnej figury nie czyta dwa razy z dwóch
wpisów cache. Σ per pracownik i lista wypłat pod nią to te same wiersze. Zakładka wydatków nie może
już napisać „Brak wydatków" nad zapełnioną listą. Legacy `/kosztorys` odpala swoje dwa odczyty
równolegle. Żaden komentarz w ruszanych plikach nie twierdzi czegoś, co zapis już unieważnił, a
`lessons.md` niesie regułę, że unieważniony pomiar trzeba dogonić w komentarzach.

## Key Decisions Made

| Decyzja                         | Wybór                                                               | Dlaczego                                                                                                                           | Źródło   |
| ------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Uzasadnienie całej zmiany       | Poprawność i kształt kodu, nigdy latencja                           | EX-597 zmierzyło, że równoległe odczyty sumują się do najwolniejszego, nie do sumy — stara przesłanka jest martwa                  | Research |
| Kolejność faz                   | Wyścig auth pierwszy, sam, test-first                               | To jedyny realny defekt, a usunięcie `requireInvestmentOr404` rozstrzyga wyścig w złą stronę — punkty 3 i 4 są nierozłączne        | Plan     |
| Bramka auth                     | Nowy `requireManagementPage()`, awaitowany **przed** fan-outem      | Wpięcie w `Promise.all` to dokładnie to, co zrobił `3fc35958` i dlaczego wyścig był niewidoczny; `requireAuth` to `cache()`d JWT   | Plan     |
| Zasięg nowej bramki             | Tylko `kosztorys_v2`                                                | Wzorzec powtarza się na pięciu stronach, ale zamiatanie ich przy okazji to osobna oferta, nie doklejka                             | User     |
| Materiały: skąd figury          | Zakładka bramkuje się własnymi wierszami; agregat zostaje dla marży | `deriveFinancials` produkuje całe `InvestmentFinancialsT`, więc agregatu nie da się usunąć — recepta EX-680 nie przenosi się 1:1   | User     |
| Materiały: `materialsBreakdown` | Zostaje na agregacie                                                | Figura per kategoria zasila trzy powierzchnie; przepisanie jej to własny slice                                                     | User     |
| Warstwa testu na auth           | Vitest na wyodrębnionej bramce, bez E2E                             | Nie ma fixture'a `EMPLOYEE` w `e2e/helpers.ts`; spec pinuje regułę (redirect, nie throw), nie trasę — żadne `e2e-backlog` nie wisi | User     |
| Trasa share                     | `(share)/podglad-inwestora` nietknięta                              | Niesie całą bramkę auth przez `requireInvestmentOr404` — to nie jest ten sam przypadek                                             | User     |
| `fetchExpenseCategories`        | Zostawiamy                                                          | Fetcher jest współdzielony z nieuwierzytelnioną trasą `/k/[token]`; granica PII jest żywa, nie zwietrzała                          | Research |
| Lekcja                          | Wpis do `lessons.md`                                                | `lessons.md:733` mówi „nie czytaj zwietrzałego dokumentu jak fundamentu"; brakuje drugiej połowy — dogoń komentarze przy zamykaniu | User     |

## Scope

**W zakresie:** bramka `requireManagementPage` + jej spec; `kosztorys_v2` bierze nazwę i istnienie z
`refData`; `payoutsByWorker` znika z kontraktu edytora, Σ liczy się z wierszy w
`SubcontractorSummary`; kasacja `fetchPayoutsByWorkerForInvestment` i
`sumPayoutsByWorkerForInvestment`; bramki `SummaryExpensesTab` na własnych wierszach; `Promise.all`
na legacy `/kosztorys`; trzy komentarze; wpis do `lessons.md`.

**Poza zakresem:** `fetchExpenseCategories` vs `refData.expenseCategories`; siedem martwych
zagnieżdżonych `unstable_cache` na ścieżce share; `materialsBreakdown` z wierszy; trasa share;
pozostałe cztery strony powtarzające wzorzec bramki auth.

## Architecture / Approach

Cztery commity, jeden na fazę. Faza 1 idzie pierwsza i sama, bo jest defektem. Fazy 2–4 są niezależne
od siebie i od kolejności Fazy 1. Bramka auth to `await` przed pierwszym promisem, nie kolejny element
`Promise.all` — `requireAuth` nie robi round-tripu do bazy, więc szeregowanie jej nic nie kosztuje, a
`getKosztorysTree` odczyta ją z tego samego cache'u requestu. Wyprowadzenie Σ wypłat ląduje w
`SubcontractorSummary`, bo blok **już** dostaje `payoutTransactions` i `workers` — nie trzeba żadnego
nowego propa, wystarczy usunąć stary.

## Phases at a Glance

| Faza                                    | Co dowozi                                              | Główne ryzyko                                                                          |
| --------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| 1. Bramka auth na `kosztorys_v2`        | Deterministyczny redirect + koniec zbędnego `findByID` | Spec pinuje regułę, nie trasę — RSC-owego zachowania nie dowodzi                       |
| 2. `payoutsByWorker` precz              | Σ i lista wypłat z jednych wierszy                     | Kubełek `workerId: null` musi przeżyć grupowanie jako własny wiersz                    |
| 3. Zakładka wydatków z własnych wierszy | Koniec „Brak wydatków" nad zapełnioną listą            | Widok klienta już odcina settled dwoma drogami — bramka musi to odtworzyć, nie zmienić |
| 4. Szeregowa para + komentarze          | `Promise.all` na legacy, trzy komentarze, lekcja       | żadne                                                                                  |

**Prerekwizyty:** przed Fazą 3 `db-test` musi mieć dane (`pnpm db:import:test`, potem
`pnpm seed:kosztorys:test`) — dump z prod nie niesie kosztorysu, a próg zbioru w `test:parity` na tym
pada.
**Szacowany rozmiar:** jedna sesja, 4 fazy. Bez migracji, bez zmian schematu, bez długu na prod.

## Open Risks & Assumptions

- Spec na bramkę dowodzi reguły (redirect, nie throw), nie tego, co widzi przeglądarka na prawdziwej
  trasie RSC. Dowód browser-level wymagałby fixture'a `EMPLOYEE`, którego świadomie nie dokładamy.
- Faza 3 zostawia jeden szew: `materialsBreakdown` i wykres nadal jadą z agregatu, choć tabela i lista
  obok liczą się z wierszy. Jeśli te dwie płaszczyzny się rozjadą, zobaczymy to jako niezgodność
  „Razem", nie jako pustą tabelę.
- Zakładamy, że `PayoutByWorkerT` przeżywa kasację swojego jedynego producenta — jest bazą
  `SubcontractorPayoutRowT`, którą Faza 2 nadal produkuje.

## Success Criteria (Summary)

- `EMPLOYEE` na `/inwestycje/<id>/kosztorys_v2` ląduje na `/zaloguj`, nie na `error.tsx`.
- `grep -rn "payoutsByWorker\|PayoutsByWorkerForInvestment" src` nie zwraca nic.
- Zakładka wydatków nigdy nie pokazuje komunikatu o braku wydatków nad niepustym blokiem.
- `pnpm test:parity` zielony po Fazie 3; `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
  zielone po Fazie 4.
