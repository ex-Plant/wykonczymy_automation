# Terminologia domeny — Polish→English rename (EX-548) — Plan Brief

> Pełny plan: `context/changes/kosztorys-terminology/plan.md`
> Linear: EX-548

## What & Why

Krok „język" łuku l5: jeden business concept = jeden angielski identyfikator w całej aplikacji.
Argument urgentności właściciela — każdy nowy plik kosztorysu re-typuje drift, więc im później rename,
tym więcej site'ów. Rename jest tani do zrobienia późno (`tsc` łapie każdy site), ale dług rośnie.

## Starting Point

Pomiar na węzłach `Identifier` (uśpiona reguła ESLint wskrzeszona na 26 rdzeniach): **84 identyfikatory
/ 1204 wystąpienia / 103 pliki**, po wyłączeniu sankcjonowanego `kosztorys`. Grep dałby liczbę o ~30%
wyższą — to stringi UI i komentarze, poprawne z polityki. Guard `local/no-domain-drift` leży
zakomentowany w `eslint.config.mjs` z `TODO(EX-548)` na 9 rdzeniach; brakuje mu 12 żywych i globa `e2e/`.

## Desired End State

`pnpm lint` zielony z **aktywnym** guardem na 21 rdzeniach nad `src/` i `e2e/`. Każda figura finansowa
niesie jedną angielską nazwę po obu stronach szwu rekoncyliacji. Glosariusz i destylacja opisują stan
faktyczny kodu.

## Key Decisions Made

| Decyzja                             | Wybór                                                | Dlaczego                                                                                                    | Źródło              |
| ----------------------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------- |
| Sufiks płaszczyzny na `rabatAmount` | Gołe `discountAmount`                                | `SummaryReadingT` **jest** przełącznikiem płaszczyzny; sufiks powieszony wszędzie przestaje ostrzegać       | User (Q5)           |
| Trzy figury pre-rabat               | Jedna nazwa figury + osobna nazwa operacji sumowania | Są równe **tylko** na widoku klienta; jedna nazwa nad obiema stwierdzałaby fałsz na `w_tools`/`no_tools`    | User (Q4) + analiza |
| `saldo` vs `bilans` po angielsku    | `registerBalance*` vs `balance`                      | `balance` już jest nazwą figury inwestycji i kolumną w DB — odwrotny wybór rozjechałby kod ze schematem     | User (Q6)           |
| `remaining` / `dueNet`              | Bez sufiksu                                          | Jednopłaszczyznowe; sufiks rezerwowany na realne zderzenia                                                  | User (Q9)           |
| Rodzina `saldo`                     | W zakresie                                           | Guard da się włączyć z kompletem rdzeni za jednym razem zamiast w dwóch podejściach                         | User                |
| Sekwencja                           | Rodzina na commit, guard ostatni                     | Jeden commit = jedno pojęcie i zielony `tsc`; szew B2 osobno, bo tam zła nazwa kosztuje najwięcej           | User                |
| Faza Q4 osobno od szwu              | Tak, mimo niskiego ryzyka                            | Faza 4 to czysty rename, faza 5 zmienia sygnatury — osobny commit kosztuje nic, daje czysty punkt cofnięcia | User                |

## Scope

**W zakresie:** glosariusz + regeneracja destylacji od zera (bramka 3); rodzina `Robocizna`
w `sheet-import`; `summary-economics` + aliasy SQL + `wydatki`/`materialy`; szew B2; ujednolicenie
figury pre-rabat; rodzina `saldo`; `SectionPieBaseT`; włączenie guarda z 21 rdzeniami i globem `e2e/`.

**Poza zakresem:** Category A (`kosztorys`, `przedmiar`, `pomiar`); wszystkie polskie stringi UI
i transkrybowane nagłówki arkusza; nazwy niosące migrację (`'RABAT'`, `'planowana'`); niezmienniki,
agregat i ACL (trzy osobne slice'y w dół łuku l5); rozłączenie kosztorysu v2 od marży (parked P5).

## Architecture / Approach

Sterownikiem jest zmiana symbolu (tsserver / ts-morph), bramką `pnpm typecheck`. ast-grep i grep
zostają **read/verify** — potwierdzają brak trafień po fakcie, nigdy nie prowadzą przepisania.
Powód jest zmierzony: ~30% trafień tekstowych ma zostać.

## Phases at a Glance

| Faza                         | Co dowozi                                              | Główne ryzyko                                                                    |
| ---------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------- |
| 1. Fundament                 | Glosariusz + destylacja od zera                        | Zero kodu; ryzyko to pominięcie korekty i przepisywanie do kłamiącego autorytetu |
| 2. `sheet-import`            | 11 nazw `Robocizna*`, 8 plików                         | Najniższe — zero persystencji, brak kontaktu ze szwem                            |
| 3. `summary-economics` + SQL | Największa objętość czystego rename'u                  | Aliasy SQL czytane przez specki DB-backed                                        |
| 4. Szew B2                   | 7 nazw płaszczyznowych                                 | Jedyne miejsce, gdzie zła nazwa myli płaszczyzny                                 |
| 5. Q4                        | Ujednolicenie figury pre-rabat                         | **Nie rename** — zmiana sygnatur; ale zero wywołań produkcyjnych, awaria głośna  |
| 6. `saldo`                   | 16 nazw / 144 wystąpienia                              | Objętość, nie semantyka                                                          |
| 7. Resztki + guard           | `SectionPieBaseT`, fixture `etapQty`, włączenie reguły | DoD slice'a                                                                      |

**Prerekwizyty:** brak — zero migracji, zero nowych zależności.
**Szacowany rozmiar:** 7 faz, 6 commitów rename'owych + jeden dokumentacyjny.

## Open Risks & Assumptions

- Faza 5 wprowadza jedyną realną regresję możliwą w tym slice'ie: gdyby ktoś później nakarmił
  `sumSectionSubtotalsNet` liczbą kliencką i oczekiwał odpowiedzi `laborCostsNetPreDiscount`. Obroną
  jest docblock mówiący wprost, czego ta funkcja nie robi.
- Guard działa na węzłach `Identifier`, więc **nie widzi unii stringowych**. `SectionPieBaseT` jest
  łatany ręcznie w fazie 7; kolejna polska unia stringowa wejdzie niezauważona.
- Regeneracja destylacji (bramka 3) to jedyna faza bez automatycznej bramki — jej poprawność
  weryfikuje wyłącznie czytanie.

## Success Criteria (Summary)

- `pnpm lint` zielony z aktywnym `local/no-domain-drift` na 21 rdzeniach, `src/` + `e2e/`.
- `pnpm test:parity` bez zmiany ani jednej złotówki — slice nie zmienia zachowania.
- Wprowadzenie `const rabatFoo = 1` w `src/` wywala lint.
