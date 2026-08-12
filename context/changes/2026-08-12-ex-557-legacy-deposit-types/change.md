---
change_id: ex-557-legacy-deposit-types
title: Wpłaty bez inwestycji — przywrócenie OTHER_DEPOSIT i blokada inwestycji na OTHER_DEPOSIT / COMPANY_FUNDING
status: implemented
created: 2026-08-12
updated: 2026-08-12
archived_at: null
branch: konradantonik/ex-557-inna-wplata-zasilenie-bez-inwestycji
worktree: null
---

## Notes

EX-557. Blocker zdjęty: EX-536 jest Done (2026-07-21).

### Rozstrzygnięcie właściciela (2026-08-12) — KOREKTA wcześniejszego EDIT-a w issue

Lipcowy EDIT w issue („Inna wpłata — chowamy w formularzach") został **źle wykonany**: zamiast
odebrać temu typowi wybór inwestycji, odebraliśmy cały typ. Commit `72ddc5d7` (2026-07-21) wyrzucił
`OTHER_DEPOSIT` z `DEPOSIT_UI_TYPES` dzień po tym, jak powstał nim żywy wiersz (`id=3898`, kaucja za
przecinarkę, 2026-07-20). Intencją było usunięcie **wariantu z inwestycją**, nie typu.

Obowiązujące zasady:

1. **„Inna wpłata" wraca do formularza wpłaty** — widoczna dla wszystkich ról, jak przed 21.07.
2. **Obie — „Inna wpłata" i „Zasilenie z konta firmowego" — nigdy nie mają wyboru inwestycji.**
   Egzekwowane w jednym miejscu (predykat), nie tylko w JSX okna dodawania: dziś okno **edycji**
   (`edit-transfer-form.tsx:153`) i panel Payload (`collections/transfers.ts:183`) nadal pokazują
   pole inwestycji, a `hooks/transfers/validate.ts:75` je przepuszcza — tylna furtka do podpięcia.
3. **„Zasilenie z konta firmowego" widzi wyłącznie ADMIN/OWNER** — obecny podział zostaje bez zmian.
   „Inna wpłata" bez ograniczenia roli.
4. **„Wpłata od inwestora" zostaje jedyną wpłatą z inwestycją** i jedyną niosącą netto/brutto (EX-536).
5. ~~**Trzy śmieciowe wiersze z 25.03 zostają jak są**~~ — **zasada uchylona 2026-08-12 po fakcie**
   (patrz „Korekta" niżej). Zakres zmiany nadal blokuje tylko powstawanie nowych wierszy.

Znacznik LEGACY z lipcowego EDIT-a **nie obowiązuje** — oba typy są żywe, tylko bezinwestycyjne.

### Rozstrzygnięcia po researchu (2026-08-12)

6. **Gate roli na `COMPANY_FUNDING` zostaje client-only** — właściciel: „client jest good enough".
   Nie utwardzamy `createTransferAction` o rolę; świadomie przyjęte ryzyko (manager może wysłać ten
   typ przez API). Nie zgłaszać ponownie.
7. **Stale `vatPlane` na typach, które go nie niosą — sprzątamy w tej zmianie.** Ta sama przyczyna
   źródłowa co przeciek `investment`: ukrycie pola w JSX nie czyści wartości, a `toData` ją wysyła.
8. **E2E okna wpłaty → backlog** (issue z etykietą `e2e-backlog` w projekcie „Wykonczymy"),
   nie piszemy go w tej zmianie.

### Pomiar na kopii proda (2026-08-12, najświeższy wiersz w DB 2026-08-11)

| Typ                | Wszystkie | Aktywne | Anulowane | Z inwestycją (aktywne) | Suma aktywnych | Ostatnio utworzony |
| ------------------ | --------- | ------- | --------- | ---------------------- | -------------- | ------------------ |
| `INVESTOR_DEPOSIT` | 218       | 190     | 28        | 190                    | —              | 2026-08-07         |
| `COMPANY_FUNDING`  | 26        | 26      | 0         | **0**                  | 160 074,92 zł  | 2026-04-02         |
| `OTHER_DEPOSIT`    | 14        | 8       | 6         | 3                      | 42 910,70 zł   | 2026-07-20         |

Rozkład w czasie — oba typy to dwa krótkie zrywy, nie bieżący przepływ:

| Miesiąc | `COMPANY_FUNDING`       | `OTHER_DEPOSIT`        |
| ------- | ----------------------- | ---------------------- |
| 2026-03 | 25 szt. · 150 074,92 zł | 3 szt. · 5 310,71 zł   |
| 2026-04 | 1 szt. · 10 000 zł      | 10 szt. · 66 014,30 zł |
| 2026-07 | —                       | 1 szt. · 1 020 zł      |

### Ustalenia wchodzące do researchu

1. **`COMPANY_FUNDING` — zero wierszy z inwestycją.** Wyjęcie go z `INVESTMENT_TYPES`
   (`src/lib/constants/transfers.ts`) jest no-opem na danych, a domyka lukę: dziś ukrycie pola
   inwestycji żyje tylko w JSX `deposit-form.tsx:132`, więc formularz edycji
   (`edit-transfer-form.tsx:153`) i panel Payload (`collections/transfers.ts:183`) nadal je
   pokazują, a `hooks/transfers/validate.ts:75` przepuszcza.

2. **Regresja do cofnięcia: `OTHER_DEPOSIT` zniknął z formularza mimo żywego użycia.** Wiersz
   `id=3898` („kaucja z przecinarki do wielkiego formatu", 1020 zł) powstał **2026-07-20**; picker
   odebrał ten typ commitem `72ddc5d7` z **2026-07-21**. Od tego dnia gotówka wchodząca do kasy
   **bez inwestycji** nie ma czym być zaksięgowana przez managera. 8 z 14 wierszy `OTHER_DEPOSIT` to
   właśnie takie wpływy („zwrot od Michała", „od Siergeja", „za magnes", „narzędzia telmak").

3. **Trzy aktywne `OTHER_DEPOSIT` z inwestycją to śmieci z backfillu** (wszystkie 2026-03-25),
   dziś w `financialBucket: 'income'`, więc podbijają bilans jako wpłaty, czym nie są:
   - `id=1171` Łomianki Staszica 20a/3, 132,87 — „koronki mykhaiło" (materiał)
   - `id=1196` Szaserów 30b/32, 986,18 — „rabat" (`RABAT`)
   - `id=1381` Meander 22/25, 142,65 — „stara - naprawa gwarancyjna" (`LOSS`)

   → Nieaktualne, patrz korekta niżej.

## Korekta zasady 5 — wiersze anulowane na prodzie (2026-08-12, po planie)

Właściciel naprawił dane na prodzie: wszystkie trzy wiersze mają `cancelled = true` (`id=1381`
dostał przy okazji datę 2026-04-07). `investment_id` zostało w kolumnie, ale anulowany wiersz nie
wchodzi do żadnej sumy, więc **przestały podbijać bilans** — dokładnie ten efekt, o który chodziło.

Stan na kopii lokalnej (`transactions`, najświeższy wiersz 2026-08-12):

| Typ                | Wszystkie | Aktywne | Aktywne z inwestycją | Ostatnio utworzony |
| ------------------ | --------- | ------- | -------------------- | ------------------ |
| `INVESTOR_DEPOSIT` | 241       | 215     | 215                  | 2026-08-06         |
| `COMPANY_FUNDING`  | 26        | 26      | **0**                | 2026-04-02         |
| `OTHER_DEPOSIT`    | 14        | 5       | **0**                | 2026-07-20         |

**Konsekwencja dla rozwiązania:** znika jedyny powód, dla którego plan wprowadzał drugą semantykę
zapisu (`ignoresInvestment` — „pomiń pole", zamiast „wyzeruj"). Oba typy idą istniejącą ścieżką
`showsInvestment === false → investment = null`, tą samą co `OTHER` / `REGISTER_TRANSFER`. Wyjęcie
ich z `INVESTMENT_TYPES` niesie całą zasadę — bez nowego predykatu i bez nowej gałęzi w
`validate.ts`.

Przyjęte ryzyko: edycja jednego z tych trzech wierszy **z panelu Payload lub skryptu** wyczyściłaby
mu `investment_id`. Z tabeli transakcji nie da się ich edytować — anulowany wiersz nie ma kolumny
Akcje (`src/components/tables/transfers.tsx:209`). To anulowane śmieci z przenosin danych, poza
każdą sumą.

**Ubocznie: manualny check „edytuj wiersz 1171 i sprawdź, czy inwestycja przeżyła" jest
niewykonywalny** — z tego samego powodu. Zastąpiony edycją dowolnego wiersza `COMPANY_FUNDING`.

4. Etykiety obu typów wypływają w: tabeli transferów, filtrze typu (`transfer-filters.tsx:121`
   listuje **wszystkie** `TRANSFER_TYPES`), dialogu edycji, eksporcie CSV, konfigach arkusza.
   Znacznik LEGACY odpada wraz z korektą — ale filtr i tabela muszą nadal umieć pokazać te wiersze.

5. Backend nadal przyjmuje create obu typów (`transfer-actions.test.ts:218`) — po korekcie to jest
   pożądane; brakuje natomiast blokady na `investment` w schemacie zapisu.
