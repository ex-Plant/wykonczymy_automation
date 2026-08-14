---
change_id: kosztorys-filter-conditions
title: One condition registry for the kosztorys editor's filters (EX-665)
status: planned
created: 2026-08-14
updated: 2026-08-14
archived_at: null
branch: null
worktree: null
---

## Notes

Rejestr warunków filtrowania w edytorze kosztorysu (EX-665): jeden słownik warunków, dwa
zastosowania (filtr pozycji / zwijanie sekcji), przygotowany pod dokładanie kolejnych warunków.

### Shaping (2026-08-14, w rozmowie z ownerem)

Trzy mechanizmy chowania już żyją w edytorze, każdy inny: **Szukaj** (filtr pozycji po tekście),
**Rozjazdy** (filtr pozycji po warunku, licznik po całym kosztorysie, znika przy zerze), **Sekcje**
(zwijanie, nie filtrowanie — belka i suma zostają). Zasada, która już obowiązuje i zostaje:
**sumy nigdy nie idą za filtrem** — to również domyślne zachowanie arkusza (`SUM` liczy ukryte
wiersze, dopiero `SUBTOTAL` ich nie liczy).

**Problem wyjściowy (owner):** „Zwiń puste sekcje" jest zbyt ogólne — nie wiadomo, co znaczy
„pusta". Dziś to jedna liczba: `roundToCents(section.net) === 0`.

**Ustalenie o „pustości".** Wartość wykonanych prac zeruje się twardo przy braku pomiaru
(`netForQtyForView`: `if (!(qty > 0)) return 0`), a rabat jest procentowy, więc nie zbije
niezerowej wartości do zera. Zostaje jedna rozbieżność między „bez wartości netto" a „bez pomiaru
z natury": **pozycja wykonana, ale bez ceny j.m.** Konsekwencja dzisiejszego zachowania — sekcja
w całości wykonana, ale niewyceniona, ma sumę zero i **dzisiejszy przycisk zwija ją jako „pustą"**,
czyli chowa dokładnie to, co powinno rzucać się w oczy.

Lista warunków schodzi więc do trzech ortogonalnych:

- **bez przedmiaru** — nie zaoferowano (stan normalny → nadaje się do chowania)
- **bez pomiaru z natury** — nie wykonano (stan normalny → nadaje się do chowania; zastępuje
  dzisiejsze „bez wartości netto" bez straty)
- **bez ceny j.m.** — niewycenione (**usterka, nie stan** → nie do chowania; należy obok Rozjazdów
  jako drugi warunek diagnostyczny, z licznikiem, znikający przy zerze)

**Konstrukcja: jeden warunek, dwa niezależne zastosowania.**

- na pozycjach → ukrywa wiersze, belki sekcji i ich sumy zostają
- na sekcjach → zwija sekcję, w której **każda** pozycja spełnia warunek (`∀`, nie „suma = 0" —
  suma może wyzerować się przypadkiem, „wszystkie co do jednej" nie może)

Niezależne znaczy niezależne: da się odfiltrować puste pozycje nie zwijając żadnej sekcji.

**Konsekwencja dla nazw.** „Pusta" przestaje być słowem, staje się wyborem — menu musi mówić, co
zwija („Zwiń sekcje bez wykonanych prac"), nie „Zwiń puste sekcje".

**Podział warunków na dwa rodzaje** (granica utrzymuje się sama, bo wynika z tego, ilu kolumn
dotyczy pytanie):

- **diagnostyczne** — dotyczą relacji MIĘDZY kolumnami (rozjazd = pomiar z arkusza ≠ suma etapów;
  żadna pojedyncza kolumna go nie widzi). Licznik po całym kosztorysie, docelowo zero, znikają przy
  zerze. Mieszkają w pasku narzędzi jako przyciski.
- **robocze** — dotyczą JEDNEJ kolumny. Mieszkają w menu nagłówka kolumny (`HeaderMenu` już
  istnieje i trzyma sortowanie).

**Wymaganie naczelne: rozszerzalność.** Dołożenie kolejnego warunku ma być jedną pozycją w
rejestrze, nie nowym przełącznikiem w trzech miejscach. Warunek deklaruje: nazwę, predykat na
pozycji, i czy umie się podnieść na sekcję. Menu, liczniki i zwijanie czytają z rejestru.

### Odłożone świadomie

- **Filtr kolumnowy w stylu arkusza** (EX-665 w pełnym zakresie): lejek w nagłówku, dwa tryby —
  „filtruj według wartości" (lista unikalnych wartości z checkboxami; `FilterMultiSelect` z
  transferów to gotowy komponent) i „filtruj według warunku" (puste / niepuste / zawiera /
  większe niż / pomiędzy). Warunki z różnych kolumn łączą się przez I. Lista wartości zawęża się do
  tego, co przeżyło pozostałe filtry. Numery pozycji przeskakują zamiast się przenumerowywać —
  u nas **za darmo**, bo ordynale liczą się per wiersz, nie z pozycji na ekranie
  (`ordinal-gutter-column.tsx`). Buduje się na tym samym rejestrze, jako druga porcja.
- **Widoki filtrów** (nazwane, zapisane kombinacje — jak w arkuszu). Naturalne przedłużenie w stronę
  widoku ofertowego, ale osobny temat.

### Pułapki do obsłużenia

- **Zwinięta sekcja vs. filtr pozycji.** Szukanie i Rozjazdy już wyłączają zwijanie, gdy są aktywne
  (`foldSuppressed` w `kosztorys-editor-body.tsx`) — inaczej pozycja jest schowana dwa razy i filtr
  wygląda na zepsuty. Nowy filtr pozycji musi robić to samo.
- **Liczniki liczą się po całym kosztorysie, nie po tym, co przeżyło filtr** — inaczej licznik
  liczy sam siebie i przestaje umieć powiedzieć, że problem zniknął (wzorzec z `divergedCount`).
- **dsg zamraża `columns` i nie ma natywnego filtrowania** — ta sama klasa pułapki z kluczem
  remountu co przy zmianie szerokości / widoczności / kolejności kolumn.
- Trwałość ustawień per przeglądarka, jak widoczność/szerokość/kolejność (`kosztorys-v2-*`).
