Replace reference data dropdowns with searchable combobox — sidebar fetches all users/investments/categories upfront with `pagination: false`. This won't scale past ~100-200 records. Switch to a search-as-you-type combobox with server-side filtering (debounced Payload query on keystroke) for: workers, investments, cash registers, other categories.

**[URGENT]** Optimize saldo/balance computation — multiple places fetch all transactions with `limit: 0` and reduce in JS:

1. **`recalculate-balances.ts` (hooks)** — runs on EVERY transaction create/update/delete. `recalcRegisterBalance` fetches all transactions for a cash register, `recalcInvestmentCosts` fetches all cost transactions for an investment. Most urgent — runs on writes, not just reads.
2. **`getEmployeeSaldo`** — fetches all ADVANCE + EMPLOYEE_EXPENSE for a worker on dashboard load.
   Fix: replace with SQL `SUM` via `payload.db.drizzle.execute(sql\`...\`)`. Requires adding `drizzle-orm` as a direct dependency. Alternative for hooks: incremental delta updates (add/subtract amount instead of full recalc), but riskier if data drifts.

Rozliczenia i nie tylko
gotowka - zawsze default
wybierz kasę- dany majster ma tylko swoja
kokpit majstra - widzi tylko swoja kase
swoje transakcje
nie widzi uzytkownikow
czy manager / majster może dodawać użytkowników / pracowników / inwestycje

Kto ma mieć wgląd do faktur

Jakiś widok z fakturami ?
Z opcją pobrania etc. ?

Napisz mi czy użytkownik o roli manager(majster - kasa Adrian):

- widzi inne kasy
- widzi transakcje z innych kas
- może dodawać pracowników / podwykonawców
- może dodawać inwestycje
