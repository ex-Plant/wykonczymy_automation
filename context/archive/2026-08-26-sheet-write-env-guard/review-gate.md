# Review-gate ledger — sheet-write-env-guard · 2026-08-27

Zakres: `3b8f3bfd` (dwa konta usługi) na tle `d09c59c9`…`60d4a31b` (poprzednia, zastąpiona
bramka na fladze). Pliki kodu: `src/lib/google/{auth,sheets,sheet-access}.ts`,
`src/lib/env/schema.ts`, `scripts/share-sheets-with-reader.mjs`, cztery speki, `AGENTS.md`.
Poza zakresem: `src/components/forms/edit-transfer-form/edit-transfer-form.tsx` (cudza zmiana,
weszła w `548f9693`).

Step 0.5 (przejazd przeglądarkowy) **pominięty** — slice nie rusza ani jednego komponentu ani
ścieżki UI; jest to wyłącznie warstwa poświadczeń. Weryfikacja ręczna pozostaje należna i żyje jako
sekcja `## sheet-write-env-guard` w `context/foundation/manual-checks.md` (6 nieodhaczonych boxów) —
manualne checki nie blokują archiwizacji (odwrócenie z 2026-07-28), ale rejestr zostaje.

## Findings

_Znaleziska `fixed` (18) wycięte przy archiwizacji — fix jest już kodem. Zostają decyzje._

- [x] dismissed · `simplify` · `scripts/share-sheets-with-reader.mjs:20-32` · Skrypt sam parsuje
      poświadczenie zamiast wołać `createWriteServiceAccountJWT`. Zamierzone: potrzebuje zakresu
      **Drive**, którego `auth.ts` nie wystawia; wciągnięcie go tam wymagałoby konwersji skryptu na TS
      albo uogólnienia `auth.ts` w generyczną fabrykę JWT.
- [x] 🔵 OBSERVATION · dropped · `code-review` · `scripts/share-sheets-with-reader.mjs:37-41` ·
      `permissions.list` bez paginacji. Osiągalne dopiero przy liście uprawnień dłuższej niż strona —
      te arkusze mają po kilka wpisów. Nie warte kodu.
- [x] 🟡 WARNING · skipped · `impl-review` · `src/lib/env/schema.ts:90-94` ·
      Brak odmowy w drugą stronę (wzorzec `blobTokenRefusal`: odmów, gdy poświadczenie Edytora pojawi się
      poza produkcją). Świadomie **nie** — furtka „własne konto Edytora do własnego arkusza testowego"
      jest jedyną drogą pracy nad zapisem lokalnie i jest udokumentowana w `manual-checks.md`; ta odmowa
      by ją zamknęła. Powód trafia do przepisanego planu, sekcja „czego NIE robimy".
- [x] 🟡 WARNING · skipped · `code-review` · `src/lib/google/sheet-access.ts:46-51` ·
      Pominięta sonda zmienia kontrakt z „konto MOŻE edytować" na „konto może czytać", a wołający dalej
      czyta prawdę jako dowód Edytora → dialog melduje sukces, mimo że `stampAllTabs` padło non-fatal.
      Realne, ale to **zamierzona** degradacja: alternatywą jest zablokowanie podpinania arkusza poza
      produkcją, czyli lokalnego rozwoju. Zaostrzenie tego kontraktu to osobna decyzja produktowa.
- [x] 🔵 OBSERVATION · dismissed · `impl-review` · `.env.bak-085939`, `.env.bak-before-reader-080955` ·
      Zarzut, że kopie `.env` wciąż niosą klucz prywatny Edytora — **nieprawdziwy**. Linia została
      zredagowana wcześniej tej samej sesji; `grep -c private_key` = 0 w obu. Potwierdził to niezależnie
      `code-review`.
- [x] filed **EX-746** · `module-cohesion` · `src/lib/google/sheets.ts:305-631` ·
      `setupTab` to 327 linii (połowa modułu), z czego ~250 to czyste budowanie `Schema$Request[]`, które
      dałoby się wyjąć do `sheet-tab-layout.ts` i testować bez mocka `googleapis`. Poprzedza slice, wielkość
      własnego review — `EX-746`.

## Simplify pass

Ran /simplify (cztery kąty równolegle) — **3 applied, 0 proposed, 1 dismissed**; każde znalezisko
złożone do `## Findings` z tagiem `simplify`. Kąty **reuse**, **efficiency** i **altitude** wróciły
czyste: diff sam jest dedupem (`createJWT`, `isServiceAccountJson`, wspólny fixture poświadczeń),
przewleczenie klienta do `readGrid` **zmniejsza** liczbę bitych tokenów na cykl zapisu z dwóch do
jednego, a wydzielenie `writable-sheets-client.ts` jest uogólnieniem, nie przypadkiem szczególnym.

Raport: `/var/folders/cf/bs0zn0gj1lgbc2n7ps0z211h0000gn/T/simplify-XXXXXX.eNlaE6A8OM.md`

## Tests & suite

Strażniki regresji dla znalezisk correctness napisane w Step 1, przed `/simplify` (asercje na
zachowaniu obserwowalnym, więc przeżyły przeorganizowanie wnętrza):

- `src/__tests__/lib/google/auth.test.ts` (**nowy**, 3 testy) — adres pod „jako Edytujący" to konto
  piszące, także przy braku poświadczenia. Strażnik obu 🔴.
- `src/__tests__/lib/google/sheet-access.test.ts` (**nowy**, 4 testy) — obie gałęzie sondy + `extractSheetId`.
- `src/__tests__/lib/google/sheets-write-credential.test.ts` — asercja przepisana: ścieżka zapisu bije
  **jeden** token, na tożsamość Edytora, i **nie** bije readonly. Strażnik 🟡 dwukontowego zapisu.
- `src/__tests__/lib/env/schema.test.ts` — +4 testy na `.refine()` poświadczenia Edytora.
- `src/__tests__/helpers/google-credentials.ts` (**nowy**) — wspólny fixture zamiast wklejki w czterech spekach.

Brak długu E2E: slice nie rusza ani jednego komponentu ani ścieżki przeglądarkowej, a `pnpm test:e2e`
z definicji nie niesie poświadczenia Edytora — powód zapisany w `plan.md` → Testing Strategy.

Brama całodrzewowa (`plan.md` → Whole-tree Gate), 2026-08-27:

| leg              | wynik                                                                                                                                                                                                                                                                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck` | ✅ czysto                                                                                                                                                                                                                                                                                                                                   |
| `pnpm test`      | ✅ 213 plików / 2920 testów zielonych (50 plików skipped)                                                                                                                                                                                                                                                                                   |
| `pnpm build`     | ✅ exit 0                                                                                                                                                                                                                                                                                                                                   |
| `pnpm lint`      | ⚠️ 85 warningów + **1 błąd**: `test.js:284 no-undef` — plik-brudnopis w korzeniu repo, **gitignorowany i nieśledzony**, nie należy do slice'a i nie da się go zacommitować. Bramka była czerwona z tego powodu przed slicem i jest po nim; 9 błędów `no-undef` z `share-sheets-with-reader.mjs`, które slice dołożył, zostało naprawionych. |
| `pnpm test:e2e`  | ⏭️ nie uruchamiany — nie jest na liście bramy w planie, a slice nie ma powierzchni przeglądarkowej                                                                                                                                                                                                                                          |
