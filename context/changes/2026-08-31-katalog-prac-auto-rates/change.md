---
change_id: katalog-prac-auto-rates
title: Stawka „auto" w katalogu prac — cennik bez własnej stawki liczy ze współczynnika inwestycji
status: implemented
created: 2026-08-31
updated: 2026-09-01
archived_at: null
branch: katalog-prac-auto-rates
worktree: null
---

## Notes

Dziś obie stawki (z narzędziami / bez narzędzi) są w kolekcji `work-catalogue-items` NOT NULL i
zawsze twarde kwoty: `toCatalogueCandidate` zamraża kwotę efektywną nawet gdy wiersz nic nie
nadpisywał, a `append-catalogue-items` wstawia je jako `wToolsOverrideType: 'amount'`. Owner chce
trzeciej możliwości: stawka „auto" = brak własnej stawki, liczona ze współczynnika inwestycji
docelowej.

Ustalenia właściciela (2026-08-31):

1. **Co trafia do cennika przy „Zapisz do katalogu…".** Wiersz z WŁASNYM nadpisaniem — kwotą albo
   mnożnikiem — idzie jako kwota na sztywno, czyli bez zmian wobec dzisiaj. Wiersz BEZ nadpisania
   (jedzie na globalnym współczynniku inwestycji, u właściciela 65% / 55,5%) idzie jako „auto".
   Decyzja jest **per plan**, więc jedna praca może mieć „z narzędziami" na sztywno, a „bez
   narzędzi" auto.
2. **Pułap 80% nie dotyczy „auto".** „Auto to auto, nie ma z czego liczyć 80%" —
   `checkSubcontractorPrice` milczy dla stawki auto, tak jak dziś milczy przy cenie j.m. = 0.
   Sprawdzany jest dopiero wiersz w rozpiskie, gdzie współczynnik dał już konkretną kwotę. To
   kasuje jedyny powód, dla którego guard musiałby dostać kontekst inwestycji.

Powierzchnia zmiany: migracja (`w_tools_rate` / `own_tools_rate` na nullowalne — tabela jest nowa,
na produkcji pusta), kolekcja, formularz „Nowa praca w katalogu" (puste pole = auto, nie błąd „jest
wymagana"), lista /katalog-prac, `toCatalogueCandidate`, `append-catalogue-items` (null → brak
nadpisania, więc wiersz bierze współczynnik inwestycji docelowej) oraz dialog „Zapisz do katalogu…",
który dziś pokazuje trzy kwoty.

Poprzedni slice: `context/changes/2026-08-31-work-item-catalog/` (tam też rejestr bramki review).
