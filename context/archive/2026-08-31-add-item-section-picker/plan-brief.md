# Wybór sekcji przed dodaniem pracy — Plan Brief

> Full plan: `context/changes/2026-08-31-add-item-section-picker/plan.md`

## What & Why

„Dodaj → Praca" zgaduje dziś sekcję docelową: jedyna rozwinięta, a jak jest ich więcej — ostatnia
w rozpiske. Efekt jest zaskakujący, bo praca ląduje poza sekcją, na którą użytkownik patrzy.
Zastępujemy zgadywankę jawnym wyborem sekcji w podmenu.

## Starting Point

Heurystyka żyje w jednym komponencie (`kosztorys-add-menu.tsx:32-34`). Warstwa pod spodem —
`handleAddItem(sectionId)`, `addItemAction`, `applyAddItem` — już przyjmuje dowolną sekcję i sama
rozwija tę, do której dopisała wiersz. `subtotals` niesie komplet sekcji z nazwą i liczbą pozycji.

## Desired End State

„Dodaj → Praca ▸" rozwija listę wszystkich sekcji z licznikiem pozycji. Kliknięcie dokleja pustą
pracę na końcu wskazanej sekcji i rozwija ją. Żadnego domyślnego wyboru; przy pustej rozpisce
wyzwalacz pozostaje wyszarzony.

## Key Decisions Made

| Decyzja              | Wybór                                          | Dlaczego                                                      |
| -------------------- | ---------------------------------------------- | ------------------------------------------------------------- |
| Forma wyboru         | Podmenu w istniejącym `DropdownMenu`           | Spójne z resztą menu, bez nowego dialogu                      |
| Domyślna sekcja      | Brak                                           | Każdy domyślny wybór odtwarza dzisiejsze zaskoczenie          |
| Zakres               | Tylko „Praca"                                  | Sekcje, szablony i etapy z natury lądują na końcu             |
| Etykieta sekcji      | Nazwa + liczba pozycji                         | Nazwy sekcji nie są unikalne                                  |
| Pusta rozpiska       | Wyzwalacz wyszarzony (bez zmian)               | Dzisiejsze zachowanie, nie ma czego wybierać                  |
| Scroll długiej listy | Poprawka w prymitywie `DropdownMenuSubContent` | `DropdownMenuContent` ma już `max-h` + scroll; podmenu nie ma |

## Scope

**In scope:** podmenu z sekcjami dla „Praca"; usunięcie heurystyki; wyrównanie scrolla w prymitywie
podmenu.

**Out of scope:** dialog z wyszukiwarką; kolory sekcji w liście; zapamiętywanie ostatniego wyboru;
brak blokady `handleAddItem` przy aktywnym sortowaniu kolumny (odnotowane w `change.md`).

## Architecture / Approach

Zmiana wyłącznie prezentacyjna. `subtotals` → lista pozycji podmenu → `handleAddItem(sectionId)`.
Żadnej nowej akcji serwerowej, żadnego nowego stanu.

## Phases at a Glance

| Faza                      | Co dostarcza                               | Ryzyko                                           |
| ------------------------- | ------------------------------------------ | ------------------------------------------------ |
| 1. Scroll w podmenu       | `SubContent` z `max-h` + `overflow-y-auto` | Dotyka wszystkich podmenu w aplikacji            |
| 2. „Praca ▸ wybór sekcji" | Jawny wybór sekcji, heurystyka usunięta    | Brak testu automatycznego — weryfikacja manualna |

**Prerequisites:** brak. **Estimated effort:** jedna krótka sesja.

## Open Risks & Assumptions

- Zakładamy inwariant „sekcja ma ≥1 pozycję" (`delete-policy.ts:28`) — gdyby padł, sekcja bez pozycji
  zniknęłaby z listy i stała się nieosiągalna dla dodawania.
- Faza 1 zmienia współdzielony prymityw; pozostałe podmenu są krótkie, więc zmiana ma być niewidoczna.
- Ryzyko „praca trafia do wskazanej sekcji" nie ma testu automatycznego; kandydat do E2E, decyzja
  na bramce recenzji slice'a.

## Success Criteria (Summary)

- Praca ląduje w sekcji, którą użytkownik wskazał — również gdy nie jest ostatnia ani rozwinięta.
- Żadna sekcja nie jest wybrana z góry.
- Długa lista sekcji przewija się w oknie.
