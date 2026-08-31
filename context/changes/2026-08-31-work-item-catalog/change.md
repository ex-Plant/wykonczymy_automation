---
change_id: work-item-catalog
title: Katalog prac — dodawanie pojedynczej zapisanej pracy z ceną i stawkami
status: implemented
created: 2026-08-31
updated: 2026-08-31
archived_at: null
branch: work-item-catalog
worktree: null
---

## Notes

Dziś najmniejsza jednostka, jaką da się wziąć z szablonu, to sekcja („Dodaj → Sekcja
z szablonu…"). Brakuje mechanizmu dodania POJEDYNCZEJ zapisanej pracy wraz z jej danymi:
nazwa, j.m., „Cena j.m." i stawki podwykonawców.

Stan zastany (ustalone przed założeniem change'a):

- Szablony żyją w `kosztorys_presets` (surowa tabela, `src/lib/db/presets.ts`); zapis całego
  kosztorysu, doklejenie wybranych sekcji, podmiana całej rozpiski.
- Szablon niesie: nazwę pracy, j.m., „Cena j.m." oraz per-pracowe nadpisania stawki
  podwykonawcy (współczynnik albo kwota, osobno z narzędziami / bez narzędzi).
- Szablon celowo gubi: Przedmiar, pomiar, rabat, komentarz, etapy i postęp; VAT
  i globalne współczynniki są zapisane, ale ignorowane przy wczytaniu.
- „zakres pracy z/bez narzędzi" z arkusza jest dziś tylko parserem cennika przy imporcie
  (`src/lib/kosztorys/sheet-import/resolve-rates.ts`) — nie jest katalogiem w aplikacji.

Otwarta decyzja produktowa: czy stawka podwykonawcy w katalogu jest sztywną kwotą, czy
współczynnikiem liczonym u celu (praca bez nadpisania dziedziczy globalne współczynniki
inwestycji docelowej, więc po przeniesieniu stawka po cichu się zmienia).
