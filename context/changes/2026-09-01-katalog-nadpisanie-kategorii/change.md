---
change_id: katalog-nadpisanie-kategorii
title: Kategoria kontrolowalna przy nadpisaniu pozycji w katalogu prac
status: implemented
created: 2026-09-01
updated: 2026-09-01
archived_at: null
branch: katalog-nadpisanie-kategorii
worktree: null
---

## Notes

Nadpisanie pozycji w katalogu prac („Zapisz do katalogu…" → „Nadpisz") wpisuje dziś cały kandydat,
w tym `category` wyliczoną z nazwy sekcji TEGO kosztorysu — więc cicho przenosi pracę do innej
kategorii w cenniku, a ani podgląd „W katalogu / Po zapisie", ani zdanie w potwierdzeniu (cena j.m.

- dwie stawki) o tym nie mówią. Finding z bramki review poprzedniego slice'a `work-item-catalog`
  (`src/lib/actions/work-catalogue.ts:212`, otwarty box — blokuje jego archiwizację).

Decyzja właściciela z 2026-09-01: kategoria ma być kontrolowalna przy nadpisaniu. Kształt: dialog
nadpisania pokazuje zmianę kategorii tak samo jak trzy pozostałe figury („Wyburzenia i demontaże →
Hydraulika") i daje przełącznik „zostaw kategorię z katalogu"; DOMYŚLNIE zostawia kategorię
z katalogu, bo cennik jest właścicielem swojej klasyfikacji, a sekcja w rozpisce to lokalny kontekst
jednej inwestycji. Gdy kategorie są identyczne — nie pokazujemy ani wiersza, ani przełącznika.

Świadomie NIE robimy rozwidlania pozycji po kategorii: tożsamość w cenniku to opis + j.m.
(`catalogueKey` celowo pomija sekcję), więc dwie ceny na tę samą pracę rozwaliłyby wstawianie
z katalogu. Osobna pozycja powstaje przez zmianę opisu albo j.m., a inwestycyjna różnica ceny przez
nadpisanie na wierszu rozpiski.

Dyspozycja testowa z findingu: `test: test-driven-debugging · integration` — spec na bazie
asercjujący UTRWALONĄ kategorię po nadpisaniu w obu trybach.
