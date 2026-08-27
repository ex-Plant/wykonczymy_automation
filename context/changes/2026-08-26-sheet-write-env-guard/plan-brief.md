# Bramka środowiskowa na zapisie do Google Sheets — brief

> Pełny plan: `context/changes/2026-08-26-sheet-write-env-guard/plan.md`
> Research: `context/changes/2026-08-26-sheet-write-env-guard/research.md`

> **⚠️ Ten brief zamrożono w momencie zatwierdzenia planu i NIE opisuje stanu wdrożonego.**
> Opisany tu projekt — predykat `sheetWriteRefusal` na `VERCEL_ENV` + lista
> `GOOGLE_SHEETS_WRITE_ALLOWLIST` — został w trakcie **porzucony i skasowany**: ta maszyna trzyma
> sekrety produkcji, więc żadne sprawdzenie środowiska nie odróżni produkcji od developera, który
> ustawił zmienne. Wdrożono bramkę w **poświadczeniu**: poza produkcją aplikacja niesie konto
> z prawem wyłącznie do odczytu, więc odmawia Google. Aktualny opis i uzasadnienie:
> `plan.md` → „Porzucona ścieżka". Poniższe zostaje jako zapis tego, co zatwierdzono.

## Co i po co

Localhost, preview i baza E2E pisały do żywych arkuszy klientów — w ośmiu arkuszach wylądowało
36 obcych wierszy. Przyczyna nie jest błędem w logice arkuszowej: identyfikator arkusza pochodzi
z bazy, każda baza nieprodukcyjna to zrzut produkcji, a na całej ścieżce zapisu nie ma ani jednego
sprawdzenia środowiska. Zmiana wstawia to sprawdzenie w jedynym miejscu, którego nie da się ominąć.

## Punkt wyjścia

Siedem wywołań zapisujących wisi pod dwiema fabrykami klienta z zakresem `spreadsheets`
(`sheets.ts:42-45`, `sheet-access.ts:32-33`). Wyzwalaczem jest hook kolekcji na `transactions`, więc
łapie formularz, `/admin`, REST i każdy skrypt — bramka warstwę wyżej byłaby do obejścia. Zapis jest
odroczony przez `after()` i połykany przez `catch`, więc nie zostawia śladu w UI. Cztery odczyty
dzielą fabrykę z zapisami.

## Stan docelowy

Klient zapisowy powstaje tylko przy `VERCEL_ENV === 'production'` albo dla arkusza z jawnej listy
`GOOGLE_SHEETS_WRITE_ALLOWLIST`. Poza tym funkcja rzuca przed pierwszym wywołaniem Google API.
Odczyty — podgląd, import kosztorysu, porównanie z arkuszem — działają wszędzie bez zmian. Naprawa
arkusza klienta odbywa się z produkcji i nie ma innej drogi.

## Kluczowe decyzje

| Decyzja             | Wybór                                  | Dlaczego                                                                                                                                               | Źródło   |
| ------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| Gdzie szew          | fabryka klienta zapisowego             | jedyny sposób zdobycia tokenu z prawem zapisu; hooki i akcje mają kilkanaście wejść, część nieenumerowalnych                                           | Research |
| Klucz środowiska    | `VERCEL_ENV`, nigdy `NODE_ENV`         | lokalny `next build` ustawia `NODE_ENV=production` i wyłączyłby strażnika na maszynie, którą ma chronić                                                | Research |
| Kształt furtki      | lista identyfikatorów arkuszy          | flaga `0/1` zostanie włączona w `.env` i tam zostanie; lista wiąże zgodę z tożsamością zasobu, jak `blobTokenRefusal` z id store'a                     | Rozmowa  |
| Wiązanie baza↔zasób | nie robimy                             | jedyny groźny kierunek odcina samo `VERCEL_ENV`; host Neona jest rotowany, więc zaszycie go zamieniłoby hipotetyczną ochronę na pewną awarię produkcji | Plan     |
| Odczyty             | na `getReadonlySheetsClient()`         | warunek konieczny, nie kosmetyka — bez tego bramka zamyka lokalnie czytanie arkuszy                                                                    | Research |
| Sonda uprawnień     | degraduje się do odczytu               | inaczej lokalne podpięcie arkusza mówiłoby „udostępnij arkusz koncie usługowemu", co jest nieprawdą                                                    | Plan     |
| Zakres              | tylko Sheets                           | tu udowodniono szkodę u klienta, a powierzchnia jest zamknięta w dwóch liniach                                                                         | Rozmowa  |
| Miejsce predykatu   | `src/lib/google/`, nie `env/schema.ts` | `blobTokenRefusal` siedzi w schema.ts przez wymuszenie grafu Payloada; ścieżka arkuszy tego ograniczenia nie ma                                        | Plan     |

## Zakres

**W zakresie:** predykat odmowy + zmienna env; bramka na fabryce klienta zapisowego; przeniesienie
czterech odczytów na klienta `readonly`; degradacja sondy uprawnień; test regresyjny na obserwowalnym
efekcie; aktualizacja `AGENTS.md`; odmrożenie sześciu sekcji bramy `staging → main`.

**Poza zakresem:** poczta, OpenRouter, Meta, crony; zerowanie `google_sheet_id` po restore; naprawa
`e2e/helpers.ts:46`; sprzątanie czterech pozostałych brudnych arkuszy; wyjątek dla resetu.

## Podejście

Predykat (`sheetWriteRefusal`) jako czysta funkcja obok szwu → `getClient()` przyjmuje
`spreadsheetId`, sprawdza predykat, rzuca przy odmowie → odczyty schodzą na klienta `readonly`.
Wszystkie cztery wywołania fabryki mają już `spreadsheetId` w zasięgu, więc przewleczenie jest
darmowe. Żaden skrypt w repo nie pisze do arkuszy, więc powierzchnia jest domknięta.

## Fazy

| Faza                            | Co daje                                   | Główne ryzyko                                                                   |
| ------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------- |
| 1. Predykat + zmienna env       | reguła i jej test, zero wpięcia           | brak — nie zmienia zachowania                                                   |
| 2. Szew + odczyty na readonly   | bramka działa; czytanie zostaje otwarte   | przeoczony odczyt na kliencie zapisowym zamyka lokalnie jakąś ścieżkę arkuszową |
| 3. Dokumentacja + odmrożenie QA | reguła zapisana; sekcje bramy odblokowane | brak                                                                            |

**Warunki wstępne:** brak — czterech pozostałych brudnych arkuszy nie sprzątamy, a i tak nie
blokują.
**Szacowany rozmiar:** jedna sesja, trzy fazy, ~6 plików źródłowych + 5 plików testowych.

## Ryzyka i założenia

- **Istniejące spece arkuszowe przestaną przechodzić, dopóki nie dostaną swoich identyfikatorów na
  listę dozwolonych** — to zamierzone: po zmianie mają przechodzić _dlatego, że furtka działa_.
  Kuszący skrót (`VERCEL_ENV='production'` w setupie testów) wyłączyłby bramkę w testach i przykrył
  dokładnie tę regresję, którą plan zakłada.
- `pnpm test:e2e` nie ustawia `VERCEL_ENV`, więc po zmianie zapisy z E2E są odmawiane, a `catch`
  w `sheets-sync` je połyka. Spece nie zmieniają zachowania — i to domyka ryzyko naprawy literówki
  w `e2e/helpers.ts:46`.
- Bramka nie wykryje produkcyjnego deploymentu wskazanego na nieprodukcyjną bazę. Świadomie
  odpuszczone (patrz tabela decyzji).
- Liczba historycznych epizodów wycieku pozostaje nie do odtworzenia — reset kasuje dowody. Bramka
  zatrzymuje przyszłe, nie odtwarza przeszłych.

## Kryteria sukcesu

- Dodanie wydatku lokalnie na inwestycji z podpiętym arkuszem nie zmienia arkusza, a w logu jest
  odmowa z jego identyfikatorem
- Odczyty arkuszy działają lokalnie bez zmian; z własnym arkuszem testowym na liście działa też zapis
- Test regresyjny dowodzi, że przy odmowie **żadne** wywołanie Google API nie zostało wykonane
