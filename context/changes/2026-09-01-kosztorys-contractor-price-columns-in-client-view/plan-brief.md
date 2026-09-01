# Kolumny ceny wykonawcy (oba plany) w widoku Inwestora — brief

> Pełny plan: `context/changes/2026-09-01-kosztorys-contractor-price-columns-in-client-view/plan.md`
> Research: `context/changes/2026-09-01-kosztorys-contractor-price-columns-in-client-view/research.md`

## Co i po co

Owner pracuje w widoku Inwestora, a żeby porównać stawki wykonawcy musi przełączać zakładki i trzymać
liczby w głowie. Sześć kolumn — „Źródło ceny wykonawcy", „Mnożnik", „Cena j.m. netto", każda w planie
„z narzędziami" i „bez narzędzi" — ma stanąć obok ceny klienta, być edytowalna, domyślnie ukryta
i nigdy nie pokazać się klientowi.

## Punkt wyjścia

Trzy fabryki kolumn wykonawcy już dziś biorą plan argumentem i żadna komórka nie czyta aktywnego
widoku — dane obu planów siedzą na każdym wierszu niezależnie od tego, co jest na ekranie. Jedyne,
czego plan nie parametryzuje, to **id kolumny**, dlatego dwóch planów nie da się dziś złożyć naraz.

## Stan docelowy

Picker w każdym widoku wystawia sześć nowych, odznaczonych pozycji. Po włączeniu działają identycznie
jak w widoku wykonawcy: ta sama edycja, to samo menu źródła ceny, te same ostrzeżenia. Sortowanie
działa i czyta plan z nazwy kolumny. Tryb „Brutto" ich nie chowa. W podglądzie inwestora nie ma ich
nigdy i nie da się ich tam wprowadzić żadnym zapisanym ustawieniem.

## Podjęte decyzje

| Decyzja             | Wybór                                           | Dlaczego                                                                                                       | Źródło   |
| ------------------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------- |
| Zasięg              | Sześć kolumn w **każdym** widoku                | Jeden zestaw kolumn niezależny od widoku — zero rozgałęzień „gdzie jesteśmy"                                   | Plan     |
| Id kolumn           | Sufiks planu we wszystkich widokach             | Jedno pojęcie, jedna nazwa; sortowanie czyta plan z id zamiast zgadywać z widoku                               | Research |
| Cena klienta        | Zostaje przy `price`                            | Inne pojęcie, a jej klucz siedzi w ustawieniach klienta w bazie — rename **odsłoniłby** cenę                   | Research |
| Domyślna widoczność | Wszystkie sześć ukryte                          | Nikt nie zobaczy zmiany, dopóki sam nie odznaczy; wejście przez piker jest świadome                            | Plan     |
| Etykiety            | „Mnożnik — z narzędziami"                       | Powtarza wzorzec dzisiejszego „Razem netto — po rabacie" z tej samej funkcji etykiet                           | Plan     |
| Konfiguracja        | Mapy po kluczu bazowym, disclosure po pełnym id | Baza utrzymuje inwarianty testowe bez sześciu wpisów; pełne id nie pozwala odziedziczyć przepustki do podglądu | Research |
| Tryb „Brutto"       | Kolumny przeżywają                              | Stawka wykonawcy jest netto z definicji i nie ma brutto-bliźniaka                                              | Research |
| Problemy            | Reveal per plan problemu                        | Warunek stawkowy już niesie swój plan                                                                          | Research |
| Testy               | Trzy unity: sort, disclosure, picker            | Dokładnie te trzy klasy są ciche — sort bez wyjątku, wyciek przez allowlistę, brak pozycji w pikerze           | Plan     |

## Zakres

**W zakresie:** namespace id per plan; składanie sześciu kolumn w każdym widoku; etykiety z nazwą
planu; domyślne ukrycie; sortowanie per plan; reveal problemów per plan; testy zamka podglądu;
aktualizacja dwóch miejsc w dokumentacji, które przestają być prawdą.

**Poza zakresem:** rename klientowskiej ceny; składanie ceny klienta w widokach wykonawcy; zmiany
w payloadzie podglądu; bramki roli; jakikolwiek wpis w grupach dialogu „co widzi klient"; wiersz
„Razem" dla kolumn cenowych; E2E.

## Podejście

Jeden nowy moduł kluczy plan↔id na wzór `stage-keys.ts` i jedno rozgałęzienie mniej w składaniu: gałąź
cenowa przestaje pytać „który widok" i zawsze dokłada sześć kolumn planów, a widok decyduje już tylko
o klientowskiej cenie. Mapy konfiguracji czytają klucz bazowy (jedno pojęcie, jeden wpis), allowlista
podglądu czyta pełne id (nowe kolumny są dla niej nieznane, czyli odrzucone).

## Fazy

| Faza                     | Co dowozi                                             | Główne ryzyko                                                                |
| ------------------------ | ----------------------------------------------------- | ---------------------------------------------------------------------------- |
| 1. Namespace i składanie | Sześć kolumn w każdym widoku, z etykietami planu      | Rozwiązanie po bazie tam, gdzie musi być pełne id — czyli wyciek do podglądu |
| 2. Sortowanie            | Sort czyta plan z id, w każdym widoku                 | Pominięcie jest **ciche** — sort po prostu nic nie robi (EX-487)             |
| 3. Widoczność i zamek    | Domyślne ukrycie, oś, reveal per plan, testy podglądu | Bramka napisana przeciw widokowi zamiast przeciw audytorium                  |

**Warunki wstępne:** brak — cała zmiana jest lokalna, bez migracji i bez ruchu w bazie.
**Szacowany rozmiar:** jedna sesja, trzy fazy.

## Otwarte ryzyka i założenia

- Przypięcie planu do Inwestora przestaje chronić te sześć kolumn — od tej zmiany **jedyną** barierą
  przed klientem jest allowlista. Dlatego faza 3 dokłada test drogi przez ręcznie edytowane ustawienia
  klienta, nie tylko przez render.
- W widokach wykonawcy trzy kolumny, które dziś są widoczne od razu, startują ukryte. To świadomy
  koszt jednolitego domyślnego stanu; kto ich używa, odznacza je raz.
- Zapisane szerokości i ticki dla `priceMode` / `priceCoeff` / `price` w widokach wykonawcy wracają do
  domyślnych (localStorage, sierocy klucz zostaje). Nic w bazie.

## Kryteria sukcesu

- Stawka wpisana w kolumnie planu z widoku Inwestora jest tą samą stawką po przełączeniu na widok tego
  planu — bez żadnej synchronizacji, bo to ta sama komórka i to samo pole.
- W podglądzie inwestora żadna z sześciu kolumn nie pojawia się nigdy, żadną drogą.
- Sortowanie po każdej z sześciu kolumn działa i rozróżnia plany.
