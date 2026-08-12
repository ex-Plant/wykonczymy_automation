---
change_id: wplaty-jedno-zrodlo
title: Wpłaty per inwestycja — jedna ścieżka wyliczenia zamiast dwóch
status: implemented
created: 2026-08-12
updated: 2026-08-12
archived_at: null
branch: konradantonik/wplaty-jedno-zrodlo
worktree: null
---

## Notes

Linear: **EX-680** (projekt „Wykonczymy"), zależy od EX-557.

Ujednolicenie figury „wpłaty" na powierzchniach per-inwestycja. **Kierunek zmieniony przy planowaniu**
(2026-08-12): zamiast wybierać zwycięzcę między dwoma źródłami, `wplatyNet` wypada z kontraktu —
wartość wyprowadza się z listy wpłat, którą komponent i tak dostaje. Plus guard na niezmiennik
i naprawa pustej listy wpłat na podglądzie klienta.

### Skąd to się wzięło (EX-557, 2026-08-12)

Przy EX-557 wyszło, że jedna figura ma **dwie ścieżki wyliczenia** o różnym zestawie typów:

| Ścieżka                                                | Zestaw typów                | Powierzchnie                                                                                                                                                            |
| ------------------------------------------------------ | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `financials.totalIncome` (bucket `income`)             | **wszystkie trzy** wpłaty   | listing (`shape-investments.ts:51`), bilans (`calculate-balance.ts:11`), rozbicie kosztów (`map-category-costs.ts:129`), preview kosztorysu (`preview-kosztorys.ts:62`) |
| `sumDepositAmounts` (lista z `getDepositTransactions`) | **`INVESTOR_DEPOSIT` only** | Podsumowanie (`investment-summary-panel.tsx:64`), kosztorys v2 (`kosztorys_v2/page.tsx:77`)                                                                             |

### Czego NIE ruszamy — i dlaczego

**`financialBucket` obu typów zostaje `'income'`.** `/raporty` (`raporty/page.tsx:44`) woła to samo
`deriveFinancials` na wierszach **nieprzypiętych do inwestycji**, gdzie „Inna wpłata" i „Zasilenie
z konta firmowego" są poprawnymi wpłatami firmowymi — to jest ta figura, o której właściciel został
uprzedzony, że zacznie znowu rosnąć. Przestawienie bucketu na `'none'` cicho wycięłoby oba typy
z raportu firmowego. Definicja jest dobra; zła jest liczba ścieżek.

### Dlaczego to dziś nie jest widoczny błąd

Po EX-557 żaden z tych dwóch typów nie może dostać inwestycji (`showsInvestment === false` →
hook zeruje na każdej ścieżce zapisu), więc w zapytaniu scope'owanym po `investment_id` wnosi
dokładnie 0. Pomiar na kopii proda (2026-08-12): `COMPANY_FUNDING` 26 aktywnych / **0**
z inwestycją, `OTHER_DEPOSIT` 5 aktywnych / **0** z inwestycją. Obie ścieżki dają więc ten sam
wynik — ale **nic tego nie pilnuje**, i przy rozjeździe listing pokazałby wiersz, którego
Podsumowanie by nie pokazało, a lista wpłat nie sumowałaby się do własnego totalu.

### Kierunek

1. Podsumowanie i kosztorys v2 czytają `financials.totalIncome` (jest już wyliczone linijkę wyżej
   w obu komponentach) — jedna figura, jedno źródło.
2. Lista wpłat zostaje `INVESTOR_DEPOSIT`-only — to jest lista wpłat **klienta** i ma nią być.
3. Guard: **niezmiennik** „żaden aktywny wiersz typu deposit inny niż `INVESTOR_DEPOSIT` nie ma
   `investment_id`". Bez tego równość z pkt. 1–2 jest przypadkiem, nie regułą. Asercja równości
   `Σ listy === totalIncome` odpada — po ujednoliceniu byłaby tautologią (patrz research.md).
4. **Podgląd/share dociąga listę wpłat** (`preview-kosztorys.ts` → `depositTransactions`) — dziś
   renderuje total bez listy, przez co w trybie mieszanym odejmuje 0 zł wpłat. To realny defekt,
   ta sama przyczyna źródłowa, wchodzi do zakresu.
