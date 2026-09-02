# Plan brief — EX-766, subcontractor override collapse

**What.** Four columns become two. `w_tools_override_type` / `own_tools_override_type` disappear;
`w_tools_override_value` / `own_tools_override_value` become nullable. `NULL` = auto, a number =
a kwota, `0` = an explicit 0 zł kwota.

**Why.** The type union has had one member since 2026-09-01, so the discriminator discriminates
nothing. The real reason is sharper: a mode change persists as **two independent concurrent
single-key writes**, so `{type: null, value: 500}` — an auto row secretly holding a kwota — is
reachable and durable, and `/admin` reaches it directly. One field makes that state unspellable.

**Cost.** One migration touching 3671 rows across 11 investments, plus two `DELETE`s. Roughly 20
source files and 16 specs.

**Five phases.**

0. **Golden master, own commit.** Regenerate on a fresh `db-test`. The fixture is from 2026-08-28,
   when prod held zero kosztorys rows, so all eleven real kosztorys investments currently sit in the
   `dataMoved` skip set — their money is compared against nothing. That is ~46k zł of robocizna
   passing through the refactor unguarded.
1. **One red test.** „Brak ceny wykonawcy" fires on an explicit `0` and not on auto. Written in the
   target shape, so it does not compile — that is its red.
2. **The collapse, atomic.** Migration, types, pricing, the należność SQL, `insert-rows`, the Payload
   collection, the action schema, the grid, the catalogue round-trip, the sheet import, and the two
   shared fixture helpers. Not subdividable: a type change crosses every layer at once. Three traps
   live here — the `coalesce(…, 0)` in SQL, `defaultValue: 0` in Payload, and `nullable()` having to
   wrap the coercion rather than follow it.
3. **Test sweep.** ~16 mechanical fixture rewrites, one deliberate deletion of the dead `'coeff'`
   spec, and the golden-master hash rewritten to emit the legacy bytes as literals so no fingerprint
   moves and `test:parity` runs with no regeneration.
4. **Preview, then production.** `db:migrate:preview` on staging after the deploy is live; production
   by a human afterwards.

**Settled, not reopened.** The „Źródło ceny wykonawcy" column stays — it becomes one write instead of
two, but it stays visible. Decided 2026-09-01, reaffirmed 2026-09-02, rationale now in
`context/reference/kosztorys-editor-domain-notes.md`.

**Deploy order.** Deploy first, migrate second. New code against an unmigrated schema reads fine; the
only window cost is a loud `23502` on a "clear to auto" write, and nobody is entering data. Residual
risk accepted: a Vercel rollback after the migration breaks `/k/[token]` with 42703.

**Baza to `snapshot-retention-thinning`, nie `staging`.** Tamta zmiana wniosła `itemWithColumnDefaults`
z `?? 0` na obu polach override — trzecie miejsce tej samej pułapki. Faza 2 dostała krok 11.

Full plan: `plan.md`. Research and owner decisions: `research.md`.
