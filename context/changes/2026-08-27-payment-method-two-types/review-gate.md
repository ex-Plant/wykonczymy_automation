# Review-gate ledger — payment-method-two-types · 2026-08-27

Slice: metoda płatności pytana tylko na `INVESTOR_DEPOSIT` i `INVESTMENT_EXPENSE_NET`;
`transactions.payment_method` staje się nullowalna, hook zeruje ją na pozostałych typach.

Fan-out: `/code-review` (diff-scoped), `comment-noise-audit` (flag-only), placement
(feature-first + cohesion + scatter), `primitive-reuse-scan`, `/simplify` (simplification +
altitude). Odpadły: `/10x-impl-review` (brak `plan.md`), `tailwind-v4-audit` (zero stylów).

## Findings

- [x] 🟡 WARNING · fixed · code-review · `src/lib/queries/transfers.ts:165` · wiersz anulowania przestał pokazywać metodę oryginału (kolumna „—") — `enrichCancellationOriginals` nie pożyczał `paymentMethod`, choć akcja przestała go kopiować
      test: test-driven-debugging · unit — pokryte przez `transfer-filters.test.ts` na bliźniaczej ścieżce filtra; sam merge display'owy jest jednolinijkowym `?? null` obok sześciu identycznych
- [x] 🟡 WARNING · fixed · code-review · `src/lib/queries/transfer-filters.ts:200` · filtr „Metoda" gubił wszystkie anulowania — `paymentMethod` nie był w `FIELDS_ONLY_THE_ORIGINAL_CARRIES`, więc `IN ('CASH')` nigdy nie trafiał w NULL audytu; komentarz obok kłamał, że metoda jest kopiowana
      test: test-driven-debugging · unit — `re-aims a metoda scope at the original` w `src/__tests__/lib/queries/transfer-filters.test.ts`
- [x] 🟡 WARNING · fixed · code-review · `src/hooks/transfers/validate.ts:174` · edycja dowolnego pola kasowała metodę starego wiersza (hook zerował bezwarunkowo, a `planeFillIn` zawsze odsyłał zapisaną wartość) — sprzeczne z obietnicą migracji „historia zostaje"
      test: test-driven-debugging · unit — `leaves a stored method alone when the update does not name one` w `validate-hook.test.ts`
- [x] fixed · scatter · `src/lib/transfers/clear-fields-for-type.ts:26` · drugi dom dla „wyczyść, czego typ nie niesie" — `paymentMethod` dopisany do `CARRIED_BY`/`EMPTY_VALUE`, ternary w `expense-form.tsx` zniknął
- [x] fixed · comment-noise · `src/components/forms/deposit-form/deposit-form.tsx` · komentarz wskazujący na komentarz cztery linie niżej — usunięty
- [x] fixed · comment-noise · `src/__tests__/transfer-constants.test.ts` · trzecia kopia tego samego akapitu nad `trueFor` — usunięta
- [x] fixed · comment-noise · `src/migrations/20260827_0_payment_method_nullable.ts:11` · zdanie narratorskie o treści `down` — przycięte
- [x] fixed · comment-noise · `src/types/transfers.ts:29` · „the forms never ask it" było węższe niż prawda (hook zeruje każdemu piszącemu) — poprawione
- [x] dismissed · code-review · `src/components/forms/deposit-form/deposit-form.tsx:82` · wpłata trzyma domyślne „Gotówka", więc nowa reguła wymagalności tam nie strzela — to świadomy, wcześniejszy stan: przy wpłacie metoda JEST planem, a plan domyślnie jest netto. Zmiana zachowania poza zakresem tego slice'a (i wymaga decyzji właściciela, nie review).
- [x] dropped · placement · `src/__tests__/transfer-table.test.ts` · brak case'u na `null` w renderze komórki — mapowanie na `null` jest już pokryte w `transfer-mapping.test.ts`, a sama komórka to `label ?? '—'`; nie warte osobnego testu
- [x] dismissed · code-review · `src/migrations/20260827_0_payment_method_nullable.ts` · kolejność deploya (additive → migracja na prod PRZED wypchnięciem kodu) potwierdzona; okno przejściowe bezpieczne w obie strony

- [x] fixed · reuse-scan · `src/lib/queries/transfers.ts:159` · dwie ręcznie utrzymywane kopie listy „pól, które niesie tylko oryginał" — `enrichCancellationOriginals` jedzie teraz z eksportowanego `FIELDS_ONLY_THE_ORIGINAL_CARRIES`; ten slice właśnie złapał je rozjechane
- [x] fixed · altitude · `src/hooks/transfers/validate.ts:170` · komentarz uzasadniał bramkę „typ jest zamrożony", co unieważniałoby cztery bezwarunkowe stripy obok — teraz podaje prawdziwy powód (legacy dane bez backfillu)
- [x] fixed · simplify · `src/components/tables/transfers.tsx:169` · `?? method` nieosiągalne po zwężeniu typu — usunięte
- [x] fixed · simplify · `src/__tests__/lib/transfers/clear-fields-for-type.test.ts` · nowy case dublował ostrzejszą asercję `toEqual` trzy linie wyżej — usunięty
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
