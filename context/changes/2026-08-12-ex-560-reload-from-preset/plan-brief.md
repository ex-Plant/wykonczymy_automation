# Plan Brief: Reload a kosztorys from a preset (EX-560)

**Full plan**: `plan.md`

## The change in one paragraph

Add „Wczytaj szablon…" to the kosztorys editor: replace an investment's whole rozpiska with a saved
preset, reversibly. The mechanism is already shipped for the Google-sheet import — a forced pre-wipe
`manual` snapshot plus `restoreKosztorys` inside one transaction — so this ports that shape onto a
preset payload rather than inventing a second destructive path.

## Scope

Swapping the szablon **at the start of an investment** — the wrong one picked at creation, or none.
That is the whole case. An earlier draft tried to make the reload safe on a mature rozpiska by
matching prace and carrying przedmiar and postęp across the swap; the owner rejected it as
over-engineering, because reloading a szablon onto a kosztorys with real work recorded against it
makes no business sense to begin with. Dropping the merge removed a whole phase.

## Why it isn't just `applyPreset`

`applyPreset` is insert-only by contract and `seedInvestmentFromPreset` refuses a non-empty target.
The reload instead takes the preset payload, swaps in `settings: currentTree.settings`, and hands it
to `restoreKosztorys` — exactly as `buildImportPlan` ends. One atomic wipe+insert in the codebase,
not two. With no merge there is no matching, no id remapping, no new domain logic at all.

## Phases

| #   | What                                                           | Ends with                                               |
| --- | -------------------------------------------------------------- | ------------------------------------------------------- |
| 1   | Dedup the triplicated cache-tag list                           | Typecheck                                               |
| 2   | `reloadFromPresetAction` — snapshot + replace, one transaction | Integration spec: persisted state + snapshot round-trip |
| 3   | Dialog (reuses the create-form preset `<Select>`) + menu entry | Manual checks; E2E authored or filed at the review gate |

## Settled by the owner

Preset stays a separate fast path · no "effectively empty" gate · VAT / coefficients / global
discount untouched · everything else replaced, nothing carried over · one plain confirm, no
escalated warning.

## Risks

- The only real risk is that the promised undo doesn't restore — that is what Phase 2's spec pins.
- No schema change, no migration, no data-preservation path owed (kosztorys rows are throwaway
  pre-dogfooding).
