# Review-gate ledger — strata-obniza-bilans (EX-675) · 2026-08-13

## Findings

- [x] 🔴 CRITICAL · fixed · repro (faza 0) · `src/hooks/transfers/validate.ts:59-124` · częściowa
      aktualizacja (PATCH jednego pola) leciała na czerwono na **trzech** wymaganiach naraz, nie
      tylko na `investment`: „Cash register is required… Investment is required… Expense category
      is required…". Naprawa czyta wszystkie pola relacyjne przez `originalDoc`, wzorem istniejącego
      fallbacku na `type`.
      test: test-driven-debugging · unit — `src/__tests__/validate-hook.test.ts`, repro napisany
      czerwony przed naprawą, plus guard, że brak inwestycji po obu stronach dalej odrzuca.

## Simplify pass

_Do uzupełnienia w bramce._

## Tests & suite

_Do uzupełnienia w bramce._
