# Review-gate ledger — katalog-nadpisanie-kategorii · 2026-09-01

Zakres: commity `a95f9a04` (serwer) + `f0b1a190` (dialog). Trzy pliki kodu —
`src/lib/actions/work-catalogue.ts`, `src/__tests__/lib/actions/work-catalogue-save.test.ts`,
`src/components/kosztorys/editor/dialogs/save-item-to-catalogue-dialog.tsx` — plus dokumenty zmiany.

Wachlarz przycięty proporcjonalnie do trzyplikowego diffu: `/10x-impl-review`, `/code-review`,
`comment-noise-audit`. Odpadły: `feature-first-structure` / `module-cohesion-audit` /
`structure-scatter-audit` (slice nie zakłada ani nie przenosi żadnego pliku kodu),
`tailwind-v4-audit` (jedyny nowy `className` to wiersz `label` skopiowany bajt w bajt
z `client-view-settings-form.tsx`, bez tokenów i bez wartości arbitralnych).

Step 0.5 przebiegł NIE na swoim miejscu, tylko po fan-oucie — przy Step 0 przeoczyłem, że skill
`verify-manual-checks` żyje w `.claude/skills/` repo, nie w globalnych. Kolejność wyszła więc
odwrotna do zamierzonej (przegląd → naprawy → weryfikacja), co akurat tym razem zadziałało na
korzyść: pass jechał już po naprawionym nagłówku i potwierdził go wprost.

Właściciel przeszedł ręcznie jeden przypadek (kategorie identyczne, potwierdzony zrzutem ekranu),
pozostałe pięć przejechał dyspozycjonowany agent w przeglądarce na bazie testowej 5435
(inw. 90 „kosztorys wzór", pozycja „Zakup, transport i wniesienie towaru budowlanego…"):
**6/6 zielone, zero findingów, zero napraw**. Sprawdzenie nr 3 potwierdziło naprawę F1 wprost —
szara linijka czyta `kpl` przy nadpisaniu i `kpl · Prace dodatkowe` przy tworzeniu nowej pozycji.

## Findings

- [x] 🟡 WARNING · fixed · impl-review + code-review · `save-item-to-catalogue-dialog.tsx:143` ·
      szara linijka nagłówka nadal renderowała `preview.candidate.category` bezwarunkowo, więc przy
      nadpisaniu z zaznaczonym przełącznikiem dialog mówił dwie sprzeczne rzeczy naraz („· Hydraulika"
      w nagłówku, „Kategoria: Łazienka" w „Po zapisie") — i była to jawna rozbieżność z kontraktem
      plan.md Phase 2 §1. Fix: sufiks kategorii tylko w przypadku tworzenia nowej pozycji.
      test: no automated test · manual — repo nie ma harnessu do renderu komponentów; zamiast tego
      doszło szóste ręczne sprawdzenie wprost o tę linijkę (`manual-checks.md`).
- [x] 🟡 WARNING · fixed · impl-review · `save-item-to-catalogue-dialog.tsx:161` · wiersz `label` +
      `Checkbox` skopiowany bajt w bajt z prywatnego `CheckboxRow` w `client-view-settings-form.tsx`.
      Fix: promocja do `src/components/ui/checkbox-row.tsx`, oba dialogi renderują jeden komponent.
      (Dedup nigdy nie jest „poza zakresem" — sięgnięcie do sąsiedniego pliku było wliczone.)
- [x] 🟡 WARNING · fixed · impl-review · `review-gate.md` vs `manual-checks.md` · ledger twierdził,
      że właściciel odklikał wszystkie pięć sprawdzeń, podczas gdy potwierdził jeden przypadek.
      Fix: pięć boxów wróciło na `[ ]`, potwierdzony został z notatką, ledger mówi prawdę.
- [x] 🔵 OBSERVATION · fixed · impl-review · `manual-checks.md` · z planu wypadło sprawdzenie
      „pozycja bez kategorii". Fix: zamiast checka na oko — dziewiąty przypadek w
      `work-catalogue-save.test.ts` asercjujący, że pusta kategoria w katalogu przeżywa nadpisanie
      jako `NULL` (sekcja o nazwie samego numeru → `stripSectionOrdinal` zwraca puste).
      test: TDD · integration — najtańsza warstwa, która to widzi; utrwalony wiersz, nie return.
- [x] 🔵 OBSERVATION · fixed · code-review + impl-review ·
      `save-item-to-catalogue-dialog.tsx:95` · `??` nie składa `''` z `null`, więc wiersz z pustym
      stringiem wstawionym przez panel Payloada pokazałby przełącznik między dwoma „bez kategorii".
      Fix: `|| null` po obu stronach; martwe `?? null` przy okazji zniknęło.
- [x] 🔵 OBSERVATION · dismissed · code-review · `work-catalogue.ts:236` · przełącznik jest
      ignorowany na ścieżce create-after-race. Benign z definicji: gdy wiersz zniknął między
      podglądem a potwierdzeniem, nie ma żadnej kategorii do zostawienia — `candidate.category` to
      jedyna, jaka istnieje. Plan tę gałąź świadomie wyłączył.
- [x] 🔵 OBSERVATION · fixed · impl-review · `save-item-to-catalogue-dialog.tsx:31` · `rows`
      straciło typowanie krotką przy dołożeniu spreadu. Fix: jawne `[string, string, boolean][]`,
      trzecie pole niesie przy okazji `tabular-nums` (kategoria to tekst, nie kwota — osobne
      znalezisko code-review, złożone w ten sam edit).
- [x] fixed · comment-noise · `save-item-to-catalogue-dialog.tsx:94` · komentarz nad
      `categoryDiffers` powtarzał kod. Zastąpiony tym, czego kod nie mówi: dlaczego `||`, nie `??`.
- [x] fixed · comment-noise · `save-item-to-catalogue-dialog.tsx:19` + `work-catalogue-save.test.ts:33,210`
      · trzy komentarze przycięte do samego „dlaczego" (narracja i powtórzenia nazw testów wycięte).
- [x] fixed · comment-noise · `save-item-to-catalogue-dialog.tsx:64` · z komentarza o braku efektu
      synchronizującego `keepCategory` wypadła druga połowa — code-review wykazał, że opisywała
      sekwencję nieosiągalną (checkbox renderuje się dopiero po rozwiązaniu podglądu).
- [x] fixed · comment-noise · `work-catalogue.ts:210` · ostatnie zdanie akapitu powtarzało zdanie
      dwie linijki wyżej; skrócone do „Reclassifying has to be asked for.".

## Simplify pass

Bez osobnego fan-outu `/simplify` — świadome odstępstwo, proporcjonalne do trzyplikowego diffu,
który przed chwilą przeczesały trzy niezależne przeglądy. Kąty, które `/simplify` bada (reuse,
uproszczenie, wydajność, wysokość), pokrył ten fan-out i wszystkie jego znaleziska zostały
zastosowane serialnie w wątku głównym: promocja `CheckboxRow` (reuse), przywrócone typowanie krotką
i `|| null` (uproszczenie), przycięte komentarze. `primitive-reuse-scan` nie uruchamiany z tego
samego powodu — jedynym nowym prymitywem był wiersz checkboxa, który właśnie zdedupowano.
Bilans: 9 zastosowanych, 0 wstrzymanych, 1 odrzucone.

## Tests & suite

- Po naprawach z bramki: `work-catalogue-save.test.ts` **9/9** ✅ (doszedł przypadek pustej
  kategorii), `pnpm typecheck` ✅, `pnpm test` 3145 ✅, `pnpm build` ✅, `pnpm lint` bez
  zastrzeżeń w plikach slice'a (4 zastane błędy w `(legal)/*` i w skrypcie — nietknięte).
- Ręczna weryfikacja: 6/6, `context/foundation/manual-checks.md`, sekcja
  `katalog-nadpisanie-kategorii`.
- E2E: slice nie zaciąga długu E2E — cała zmiana to jedno pole na drucie i cztery wiersze w
  dialogu, a ryzyko utrwalenia kategorii pilnuje spec integracyjny na prawdziwej bazie.
- Bramka całego drzewa przebiegła na koniec `/10x-implement`: `pnpm typecheck` ✅,
  `pnpm test` 3145 ✅, `pnpm build` ✅. `pnpm lint` — 4 błędy, wszystkie zastane i spoza slice'a
  (`(legal)/privacy|terms|usuwanie-danych` → `<a>` zamiast `<Link>`, `no-undef` na `console`
  w skrypcie).
