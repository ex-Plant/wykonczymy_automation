# Review-gate ledger — payment-method-two-types · 2026-08-27

Slice: metoda płatności pytana tylko na `INVESTOR_DEPOSIT` i `INVESTMENT_EXPENSE_NET`;
`transactions.payment_method` staje się nullowalna, hook zeruje ją na pozostałych typach.

Fan-out: `/code-review` (diff-scoped), `comment-noise-audit` (flag-only), placement
(feature-first + cohesion + scatter), `primitive-reuse-scan`, `/simplify` (simplification +
altitude). Odpadły: `/10x-impl-review` (brak `plan.md`), `tailwind-v4-audit` (zero stylów).

## Findings

- [x] dismissed · code-review · `src/components/forms/deposit-form/deposit-form.tsx:82` · wpłata trzyma domyślne „Gotówka", więc nowa reguła wymagalności tam nie strzela — to świadomy, wcześniejszy stan: przy wpłacie metoda JEST planem, a plan domyślnie jest netto. Zmiana zachowania poza zakresem tego slice'a (i wymaga decyzji właściciela, nie review).
- [x] dropped · placement · `src/__tests__/transfer-table.test.ts` · brak case'u na `null` w renderze komórki — mapowanie na `null` jest już pokryte w `transfer-mapping.test.ts`, a sama komórka to `label ?? '—'`; nie warte osobnego testu
- [x] dismissed · code-review · `src/migrations/20260827_0_payment_method_nullable.ts` · kolejność deploya (additive → migracja na prod PRZED wypchnięciem kodu) potwierdzona; okno przejściowe bezpieczne w obie strony

- [x] skipped · altitude+simplify+reuse · `src/components/forms/deposit-form/deposit-form.tsx:143` · formularz wpłat nie przechodzi przez `staleFieldsForType`, więc kasuje metodę dopiero przy submit — wpięcie helpera zapisałoby do formularza klucze, których `DepositFormValuesT` nie ma (`targetRegister`/`worker`/`settled`), i dotyka listenera z równolegle toczącą się robotą nad `vatPlane`. Realne, ale to osobna zmiana.
- [x] dropped · reuse-scan · `src/lib/schemas/transfer.ts:18` · `z.enum(PAYMENT_METHODS).nullish()` trzy razy — wyciągnięcie aliasu nic nie kupuje poza trzymaniem trójki w zgodzie
- [x] dropped · simplify · `src/components/forms/deposit-form/deposit-form.tsx:143` · trzy sąsiednie linie testują ten sam warunek raz predykatem, dwa razy literałem — predykat jest tu semantycznie właściwy, ujednolicanie to kosmetyka
- [x] dropped · altitude · `src/lib/constants/transfers.ts:474` · predykat stoi nad bannerem „Field-rule predicates" — trzyma się rodziny `carries*`, przeniesienie to czysta kosmetyka

## Simplify pass

Ran /simplify (simplification + altitude angles) + `primitive-reuse-scan` — 4 applied, 0 proposed,
5 dismissed/dropped, 1 skipped; every finding folded into `## Findings` above. Raporty agentów nie
zostały zapisane do plików — findingi przepisane tutaj w całości.

## Tests & suite

Szybkie nogi na życzenie użytkownika (bez e2e i build):

- `pnpm typecheck` — zielony.
- `pnpm lint` — brak błędów w plikach tego slice'a. Dwa błędy w repo są cudze i wcześniejsze:
  `src/hooks/use-status-filter.ts:56` (równoległa robota) i `test.js:284` (plik-śmieć w korzeniu).
- `pnpm exec vitest run src/__tests__` — 2990 zielonych, 173 pominiętych, 0 czerwonych.
- `pnpm test:e2e` + `pnpm build` — odłożone decyzją użytkownika.

E2E: niewinny. Warunek renderu to jeden predykat, którego tabela prawdy, hook i oba schematy mają
testy; decyzja użytkownika 2026-08-27.

_Trimmed at archive (2026-09-02): 12 `fixed` finding(s) removed — a fixed finding's durable record is its commit; what survives is the negative space git cannot hold. Pre-trim tally: 12 fixed, 7 other, 0 open._
