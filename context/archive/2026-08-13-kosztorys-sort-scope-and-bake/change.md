---
change_id: kosztorys-sort-scope-and-bake
title: Zakres sortowania w menu kolumny + utrwalanie kolejności całego kosztorysu
status: archived
created: 2026-08-13
updated: 2026-08-13
archived_at: 2026-08-13T18:10:00Z
branch: konradantonik/ex-682-sort-within-sections
worktree: null
---

## Notes

rozdzielenie sortowania na „w sekcjach" / „w całym kosztorysie" w menu kolumny (globalne = tylko
widok, nigdzie nie utrwalane) oraz wariant „Utrwal kolejność w całym kosztorysie" zapisujący
display_order we wszystkich sekcjach naraz

### Ustalenia z rozmowy (2026-08-13)

Buduje na EX-682/EX-683 (branch `konradantonik/ex-682-sort-within-sections`), gdzie sortowanie
zostało zamienione na wyłącznie wewnątrzsekcyjne — ta zmiana przywraca sortowanie globalne jako
świadomy, nazwany tryb obok tamtego.

- **Menu kolumny**: 4 pozycje sortowania + „Wyczyść sortowanie". Zakres wprost w etykiecie
  („rosnąco w sekcjach" / „rosnąco w całym kosztorysie" itd.), znacznik przy aktywnej pozycji.
  Bez podmenu i bez osobnego przełącznika trybu — kierunek i zakres wybiera się jednym gestem.
- **Nic z samego sortowania nie jest utrwalane** — ani w localStorage, ani w bazie. Sortowanie
  zostaje soczewką; jedyną trwałą kolejnością jest `display_order`.
- **Dlaczego nie zapisywać reguły sortowania**: zapisana reguła jest żywa i przebija pozycje —
  po ▲/▼ i przeładowaniu przesunięcie wiersza znika, bo reguła sortuje go z powrotem. Dwa
  źródła prawdy o kolejności. Zapisujemy wynik (`display_order`), nie regułę.
- **Reguła sortowania nie jest utrwalana nigdzie** — ani globalna, ani sekcyjna; ▲▼ i wstawianie
  pozostają wyłączone przy każdym sortowaniu. (Wyszarzanie zapisu przy sortowaniu globalnym —
  patrz korekta niżej: wycofane.)
- **Nowy wariant**: „Utrwal kolejność w całym kosztorysie" — ten sam planner przelatuje po
  wszystkich sekcjach, refy sklejone w jeden zapis i jedno cofnięcie. `renumberDisplayOrder`
  przyjmuje dowolną listę id→indeks, więc mechanizm już to unosi.

### Korekta po implementacji (2026-08-13)

Utrwalanie kolejności **przeniesione z menu wiersza do menu nagłówka kolumny** — tam, gdzie się
sortuje. Jedno polecenie „Utrwal kolejność", obejmujące wszystkie sekcje naraz.

Powód (właściciel): nie da się posortować jednej sekcji. „w sekcjach" porządkuje **każdą** sekcję,
„w całym kosztorysie" miesza wszystkie — więc zapis zaczepiony o jedną sekcję zapisywał wycinek
czegoś, czego nigdy nie dało się osobno wywołać, a menu wiersza dodatkowo sugerowało, że wiersz ma
z tym coś wspólnego. Z nagłówka kolumny i tak nie ma jak wskazać sekcji.

### Korekta druga — zapis zawsze aktywny (2026-08-13)

Polecenie nazywa się **„Zapisz kolejność"** i jest **aktywne przy każdym sortowaniu, także „w całym
kosztorysie"** (wcześniej: wyszarzone). Wyszarzanie opierało się na błędnym założeniu — plan zapisu
przenumerowuje **każdą sekcję osobno wg tego samego klucza sortowania**, więc sortowanie globalne
zapisuje bajt w bajt to samo co sekcyjne. Zakres zmienia to, co widać na ekranie, nigdy to, co
trafia do bazy. Jedyny koszt: po wyczyszczeniu sortowania globalnego przeplot nie wraca — wiersze
wracają pod swoje sekcje (właściciel: „możemy zawsze z powrotem posortować sekcjami").

Skutkiem tego zniknęły wszystkie podpowiedzi (tooltipy) tłumaczące blokadę, razem z modułem
`sort-lock-hints` i jego specem — nie ma już blokady do wytłumaczenia.

Konsekwencje pierwszej korekty: znika pozycja utrwalania z grupy „Sekcja" w menu wiersza wraz z akcją serwerową
zapisującą pojedynczą sekcję (EX-683) i jej specem — nikt jej już nie woła, a szersza akcja robi to
samo zapytanie bez ograniczenia do jednej sekcji. Schemat walidacji wraca do jednego kształtu:
odrzuca powtórzone id, ale **nie** powtórzony indeks, bo przy wielu sekcjach każda zaczyna
numerację od zera. Strzałki ▲▼ i „Wstaw" bez zmian.
