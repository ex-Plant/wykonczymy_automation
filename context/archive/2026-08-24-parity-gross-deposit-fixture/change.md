---
change_id: parity-gross-deposit-fixture
title: Parity fixture — wpłaty brutto w db-test i podłoga zbioru w bramce (EX-725)
status: archived
created: 2026-08-24
updated: 2026-09-02
archived_at: 2026-09-02T08:05:52Z
branch: null
worktree: null
---

## Notes

EX-725: fixture w `db-test` nie ma ani jednej wpłaty brutto (221 × `INVESTOR_DEPOSIT`, wszystkie
`vat_plane IS NULL` / `net_amount IS NULL`), więc `pnpm test:parity` sprawdza tylko ścieżkę
gotówkową. Do zrobienia: dosiać wpłaty brutto (z kwotą netto z faktury i co najmniej jedną bez —
most legacy), dołożyć podłogę zbioru w bramce, opisać rozszerzony kontrakt
`db:import:test` + seed w AGENTS.md.

Źródło: bramka `mixed-settlement-both-planes` (faza F8 / code-review #3).
