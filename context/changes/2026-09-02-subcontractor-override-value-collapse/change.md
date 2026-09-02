---
change_id: subcontractor-override-value-collapse
title: Collapse the subcontractor price override pair into `overrideValue: number | null`
status: implementing
created: 2026-09-02
updated: 2026-09-02
archived_at: null
branch: null
worktree: null
linear: EX-766
---

## Notes

Tracked as **EX-766**. Collapses the per-item subcontractor price override from a two-column pair
(`*_override_type` varchar `'amount'|NULL` + `*_override_value` numeric NOT NULL DEFAULT 0) into one
nullable number per tool plane: `NULL` = auto (derive from the investment coefficient), a number =
a fixed kwota, `0` = an explicit free-of-charge kwota.

Research: `research.md` (2026-09-02). Three facts reshaped the change relative to the issue as filed:

1. Production is **not** empty — 3671 `kosztorys_items` rows across 11 investments. The AGENTS.md
   throwaway-data carve-out was deleted the same day; a real backfill is owed.
2. The unauthenticated `/k/[token]` share link reads these columns, so the migration **splits in two
   across two deploys** (lessons.md:1482).
3. The load-bearing risk is not the columns but the **serialized payloads** — `kosztorys_presets`
   (1 curated global row) and `kosztorys_snapshots` carry `wToolsOverrideType` inside JSON, where
   `{type: null, value: 0}` would restore as an explicit `0 zł` instead of auto.

Second research pass (2026-09-02, appended to `research.md`) added a fourth:

4. The pair has a **representable state no single write can produce atomically** —
   `{type: null, value: nonzero}`, reachable because a mode change persists as two independent
   concurrent single-key patches. The collapse makes it unspellable. That, not tidiness, is the
   change's justification — and the migration's backfill must be
   `CASE WHEN type = 'amount' THEN value ELSE NULL END`, never bare `value`.

It also reversed two pass-one recommendations: stored payloads get a **read-time fold in TS**, not a
jsonb rewrite (auto-snapshots are written continuously, so a one-shot rewrite races the deploy), and
the golden-master hash is rewritten to emit the **legacy bytes as literals** so no fixture moves.

**Owner decisions (2026-09-02)** — recorded in `research.md` § Owner Decisions:
presets/snapshots are disposable test data, and nobody writes during the deploy window. Together they
drop the TS read-time fold (→ the affected blobs are simply **deleted** in the migration, superseding
both pass-one and pass-two recommendations above) and the two-migration split (→ **one migration,
applied after the deploy is live**). Accepted residual risk: a Vercel rollback after the migration
reintroduces 42703 on `/k/[token]`.

**Decyzje z rozmowy (2026-09-02), pełne uzasadnienia w `research.md` § Owner Decisions:**

- **Kolumna „Źródło" ZOSTAJE** — rozstrzygnięte 2026-09-01, nie otwieramy trzeci raz. Rationale
  przeniesione do `context/reference/kosztorys-editor-domain-notes.md`, bo archiwum okazało się
  nieosiągalne dla dwóch przebiegów researchu.
- **Bloby kasujemy, nie przepisujemy** — szablon (1) + snapshoty `auto` (5). Jedenaście pustych
  `manual` zostaje nietkniętych: mają zero pozycji, więc są odporne na zmianę, i to akurat one mają
  prawdziwą intencję odtworzenia. Właściciel wczyta szablon ponownie **po** deployu, więc nowy
  zserializuje się już zwiniętym kształtem.
- **Golden master regenerowany osobnym commitem PRZED zmianą** — bez tego jedenaście inwestycji
  z kosztorysem (czyli dokładnie te, których kwoty ta zmiana może ruszyć) przechodzi refaktor bez
  żadnej straży; ~46k zł robocizny mogłoby zniknąć na zielonym teście.

Plan: `plan.md` (2026-09-02) — five phases: golden-master regeneration on its own commit, one red
test proving `NULL ≠ 0`, the atomic collapse across every layer, the test sweep with the
byte-identical hash rewrite, then the preview rehearsal before a human runs production.

**Rebazowanie planu na `snapshot-retention-thinning` (2026-09-02).** Ta zmiana powstaje na gałęzi
zamkniętej zmiany o retencji snapshotów, nie na `staging`. Sprawdzone: 27 plików, z czego jeden ma
realny wpływ — `src/lib/kosztorys/snapshot-format.ts` wnosi `itemWithColumnDefaults` z `?? 0` na obu
polach override, czyli trzecie wystąpienie tej samej pułapki co `defaultValue: 0`. Dopisane jako
Faza 2 krok 11 wraz ze skurczeniem zbioru `TolerantT` (reguła z `lessons.md:780`). Retencja roczna
nie koliduje z D3 — przeciwnie, skasowanie snapshotów `auto` zdejmuje całą ekspozycję na odtwarzanie
starego kształtu przez rok.
