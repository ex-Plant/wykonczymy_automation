---
change_id: kosztorys-contractor-price-columns-in-client-view
title: Kolumny ceny wykonawcy (obu planów) w widoku Inwestora
status: implemented
created: 2026-09-01
updated: 2026-09-01
archived_at: null
branch: kosztorys-contractor-price-columns-in-client-view
worktree: null
---

## Notes

> **Superseded by `context/changes/2026-09-01-kosztorys-dwie-opcje-zrodla-ceny-wykonawcy/`.** Ten
> dokument opisuje sześć kolumn i tryb „własny mnożnik". Późniejszy change ściął źródło ceny wykonawcy
> do dwóch opcji („auto" / kwota stała), skasował kolumnę „Mnożnik" i zostawił w widoku Inwestora
> tylko dwie kolumny „Cena j.m. netto" — po jednej na plan. Czytaj poniższe jako zapis stanu z dnia
> wdrożenia, nie jako opis obecnego zachowania.

Sześć kolumn ceny wykonawcy — „Źródło ceny wykonawcy" / „Mnożnik" / „Cena j.m. netto" × plan
z narzędziami i bez narzędzi — dostępnych w widoku Inwestora edytora kosztorysu, żeby owner/manager
porównał wartości bez przełączania planu. Edytowalne (piszą override tego planu). Domyślnie ukryte,
wywoływane z pickera kolumn. Nigdy widoczne w podglądzie inwestora.

Ustalenia z rozmowy przed planem:

- Ukrycie w podglądzie jest darmowe: `PREVIEW_VISIBLE_COLUMNS` / `CLIENT_VIEW_GROUPS` to allowlista,
  a `assertDisclosurePair` pilnuje planu.
- Rola: strona idzie przez `requireManagementPage()`, więc żadnego nowego gate'u nie trzeba.
- Główna robota: id kolumn. Fabryki (`subcontractorModeColumn` / `CoeffColumn` / `PriceColumn`) mają
  zaszyte `priceMode` / `priceCoeff` / `price` — w widoku klienta kolidują z klientowską `price`
  i między planami. Trzeba sufiksu planu; widoki wykonawcy zostają na starych id, żeby nie zresetować
  zapisanych preferencji kolumn.
- Sortowanie: `columnSortValue` liczy `priceCoeff`/`priceMode`/`price` po `view` — musi czytać plan
  z sufiksu id.
- Rozstrzygnięcie właściciela odwróciło jeden punkt powyżej: sufiks planu wchodzi do **wszystkich**
  widoków, nie tylko do Inwestora (rozstrzygnięcia w `research.md`).
- Do ruszenia też: `COLUMN_LABELS`/`HEADER_TIPS` (najlepiej rozwiązywane po sufiksie z `PLANE_LABELS`),
  `COLUMN_MONEY_AXIS` + `AXIS_EXEMPT_COLUMNS`, `DEFAULT_HIDDEN_COLUMNS`, `PRICE_COLUMNS`
  w `row-conditions.ts` (żeby problem ze stawką odsłaniał kolumny również w widoku Inwestora).
