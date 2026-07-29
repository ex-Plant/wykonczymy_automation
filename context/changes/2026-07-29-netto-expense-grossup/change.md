---
change_id: netto-expense-grossup
title: Wydatek netto — odwrócenie wyliczenia, brutto liczone ze stawki materiałów
status: planned
created: 2026-07-29
updated: 2026-07-29
archived_at: null
branch: null
worktree: null
---

## Notes

Odwrócenie wyliczenia dla wydatków netto (`netBilled`): netto jest daną wejściową, brutto =
netto × (1 + stawka materiałów). Dziś ten typ wchodzi po face value na obu osiach
(netto === brutto).

Dotyka trzech miejsc:

- tabelka „Wydatki inwestycyjne" (`materials-breakdown-table.tsx`) — kolumna Brutto
- `materialsPair` (`src/lib/kosztorys/summary-economics.ts`) — wiersz „Materiały" w Podsumowaniu
  i przez to „Do zapłaty"
- `deriveFinancials` (`src/lib/db/investment-financials.ts`) — `totalMaterialCosts`, marża, bilans

**To jest zmiana sposobu wyliczania rozliczenia, nie prezentacji** — rusza kwotę, którą inwestor
widzi jako należną. Wymaga udokumentowania (owner, 2026-07-29).

Rozstrzygnięte na etapie planowania (2026-07-29):

- **Zakres: wyłącznie panel v2.** v1 (bilans, „Koszty inwestora", kolumny kategorii na listingu,
  kafelek „Korekta (bez kategorii)") zostaje świadomie rozjechany i idzie osobnym changem — nie ma
  tam w ogóle osi pieniądza (`totalMaterialCosts` dodaje brutto z paragonów do kwot netto w jednym
  skalarze), więc poprawianie jednego składnika wewnątrz błędnej sumy ruszyłoby bilans o kwotę,
  której nikt nie umie wytłumaczyć. Decyzja właściciela.
- **Tabelka jest błędna niezależnie od trybu rozliczenia.** Kolumna Brutto renderuje `row.net` bez
  sprawdzenia `origin`, więc dla wiersza netto pokazuje kwotę netto. To defekt prezentacji, nie
  konsekwencja rozliczenia — naprawiany bezwarunkowo.
- **Stawka w tabelce**: ta sama, która rządzi kolumną Netto (`materialsNetRate ?? vatRate`) —
  brutto = netto × (1+r) jest odwrotnością netto = brutto ÷ (1+r).
- **Gross-up w rozliczeniu**: tylko przy `settlementMode === 'GROSS'`, stawką `vatRate` (przy tym
  trybie koncesja jest z definicji wyłączona). Netto i mieszany bez zmian.
- `computeMixedSettlement` nie wymaga zmian — grosuje wyłącznie kwotę jeszcze nierozliczoną.
- `buildMaterialyBreakdown` i `netCategoryCosts` bez zmian — niezmienniki Σ są asertowane na
  `row.net`, którego nie ruszamy.

Bez migracji: `investments.vat_rate` jest `NOT NULL DEFAULT 0.08`.

Kontekst poprzedzający (już wdrożone w tej samej zakładce, poza tym changem):

- „Wydatki" → „Materiały" w przełączniku widoków
- Robocizna pokazuje Netto + Brutto niezależnie od trybu rozliczenia
- Kolumna Netto w tabelce materiałów jest zawsze widoczna, stawka = `materialsNetRate ?? vatRate`,
  czysto prezentacyjna
