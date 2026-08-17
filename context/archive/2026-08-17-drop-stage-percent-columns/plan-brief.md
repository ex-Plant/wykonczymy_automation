there# Usunięcie kolumn „% wykonania" per etap — Plan Brief

> Pełny plan: `context/changes/2026-08-17-drop-stage-percent-columns/plan.md`
> Research: `context/changes/2026-08-17-drop-stage-percent-columns/research.md`

## What & Why

Kolumny „Etap 1 %", „Etap 2 %", … w edytorze kosztorysu nie zarabiają na swoje miejsce. Właściciel:
mniej kolumn, mniej logiki, mniej rozdętego widoku. Znikają razem z osią czytania „PLN / Procent",
która istniała wyłącznie po to, żeby je przełączać.

## Starting Point

Grid składa widoczność kolumny z czterech niezależnych osi łączonych zwykłym AND. Oś „Etapy"
(`values | percent`) ma w całej dziedzinie trzy klucze: kwota netto i kwota brutto po stronie
`values`, procent po stronie `percent`. Bez procentu zostają dwa klucze z jedną etykietą — wybór
„Procent" wygaszałby cały blok etapów, pokazując „Procent" jako zaznaczone. To, co ta oś jeszcze
umiała, robi już picker kolumn i warstwa „Praca".

Kolumny są **wyliczane**, nie zapisywane — inaczej niż przy każdym poprzednim usuwaniu kolumny
kosztorysu (`measuredQty`, `costVariant`, współczynniki sekcji), które wymagały migracji.

## Desired End State

Popover „Kolumny" ma trzy sekcje zamiast czterech — bez „Etapy". Grid pokazuje ilość etapu oraz
kwotę netto i brutto etapu, bez procentu. Kolumna „% wykonania (względem przedmiaru)" zostaje
nietknięta, razem z czerwonym sygnałem przekroczenia Przedmiaru. Podgląd klienta traci tę kolumnę
i jej ptaszka w ustawieniach.

## Key Decisions Made

| Decyzja                | Wybór                                     | Dlaczego                                                                                                         | Źródło |
| ---------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------ |
| Oś „PLN / Procent"     | Znika razem z kolumnami                   | Zdegenerowana bez procentu; jej jedyna pozostała funkcja jest już dostępna w pickerze i w warstwie „Praca"       | User   |
| Kolumna „% wykonania"  | **Zostaje**                               | Procent w Podsumowaniu liczy wartościowo dla całości; ta kolumna liczy ilościowo per pozycja i pokazuje czerwień | User   |
| Podgląd klienta        | Traci tę kolumnę, bez zamiennika          | Allowlista kurczy się o jedną pozycję; zapisane ustawienia same się czyszczą przy odczycie i zapisie             | User   |
| Migracja / czyszczenie | Żadna                                     | Kolumna jest wyliczana; wszystkie cztery magazyny stanu są rzadkie i samoleczące                                 | Plan   |
| Podział na fazy        | Produkcja + testy w jednej fazie          | Rozdzielenie zostawiłoby bramkę fazy z czerwonym `tsc` i czerwonym vitestem                                      | Plan   |
| Dowód kompletności     | `pnpm typecheck` **plus** grep na literał | Kolumna wyliczana nie ma szkieletu `satisfies`, więc kompilator sam nie jest pełnym dowodem                      | Plan   |

## Scope

**W zakresie:** usunięcie grupy kolumn i jej kluczy; usunięcie osi (dwa pliki w całości, sekcja
w toolbarze, predykat i jego człon w filtrze gridu); usunięcie osieroconego helpera ułamka;
przeniesienie dwóch asercji, które oś przeżywają, do nowych domów; aktualizacja notatek domenowych
i rejestru sprawdzeń ręcznych.

**Poza zakresem:** kolumna „% wykonania" i jej czerwony sygnał; licznik „Postęp prac"
w Podsumowaniu; migracje, backfille, czyszczenie localStorage; zamiennik dla sekcji „Etapy"
w popoverze.

## Architecture / Approach

Usunięcie idzie od korzenia (klucz grupy) w górę do trzech powierzchni: składania kolumn, toolbaru
i allowlisty klienta. Jedyna pułapka to `progressDisplayAllows`, który **fail-open** — nieotagowany
klucz przechodzi. Skasowanie samej mapy zostawiłoby w gorącym filtrze człon zawsze prawdziwy, więc
mapa, predykat i wywołanie idą jednym ruchem.

## Phases at a Glance

| Faza                    | Co dowozi                                   | Główne ryzyko                                                  |
| ----------------------- | ------------------------------------------- | -------------------------------------------------------------- |
| 1. Kolumny + oś + testy | Całe usunięcie, zielony `tsc` i cały pakiet | Półusunięcie osi; zgubienie dwóch asercji, które ją przeżywają |
| 2. Dokumentacja         | Notatki domenowe i rejestr sprawdzeń zgodne | Brak                                                           |

**Prerekwizyty:** brak — bez migracji, bez zależności, bez kolejności wdrożenia.
**Szacowany rozmiar:** jedna sesja, 2 fazy.

## Open Risks & Assumptions

- Zakładamy, że nikt nie odczytuje procentu etapu z podglądu klienta jako uzgodnionej liczby —
  kosztorysy są do dogfoodingu danymi jednorazowymi, więc nie ma czego zachowywać.
- Nowe testy nie są należne: zmiana usuwa funkcję razem z jej pokryciem. Praca polega na **nie
  zgubieniu** dwóch asercji, które oś przeżywają.
- E2E nie jest należne — `e2e/**` nie zna tych kolumn, a zmiana usuwa interfejs, a nie dokłada
  ryzyko przeglądarkowe.

## Success Criteria (Summary)

- Nigdzie — w żadnym widoku ani w podglądzie klienta — nie ma kolumny „Etap N %".
- Popover „Kolumny" ma Kwoty / Warstwy / Kolumny; kwoty etapów nadal się przełączają, a „Praca"
  nadal je chowa.
- „% wykonania (względem przedmiaru)" renderuje się jak dotąd i nadal czerwienieje przy przekroczeniu
  Przedmiaru.
- Kosztorys z zapisanym starym ustawieniem podglądu otwiera się bez błędu.
